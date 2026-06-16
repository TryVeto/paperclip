import { Command } from "commander";
import type { RunTraceArchiveListItem, RunTraceBundle } from "@paperclipai/shared";
import {
  addCommonClientOptions,
  apiPath,
  formatInlineRecord,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface RunTraceListOptions extends BaseClientOptions {
  companyId?: string;
  since?: string;
  agentId?: string;
  runId?: string;
  status?: string;
  runStatus?: string;
  limit?: string;
}

interface RunTraceGetOptions extends BaseClientOptions {
  archiveId?: string;
}

export function registerRunTraceCommands(program: Command): void {
  const runTraces = program.command("run-traces").description("Run trace archive operations");

  addCommonClientOptions(
    runTraces
      .command("list")
      .description("List archived run traces for a company")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .option("--since <iso>", "Only archives created after this timestamp")
      .option("--agent-id <id>", "Filter by agent ID")
      .option("--run-id <id>", "Filter by heartbeat run ID")
      .option("--status <status>", "Archive status: pending, ready, failed")
      .option("--run-status <status>", "Terminal run status filter")
      .option("--limit <n>", "Max rows (default 100)")
      .action(async (opts: RunTraceListOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const params = new URLSearchParams();
          if (opts.since) params.set("since", opts.since);
          if (opts.agentId) params.set("agentId", opts.agentId);
          if (opts.runId) params.set("runId", opts.runId);
          if (opts.status) params.set("status", opts.status);
          if (opts.runStatus) params.set("runStatus", opts.runStatus);
          if (opts.limit) params.set("limit", opts.limit);

          const query = params.toString();
          const path = `${apiPath`/api/companies/${ctx.companyId}/run-traces`}${query ? `?${query}` : ""}`;
          const rows = (await ctx.api.get<RunTraceArchiveListItem[]>(path)) ?? [];

          if (ctx.json) {
            printOutput(rows, { json: true });
            return;
          }

          for (const row of rows) {
            console.log(
              formatInlineRecord({
                id: row.id,
                runId: row.runId,
                agentName: row.agentName,
                issueIdentifier: row.issueIdentifier,
                runStatus: row.runStatus,
                status: row.status,
                captureStatus: row.captureStatus,
                archivedAt: row.archivedAt ? String(row.archivedAt) : null,
              }),
            );
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  addCommonClientOptions(
    runTraces
      .command("get")
      .description("Get a run trace archive row")
      .requiredOption("--archive-id <id>", "Archive ID")
      .action(async (opts: RunTraceGetOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const row = await ctx.api.get<RunTraceArchiveListItem>(
            apiPath`/api/run-traces/${opts.archiveId}`,
          );
          printOutput(row, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    runTraces
      .command("bundle")
      .description("Get the full run trace bundle for an archive")
      .requiredOption("--archive-id <id>", "Archive ID")
      .action(async (opts: RunTraceGetOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const bundle = await ctx.api.get<RunTraceBundle>(
            apiPath`/api/run-traces/${opts.archiveId}/bundle`,
          );
          printOutput(bundle, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );
}
