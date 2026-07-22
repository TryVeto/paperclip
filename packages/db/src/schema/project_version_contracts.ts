import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { documentRevisions } from "./document_revisions.js";
import { issuePlanDecompositions } from "./issue_plan_decompositions.js";
import { issueThreadInteractions } from "./issue_thread_interactions.js";
import { issues } from "./issues.js";
import { projectWorkspaces } from "./project_workspaces.js";
import { projects } from "./projects.js";

/**
 * Version capsule: one active (unshipped) version per project.
 * Display state is derived from evidence columns — not a separate status field.
 */
export const projectVersionContracts = pgTable(
  "project_version_contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    versionKey: text("version_key").notNull(),
    predecessorVersionId: uuid("predecessor_version_id"),
    rootIssueId: uuid("root_issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "restrict" }),

    productBaseSha: text("product_base_sha").notNull(),
    implementationBaseSha: text("implementation_base_sha").notNull(),
    projectWorkspaceId: uuid("project_workspace_id").references(() => projectWorkspaces.id, {
      onDelete: "set null",
    }),

    specificationOwnerAgentId: uuid("specification_owner_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),

    /** Exactly one shape: bootstrap file ref XOR document-backed plan. */
    canonicalSpecKind: text("canonical_spec_kind").notNull(), // "bootstrap_file" | "plan_document"
    canonicalSpecPath: text("canonical_spec_path"),
    canonicalSpecCommitSha: text("canonical_spec_commit_sha"),
    canonicalSpecBlobSha: text("canonical_spec_blob_sha"),

    acceptedSpecRevisionId: uuid("accepted_spec_revision_id").references(() => documentRevisions.id, {
      onDelete: "set null",
    }),
    acceptedSpecConfirmationId: uuid("accepted_spec_confirmation_id").references(
      () => issueThreadInteractions.id,
      { onDelete: "set null" },
    ),

    acceptedDecompositionId: uuid("accepted_decomposition_id").references(
      () => issuePlanDecompositions.id,
      { onDelete: "set null" },
    ),
    acceptedDecompositionFingerprint: text("accepted_decomposition_fingerprint"),

    candidateSourceSha: text("candidate_source_sha"),
    verificationReceipt: jsonb("verification_receipt").$type<Record<string, unknown>>(),
    verificationReceiptLockedAt: timestamp("verification_receipt_locked_at", { withTimezone: true }),

    deployedSourceSha: text("deployed_source_sha"),
    shipReceipt: jsonb("ship_receipt").$type<Record<string, unknown>>(),
    shipReceiptLockedAt: timestamp("ship_receipt_locked_at", { withTimezone: true }),

    blockReason: text("block_reason"),
    openIdempotencyKey: text("open_idempotency_key"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectVersionUq: uniqueIndex("project_version_contracts_company_project_version_uq").on(
      table.companyId,
      table.projectId,
      table.versionKey,
    ),
    rootIssueUq: uniqueIndex("project_version_contracts_root_issue_uq").on(table.rootIssueId),
    oneActivePerProjectUq: uniqueIndex("project_version_contracts_one_active_per_project_uq")
      .on(table.companyId, table.projectId)
      .where(sql`${table.shippedAt} IS NULL`),
    openIdempotencyUq: uniqueIndex("project_version_contracts_open_idempotency_uq")
      .on(table.companyId, table.projectId, table.openIdempotencyKey)
      .where(sql`${table.openIdempotencyKey} IS NOT NULL`),
    companyProjectIdx: index("project_version_contracts_company_project_idx").on(
      table.companyId,
      table.projectId,
    ),
  }),
);
