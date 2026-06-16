import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  agentConversationTitle,
  findOrCreateAgentConversationIssue,
  isAgentConversationIssue,
} from "./agentConversationIssue";

const mockList = vi.fn();
const mockCreate = vi.fn();

vi.mock("../api/issues", () => ({
  issuesApi: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

describe("agentConversationIssue", () => {
  beforeEach(() => {
    mockList.mockReset();
    mockCreate.mockReset();
  });

  it("builds a stable conversation title", () => {
    expect(agentConversationTitle("CEO")).toBe("Conversation — CEO");
  });

  it("matches conversation issues by exact title", () => {
    expect(isAgentConversationIssue({ title: "Conversation — CEO" }, "CEO")).toBe(true);
    expect(isAgentConversationIssue({ title: "Conversation — Other" }, "CEO")).toBe(false);
  });

  it("reuses an existing conversation issue", async () => {
    const existing = { id: "issue-1", title: "Conversation — CEO" };
    mockList.mockResolvedValue([existing]);

    const issue = await findOrCreateAgentConversationIssue("company-1", {
      id: "agent-1",
      name: "CEO",
    });

    expect(issue).toBe(existing);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockList).toHaveBeenCalledWith("company-1", {
      assigneeAgentId: "agent-1",
      q: "Conversation — CEO",
      limit: 20,
      sortField: "updated",
      sortDir: "desc",
    });
  });

  it("creates a conversation issue when none exists", async () => {
    mockList.mockResolvedValue([]);
    mockCreate.mockResolvedValue({ id: "issue-2", identifier: "PAP-42", title: "Conversation — CEO" });

    const issue = await findOrCreateAgentConversationIssue("company-1", {
      id: "agent-1",
      name: "CEO",
    });

    expect(issue.id).toBe("issue-2");
    expect(mockCreate).toHaveBeenCalledWith("company-1", {
      title: "Conversation — CEO",
      description: "Direct conversation with CEO.",
      assigneeAgentId: "agent-1",
      priority: "medium",
    });
  });
});
