import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

/**
 * Run-level circuit-breaker ledger. One active row tracks the consecutive
 * same-fingerprint failure streak for an (company, agent, fingerprint) tuple so
 * the scheduler can quarantine / dead-letter instead of blindly requeueing a
 * crash-looping run. A successful run resolves the agent's active rows, resetting
 * the breaker. This is distinct from `issue_recovery_actions` (issue-level
 * escalation); it guards the run dispatch loop itself.
 *
 * state lifecycle: observed -> quarantined -> dead_letter (terminal), or
 * any active state -> resolved when the agent next succeeds.
 */
export const heartbeatRunFailures = pgTable(
  "heartbeat_run_failures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    fingerprint: text("fingerprint").notNull(),
    failureClass: text("failure_class").notNull(),
    errorCode: text("error_code"),
    state: text("state").notNull().default("observed"),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    firstRunId: uuid("first_run_id"),
    lastRunId: uuid("last_run_id"),
    ownerType: text("owner_type"),
    ownerUserId: text("owner_user_id"),
    nextAction: text("next_action"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    quarantinedAt: timestamp("quarantined_at", { withTimezone: true }),
    deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentStateIdx: index("heartbeat_run_failures_company_agent_state_idx").on(
      table.companyId,
      table.agentId,
      table.state,
    ),
    companyStateUpdatedIdx: index("heartbeat_run_failures_company_state_updated_idx").on(
      table.companyId,
      table.state,
      table.updatedAt,
    ),
    activeFingerprintUq: uniqueIndex("heartbeat_run_failures_active_fingerprint_uq")
      .on(table.companyId, table.agentId, table.fingerprint)
      .where(sql`${table.state} in ('observed', 'quarantined', 'dead_letter')`),
  }),
);
