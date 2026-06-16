import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRunTraceArchiveService = vi.hoisted(() => ({
  listArchives: vi.fn(),
  getArchiveById: vi.fn(),
  getArchiveBundle: vi.fn(),
}));

vi.mock("../services/run-trace-archive.js", () => ({
  runTraceArchiveService: () => mockRunTraceArchiveService,
}));

async function createApp(
  actor: Record<string, unknown> = {
    type: "board",
    userId: "user-1",
    companyIds: ["company-1"],
    source: "session",
    isInstanceAdmin: false,
  },
) {
  vi.resetModules();
  const [{ errorHandler }, { runTraceArchiveRoutes }] = await Promise.all([
    import("../middleware/index.js") as Promise<typeof import("../middleware/index.js")>,
    import("../routes/run-trace-archives.js") as Promise<typeof import("../routes/run-trace-archives.js")>,
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      ...actor,
      companyIds: Array.isArray(actor.companyIds) ? [...actor.companyIds] : actor.companyIds,
    };
    next();
  });
  app.use("/api", runTraceArchiveRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe.sequential("run trace archive routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mockRunTraceArchiveService)) mock.mockReset();
  });

  it("lists company run traces for board users", async () => {
    mockRunTraceArchiveService.listArchives.mockResolvedValue([
      {
        id: "archive-1",
        companyId: "company-1",
        runId: "run-1",
        agentId: "agent-1",
        issueId: null,
        runStatus: "succeeded",
        status: "ready",
        bundleVersion: "paperclip-run-trace-v1",
        captureStatus: "partial",
        attemptCount: 1,
        failureReason: null,
        archivedAt: new Date("2026-06-16T00:00:00.000Z"),
        createdAt: new Date("2026-06-16T00:00:00.000Z"),
        updatedAt: new Date("2026-06-16T00:00:00.000Z"),
        agentName: "frontline-eng",
        issueIdentifier: null,
        issueTitle: null,
      },
    ]);

    const app = await createApp();
    const res = await request(app).get("/api/companies/company-1/run-traces");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mockRunTraceArchiveService.listArchives).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "company-1" }),
    );
  });

  it("returns bundle for ready archives", async () => {
    mockRunTraceArchiveService.getArchiveById.mockResolvedValue({
      id: "archive-1",
      companyId: "company-1",
      runId: "run-1",
      status: "ready",
    });
    mockRunTraceArchiveService.getArchiveBundle.mockResolvedValue({
      traceId: "run-1",
      companyId: "company-1",
      captureStatus: "partial",
      files: [],
    });

    const app = await createApp();
    const res = await request(app).get("/api/run-traces/archive-1/bundle");
    expect(res.status).toBe(200);
    expect(res.body.traceId).toBe("run-1");
  });

  it("rejects agent callers", async () => {
    const app = await createApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-1",
      source: "api_key",
    });
    const res = await request(app).get("/api/companies/company-1/run-traces");
    expect(res.status).toBe(403);
  });
});
