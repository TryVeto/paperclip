import { describe, expect, it } from "vitest";
import { checkCheckoutBeforeWork, checkCommentBeforeExit, runHardChecks } from "./hard-checks.js";
import type { EvalTrace } from "../types.js";

const baseTrace: EvalTrace = {
  runId: "run-1",
  companyId: "company-1",
  agentId: "agent-1",
  issueId: "issue-1",
  runStatus: "succeeded",
  activity: [],
};

describe("eval hard checks", () => {
  it("passes checkout when lease precedes mutation", () => {
    const trace: EvalTrace = {
      ...baseTrace,
      activity: [
        { id: "1", action: "environment.lease_acquired", actorType: "agent", actorId: "agent-1", entityType: "issue", entityId: "issue-1", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "2", action: "issue.updated", actorType: "agent", actorId: "agent-1", entityType: "issue", entityId: "issue-1", createdAt: "2026-01-01T00:01:00.000Z" },
      ],
    };
    expect(checkCheckoutBeforeWork(trace).pass).toBe(true);
  });

  it("requires comment on terminal exit", () => {
    const withoutComment = checkCommentBeforeExit({ ...baseTrace, activity: [] });
    expect(withoutComment.pass).toBe(false);

    const withComment = checkCommentBeforeExit({
      ...baseTrace,
      activity: [
        { id: "1", action: "issue_comment.created", actorType: "agent", actorId: "agent-1", entityType: "issue_comment", entityId: "c-1", createdAt: "2026-01-01T00:00:00.000Z" },
      ],
    });
    expect(withComment.pass).toBe(true);
  });

  it("runs expected check set", () => {
    const checks = runHardChecks(baseTrace, ["company_boundary", "no_work_exit"], { companyId: "company-1" });
    expect(checks).toHaveLength(2);
    expect(checks.every((check) => check.pass)).toBe(true);
  });
});
