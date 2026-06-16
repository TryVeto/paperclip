import type { EvalTrace, EvalTraceActivity } from "../types.js";

export async function pollRunUntilTerminal(
  apiBaseUrl: string,
  companyId: string,
  runId: string,
  options: { timeoutMs?: number; intervalMs?: number; token?: string } = {},
): Promise<{ runStatus: string; resultJson: Record<string, unknown> | null }> {
  const timeoutMs = options.timeoutMs ?? 20 * 60 * 1000;
  const intervalMs = options.intervalMs ?? 5_000;
  const started = Date.now();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  while (Date.now() - started < timeoutMs) {
    const url = new URL(`/api/agents/runs/${runId}`, apiBaseUrl);
    const res = await fetch(url, { headers });
    if (res.ok) {
      const run = await res.json() as { status?: string; resultJson?: Record<string, unknown> | null };
      if (run.status && ["succeeded", "failed", "cancelled", "timed_out"].includes(run.status)) {
        return { runStatus: run.status, resultJson: run.resultJson ?? null };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for run ${runId}`);
}

export function activityFromArchiveBundle(bundle: Record<string, unknown>, context: {
  runId: string;
  companyId: string;
  agentId: string;
  issueId: string | null;
  runStatus: string;
}): EvalTrace {
  const files = Array.isArray(bundle.files) ? bundle.files as Array<{ path?: string; contents?: string }> : [];
  const activityFile = files.find((file) => file.path === "paperclip/activity-log.json");
  let activity: EvalTraceActivity[] = [];
  if (activityFile?.contents) {
    try {
      const parsed = JSON.parse(activityFile.contents) as unknown;
      if (Array.isArray(parsed)) {
        activity = parsed.map((row) => {
          const record = row as Record<string, unknown>;
          return {
            id: String(record.id ?? ""),
            action: String(record.action ?? ""),
            actorType: String(record.actorType ?? ""),
            actorId: String(record.actorId ?? ""),
            entityType: String(record.entityType ?? ""),
            entityId: String(record.entityId ?? ""),
            createdAt: String(record.createdAt ?? ""),
            details: (record.details as Record<string, unknown> | null | undefined) ?? null,
          };
        });
      }
    } catch {
      activity = [];
    }
  }

  const paperclipRun = bundle.paperclipRun as Record<string, unknown> | null | undefined;
  return {
    runId: context.runId,
    companyId: context.companyId,
    agentId: context.agentId,
    issueId: context.issueId,
    runStatus: context.runStatus,
    activity,
    resultJson: (paperclipRun?.result as Record<string, unknown> | null | undefined) ?? null,
  };
}
