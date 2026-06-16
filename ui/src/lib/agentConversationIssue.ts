import type { Issue } from "@paperclipai/shared";
import { issuesApi } from "../api/issues";

export const AGENT_CONVERSATION_TITLE_PREFIX = "Conversation — ";

export function agentConversationTitle(agentName: string): string {
  return `${AGENT_CONVERSATION_TITLE_PREFIX}${agentName}`;
}

export function isAgentConversationIssue(
  issue: Pick<Issue, "title">,
  agentName: string,
): boolean {
  return issue.title === agentConversationTitle(agentName);
}

export async function findOrCreateAgentConversationIssue(
  companyId: string,
  agent: { id: string; name: string },
): Promise<Issue> {
  const title = agentConversationTitle(agent.name);
  const candidates = await issuesApi.list(companyId, {
    assigneeAgentId: agent.id,
    q: title,
    limit: 20,
    sortField: "updated",
    sortDir: "desc",
  });
  const existing = candidates.find((issue) => isAgentConversationIssue(issue, agent.name));
  if (existing) return existing;

  return issuesApi.create(companyId, {
    title,
    description: `Direct conversation with ${agent.name}.`,
    assigneeAgentId: agent.id,
    priority: "medium",
  });
}
