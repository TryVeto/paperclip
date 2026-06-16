import type { FeedbackTraceBundle, FeedbackTraceBundleCaptureStatus } from "./feedback.js";

export const RUN_TRACE_ARCHIVE_STATUSES = ["pending", "ready", "failed"] as const;
export type RunTraceArchiveStatus = (typeof RUN_TRACE_ARCHIVE_STATUSES)[number];

export const RUN_TRACE_BUNDLE_VERSION = "paperclip-run-trace-v1";

export interface RunTraceArchiveActivitySummaryItem {
  id: string;
  action: string;
  actorType: string;
  actorId: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  details: Record<string, unknown> | null;
}

export interface RunTraceArchive {
  id: string;
  companyId: string;
  runId: string;
  agentId: string;
  issueId: string | null;
  runStatus: string;
  status: RunTraceArchiveStatus;
  bundleVersion: string;
  captureStatus: FeedbackTraceBundleCaptureStatus | null;
  attemptCount: number;
  failureReason: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RunTraceArchiveListItem extends RunTraceArchive {
  agentName: string | null;
  issueIdentifier: string | null;
  issueTitle: string | null;
}

export type RunTraceBundle = FeedbackTraceBundle;
