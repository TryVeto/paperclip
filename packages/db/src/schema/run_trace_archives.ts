import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { heartbeatRuns } from "./heartbeat_runs.js";
import { issues } from "./issues.js";

export const runTraceArchives = pgTable(
  "run_trace_archives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    runId: uuid("run_id").notNull().references(() => heartbeatRuns.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    runStatus: text("run_status").notNull(),
    status: text("status").notNull().default("pending"),
    bundleVersion: text("bundle_version").notNull().default("paperclip-run-trace-v1"),
    captureStatus: text("capture_status"),
    bundleSnapshot: jsonb("bundle_snapshot").$type<Record<string, unknown>>(),
    activitySummary: jsonb("activity_summary").$type<Array<Record<string, unknown>>>(),
    attemptCount: integer("attempt_count").notNull().default(0),
    failureReason: text("failure_reason"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runUniqueIdx: uniqueIndex("run_trace_archives_run_idx").on(table.runId),
    companyCreatedIdx: index("run_trace_archives_company_created_idx").on(table.companyId, table.createdAt),
    companyStatusIdx: index("run_trace_archives_company_status_idx").on(table.companyId, table.status, table.createdAt),
    companyAgentIdx: index("run_trace_archives_company_agent_idx").on(table.companyId, table.agentId, table.createdAt),
  }),
);
