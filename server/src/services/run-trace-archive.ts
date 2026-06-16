import { and, asc, desc, eq, getTableColumns, gte, inArray, lt, or, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, issues, runTraceArchives } from "@paperclipai/db";
import {
  RUN_TRACE_BUNDLE_VERSION,
  type FeedbackTraceBundleCaptureStatus,
  type InstanceExperimentalSettings,
  type RunTraceArchive,
  type RunTraceArchiveListItem,
  type RunTraceArchiveStatus,
  type RunTraceBundle,
} from "@paperclipai/shared";
import { buildRunTraceBundleForRunId } from "./feedback.js";
import { instanceSettingsService } from "./instance-settings.js";

const MAX_FLUSH_BATCH = 25;
const MAX_ARCHIVE_ATTEMPTS = 5;
const TERMINAL_RUN_STATUSES = new Set(["succeeded", "failed", "cancelled", "timed_out"]);
const SUCCESSFUL_RUN_STATUSES = new Set(["succeeded", "cancelled"]);

function parseEnvAllowlistedCompanyIds(): Set<string> | null {
  const raw = process.env.RUN_TRACE_ARCHIVE_COMPANY_IDS?.trim();
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

async function resolveAllowlistedCompanyIds(
  db: Db,
  experimental: InstanceExperimentalSettings,
): Promise<Set<string>> {
  const envAllowlist = parseEnvAllowlistedCompanyIds();
  if (envAllowlist) return envAllowlist;
  return new Set(experimental.runTraceArchiveCompanyIds);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readIssueIdFromContext(contextSnapshot: unknown): string | null {
  const context = asRecord(contextSnapshot);
  const issueId = context?.issueId;
  return typeof issueId === "string" && issueId.length > 0 ? issueId : null;
}

function summarizeActivity(bundle: RunTraceBundle | null): Array<Record<string, unknown>> {
  if (!bundle) return [];
  const activityFile = bundle.files.find((file) => file.path === "paperclip/activity-log.json");
  if (!activityFile) return [];
  try {
    const parsed = JSON.parse(activityFile.contents) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => {
      const record = asRecord(row);
      if (!record) return {};
      return {
        id: record.id ?? null,
        action: record.action ?? null,
        actorType: record.actorType ?? null,
        actorId: record.actorId ?? null,
        entityType: record.entityType ?? null,
        entityId: record.entityId ?? null,
        createdAt: record.createdAt ?? null,
      };
    });
  } catch {
    return [];
  }
}

function mapArchiveRow(
  row: typeof runTraceArchives.$inferSelect,
  extras?: { agentName?: string | null; issueIdentifier?: string | null; issueTitle?: string | null },
): RunTraceArchive | RunTraceArchiveListItem {
  const base: RunTraceArchive = {
    id: row.id,
    companyId: row.companyId,
    runId: row.runId,
    agentId: row.agentId,
    issueId: row.issueId,
    runStatus: row.runStatus,
    status: row.status as RunTraceArchiveStatus,
    bundleVersion: row.bundleVersion,
    captureStatus: (row.captureStatus as FeedbackTraceBundleCaptureStatus | null) ?? null,
    attemptCount: row.attemptCount,
    failureReason: row.failureReason,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  if (!extras) return base;
  return {
    ...base,
    agentName: extras.agentName ?? null,
    issueIdentifier: extras.issueIdentifier ?? null,
    issueTitle: extras.issueTitle ?? null,
  };
}

const archiveColumns = getTableColumns(runTraceArchives);

export function runTraceArchiveService(db: Db) {
  const settingsSvc = instanceSettingsService(db);

  return {
    async resolveAllowlistedCompanyIds() {
      const experimental = await settingsSvc.getExperimental();
      return resolveAllowlistedCompanyIds(db, experimental);
    },

    async isCompanyAllowlisted(companyId: string) {
      const allowlist = await this.resolveAllowlistedCompanyIds();
      return allowlist.has(companyId);
    },

    async notifyRunTerminalStatus(run: {
      id: string;
      companyId: string;
      agentId: string;
      status: string;
      contextSnapshot: unknown;
    }) {
      if (!TERMINAL_RUN_STATUSES.has(run.status)) return null;

      const experimental = await settingsSvc.getExperimental();
      const allowlist = await resolveAllowlistedCompanyIds(db, experimental);
      if (!allowlist.has(run.companyId)) return null;

      const issueId = readIssueIdFromContext(run.contextSnapshot);
      const inserted = await db
        .insert(runTraceArchives)
        .values({
          companyId: run.companyId,
          runId: run.id,
          agentId: run.agentId,
          issueId,
          runStatus: run.status,
          status: "pending",
          bundleVersion: RUN_TRACE_BUNDLE_VERSION,
        })
        .onConflictDoNothing({ target: runTraceArchives.runId })
        .returning()
        .then((rows) => rows[0] ?? null);

      return inserted ? mapArchiveRow(inserted) : null;
    },

    async pruneExpiredArchives(input?: { now?: Date }) {
      const now = input?.now ?? new Date();
      const experimental = await settingsSvc.getExperimental();
      const succeededCutoff = new Date(
        now.getTime() - experimental.runTraceArchiveSucceededRetentionDays * 86_400_000,
      );
      const failedCutoff = new Date(
        now.getTime() - experimental.runTraceArchiveFailedRetentionDays * 86_400_000,
      );

      const deleted = await db
        .delete(runTraceArchives)
        .where(
          and(
            or(
              and(
                inArray(runTraceArchives.runStatus, ["succeeded", "cancelled"]),
                inArray(runTraceArchives.status, ["ready", "failed"]),
                lt(runTraceArchives.createdAt, succeededCutoff),
              ),
              and(
                inArray(runTraceArchives.runStatus, ["failed", "timed_out"]),
                inArray(runTraceArchives.status, ["ready", "failed"]),
                lt(runTraceArchives.createdAt, failedCutoff),
              ),
            ),
          ),
        )
        .returning({ id: runTraceArchives.id });

      return { prunedCount: deleted.length };
    },

    async flushPendingArchives(input?: { companyId?: string; archiveId?: string; limit?: number }) {
      await this.pruneExpiredArchives();

      const filters = [eq(runTraceArchives.status, "pending")];
      if (input?.companyId) filters.push(eq(runTraceArchives.companyId, input.companyId));
      if (input?.archiveId) filters.push(eq(runTraceArchives.id, input.archiveId));

      const rows = await db
        .select()
        .from(runTraceArchives)
        .where(and(...filters))
        .orderBy(asc(runTraceArchives.createdAt), asc(runTraceArchives.id))
        .limit(Math.max(1, Math.min(input?.limit ?? MAX_FLUSH_BATCH, 200)));

      const results: Array<{ archiveId: string; status: RunTraceArchiveStatus }> = [];
      for (const row of rows) {
        const nextAttempt = row.attemptCount + 1;
        try {
          const bundle = await buildRunTraceBundleForRunId(db, {
            companyId: row.companyId,
            runId: row.runId,
          });
          if (!bundle) {
            throw new Error("run_trace_bundle_unavailable");
          }

          const activitySummary = summarizeActivity(bundle);
          const bundleSnapshot = {
            captureStatus: bundle.captureStatus,
            notes: bundle.notes,
            envelope: bundle.envelope,
            integrity: bundle.integrity,
            adapterType: bundle.adapterType,
            fileCount: bundle.files.length,
          };

          await db
            .update(runTraceArchives)
            .set({
              status: "ready",
              captureStatus: bundle.captureStatus,
              bundleSnapshot,
              activitySummary,
              attemptCount: nextAttempt,
              failureReason: null,
              archivedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(runTraceArchives.id, row.id));

          results.push({ archiveId: row.id, status: "ready" });
        } catch (error) {
          const failureReason =
            error instanceof Error ? error.message.slice(0, 500) : "run_trace_archive_failed";
          const terminal = nextAttempt >= MAX_ARCHIVE_ATTEMPTS;
          await db
            .update(runTraceArchives)
            .set({
              status: terminal ? "failed" : "pending",
              attemptCount: nextAttempt,
              failureReason,
              updatedAt: new Date(),
            })
            .where(eq(runTraceArchives.id, row.id));
          results.push({ archiveId: row.id, status: terminal ? "failed" : "pending" });
        }
      }

      return results;
    },

    async listArchives(input: {
      companyId: string;
      since?: Date;
      agentId?: string;
      runId?: string;
      status?: RunTraceArchiveStatus;
      runStatus?: string;
      limit?: number;
    }) {
      const filters = [eq(runTraceArchives.companyId, input.companyId)];
      if (input.since) filters.push(gte(runTraceArchives.createdAt, input.since));
      if (input.agentId) filters.push(eq(runTraceArchives.agentId, input.agentId));
      if (input.runId) filters.push(eq(runTraceArchives.runId, input.runId));
      if (input.status) filters.push(eq(runTraceArchives.status, input.status));
      if (input.runStatus) filters.push(eq(runTraceArchives.runStatus, input.runStatus));

      const rows = await db
        .select({
          ...archiveColumns,
          agentName: agents.name,
          issueIdentifier: issues.identifier,
          issueTitle: issues.title,
        })
        .from(runTraceArchives)
        .leftJoin(agents, eq(runTraceArchives.agentId, agents.id))
        .leftJoin(issues, eq(runTraceArchives.issueId, issues.id))
        .where(and(...filters))
        .orderBy(desc(runTraceArchives.createdAt))
        .limit(Math.max(1, Math.min(input.limit ?? 100, 500)));

      return rows.map((row) =>
        mapArchiveRow(row, {
          agentName: row.agentName,
          issueIdentifier: row.issueIdentifier,
          issueTitle: row.issueTitle,
        }) as RunTraceArchiveListItem,
      );
    },

    async getArchiveById(archiveId: string) {
      const row = await db
        .select({
          ...archiveColumns,
          agentName: agents.name,
          issueIdentifier: issues.identifier,
          issueTitle: issues.title,
        })
        .from(runTraceArchives)
        .leftJoin(agents, eq(runTraceArchives.agentId, agents.id))
        .leftJoin(issues, eq(runTraceArchives.issueId, issues.id))
        .where(eq(runTraceArchives.id, archiveId))
        .then((rows) => rows[0] ?? null);

      return row
        ? (mapArchiveRow(row, {
            agentName: row.agentName,
            issueIdentifier: row.issueIdentifier,
            issueTitle: row.issueTitle,
          }) as RunTraceArchiveListItem)
        : null;
    },

    async getArchiveBundle(archiveId: string): Promise<RunTraceBundle | null> {
      const row = await db
        .select()
        .from(runTraceArchives)
        .where(and(eq(runTraceArchives.id, archiveId), eq(runTraceArchives.status, "ready")))
        .then((rows) => rows[0] ?? null);
      if (!row) return null;
      return buildRunTraceBundleForRunId(db, {
        companyId: row.companyId,
        runId: row.runId,
      });
    },

    pendingCount(companyId?: string) {
      const filters = [eq(runTraceArchives.status, "pending")];
      if (companyId) filters.push(eq(runTraceArchives.companyId, companyId));
      return db
        .select({ count: sql<number>`count(*)::int` })
        .from(runTraceArchives)
        .where(and(...filters))
        .then((rows) => rows[0]?.count ?? 0);
    },
  };
}

export type RunTraceArchiveService = ReturnType<typeof runTraceArchiveService>;

/** @internal Exported for integration tests. */
export { SUCCESSFUL_RUN_STATUSES, TERMINAL_RUN_STATUSES };
