CREATE TABLE IF NOT EXISTS "project_version_contracts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "version_key" text NOT NULL,
  "predecessor_version_id" uuid,
  "root_issue_id" uuid NOT NULL,
  "product_base_sha" text NOT NULL,
  "implementation_base_sha" text NOT NULL,
  "project_workspace_id" uuid,
  "specification_owner_agent_id" uuid NOT NULL,
  "canonical_spec_kind" text NOT NULL,
  "canonical_spec_path" text,
  "canonical_spec_commit_sha" text,
  "canonical_spec_blob_sha" text,
  "accepted_spec_revision_id" uuid,
  "accepted_spec_confirmation_id" uuid,
  "accepted_decomposition_id" uuid,
  "accepted_decomposition_fingerprint" text,
  "candidate_source_sha" text,
  "verification_receipt" jsonb,
  "verification_receipt_locked_at" timestamptz,
  "deployed_source_sha" text,
  "ship_receipt" jsonb,
  "ship_receipt_locked_at" timestamptz,
  "block_reason" text,
  "open_idempotency_key" text,
  "shipped_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_version_contracts" ADD CONSTRAINT "project_version_contracts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_version_contracts" ADD CONSTRAINT "project_version_contracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_version_contracts" ADD CONSTRAINT "project_version_contracts_root_issue_id_issues_id_fk" FOREIGN KEY ("root_issue_id") REFERENCES "public"."issues"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_version_contracts" ADD CONSTRAINT "project_version_contracts_specification_owner_agent_id_agents_id_fk" FOREIGN KEY ("specification_owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_version_contracts" ADD CONSTRAINT "project_version_contracts_project_workspace_id_project_workspaces_id_fk" FOREIGN KEY ("project_workspace_id") REFERENCES "public"."project_workspaces"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_version_contracts" ADD CONSTRAINT "project_version_contracts_accepted_spec_revision_id_document_revisions_id_fk" FOREIGN KEY ("accepted_spec_revision_id") REFERENCES "public"."document_revisions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_version_contracts" ADD CONSTRAINT "project_version_contracts_accepted_spec_confirmation_id_issue_thread_interactions_id_fk" FOREIGN KEY ("accepted_spec_confirmation_id") REFERENCES "public"."issue_thread_interactions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_version_contracts" ADD CONSTRAINT "project_version_contracts_accepted_decomposition_id_issue_plan_decompositions_id_fk" FOREIGN KEY ("accepted_decomposition_id") REFERENCES "public"."issue_plan_decompositions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_version_contracts" ADD CONSTRAINT "project_version_contracts_predecessor_version_id_fk" FOREIGN KEY ("predecessor_version_id") REFERENCES "public"."project_version_contracts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_version_contracts_company_project_version_uq" ON "project_version_contracts" USING btree ("company_id","project_id","version_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_version_contracts_root_issue_uq" ON "project_version_contracts" USING btree ("root_issue_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_version_contracts_one_active_per_project_uq" ON "project_version_contracts" USING btree ("company_id","project_id") WHERE "shipped_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_version_contracts_open_idempotency_uq" ON "project_version_contracts" USING btree ("company_id","project_id","open_idempotency_key") WHERE "open_idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_version_contracts_company_project_idx" ON "project_version_contracts" USING btree ("company_id","project_id");--> statement-breakpoint
ALTER TABLE "project_version_contracts" DROP CONSTRAINT IF EXISTS "project_version_contracts_sha_hex_check";--> statement-breakpoint
ALTER TABLE "project_version_contracts" ADD CONSTRAINT "project_version_contracts_sha_hex_check" CHECK (
  "product_base_sha" ~ '^[0-9a-f]{40}$'
  AND "implementation_base_sha" ~ '^[0-9a-f]{40}$'
  AND ("canonical_spec_commit_sha" IS NULL OR "canonical_spec_commit_sha" ~ '^[0-9a-f]{40}$')
  AND ("canonical_spec_blob_sha" IS NULL OR "canonical_spec_blob_sha" ~ '^[0-9a-f]{40}$')
  AND ("candidate_source_sha" IS NULL OR "candidate_source_sha" ~ '^[0-9a-f]{40}$')
  AND ("deployed_source_sha" IS NULL OR "deployed_source_sha" ~ '^[0-9a-f]{40}$')
);--> statement-breakpoint
ALTER TABLE "project_version_contracts" DROP CONSTRAINT IF EXISTS "project_version_contracts_spec_shape_check";--> statement-breakpoint
ALTER TABLE "project_version_contracts" ADD CONSTRAINT "project_version_contracts_spec_shape_check" CHECK (
  (
    "canonical_spec_kind" = 'bootstrap_file'
    AND "canonical_spec_path" IS NOT NULL
    AND "canonical_spec_commit_sha" IS NOT NULL
    AND "canonical_spec_blob_sha" IS NOT NULL
  )
  OR (
    "canonical_spec_kind" = 'plan_document'
    AND "canonical_spec_path" IS NULL
    AND "canonical_spec_commit_sha" IS NULL
    AND "canonical_spec_blob_sha" IS NULL
  )
);--> statement-breakpoint
ALTER TABLE "project_version_contracts" DROP CONSTRAINT IF EXISTS "project_version_contracts_shipped_complete_check";--> statement-breakpoint
ALTER TABLE "project_version_contracts" ADD CONSTRAINT "project_version_contracts_shipped_complete_check" CHECK (
  "shipped_at" IS NULL
  OR (
    (
      ("canonical_spec_kind" = 'bootstrap_file' AND "canonical_spec_blob_sha" IS NOT NULL)
      OR ("canonical_spec_kind" = 'plan_document' AND "accepted_spec_revision_id" IS NOT NULL)
    )
    AND "accepted_decomposition_id" IS NOT NULL
    AND "verification_receipt" IS NOT NULL
    AND "verification_receipt_locked_at" IS NOT NULL
    AND "candidate_source_sha" IS NOT NULL
    AND "deployed_source_sha" IS NOT NULL
    AND "ship_receipt" IS NOT NULL
    AND "ship_receipt_locked_at" IS NOT NULL
    AND "candidate_source_sha" = "deployed_source_sha"
  )
);
