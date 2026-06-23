CREATE TABLE IF NOT EXISTS "heartbeat_run_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"failure_class" text NOT NULL,
	"error_code" text,
	"state" text DEFAULT 'observed' NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"first_run_id" uuid,
	"last_run_id" uuid,
	"owner_type" text,
	"owner_user_id" text,
	"next_action" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quarantined_at" timestamp with time zone,
	"dead_lettered_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM "pg_constraint" WHERE "conname" = 'heartbeat_run_failures_company_id_companies_id_fk'
	) THEN
		ALTER TABLE "heartbeat_run_failures" ADD CONSTRAINT "heartbeat_run_failures_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM "pg_constraint" WHERE "conname" = 'heartbeat_run_failures_agent_id_agents_id_fk'
	) THEN
		ALTER TABLE "heartbeat_run_failures" ADD CONSTRAINT "heartbeat_run_failures_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "heartbeat_run_failures_company_agent_state_idx" ON "heartbeat_run_failures" ("company_id","agent_id","state");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "heartbeat_run_failures_company_state_updated_idx" ON "heartbeat_run_failures" ("company_id","state","updated_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "heartbeat_run_failures_active_fingerprint_uq" ON "heartbeat_run_failures" ("company_id","agent_id","fingerprint") WHERE "state" in ('observed','quarantined','dead_letter');
--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN IF NOT EXISTS "failure_fingerprint" text;
--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN IF NOT EXISTS "failure_class" text;
--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN IF NOT EXISTS "circuit_disposition" text;
