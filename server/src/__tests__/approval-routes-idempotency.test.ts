import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Route params (:id / :companyId) are validated as UUIDs, so fixtures must use
// real UUID-shaped ids rather than synthetic slugs.
const COMPANY_1 = "00000000-0000-4000-8000-000000000001";
const COMPANY_2 = "00000000-0000-4000-8000-000000000002";
const APPROVAL_1 = "11111111-1111-4111-8111-111111111111";
const APPROVAL_2 = "22222222-2222-4222-8222-222222222222";
const APPROVAL_3 = "33333333-3333-4333-8333-333333333333";
const APPROVAL_4 = "44444444-4444-4444-8444-444444444444";
const APPROVAL_5 = "55555555-5555-4555-8555-555555555555";
const APPROVAL_6 = "66666666-6666-4666-8666-666666666666";
const APPROVAL_7 = "77777777-7777-4777-8777-777777777777";
const APPROVAL_8 = "88888888-8888-4888-8888-888888888888";

const mockApprovalService = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  requestRevision: vi.fn(),
  resubmit: vi.fn(),
  listComments: vi.fn(),
  addComment: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  wakeup: vi.fn(),
}));

const mockIssueApprovalService = vi.hoisted(() => ({
  listIssuesForApproval: vi.fn(),
  linkManyForApproval: vi.fn(),
}));

const mockSecretService = vi.hoisted(() => ({
  normalizeHireApprovalPayloadForPersistence: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());
const mockAccessService = vi.hoisted(() => ({
  decide: vi.fn(),
}));

function registerModuleMocks() {
  vi.doMock("../services/index.js", () => ({
    accessService: () => mockAccessService,
    approvalService: () => mockApprovalService,
    heartbeatService: () => mockHeartbeatService,
    issueApprovalService: () => mockIssueApprovalService,
    logActivity: mockLogActivity,
    secretService: () => mockSecretService,
  }));
}

async function createApp(actorOverrides: Record<string, unknown> = {}) {
  const [{ errorHandler }, { approvalRoutes }] = await Promise.all([
    import("../middleware/index.js"),
    import("../routes/approvals.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      companyIds: [COMPANY_1],
      source: "session",
      isInstanceAdmin: false,
      ...actorOverrides,
    };
    next();
  });
  app.use("/api", approvalRoutes(createRouteDb()));
  app.use(errorHandler);
  return app;
}

function createRouteDb(contextSnapshot: Record<string, unknown> = {}, runId = "run-1", agentId = "agent-1") {
  const runRows = [{
    id: runId,
    companyId: COMPANY_1,
    agentId,
    contextSnapshot,
  }];
  return {
    select: vi.fn((selection: Record<string, unknown> = {}) => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          then: async (resolve: (rows: unknown[]) => unknown) => resolve(
            Object.keys(selection).includes("contextSnapshot") ? runRows : [],
          ),
        })),
      })),
    })),
  } as any;
}

async function createAgentApp(options: { runId?: string; contextSnapshot?: Record<string, unknown> } = {}) {
  const [{ errorHandler }, { approvalRoutes }] = await Promise.all([
    import("../middleware/index.js"),
    import("../routes/approvals.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "agent",
      agentId: "agent-1",
      companyId: COMPANY_1,
      runId: options.runId ?? "run-1",
      source: "api_key",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", approvalRoutes(createRouteDb(options.contextSnapshot, options.runId ?? "run-1")));
  app.use(errorHandler);
  return app;
}

describe("approval routes idempotent retries", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("../services/index.js");
    vi.doUnmock("../routes/approvals.js");
    vi.doUnmock("../routes/authz.js");
    vi.doUnmock("../middleware/index.js");
    registerModuleMocks();
    vi.clearAllMocks();
    mockApprovalService.list.mockReset();
    mockApprovalService.getById.mockReset();
    mockApprovalService.create.mockReset();
    mockApprovalService.approve.mockReset();
    mockApprovalService.reject.mockReset();
    mockApprovalService.requestRevision.mockReset();
    mockApprovalService.resubmit.mockReset();
    mockApprovalService.listComments.mockReset();
    mockApprovalService.addComment.mockReset();
    mockHeartbeatService.wakeup.mockReset();
    mockIssueApprovalService.listIssuesForApproval.mockReset();
    mockIssueApprovalService.linkManyForApproval.mockReset();
    mockSecretService.normalizeHireApprovalPayloadForPersistence.mockReset();
    mockLogActivity.mockReset();
    mockAccessService.decide.mockReset();
    mockAccessService.decide.mockResolvedValue({
      allowed: true,
      action: "company_scope:read",
      reason: "allow_test",
      explanation: "Allowed by test mock.",
    });
    mockHeartbeatService.wakeup.mockResolvedValue({ id: "wake-1" });
    mockIssueApprovalService.listIssuesForApproval.mockResolvedValue([{ id: "issue-1" }]);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("does not emit duplicate approval side effects when approve is already resolved", async () => {
    mockApprovalService.getById.mockResolvedValue({
      id: APPROVAL_1,
      companyId: COMPANY_1,
      type: "hire_agent",
      status: "approved",
      payload: {},
      requestedByAgentId: "agent-1",
    });
    mockApprovalService.approve.mockResolvedValue({
      approval: {
        id: APPROVAL_1,
        companyId: COMPANY_1,
        type: "hire_agent",
        status: "approved",
        payload: {},
        requestedByAgentId: "agent-1",
      },
      applied: false,
    });

    const res = await request(await createApp())
      .post(`/api/approvals/${APPROVAL_1}/approve`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockIssueApprovalService.listIssuesForApproval).not.toHaveBeenCalled();
    expect(mockHeartbeatService.wakeup).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it("does not emit duplicate rejection logs when reject is already resolved", async () => {
    mockApprovalService.getById.mockResolvedValue({
      id: APPROVAL_1,
      companyId: COMPANY_1,
      type: "hire_agent",
      status: "rejected",
      payload: {},
    });
    mockApprovalService.reject.mockResolvedValue({
      approval: {
        id: APPROVAL_1,
        companyId: COMPANY_1,
        type: "hire_agent",
        status: "rejected",
        payload: {},
      },
      applied: false,
    });

    const res = await request(await createApp())
      .post(`/api/approvals/${APPROVAL_1}/reject`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it("rejects approval decisions for companies outside the caller scope", async () => {
    mockApprovalService.getById.mockResolvedValue({
      id: APPROVAL_2,
      companyId: COMPANY_2,
      type: "hire_agent",
      status: "pending",
      payload: {},
    });

    const res = await request(await createApp())
      .post(`/api/approvals/${APPROVAL_2}/approve`)
      .send({});

    expect(res.status).toBe(403);
    expect(mockApprovalService.approve).not.toHaveBeenCalled();
  });

  it("rejects approval revision requests for companies outside the caller scope", async () => {
    mockApprovalService.getById.mockResolvedValue({
      id: APPROVAL_3,
      companyId: COMPANY_2,
      type: "hire_agent",
      status: "pending",
      payload: {},
    });

    const res = await request(await createApp())
      .post(`/api/approvals/${APPROVAL_3}/request-revision`)
      .send({ decisionNote: "Need changes" });

    expect(res.status).toBe(403);
    expect(mockApprovalService.requestRevision).not.toHaveBeenCalled();
  });

  it("derives approval attribution from the authenticated actor on approve", async () => {
    mockApprovalService.getById.mockResolvedValue({
      id: APPROVAL_4,
      companyId: COMPANY_1,
      type: "hire_agent",
      status: "pending",
      payload: {},
      requestedByAgentId: null,
    });
    mockApprovalService.approve.mockResolvedValue({
      approval: {
        id: APPROVAL_4,
        companyId: COMPANY_1,
        type: "hire_agent",
        status: "approved",
        payload: {},
        requestedByAgentId: null,
      },
      applied: true,
    });

    const res = await request(await createApp())
      .post(`/api/approvals/${APPROVAL_4}/approve`)
      .send({ decidedByUserId: "forged-user", decisionNote: "ship it" });

    expect(res.status).toBe(200);
    expect(mockApprovalService.approve).toHaveBeenCalledWith(APPROVAL_4, "user-1", "ship it");
  });

  it("derives approval attribution from the authenticated actor on reject", async () => {
    mockApprovalService.getById.mockResolvedValue({
      id: APPROVAL_5,
      companyId: COMPANY_1,
      type: "hire_agent",
      status: "pending",
      payload: {},
    });
    mockApprovalService.reject.mockResolvedValue({
      approval: {
        id: APPROVAL_5,
        companyId: COMPANY_1,
        type: "hire_agent",
        status: "rejected",
        payload: {},
      },
      applied: true,
    });

    const res = await request(await createApp())
      .post(`/api/approvals/${APPROVAL_5}/reject`)
      .send({ decidedByUserId: "forged-user", decisionNote: "not now" });

    expect(res.status).toBe(200);
    expect(mockApprovalService.reject).toHaveBeenCalledWith(APPROVAL_5, "user-1", "not now");
  });

  it("derives approval attribution from the authenticated actor on request revision", async () => {
    mockApprovalService.getById.mockResolvedValue({
      id: APPROVAL_6,
      companyId: COMPANY_1,
      type: "hire_agent",
      status: "pending",
      payload: {},
    });
    mockApprovalService.requestRevision.mockResolvedValue({
      id: APPROVAL_6,
      companyId: COMPANY_1,
      type: "hire_agent",
      status: "revision_requested",
      payload: {},
    });

    const res = await request(await createApp())
      .post(`/api/approvals/${APPROVAL_6}/request-revision`)
      .send({ decidedByUserId: "forged-user", decisionNote: "Need changes" });

    expect(res.status).toBe(200);
    expect(mockApprovalService.requestRevision).toHaveBeenCalledWith(
      APPROVAL_6,
      "user-1",
      "Need changes",
    );
  });

  it("lets agents create generic issue-linked board approval requests", async () => {
    mockApprovalService.create.mockResolvedValue({
      id: APPROVAL_1,
      companyId: COMPANY_1,
      type: "request_board_approval",
      requestedByAgentId: "agent-1",
      requestedByUserId: null,
      status: "pending",
      payload: { title: "Approve hosting spend" },
      decisionNote: null,
      decidedByUserId: null,
      decidedAt: null,
      createdAt: new Date("2026-04-06T00:00:00.000Z"),
      updatedAt: new Date("2026-04-06T00:00:00.000Z"),
    });

    const res = await request(await createAgentApp())
      .post(`/api/companies/${COMPANY_1}/approvals`)
      .send({
        type: "request_board_approval",
        issueIds: ["00000000-0000-0000-0000-000000000001"],
        payload: { title: "Approve hosting spend" },
      });

    expect([200, 201], JSON.stringify(res.body)).toContain(res.status);
    expect(res.body).toMatchObject({
      companyId: COMPANY_1,
      type: "request_board_approval",
      requestedByAgentId: "agent-1",
      requestedByUserId: null,
      status: "pending",
    });
    expect(mockSecretService.normalizeHireApprovalPayloadForPersistence).not.toHaveBeenCalled();
    expect(mockIssueApprovalService.linkManyForApproval).toHaveBeenCalledWith(
      APPROVAL_1,
      ["00000000-0000-0000-0000-000000000001"],
      { agentId: "agent-1", userId: null },
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        companyId: COMPANY_1,
        actorType: "agent",
        actorId: "agent-1",
        action: "approval.created",
      }),
    );
  });

  it("blocks status-only recovery runs from creating approvals", async () => {
    const res = await request(await createAgentApp({
      contextSnapshot: {
        modelProfile: "cheap",
        recoveryIntent: "status_only",
        allowDeliverableWork: false,
        allowDocumentUpdates: false,
        resumeRequiresNormalModel: true,
      },
    }))
      .post(`/api/companies/${COMPANY_1}/approvals`)
      .send({
        type: "request_board_approval",
        payload: { title: "Approve hosting spend" },
      });

    expect(res.status, JSON.stringify(res.body)).toBe(403);
    expect(res.body.error).toContain("Cheap status-only recovery runs cannot create or modify approvals");
    expect(mockApprovalService.create).not.toHaveBeenCalled();
    expect(mockIssueApprovalService.linkManyForApproval).not.toHaveBeenCalled();
  });

  it("blocks status-only recovery runs from resubmitting approvals", async () => {
    mockApprovalService.getById.mockResolvedValue({
      id: APPROVAL_7,
      companyId: COMPANY_1,
      type: "request_board_approval",
      status: "revision_requested",
      payload: {},
      requestedByAgentId: "agent-1",
    });

    const res = await request(await createAgentApp({
      contextSnapshot: {
        modelProfile: "cheap",
        recoveryIntent: "status_only",
        allowDeliverableWork: false,
        allowDocumentUpdates: false,
        resumeRequiresNormalModel: true,
      },
    }))
      .post(`/api/approvals/${APPROVAL_7}/resubmit`)
      .send({ payload: { title: "Retry" } });

    expect(res.status, JSON.stringify(res.body)).toBe(403);
    expect(res.body.error).toContain("Cheap status-only recovery runs cannot create or modify approvals");
    expect(mockApprovalService.resubmit).not.toHaveBeenCalled();
  });

  it("blocks status-only recovery runs from commenting on approvals", async () => {
    mockApprovalService.getById.mockResolvedValue({
      id: APPROVAL_8,
      companyId: COMPANY_1,
      type: "request_board_approval",
      status: "pending",
      payload: {},
      requestedByAgentId: "agent-1",
    });

    const res = await request(await createAgentApp({
      contextSnapshot: {
        modelProfile: "cheap",
        recoveryIntent: "status_only",
        allowDeliverableWork: false,
        allowDocumentUpdates: false,
        resumeRequiresNormalModel: true,
      },
    }))
      .post(`/api/approvals/${APPROVAL_8}/comments`)
      .send({ body: "please approve" });

    expect(res.status, JSON.stringify(res.body)).toBe(403);
    expect(res.body.error).toContain("Cheap status-only recovery runs cannot create or modify approvals");
    expect(mockApprovalService.addComment).not.toHaveBeenCalled();
  });

  it("returns 400 (not 500) for a malformed approval id on GET", async () => {
    const res = await request(await createApp()).get("/api/approvals/not-a-uuid");

    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body.error).toContain("Invalid approval ID");
    expect(mockApprovalService.getById).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed approval id on approve, without calling the service", async () => {
    const res = await request(await createApp())
      .post("/api/approvals/not-a-uuid/approve")
      .send({});

    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body.error).toContain("Invalid approval ID");
    expect(mockApprovalService.getById).not.toHaveBeenCalled();
    expect(mockApprovalService.approve).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed approval id on comments", async () => {
    const res = await request(await createApp())
      .post("/api/approvals/not-a-uuid/comments")
      .send({ body: "hello" });

    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body.error).toContain("Invalid approval ID");
    expect(mockApprovalService.getById).not.toHaveBeenCalled();
    expect(mockApprovalService.addComment).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed company id on list, without calling the service", async () => {
    const res = await request(await createApp()).get("/api/companies/not-a-uuid/approvals");

    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body.error).toContain("Invalid company ID");
    expect(mockApprovalService.list).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed company id on create, without calling the service", async () => {
    const res = await request(await createApp())
      .post("/api/companies/not-a-uuid/approvals")
      .send({ type: "request_board_approval", payload: { title: "x" } });

    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body.error).toContain("Invalid company ID");
    expect(mockApprovalService.create).not.toHaveBeenCalled();
  });
});
