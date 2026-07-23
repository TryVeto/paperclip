import { pgTable, uuid, text, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * Board-pre-registered one-use classification tokens for canary/synthetic/probe runs.
 * Ordinary Desktop/Inkbox payloads cannot set traffic_class; only consuming a valid token
 * (or a trusted board/agent session boundary) may stamp non-system classes.
 */
export const runClassificationTokens = pgTable(
  "run_classification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    trafficClass: text("traffic_class").notNull(),
    actionable: boolean("actionable").notNull().default(false),
    actionabilityReason: text("actionability_reason").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    consumedByRunId: uuid("consumed_by_run_id"),
    createdByActorType: text("created_by_actor_type"),
    createdByActorId: text("created_by_actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyTokenUq: uniqueIndex("run_classification_tokens_company_token_hash_uq").on(
      table.companyId,
      table.tokenHash,
    ),
    companyExpiresIdx: index("run_classification_tokens_company_expires_idx").on(
      table.companyId,
      table.expiresAt,
    ),
  }),
);
