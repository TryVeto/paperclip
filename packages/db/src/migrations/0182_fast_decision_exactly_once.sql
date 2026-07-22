-- Both predicates use namespaces introduced by this migration's server build.
-- Paperclip applies migrations before serving requests, so matching duplicates
-- indicate an unsupported partial rollout or manual write. Fail closed rather
-- than deleting or relabeling durable wake and audit history.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "agent_wakeup_requests"
    WHERE "idempotency_key" LIKE 'fast-decision-v1:escalate:%'
    GROUP BY "company_id", "agent_id", "idempotency_key"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate fast-decision escalation wakeups prevent exactly-once index creation';
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "heartbeat_run_events"
    WHERE "event_type" = 'lifecycle'
      AND "payload"->>'runtime' = 'fast-decision-v1'
      AND "payload" ? 'status'
    GROUP BY "run_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate fast-decision terminal events prevent exactly-once index creation';
  END IF;
END $$;--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, and this narrow partial index is required before enabling fast-decision escalation.
CREATE UNIQUE INDEX IF NOT EXISTS "agent_wakeup_requests_fast_decision_escalation_uq"
  ON "agent_wakeup_requests" USING btree ("company_id", "agent_id", "idempotency_key")
  WHERE "idempotency_key" LIKE 'fast-decision-v1:escalate:%';--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, and this narrow partial index is required before enabling fast-decision terminal finalization.
CREATE UNIQUE INDEX IF NOT EXISTS "heartbeat_run_events_fast_decision_terminal_uq"
  ON "heartbeat_run_events" USING btree ("run_id")
  WHERE "event_type" = 'lifecycle'
    AND "payload"->>'runtime' = 'fast-decision-v1'
    AND "payload" ? 'status';
