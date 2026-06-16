CREATE TABLE "run_trace_archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"issue_id" uuid,
	"run_status" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"bundle_version" text DEFAULT 'paperclip-run-trace-v1' NOT NULL,
	"capture_status" text,
	"bundle_snapshot" jsonb,
	"activity_summary" jsonb,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"failure_reason" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "run_trace_archives" ADD CONSTRAINT "run_trace_archives_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "run_trace_archives" ADD CONSTRAINT "run_trace_archives_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "run_trace_archives" ADD CONSTRAINT "run_trace_archives_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "run_trace_archives" ADD CONSTRAINT "run_trace_archives_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "run_trace_archives_run_idx" ON "run_trace_archives" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX "run_trace_archives_company_created_idx" ON "run_trace_archives" USING btree ("company_id","created_at");
--> statement-breakpoint
CREATE INDEX "run_trace_archives_company_status_idx" ON "run_trace_archives" USING btree ("company_id","status","created_at");
--> statement-breakpoint
CREATE INDEX "run_trace_archives_company_agent_idx" ON "run_trace_archives" USING btree ("company_id","agent_id","created_at");
