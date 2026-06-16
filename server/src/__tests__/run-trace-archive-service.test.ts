import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  agents,
  companies,
  createDb,
  heartbeatRuns,
  instanceSettings,
  runTraceArchives,
} from "@paperclipai/db";
import * as feedbackModule from "../services/feedback.js";
import { buildRunTraceBundleForRunId } from "../services/feedback.js";
import { instanceSettingsService } from "../services/instance-settings.js";
import { runTraceArchiveService } from "../services/run-trace-archive.js";
import { startEmbeddedPostgresTestDatabase } from "./helpers/embedded-postgres.js";

async function closeDbClient(db: ReturnType<typeof createDb> | undefined) {
  await db?.$client?.end?.({ timeout: 0 });
}

describe.sequential("runTraceArchiveService", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof runTraceArchiveService>;
  let settings!: ReturnType<typeof instanceSettingsService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    const started = await startEmbeddedPostgresTestDatabase("paperclip-run-trace-archive-");
    db = createDb(started.connectionString);
    svc = runTraceArchiveService(db);
    settings = instanceSettingsService(db);
    tempDb = started;
  }, 120_000);

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await db.delete(runTraceArchives);
    await db.delete(heartbeatRuns);
    await db.delete(agents);
    await db.delete(companies);
    await db.delete(instanceSettings);
  });

  afterAll(async () => {
    await closeDbClient(db);
    await tempDb?.cleanup();
  });

  async function seedCompanyAndRun(input?: { resultJson?: Record<string, unknown> }) {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const runId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Archive Test Co",
      issuePrefix: `A${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "test-agent",
      role: "engineer",
      adapterType: "cursor_local",
      adapterConfig: {},
    });
    await db.insert(heartbeatRuns).values({
      id: runId,
      companyId,
      agentId,
      status: "succeeded",
      invocationSource: "on_demand",
      finishedAt: new Date(),
      resultJson: input?.resultJson ?? { summary: "done" },
      contextSnapshot: {},
    });

    return { companyId, agentId, runId };
  }

  it("archives only allowlisted companies from instance settings", async () => {
    const allowed = await seedCompanyAndRun();
    const blocked = await seedCompanyAndRun();

    await settings.updateExperimental({
      runTraceArchiveCompanyIds: [allowed.companyId],
    });

    const archived = await svc.notifyRunTerminalStatus({
      id: allowed.runId,
      companyId: allowed.companyId,
      agentId: allowed.agentId,
      status: "succeeded",
      contextSnapshot: {},
    });
    const skipped = await svc.notifyRunTerminalStatus({
      id: blocked.runId,
      companyId: blocked.companyId,
      agentId: blocked.agentId,
      status: "succeeded",
      contextSnapshot: {},
    });

    expect(archived?.runId).toBe(allowed.runId);
    expect(skipped).toBeNull();
  });

  it("prefers RUN_TRACE_ARCHIVE_COMPANY_IDS env override over instance settings", async () => {
    const { companyId, agentId, runId } = await seedCompanyAndRun();
    const otherCompanyId = randomUUID();

    await settings.updateExperimental({
      runTraceArchiveCompanyIds: [otherCompanyId],
    });
    vi.stubEnv("RUN_TRACE_ARCHIVE_COMPANY_IDS", companyId);

    const archived = await svc.notifyRunTerminalStatus({
      id: runId,
      companyId,
      agentId,
      status: "succeeded",
      contextSnapshot: {},
    });

    expect(archived?.companyId).toBe(companyId);
  });

  it("is idempotent per run id", async () => {
    const { companyId, agentId, runId } = await seedCompanyAndRun();
    await settings.updateExperimental({ runTraceArchiveCompanyIds: [companyId] });

    const first = await svc.notifyRunTerminalStatus({
      id: runId,
      companyId,
      agentId,
      status: "succeeded",
      contextSnapshot: {},
    });
    const second = await svc.notifyRunTerminalStatus({
      id: runId,
      companyId,
      agentId,
      status: "succeeded",
      contextSnapshot: {},
    });

    expect(first?.id).toBeTruthy();
    expect(second).toBeNull();

    const rows = await db.select().from(runTraceArchives).where(eq(runTraceArchives.runId, runId));
    expect(rows).toHaveLength(1);
  });

  it("retries pending archives and marks ready when bundle build succeeds", async () => {
    const { companyId, agentId, runId } = await seedCompanyAndRun();
    await settings.updateExperimental({ runTraceArchiveCompanyIds: [companyId] });

    await svc.notifyRunTerminalStatus({
      id: runId,
      companyId,
      agentId,
      status: "succeeded",
      contextSnapshot: {},
    });

    const results = await svc.flushPendingArchives();
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("ready");

    const row = await db
      .select()
      .from(runTraceArchives)
      .where(eq(runTraceArchives.runId, runId))
      .then((rows) => rows[0]);
    expect(row?.status).toBe("ready");
    expect(row?.bundleSnapshot).toBeTruthy();
  });

  it("marks archive failed after max attempts", async () => {
    const { companyId, agentId, runId } = await seedCompanyAndRun();
    await settings.updateExperimental({ runTraceArchiveCompanyIds: [companyId] });

    await svc.notifyRunTerminalStatus({
      id: runId,
      companyId,
      agentId,
      status: "succeeded",
      contextSnapshot: {},
    });

    vi.spyOn(feedbackModule, "buildRunTraceBundleForRunId").mockResolvedValue(null);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await svc.flushPendingArchives();
    }

    const row = await db
      .select()
      .from(runTraceArchives)
      .where(eq(runTraceArchives.runId, runId))
      .then((rows) => rows[0]);
    expect(row?.status).toBe("failed");
    expect(row?.attemptCount).toBe(5);
  });

  it("prunes old successful archives using retention settings", async () => {
    const { companyId, agentId, runId } = await seedCompanyAndRun();
    await settings.updateExperimental({
      runTraceArchiveCompanyIds: [companyId],
      runTraceArchiveSucceededRetentionDays: 7,
    });

    await db.insert(runTraceArchives).values({
      companyId,
      runId,
      agentId,
      runStatus: "succeeded",
      status: "ready",
      bundleVersion: "paperclip-run-trace-v1",
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
      updatedAt: new Date("2020-01-01T00:00:00.000Z"),
      archivedAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    const result = await svc.pruneExpiredArchives({ now: new Date("2026-06-16T00:00:00.000Z") });
    expect(result.prunedCount).toBe(1);

    const rows = await db.select().from(runTraceArchives).where(eq(runTraceArchives.runId, runId));
    expect(rows).toHaveLength(0);
  });
});

describe.sequential("buildRunTraceBundleForRunId redaction", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    const started = await startEmbeddedPostgresTestDatabase("paperclip-run-trace-redaction-");
    db = createDb(started.connectionString);
    tempDb = started;
  }, 120_000);

  afterEach(async () => {
    await db.delete(heartbeatRuns);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await closeDbClient(db);
    await tempDb?.cleanup();
  });

  it("redacts secret-like values from run resultJson in archive bundles", async () => {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const runId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Redaction Co",
      issuePrefix: "RC",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "redaction-agent",
      role: "engineer",
      adapterType: "cursor_local",
      adapterConfig: {},
    });
    await db.insert(heartbeatRuns).values({
      id: runId,
      companyId,
      agentId,
      status: "succeeded",
      invocationSource: "on_demand",
      finishedAt: new Date(),
      resultJson: {
        summary: "Used api_key=super-secret-value in output",
      },
      contextSnapshot: {},
    });

    const bundle = await buildRunTraceBundleForRunId(db, { companyId, runId });
    expect(bundle).toBeTruthy();
    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toContain("super-secret-value");
  });
});
