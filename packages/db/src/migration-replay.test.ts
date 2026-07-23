import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import { applyPendingMigrations, inspectMigrations } from "./client.js";
import { getEmbeddedPostgresTestSupport, startEmbeddedPostgresTestDatabase } from "./test-embedded-postgres.js";

const cleanups: Array<() => Promise<void>> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

describeEmbeddedPostgres("migration journal append-only + replay", () => {
  afterEach(async () => Promise.all(cleanups.splice(0).map((cleanup) => cleanup())));

  it("applies full journal, is idempotent on re-apply, and replays tip migration", async () => {
    const database = await startEmbeddedPostgresTestDatabase("paperclip-migration-replay-");
    cleanups.push(database.cleanup);
    const sql = postgres(database.connectionString, { max: 1 });
    cleanups.push(async () => {
      await sql.end({ timeout: 5 });
    });

    await applyPendingMigrations(database.connectionString);
    const afterFirst = await inspectMigrations(database.connectionString);
    expect(afterFirst.status).toBe("upToDate");
    expect(afterFirst.availableMigrations.length).toBeGreaterThan(180);
    expect(afterFirst.availableMigrations.at(-1)).toBe("0186_run_traffic_classification.sql");

    // Idempotent re-apply (restart/replay)
    await applyPendingMigrations(database.connectionString);
    const afterSecond = await inspectMigrations(database.connectionString);
    expect(afterSecond.status).toBe("upToDate");
    expect(afterSecond.appliedMigrations).toEqual(afterFirst.appliedMigrations);

    // Tip columns exist
    const cols = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'heartbeat_runs'
        AND column_name IN ('traffic_class','actionable','actionability_reason','request_received_at')
      ORDER BY 1
    `;
    expect(cols.map((c) => c.column_name)).toEqual([
      "actionability_reason",
      "actionable",
      "request_received_at",
      "traffic_class",
    ]);

    const tokens = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'run_classification_tokens'
      ) AS exists
    `;
    expect(tokens[0]?.exists).toBe(true);

    // Simulate tip rollback (drop objects + remove journal row), then replay
    const tipRows = await sql<{ hash: string; created_at: string }[]>`
      SELECT hash, created_at::text AS created_at
      FROM "drizzle"."__drizzle_migrations"
      ORDER BY created_at DESC
      LIMIT 1
    `;
    expect(tipRows.length).toBe(1);
    await sql`DELETE FROM "drizzle"."__drizzle_migrations" WHERE "hash" = ${tipRows[0]!.hash}`;
    await sql`ALTER TABLE "heartbeat_runs" DROP CONSTRAINT IF EXISTS "heartbeat_runs_traffic_class_check"`;
    await sql`ALTER TABLE "heartbeat_runs" DROP COLUMN IF EXISTS "traffic_class"`;
    await sql`ALTER TABLE "heartbeat_runs" DROP COLUMN IF EXISTS "actionable"`;
    await sql`ALTER TABLE "heartbeat_runs" DROP COLUMN IF EXISTS "actionability_reason"`;
    await sql`ALTER TABLE "heartbeat_runs" DROP COLUMN IF EXISTS "request_received_at"`;
    await sql`DROP TABLE IF EXISTS "run_classification_tokens"`;

    const pending = await inspectMigrations(database.connectionString);
    expect(pending.status).toBe("needsMigrations");
    expect(pending.pendingMigrations.some((m) => m.includes("0186_run_traffic_classification"))).toBe(
      true,
    );

    await applyPendingMigrations(database.connectionString);
    const afterReplay = await inspectMigrations(database.connectionString);
    expect(afterReplay.status).toBe("upToDate");

    const colsAfter = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'heartbeat_runs' AND column_name = 'traffic_class'
    `;
    expect(colsAfter).toHaveLength(1);
  }, 120_000);
});
