ALTER TABLE "heartbeat_runs"
  ADD COLUMN IF NOT EXISTS "traffic_class" text NOT NULL DEFAULT 'system';
--> statement-breakpoint
ALTER TABLE "heartbeat_runs"
  ADD COLUMN IF NOT EXISTS "actionable" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "heartbeat_runs"
  ADD COLUMN IF NOT EXISTS "actionability_reason" text NOT NULL DEFAULT 'unset_fail_closed';
--> statement-breakpoint
ALTER TABLE "heartbeat_runs"
  ADD COLUMN IF NOT EXISTS "request_received_at" timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
ALTER TABLE "heartbeat_runs"
  DROP CONSTRAINT IF EXISTS "heartbeat_runs_traffic_class_check";
--> statement-breakpoint
ALTER TABLE "heartbeat_runs"
  ADD CONSTRAINT "heartbeat_runs_traffic_class_check" CHECK (
    "traffic_class" IN ('natural', 'canary', 'synthetic', 'operator_probe', 'system')
  );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "run_classification_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "traffic_class" text NOT NULL,
  "actionable" boolean NOT NULL DEFAULT false,
  "actionability_reason" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "consumed_by_run_id" uuid,
  "created_by_actor_type" text,
  "created_by_actor_id" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "run_classification_tokens" ADD CONSTRAINT "run_classification_tokens_company_id_companies_id_fk"
   FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "run_classification_tokens_company_token_hash_uq"
  ON "run_classification_tokens" ("company_id", "token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "run_classification_tokens_company_expires_idx"
  ON "run_classification_tokens" ("company_id", "expires_at");
--> statement-breakpoint
ALTER TABLE "run_classification_tokens"
  DROP CONSTRAINT IF EXISTS "run_classification_tokens_traffic_class_check";
--> statement-breakpoint
ALTER TABLE "run_classification_tokens"
  ADD CONSTRAINT "run_classification_tokens_traffic_class_check" CHECK (
    "traffic_class" IN ('natural', 'canary', 'synthetic', 'operator_probe', 'system')
  );
