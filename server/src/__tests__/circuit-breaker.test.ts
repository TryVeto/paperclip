import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, companies, createDb, heartbeatRunFailures } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import {
  CIRCUIT_DEAD_LETTER_THRESHOLD,
  CIRCUIT_QUARANTINE_THRESHOLD,
  classifyRunFailure,
  evaluateRunCircuitBreaker,
  resolveAgentCircuitOnSuccess,
} from "../services/circuit-breaker.ts";

describe("classifyRunFailure", () => {
  const agentId = randomUUID();

  it("marks security/config/non-retryable codes as terminal", () => {
    expect(classifyRunFailure({ agentId, errorCode: "secret_exposure" })).toMatchObject({
      failureClass: "security",
      terminal: true,
    });
    expect(classifyRunFailure({ agentId, errorCode: "configuration_incomplete" })).toMatchObject({
      failureClass: "configuration",
      terminal: true,
    });
    expect(classifyRunFailure({ agentId, errorCode: "workspace_validation_failed" })).toMatchObject({
      failureClass: "configuration",
      terminal: true,
    });
    expect(classifyRunFailure({ agentId, errorCode: "agent_not_invokable" })).toMatchObject({
      failureClass: "non_retryable",
      terminal: true,
    });
  });

  it("classifies provider rate limits from code and from message heuristics", () => {
    expect(classifyRunFailure({ agentId, errorCode: "provider_rate_limit" })).toMatchObject({
      failureClass: "provider_rate_limit",
      terminal: false,
    });
    expect(
      classifyRunFailure({ agentId, errorCode: null, error: "Error 429: Too Many Requests" }),
    ).toMatchObject({ failureClass: "provider_rate_limit", terminal: false });
    expect(
      classifyRunFailure({ agentId, errorCode: "adapter_failed", error: "rate limit exceeded" }),
    ).toMatchObject({ failureClass: "provider_rate_limit", terminal: false });
  });

  it("classifies known transient infra codes and unknown codes as requeueable", () => {
    expect(classifyRunFailure({ agentId, errorCode: "adapter_failed" })).toMatchObject({
      failureClass: "transient_infra",
      terminal: false,
    });
    expect(classifyRunFailure({ agentId, errorCode: "process_lost" })).toMatchObject({
      failureClass: "transient_infra",
      terminal: false,
    });
    expect(classifyRunFailure({ agentId, errorCode: "something_unexpected" })).toMatchObject({
      failureClass: "unknown",
      terminal: false,
    });
  });

  it("produces a stable fingerprint that ignores per-occurrence noise", () => {
    const a = classifyRunFailure({ agentId, errorCode: "adapter_failed", error: "boom at line 42 run 0xdeadbeef" });
    const b = classifyRunFailure({ agentId, errorCode: "adapter_failed", error: "boom at line 99 run 0xfeedface" });
    expect(a.fingerprint).toBe(b.fingerprint);

    const other = classifyRunFailure({ agentId: randomUUID(), errorCode: "adapter_failed", error: "boom" });
    expect(other.fingerprint).not.toBe(a.fingerprint);
  });
});

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres circuit-breaker tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("run circuit breaker ledger", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-circuit-breaker-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(heartbeatRunFailures);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedCompanyAgent() {
    const companyId = randomUUID();
    const agentId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "CodexCoder",
      role: "engineer",
      status: "active",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });
    return { companyId, agentId };
  }

  it("escalates retry -> quarantine -> dead_letter on a repeated same-fingerprint failure (no blind requeue)", async () => {
    const { companyId, agentId } = await seedCompanyAgent();
    const classification = classifyRunFailure({ agentId, errorCode: "adapter_failed", error: "boom" });

    const first = await evaluateRunCircuitBreaker(db, {
      companyId,
      agentId,
      runId: randomUUID(),
      classification,
    });
    expect(first).toMatchObject({ disposition: "retry", occurrenceCount: 1 });

    const second = await evaluateRunCircuitBreaker(db, {
      companyId,
      agentId,
      runId: randomUUID(),
      classification,
    });
    expect(second).toMatchObject({
      disposition: "quarantine",
      occurrenceCount: CIRCUIT_QUARANTINE_THRESHOLD,
    });

    const third = await evaluateRunCircuitBreaker(db, {
      companyId,
      agentId,
      runId: randomUUID(),
      classification,
    });
    expect(third).toMatchObject({
      disposition: "dead_letter",
      occurrenceCount: CIRCUIT_DEAD_LETTER_THRESHOLD,
    });

    const rows = await db.select().from(heartbeatRunFailures);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ state: "dead_letter", ownerType: "human" });
    expect(rows[0]?.deadLetteredAt).not.toBeNull();
    expect(rows[0]?.quarantinedAt).not.toBeNull();
  });

  it("keeps distinct fingerprints on independent streaks", async () => {
    const { companyId, agentId } = await seedCompanyAgent();
    const a = classifyRunFailure({ agentId, errorCode: "adapter_failed" });
    const b = classifyRunFailure({ agentId, errorCode: "timeout" });

    expect((await evaluateRunCircuitBreaker(db, { companyId, agentId, runId: randomUUID(), classification: a })).disposition).toBe("retry");
    expect((await evaluateRunCircuitBreaker(db, { companyId, agentId, runId: randomUUID(), classification: b })).disposition).toBe("retry");

    const rows = await db.select().from(heartbeatRunFailures);
    expect(rows).toHaveLength(2);
  });

  it("blocks terminal classes without recording a ledger row", async () => {
    const { companyId, agentId } = await seedCompanyAgent();
    const classification = classifyRunFailure({ agentId, errorCode: "configuration_incomplete" });

    const result = await evaluateRunCircuitBreaker(db, {
      companyId,
      agentId,
      runId: randomUUID(),
      classification,
    });
    expect(result.disposition).toBe("block");

    const rows = await db.select().from(heartbeatRunFailures);
    expect(rows).toHaveLength(0);
  });

  it("resets the breaker after a successful run so the agent can retry again", async () => {
    const { companyId, agentId } = await seedCompanyAgent();
    const classification = classifyRunFailure({ agentId, errorCode: "adapter_failed", error: "boom" });

    await evaluateRunCircuitBreaker(db, { companyId, agentId, runId: randomUUID(), classification });
    await evaluateRunCircuitBreaker(db, { companyId, agentId, runId: randomUUID(), classification });

    const resolvedCount = await resolveAgentCircuitOnSuccess(db, companyId, agentId);
    expect(resolvedCount).toBe(1);

    // A fresh failure after recovery starts a new streak at retry.
    const afterReset = await evaluateRunCircuitBreaker(db, {
      companyId,
      agentId,
      runId: randomUUID(),
      classification,
    });
    expect(afterReset).toMatchObject({ disposition: "retry", occurrenceCount: 1 });
  });
});
