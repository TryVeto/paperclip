import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  activityLog,
  agentWakeupRequests,
  agentRuntimeState,
  agents,
  companies,
  costEvents,
  createDb,
  heartbeatRunEvents,
  heartbeatRuns,
  issueComments,
  issues,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";

const mockAdapterExecute = vi.hoisted(() => vi.fn(async () => {
  throw new Error("normal adapter path must not execute for an allowlisted fast decision run");
}));

vi.mock("../adapters/index.ts", async () => {
  const actual = await vi.importActual<typeof import("../adapters/index.ts")>("../adapters/index.ts");
  return {
    ...actual,
    getServerAdapter: vi.fn(() => ({
      supportsLocalAgentJwt: false,
      execute: mockAdapterExecute,
    })),
  };
});

const { heartbeatService } = await import("../services/heartbeat.ts");

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres heartbeat fast-decision tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function waitForTerminalRun(
  db: ReturnType<typeof createDb>,
  runId: string,
  timeoutMs = 5_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.id, runId))
      .then((rows) => rows[0] ?? null);
    if (run && !["queued", "running"].includes(run.status)) return run;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for heartbeat run ${runId}`);
}

async function seedFastDecisionScenario(db: ReturnType<typeof createDb>) {
  const companyId = randomUUID();
  const fastAgentId = randomUUID();
  const fallbackAgentId = randomUUID();
  const issueId = randomUUID();
  await db.insert(companies).values({
    id: companyId,
    name: "Paperclip",
    issuePrefix: `F${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    defaultResponsibleUserId: "responsible-user",
    requireBoardApprovalForNewAgents: false,
  });
  await db.insert(agents).values([
    {
      id: fastAgentId,
      companyId,
      name: "Thinking-fast",
      role: "decision",
      status: "idle",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: { heartbeat: { wakeOnDemand: true, maxConcurrentRuns: 1 } },
      permissions: {},
    },
    {
      id: fallbackAgentId,
      companyId,
      name: "Thinking-slow",
      role: "decision",
      status: "idle",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: { heartbeat: { wakeOnDemand: true, maxConcurrentRuns: 1 } },
      permissions: {},
    },
  ]);
  await db.insert(issues).values({
    id: issueId,
    companyId,
    title: "Make a bounded decision",
    description: "Use only the supplied issue context.",
    status: "todo",
    assigneeAgentId: fastAgentId,
    createdByUserId: "responsible-user",
  });
  // Keep the fallback agent's single execution slot occupied without starting
  // an adapter. Handoff assertions can then inspect the queued successor
  // deterministically, and teardown never races a background slow-path setup.
  await db.insert(heartbeatRuns).values({
    companyId,
    agentId: fallbackAgentId,
    invocationSource: "automation",
    triggerDetail: "system",
    status: "running",
    contextSnapshot: { wakeReason: "fast_decision_test_slot_guard" },
    startedAt: new Date(),
  });
  return { companyId, fastAgentId, fallbackAgentId, issueId };
}

function fastDecisionEnv(
  ids: { fastAgentId: string; fallbackAgentId: string },
  overrides: Record<string, string | undefined> = {},
) {
  return {
    PAPERCLIP_FAST_DECISION_ENABLED: "true",
    PAPERCLIP_FAST_DECISION_AGENT_IDS: ids.fastAgentId,
    PAPERCLIP_FAST_DECISION_BASE_URL: "http://127.0.0.1:8317/v1",
    PAPERCLIP_FAST_DECISION_API_KEY_ENV: "TEST_FAST_DECISION_KEY",
    PAPERCLIP_FAST_DECISION_MODEL: "gpt-5.4",
    PAPERCLIP_FAST_DECISION_REASONING_EFFORT: "none",
    PAPERCLIP_FAST_DECISION_TIMEOUT_MS: "8000",
    PAPERCLIP_FAST_DECISION_FALLBACK_AGENT_ID: ids.fallbackAgentId,
    PAPERCLIP_FAST_DECISION_PROVIDER: "veto_gateway",
    PAPERCLIP_FAST_DECISION_BILLER: "veto_gateway",
    PAPERCLIP_FAST_DECISION_BILLING_TYPE: "subscription_included",
    TEST_FAST_DECISION_KEY: "test-secret",
    ...overrides,
  };
}

function decisionResponse(action: string, comment: string, reason: string) {
  return new Response(JSON.stringify({
    id: `resp-${action}`,
    model: "gpt-5.4",
    output_text: JSON.stringify({ action, comment, reason }),
    usage: {
      input_tokens: 50,
      input_tokens_details: { cached_tokens: 5 },
      output_tokens: 10,
    },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describeEmbeddedPostgres("heartbeat fast decision lane", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  const heartbeatServices = new Set<ReturnType<typeof heartbeatService>>();
  const trackHeartbeat = (heartbeat: ReturnType<typeof heartbeatService>) => {
    heartbeatServices.add(heartbeat);
    return heartbeat;
  };

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-heartbeat-fast-decision-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    const heartbeat = heartbeatServices.values().next().value as ReturnType<typeof heartbeatService> | undefined;
    if (heartbeat) {
      const agentIds = await db
        .select({ id: agents.id })
        .from(agents)
        .then((rows) => rows.map((row) => row.id));
      if (agentIds.length > 0) {
        await heartbeat.cancelInvocationsForAgents(
          agentIds,
          "fast-decision integration test cleanup",
        );
      }
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const activeRuns = await db
          .select({ id: heartbeatRuns.id })
          .from(heartbeatRuns)
          .where(inArray(heartbeatRuns.status, ["queued", "running", "scheduled_retry"]));
        if (activeRuns.length === 0) break;
        for (const activeRun of activeRuns) {
          await heartbeat.cancelRun(activeRun.id, "fast-decision integration test cleanup").catch(() => null);
          await heartbeat.waitForRunExecutionDrain(activeRun.id).catch(() => undefined);
        }
      }
    }
    heartbeatServices.clear();
    mockAdapterExecute.mockClear();
    await db.execute(sql.raw('TRUNCATE TABLE "companies" RESTART IDENTITY CASCADE'));
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("branches before adapter setup and atomically comments, completes, audits, and accounts once", async () => {
    const companyId = randomUUID();
    const fastAgentId = randomUUID();
    const fallbackAgentId = randomUUID();
    const issueId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `F${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      defaultResponsibleUserId: "responsible-user",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values([
      {
        id: fastAgentId,
        companyId,
        name: "Thinking-fast",
        role: "decision",
        status: "idle",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: { heartbeat: { wakeOnDemand: true, maxConcurrentRuns: 1 } },
        permissions: {},
      },
      {
        id: fallbackAgentId,
        companyId,
        name: "Thinking-slow",
        role: "decision",
        status: "idle",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: { heartbeat: { wakeOnDemand: true, maxConcurrentRuns: 1 } },
        permissions: {},
      },
    ]);
    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Acknowledge a settled decision",
      description: "The supplied record already contains the conclusive answer.",
      status: "todo",
      assigneeAgentId: fastAgentId,
      createdByUserId: "responsible-user",
    });

    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      id: "resp-fast-1",
      model: "gpt-5.4",
      output_text: JSON.stringify({
        action: "comment_and_done",
        comment: "Recorded the supplied decision and closed the issue.",
        reason: "The bounded payload is conclusive and needs no tools.",
      }),
      usage: {
        input_tokens: 120,
        input_tokens_details: { cached_tokens: 20 },
        output_tokens: 30,
        total_tokens: 150,
      },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const heartbeat = trackHeartbeat(heartbeatService(db, {
      runtimeEnv: {
        PAPERCLIP_FAST_DECISION_ENABLED: "true",
        PAPERCLIP_FAST_DECISION_AGENT_IDS: fastAgentId,
        PAPERCLIP_FAST_DECISION_BASE_URL: "http://127.0.0.1:8317/v1",
        PAPERCLIP_FAST_DECISION_API_KEY_ENV: "TEST_FAST_DECISION_KEY",
        PAPERCLIP_FAST_DECISION_MODEL: "gpt-5.4",
        PAPERCLIP_FAST_DECISION_REASONING_EFFORT: "none",
        PAPERCLIP_FAST_DECISION_TIMEOUT_MS: "8000",
        PAPERCLIP_FAST_DECISION_FALLBACK_AGENT_ID: fallbackAgentId,
        PAPERCLIP_FAST_DECISION_PROVIDER: "veto_gateway",
        PAPERCLIP_FAST_DECISION_BILLER: "veto_gateway",
        PAPERCLIP_FAST_DECISION_BILLING_TYPE: "subscription_included",
        TEST_FAST_DECISION_KEY: "test-secret",
      },
      fastDecisionFetch: fetchImpl,
    }));

    const queued = await heartbeat.invoke(
      fastAgentId,
      "assignment",
      { issueId, wakeReason: "issue_assigned" },
      "system",
      { actorType: "system", actorId: "fast-decision-test" },
    );
    expect(queued).not.toBeNull();

    const run = await waitForTerminalRun(db, queued!.id);
    await heartbeat.waitForRunExecutionDrain(run.id);
    expect(run.status).toBe("succeeded");
    expect(run.resultJson).toMatchObject({
      fastDecision: {
        version: "fast-decision-v1",
        action: "comment_and_done",
        reason: "The bounded payload is conclusive and needs no tools.",
        responseId: "resp-fast-1",
      },
    });
    expect(run.usageJson).toMatchObject({
      inputTokens: 120,
      cachedInputTokens: 20,
      outputTokens: 30,
      provider: "veto_gateway",
      model: "gpt-5.4",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(mockAdapterExecute).not.toHaveBeenCalled();

    const issue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .then((rows) => rows[0]!);
    expect(issue.status).toBe("done");
    expect(issue.executionRunId).toBeNull();

    const comments = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.createdByRunId, run.id));
    expect(comments).toHaveLength(1);
    expect(comments[0]!.body).toBe("Recorded the supplied decision and closed the issue.");

    const events = await db
      .select({ eventType: heartbeatRunEvents.eventType, message: heartbeatRunEvents.message })
      .from(heartbeatRunEvents)
      .where(eq(heartbeatRunEvents.runId, run.id));
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "fast_decision.invoke" }),
      expect.objectContaining({ eventType: "fast_decision.result" }),
      expect.objectContaining({ eventType: "lifecycle", message: "run succeeded" }),
    ]));

    const activities = await db
      .select({ action: activityLog.action, details: activityLog.details })
      .from(activityLog)
      .where(eq(activityLog.runId, run.id));
    expect(activities).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "issue.checked_out" }),
      expect.objectContaining({ action: "issue.comment_added" }),
      expect.objectContaining({
        action: "issue.updated",
        details: expect.objectContaining({
          assigneeAgentId: fastAgentId,
          assigneeUserId: null,
        }),
      }),
    ]));

    const ledger = await db
      .select()
      .from(costEvents)
      .where(eq(costEvents.heartbeatRunId, run.id));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      provider: "veto_gateway",
      model: "gpt-5.4",
      inputTokens: 120,
      cachedInputTokens: 20,
      outputTokens: 30,
    });

    const runtime = await db
      .select()
      .from(agentRuntimeState)
      .where(eq(agentRuntimeState.agentId, fastAgentId));
    expect(runtime).toHaveLength(1);
    expect(runtime[0]).toMatchObject({ lastRunId: run.id, lastRunStatus: "succeeded" });
  });

  it("preserves an applied marker when outer execution cleanup sees a post-apply failure", async () => {
    const ids = await seedFastDecisionScenario(db);
    const afterApply = vi.fn(() => {
      throw new Error("injected failure after fast-decision apply");
    });
    const heartbeat = trackHeartbeat(heartbeatService(db, {
      runtimeEnv: fastDecisionEnv(ids),
      fastDecisionFetch: vi.fn(async () => decisionResponse(
        "comment_and_done",
        "The decision is conclusive.",
        "No tools are required.",
      )),
      fastDecisionAfterApply: afterApply,
    }));
    const queued = await heartbeat.invoke(
      ids.fastAgentId,
      "assignment",
      { issueId: ids.issueId, wakeReason: "issue_assigned" },
      "system",
      { actorType: "system", actorId: "fast-decision-test" },
    );
    await vi.waitFor(() => expect(afterApply).toHaveBeenCalledTimes(1));
    await heartbeat.waitForRunExecutionDrain(queued!.id);

    const appliedRun = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.id, queued!.id))
      .then((rows) => rows[0]!);
    expect(appliedRun.status).toBe("running");
    expect(appliedRun.error).toBeNull();
    expect(appliedRun.resultJson).toMatchObject({
      fastDecision: { version: "fast-decision-v1", phase: "applied", action: "comment_and_done" },
    });
    const appliedIssue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, ids.issueId))
      .then((rows) => rows[0]!);
    expect(appliedIssue).toMatchObject({ status: "done", executionRunId: null });

    await heartbeat.reapOrphanedRuns({ staleThresholdMs: 0 });

    const recoveredRun = await waitForTerminalRun(db, queued!.id);
    expect(recoveredRun.status).toBe("succeeded");
    expect(recoveredRun.resultJson).toMatchObject({
      fastDecision: { phase: "applied", finalizationPhase: "complete" },
    });
    const recoveredIssue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, ids.issueId))
      .then((rows) => rows[0]!);
    expect(recoveredIssue.executionRunId).toBeNull();
    const comments = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.createdByRunId, queued!.id));
    expect(comments).toHaveLength(1);
    const ledger = await db
      .select()
      .from(costEvents)
      .where(eq(costEvents.heartbeatRunId, queued!.id));
    expect(ledger).toHaveLength(1);
    const taggedTerminalEvents = await db
      .select()
      .from(heartbeatRunEvents)
      .where(and(
        eq(heartbeatRunEvents.runId, queued!.id),
        eq(heartbeatRunEvents.eventType, "lifecycle"),
        sql`${heartbeatRunEvents.payload}->>'runtime' = 'fast-decision-v1'`,
        sql`${heartbeatRunEvents.payload} ? 'status'`,
      ));
    expect(taggedTerminalEvents).toHaveLength(1);
    expect(afterApply).toHaveBeenCalledTimes(1);
    expect(mockAdapterExecute).not.toHaveBeenCalled();
  });

  it("checks out before applying backlog and leaves no execution lock", async () => {
    const ids = await seedFastDecisionScenario(db);
    const fetchImpl = vi.fn(async () => decisionResponse(
      "backlog",
      "This belongs in backlog until the intake decision changes.",
      "The supplied context explicitly asks to defer the work.",
    ));
    const heartbeat = trackHeartbeat(heartbeatService(db, {
      runtimeEnv: fastDecisionEnv(ids),
      fastDecisionFetch: fetchImpl,
    }));

    const queued = await heartbeat.invoke(
      ids.fastAgentId,
      "assignment",
      { issueId: ids.issueId, wakeReason: "issue_assigned" },
      "system",
      { actorType: "system", actorId: "fast-decision-test" },
    );
    const run = await waitForTerminalRun(db, queued!.id);
    await heartbeat.waitForRunExecutionDrain(run.id);

    expect(run.status).toBe("succeeded");
    expect(run.resultJson).toMatchObject({
      fastDecision: { action: "backlog", issueStatus: "backlog" },
    });
    const issue = await db.select().from(issues).where(eq(issues.id, ids.issueId)).then((rows) => rows[0]!);
    expect(issue).toMatchObject({
      status: "backlog",
      assigneeAgentId: null,
      checkoutRunId: null,
      executionRunId: null,
    });
    expect(issue.startedAt).not.toBeNull();
    const updateActivity = await db
      .select({ details: activityLog.details })
      .from(activityLog)
      .where(eq(activityLog.runId, run.id))
      .then((rows) => rows.find((row) => (row.details as Record<string, unknown>)?.action === "backlog") ?? null);
    expect(updateActivity?.details).toMatchObject({
      status: "backlog",
      _previous: { status: "in_progress" },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(mockAdapterExecute).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "explicit escalation",
      fetchFactory: () => vi.fn(async () => decisionResponse(
        "escalate_slow",
        "This needs the slow path.",
        "The request requires tool access.",
      )),
      expectedModelErrorCode: null,
    },
    {
      label: "no-op on an active issue",
      fetchFactory: () => vi.fn(async () => decisionResponse(
        "no_op",
        "",
        "No immediate mutation was selected.",
      )),
      expectedModelErrorCode: null,
    },
    {
      label: "invalid structured output",
      fetchFactory: () => vi.fn(async () => new Response(JSON.stringify({
        id: "resp-invalid",
        model: "gpt-5.4",
        output_text: JSON.stringify({ action: "invented_action", comment: "", reason: "invalid" }),
        usage: { input_tokens: 60, output_tokens: 7 },
      }), { status: 200, headers: { "content-type": "application/json" } })),
      expectedModelErrorCode: "invalid_response",
    },
    {
      label: "model timeout",
      fetchFactory: () => vi.fn((_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        })),
      expectedModelErrorCode: "timeout",
      timeoutMs: "100",
    },
  ])("hands $label to Thinking-slow exactly once", async ({ fetchFactory, expectedModelErrorCode, timeoutMs }) => {
    const ids = await seedFastDecisionScenario(db);
    const fetchImpl = fetchFactory();
    const heartbeat = trackHeartbeat(heartbeatService(db, {
      runtimeEnv: fastDecisionEnv(ids, timeoutMs ? { PAPERCLIP_FAST_DECISION_TIMEOUT_MS: timeoutMs } : {}),
      fastDecisionFetch: fetchImpl,
    }));

    const queued = await heartbeat.invoke(
      ids.fastAgentId,
      "assignment",
      { issueId: ids.issueId, wakeReason: "issue_assigned" },
      "system",
      { actorType: "system", actorId: "fast-decision-test" },
    );
    const fastRun = await waitForTerminalRun(db, queued!.id);
    await heartbeat.waitForRunExecutionDrain(fastRun.id);

    expect(fastRun.status).toBe("succeeded");
    expect(fastRun.resultJson).toMatchObject({
      fastDecision: {
        action: "escalate_slow",
        fallbackAgentId: ids.fallbackAgentId,
        fallbackRunId: expect.any(String),
        fallbackEnqueueError: null,
        modelErrorCode: expectedModelErrorCode,
      },
    });
    const idempotencyKey = `fast-decision-v1:escalate:${fastRun.id}`;
    const wakes = await db
      .select()
      .from(agentWakeupRequests)
      .where(eq(agentWakeupRequests.idempotencyKey, idempotencyKey));
    expect(wakes).toHaveLength(1);
    expect(wakes[0]!.status).not.toBe("deferred_issue_execution");
    const fallbackRuns = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.wakeupRequestId, wakes[0]!.id));
    expect(fallbackRuns).toHaveLength(1);
    expect(fallbackRuns[0]!.agentId).toBe(ids.fallbackAgentId);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("terminalizes ownership loss without touching the new owner", async () => {
    const ids = await seedFastDecisionScenario(db);
    let resolveFetch!: (response: Response) => void;
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    const heartbeat = trackHeartbeat(heartbeatService(db, {
      runtimeEnv: fastDecisionEnv(ids),
      fastDecisionFetch: fetchImpl,
    }));

    const queued = await heartbeat.invoke(
      ids.fastAgentId,
      "assignment",
      { issueId: ids.issueId, wakeReason: "issue_assigned" },
      "system",
      { actorType: "system", actorId: "fast-decision-test" },
    );
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    await db
      .update(issues)
      .set({
        status: "todo",
        assigneeAgentId: ids.fallbackAgentId,
        checkoutRunId: null,
        executionRunId: null,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, ids.issueId));
    resolveFetch(decisionResponse(
      "comment_and_done",
      "This stale result must not be applied.",
      "The old payload appeared conclusive.",
    ));

    const run = await waitForTerminalRun(db, queued!.id);
    await heartbeat.waitForRunExecutionDrain(run.id);
    expect(run).toMatchObject({
      status: "interrupted",
      errorCode: "fast_decision_ownership_lost",
    });
    const issue = await db.select().from(issues).where(eq(issues.id, ids.issueId)).then((rows) => rows[0]!);
    expect(issue).toMatchObject({ status: "todo", assigneeAgentId: ids.fallbackAgentId });
    const comments = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.createdByRunId, run.id));
    expect(comments).toHaveLength(0);
    const fastAgent = await db.select().from(agents).where(eq(agents.id, ids.fastAgentId)).then((rows) => rows[0]!);
    expect(fastAgent.status).not.toBe("running");
  });

  it("rejects a stale queued assignment instead of falling through to the normal adapter", async () => {
    const ids = await seedFastDecisionScenario(db);
    const [slotGuard] = await db.insert(heartbeatRuns).values({
      companyId: ids.companyId,
      agentId: ids.fastAgentId,
      invocationSource: "automation",
      triggerDetail: "system",
      status: "running",
      contextSnapshot: { wakeReason: "fast_decision_test_fast_slot_guard" },
      startedAt: new Date(),
    }).returning();
    const fetchImpl = vi.fn(async () => decisionResponse(
      "comment_and_done",
      "This stale assignment must never reach the model.",
      "The old assignment was already replaced.",
    ));
    const heartbeat = trackHeartbeat(heartbeatService(db, {
      runtimeEnv: fastDecisionEnv(ids),
      fastDecisionFetch: fetchImpl,
    }));

    const queued = await heartbeat.invoke(
      ids.fastAgentId,
      "assignment",
      { issueId: ids.issueId, wakeReason: "issue_assigned" },
      "system",
      { actorType: "system", actorId: "fast-decision-test" },
    );
    expect(queued?.status).toBe("queued");
    await db
      .update(issues)
      .set({
        assigneeAgentId: ids.fallbackAgentId,
        checkoutRunId: null,
        executionRunId: null,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, ids.issueId));

    await heartbeat.cancelRun(slotGuard!.id, "release fast-decision test slot");
    const run = await waitForTerminalRun(db, queued!.id);
    await heartbeat.waitForRunExecutionDrain(run.id);

    expect(run).toMatchObject({
      status: "cancelled",
      errorCode: "issue_assignee_changed",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mockAdapterExecute).not.toHaveBeenCalled();
  });

  it("accounts a completed one-shot exactly once when the run is cancelled during the request", async () => {
    const ids = await seedFastDecisionScenario(db);
    let resolveFetch!: (response: Response) => void;
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    const heartbeat = trackHeartbeat(heartbeatService(db, {
      runtimeEnv: fastDecisionEnv(ids),
      fastDecisionFetch: fetchImpl,
    }));
    const queued = await heartbeat.invoke(
      ids.fastAgentId,
      "assignment",
      { issueId: ids.issueId, wakeReason: "issue_assigned" },
      "system",
      { actorType: "system", actorId: "fast-decision-test" },
    );
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    await heartbeat.cancelRun(queued!.id, "cancelled while the one-shot request was in flight");
    resolveFetch(decisionResponse(
      "comment_and_done",
      "This cancelled result must not mutate the issue.",
      "The response still carries billable usage.",
    ));
    await heartbeat.waitForRunExecutionDrain(queued!.id);
    await heartbeat.reapOrphanedRuns({ staleThresholdMs: 1_000 });

    const run = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.id, queued!.id))
      .then((rows) => rows[0]!);
    expect(run.status).toBe("cancelled");
    expect(run.resultJson).toMatchObject({
      fastDecision: {
        phase: "ownership_lost",
        externalTerminalStatus: "cancelled",
        terminalAccountingVersion: 1,
        finalizationPhase: "complete",
      },
    });
    const ledger = await db
      .select()
      .from(costEvents)
      .where(eq(costEvents.heartbeatRunId, run.id));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ inputTokens: 50, cachedInputTokens: 5, outputTokens: 10 });
    const comments = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.createdByRunId, run.id));
    expect(comments).toHaveLength(0);
    const taggedTerminalEvents = await db
      .select()
      .from(heartbeatRunEvents)
      .where(and(
        eq(heartbeatRunEvents.runId, run.id),
        eq(heartbeatRunEvents.eventType, "lifecycle"),
        sql`${heartbeatRunEvents.payload}->>'runtime' = 'fast-decision-v1'`,
        sql`${heartbeatRunEvents.payload} ? 'status'`,
      ));
    expect(taggedTerminalEvents).toHaveLength(1);
  });

  it("coalesces a duplicate issue wake during the model call without a lock cycle", async () => {
    const ids = await seedFastDecisionScenario(db);
    let resolveFetch!: (response: Response) => void;
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    const heartbeat = trackHeartbeat(heartbeatService(db, {
      runtimeEnv: fastDecisionEnv(ids),
      fastDecisionFetch: fetchImpl,
    }));
    const queued = await heartbeat.invoke(
      ids.fastAgentId,
      "assignment",
      { issueId: ids.issueId, wakeReason: "issue_assigned" },
      "system",
      { actorType: "system", actorId: "fast-decision-test" },
    );
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const duplicatePromise = heartbeat.invoke(
      ids.fastAgentId,
      "assignment",
      { issueId: ids.issueId, wakeReason: "duplicate_assignment" },
      "system",
      { actorType: "system", actorId: "fast-decision-test" },
    );
    resolveFetch(decisionResponse(
      "comment_and_done",
      "Applied once despite the duplicate wake.",
      "The bounded context is conclusive.",
    ));
    const duplicate = await duplicatePromise;
    expect(duplicate?.id).toBe(queued!.id);
    const run = await waitForTerminalRun(db, queued!.id);
    await heartbeat.waitForRunExecutionDrain(run.id);
    expect(run.status).toBe("succeeded");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const comments = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.createdByRunId, run.id));
    expect(comments).toHaveLength(1);
  });

  it("fails a self-fallback closed without invoking the model or creating a wake loop", async () => {
    const ids = await seedFastDecisionScenario(db);
    const fetchImpl = vi.fn(async () => decisionResponse(
      "comment_and_done",
      "This response must never be requested.",
      "The invalid configuration must fail before the model call.",
    ));
    const heartbeat = trackHeartbeat(heartbeatService(db, {
      runtimeEnv: fastDecisionEnv(ids, {
        PAPERCLIP_FAST_DECISION_FALLBACK_AGENT_ID: ids.fastAgentId,
      }),
      fastDecisionFetch: fetchImpl,
    }));

    const queued = await heartbeat.invoke(
      ids.fastAgentId,
      "assignment",
      { issueId: ids.issueId, wakeReason: "issue_assigned" },
      "system",
      { actorType: "system", actorId: "fast-decision-test" },
    );
    const run = await waitForTerminalRun(db, queued!.id);
    await heartbeat.waitForRunExecutionDrain(run.id);

    expect(run).toMatchObject({
      status: "failed",
      errorCode: "configuration_incomplete",
      resultJson: {
        fastDecision: {
          action: "escalate_slow",
          configErrorCode: "fallback_agent_id_invalid",
          fallbackRunId: null,
        },
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    const wakes = await db
      .select()
      .from(agentWakeupRequests)
      .where(eq(agentWakeupRequests.idempotencyKey, `fast-decision-v1:escalate:${run.id}`));
    expect(wakes).toHaveLength(0);
    const issue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, ids.issueId))
      .then((rows) => rows[0]!);
    expect(issue).toMatchObject({
      status: "blocked",
      executionRunId: null,
      checkoutRunId: null,
    });
  });

  it("resumes an applied marker with the flag disabled and preserves one handoff and accounting record", async () => {
    const ids = await seedFastDecisionScenario(db);
    const sourceRunId = randomUUID();
    const appliedResult = (commentId: string | null) => ({
      summary: "Escalated from the persisted fast decision.",
      fastDecision: {
        version: "fast-decision-v1",
        phase: "applied",
        action: "escalate_slow",
        reason: "Tool access is required.",
        commentId,
        issueId: ids.issueId,
        issueStatus: "in_progress",
        fallbackAgentId: ids.fallbackAgentId,
        fallbackConfigurationError: null,
        model: "gpt-5.4",
        provider: "veto_gateway",
        biller: "veto_gateway",
        billingType: "subscription_included",
        usage: { inputTokens: 70, cachedInputTokens: 10, outputTokens: 12 },
        modelElapsedMs: 900,
        appliedAt: new Date().toISOString(),
      },
    });
    await db.insert(heartbeatRuns).values({
      id: sourceRunId,
      companyId: ids.companyId,
      agentId: ids.fastAgentId,
      invocationSource: "assignment",
      triggerDetail: "system",
      status: "running",
      startedAt: new Date(Date.now() - 60_000),
      updatedAt: new Date(Date.now() - 60_000),
      contextSnapshot: { issueId: ids.issueId, wakeReason: "issue_assigned" },
      resultJson: appliedResult(null),
    });
    const [comment] = await db.insert(issueComments).values({
      companyId: ids.companyId,
      issueId: ids.issueId,
      body: "Escalated from the persisted fast decision.",
      authorType: "agent",
      authorAgentId: ids.fastAgentId,
      createdByRunId: sourceRunId,
    }).returning();
    await db
      .update(issues)
      .set({
        status: "in_progress",
        assigneeAgentId: ids.fallbackAgentId,
        checkoutRunId: null,
        executionRunId: null,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, ids.issueId));
    await db.update(agents).set({ status: "running" }).where(eq(agents.id, ids.fastAgentId));
    await db
      .update(heartbeatRuns)
      .set({ resultJson: appliedResult(comment!.id), updatedAt: new Date() })
      .where(eq(heartbeatRuns.id, sourceRunId));
    const fetchImpl = vi.fn(async () => {
      throw new Error("resumed decisions must not invoke the model");
    });
    const heartbeat = trackHeartbeat(heartbeatService(db, { runtimeEnv: {}, fastDecisionFetch: fetchImpl }));

    await Promise.all([
      heartbeat.reapOrphanedRuns({ staleThresholdMs: 1_000 }),
      heartbeat.reapOrphanedRuns({ staleThresholdMs: 1_000 }),
    ]);
    const sourceRun = await waitForTerminalRun(db, sourceRunId);
    await heartbeat.waitForRunExecutionDrain(sourceRun.id);
    await heartbeat.reapOrphanedRuns({ staleThresholdMs: 1_000 });

    expect(sourceRun.status).toBe("succeeded");
    expect(sourceRun.usageJson).toMatchObject({
      inputTokens: 70,
      cachedInputTokens: 10,
      outputTokens: 12,
      provider: "veto_gateway",
      billingType: "subscription_included",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    const idempotencyKey = `fast-decision-v1:escalate:${sourceRunId}`;
    const wakes = await db
      .select()
      .from(agentWakeupRequests)
      .where(eq(agentWakeupRequests.idempotencyKey, idempotencyKey));
    expect(wakes).toHaveLength(1);
    const fallbackRuns = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.wakeupRequestId, wakes[0]!.id));
    expect(fallbackRuns).toHaveLength(1);
    const comments = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.createdByRunId, sourceRunId));
    expect(comments).toHaveLength(1);
    const ledger = await db
      .select()
      .from(costEvents)
      .where(eq(costEvents.heartbeatRunId, sourceRunId));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      inputTokens: 70,
      cachedInputTokens: 10,
      outputTokens: 12,
    });
    const runtime = await db
      .select()
      .from(agentRuntimeState)
      .where(eq(agentRuntimeState.agentId, ids.fastAgentId));
    expect(runtime).toHaveLength(1);
    expect(runtime[0]).toMatchObject({
      lastRunId: sourceRunId,
      lastRunStatus: "succeeded",
      totalInputTokens: 70,
      totalCachedInputTokens: 10,
      totalOutputTokens: 12,
    });
  });

  it("restores and blocks an applied handoff when the fallback is paused during replay", async () => {
    const ids = await seedFastDecisionScenario(db);
    const sourceRunId = randomUUID();
    await db
      .update(agents)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(agents.id, ids.fallbackAgentId));
    await db.insert(heartbeatRuns).values({
      id: sourceRunId,
      companyId: ids.companyId,
      agentId: ids.fastAgentId,
      invocationSource: "assignment",
      triggerDetail: "system",
      status: "running",
      startedAt: new Date(Date.now() - 60_000),
      updatedAt: new Date(Date.now() - 60_000),
      contextSnapshot: { issueId: ids.issueId, wakeReason: "issue_assigned" },
      resultJson: {
        summary: "Escalated before the fallback was paused.",
        fastDecision: {
          version: "fast-decision-v1",
          phase: "applied",
          action: "escalate_slow",
          reason: "Tool access is required.",
          commentId: null,
          issueId: ids.issueId,
          issueStatus: "in_progress",
          fallbackAgentId: ids.fallbackAgentId,
          fallbackConfigurationError: null,
          model: "gpt-5.4",
          provider: "veto_gateway",
          biller: "veto_gateway",
          billingType: "subscription_included",
          usage: { inputTokens: 70, cachedInputTokens: 10, outputTokens: 12 },
          modelElapsedMs: 900,
          appliedAt: new Date().toISOString(),
        },
      },
    });
    await db
      .update(issues)
      .set({
        status: "in_progress",
        assigneeAgentId: ids.fallbackAgentId,
        checkoutRunId: null,
        executionRunId: null,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, ids.issueId));
    await db.update(agents).set({ status: "running" }).where(eq(agents.id, ids.fastAgentId));

    const fetchImpl = vi.fn(async () => {
      throw new Error("replay must not invoke the model");
    });
    const heartbeat = trackHeartbeat(heartbeatService(db, { runtimeEnv: {}, fastDecisionFetch: fetchImpl }));
    await heartbeat.reapOrphanedRuns({ staleThresholdMs: 1_000 });
    const sourceRun = await waitForTerminalRun(db, sourceRunId);
    await heartbeat.waitForRunExecutionDrain(sourceRun.id);

    expect(sourceRun).toMatchObject({
      status: "failed",
      errorCode: "configuration_incomplete",
      resultJson: {
        fastDecision: {
          fallbackRunId: null,
          fallbackEnqueueError: expect.stringContaining("paused"),
        },
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    const fallbackWakes = await db
      .select()
      .from(agentWakeupRequests)
      .where(eq(
        agentWakeupRequests.idempotencyKey,
        `fast-decision-v1:escalate:${sourceRunId}`,
      ));
    expect(fallbackWakes).toHaveLength(0);
    const issue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, ids.issueId))
      .then((rows) => rows[0]!);
    expect(issue).toMatchObject({
      status: "blocked",
      executionRunId: null,
      checkoutRunId: null,
    });
  });

  it("reconciles terminal fast-decision cleanup once after a post-accounting crash", async () => {
    const ids = await seedFastDecisionScenario(db);
    const sourceRunId = randomUUID();
    await db.insert(heartbeatRuns).values({
      id: sourceRunId,
      companyId: ids.companyId,
      agentId: ids.fastAgentId,
      invocationSource: "assignment",
      triggerDetail: "system",
      status: "succeeded",
      startedAt: new Date(Date.now() - 60_000),
      finishedAt: new Date(Date.now() - 59_000),
      contextSnapshot: { issueId: ids.issueId, wakeReason: "issue_assigned" },
      resultJson: {
        summary: "Applied before cleanup completed.",
        fastDecision: {
          version: "fast-decision-v1",
          phase: "applied",
          action: "comment_and_done",
          reason: "The issue was conclusive.",
          issueId: ids.issueId,
          issueStatus: "done",
          terminalAccountingVersion: 1,
          finalizationPhase: "pending",
        },
      },
    });
    await db
      .update(issues)
      .set({
        status: "done",
        checkoutRunId: sourceRunId,
        executionRunId: sourceRunId,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, ids.issueId));
    await db.update(agents).set({ status: "running" }).where(eq(agents.id, ids.fastAgentId));
    const heartbeat = trackHeartbeat(heartbeatService(db, { runtimeEnv: {} }));

    await heartbeat.reapOrphanedRuns({ staleThresholdMs: 1_000 });
    await heartbeat.reapOrphanedRuns({ staleThresholdMs: 1_000 });

    const run = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.id, sourceRunId))
      .then((rows) => rows[0]!);
    expect(run.resultJson).toMatchObject({
      fastDecision: { finalizationPhase: "complete", finalizedAt: expect.any(String) },
    });
    const issue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, ids.issueId))
      .then((rows) => rows[0]!);
    expect(issue).toMatchObject({ executionRunId: null, checkoutRunId: null });
    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, ids.fastAgentId))
      .then((rows) => rows[0]!);
    expect(agent.status).toBe("idle");
    const terminalEvents = await db
      .select()
      .from(heartbeatRunEvents)
      .where(and(
        eq(heartbeatRunEvents.runId, sourceRunId),
        eq(heartbeatRunEvents.eventType, "lifecycle"),
        eq(heartbeatRunEvents.message, "run succeeded"),
      ));
    expect(terminalEvents).toHaveLength(1);
  });

  it("enforces database-level uniqueness for escalation wakes and terminal events", async () => {
    const ids = await seedFastDecisionScenario(db);
    const runId = randomUUID();
    await db.insert(heartbeatRuns).values({
      id: runId,
      companyId: ids.companyId,
      agentId: ids.fastAgentId,
      invocationSource: "assignment",
      triggerDetail: "system",
      status: "succeeded",
      contextSnapshot: { issueId: ids.issueId, wakeReason: "issue_assigned" },
      finishedAt: new Date(),
    });
    const idempotencyKey = `fast-decision-v1:escalate:${runId}`;
    const wakeValues = {
      companyId: ids.companyId,
      agentId: ids.fallbackAgentId,
      source: "automation",
      triggerDetail: "system",
      reason: "fast_decision_escalated",
      status: "queued",
      idempotencyKey,
    } as const;
    await db.insert(agentWakeupRequests).values(wakeValues);
    await expect(db.insert(agentWakeupRequests).values(wakeValues)).rejects.toThrow();

    const terminalEventValues = (seq: number) => ({
      companyId: ids.companyId,
      runId,
      agentId: ids.fastAgentId,
      seq,
      eventType: "lifecycle",
      stream: "system",
      level: "info",
      message: "run succeeded",
      payload: { runtime: "fast-decision-v1", status: "succeeded" },
    });
    await db.insert(heartbeatRunEvents).values(terminalEventValues(1));
    await expect(db.insert(heartbeatRunEvents).values(terminalEventValues(2))).rejects.toThrow();

    const wakes = await db
      .select()
      .from(agentWakeupRequests)
      .where(eq(agentWakeupRequests.idempotencyKey, idempotencyKey));
    const terminalEvents = await db
      .select()
      .from(heartbeatRunEvents)
      .where(and(
        eq(heartbeatRunEvents.runId, runId),
        eq(heartbeatRunEvents.eventType, "lifecycle"),
      ));
    expect(wakes).toHaveLength(1);
    expect(terminalEvents).toHaveLength(1);
  });
});
