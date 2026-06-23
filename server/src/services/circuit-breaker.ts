import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { heartbeatRunFailures, type Db } from "@paperclipai/db";

/**
 * Run-level scheduler circuit breaker.
 *
 * The dispatch loop used to requeue generic failures (adapter_failed,
 * setup_failed, process_lost, ...) without bound, so a run that fails the same
 * way every time crash-loops forever. This module centralizes failure
 * classification and a per-(company, agent, fingerprint) failure streak so the
 * scheduler can:
 *   - never requeue terminal classes (security / config / non-retryable), and
 *   - quarantine after the 2nd identical failure and dead-letter after the 3rd,
 *     instead of blindly requeueing.
 *
 * It is intentionally separate from the issue-level recovery escalation in
 * recovery/service.ts: this guards the run dispatch loop itself.
 */

export type FailureClass =
  | "transient_infra"
  | "provider_rate_limit"
  | "configuration"
  | "security"
  | "non_retryable"
  | "unknown";

export type CircuitDisposition = "retry" | "quarantine" | "dead_letter" | "block";

export const CIRCUIT_QUARANTINE_THRESHOLD = 2;
export const CIRCUIT_DEAD_LETTER_THRESHOLD = 3;

const ACTIVE_STATES = ["observed", "quarantined", "dead_letter"] as const;

// Terminal — never requeue. A retry cannot fix these; they need a human or a
// config change. Mirrors the non-retryable + configuration codes already used
// by recovery/service.ts and the codex-local terminal-failure reference.
const CONFIGURATION_CODES = new Set<string>([
  "configuration_incomplete",
  "workspace_validation_failed",
]);
const SECURITY_CODES = new Set<string>([
  "security_violation",
  "secret_exposure",
  "unsafe_instructions",
  "instructions_violation",
  "receipt_auth_failed",
  "receipt_verification_failed",
]);
const NON_RETRYABLE_CODES = new Set<string>([
  "agent_not_invokable",
  "agent_not_found",
  "budget_blocked",
  "budget_exhausted",
  "issue_paused",
  "issue_dependencies_blocked",
]);

// Requeueable, but still tracked by the breaker so a repeating failure is
// quarantined rather than looped forever.
const PROVIDER_RATE_LIMIT_CODES = new Set<string>(["provider_rate_limit"]);
const TRANSIENT_INFRA_CODES = new Set<string>([
  "adapter_failed",
  "setup_failed",
  "timeout",
  "process_lost",
  "codex_transient_upstream",
  "claude_transient_upstream",
]);

const RATE_LIMIT_MESSAGE_RE = /\b(rate[\s_-]?limit(?:ed|ing)?|429|too many requests|quota (?:exceeded|exhausted))\b/i;

export type FailureClassification = {
  failureClass: FailureClass;
  /** Terminal classes are never requeued. */
  terminal: boolean;
  /** Stable hash grouping identical failures of the same agent. */
  fingerprint: string;
  errorCode: string | null;
};

function normalizeCode(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Reduce a free-form error string to a stable signature by stripping the parts
 * that vary per occurrence (ids, numbers, timestamps, hex, paths), so the same
 * underlying failure produces the same fingerprint across runs.
 */
function normalizeErrorSignature(error: string | null | undefined): string {
  if (typeof error !== "string" || error.trim().length === 0) return "";
  return error
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>")
    .replace(/\b\d{4}-\d{2}-\d{2}t[\d:.]+z?\b/g, "<ts>")
    .replace(/0x[0-9a-f]+/g, "<hex>")
    .replace(/\/[^\s'"]+/g, "<path>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function classifyRunFailure(input: {
  agentId: string;
  errorCode?: string | null;
  error?: string | null;
}): FailureClassification {
  const errorCode = normalizeCode(input.errorCode);
  const error = typeof input.error === "string" ? input.error : null;

  let failureClass: FailureClass;
  let terminal: boolean;

  if (errorCode && SECURITY_CODES.has(errorCode)) {
    failureClass = "security";
    terminal = true;
  } else if (errorCode && CONFIGURATION_CODES.has(errorCode)) {
    failureClass = "configuration";
    terminal = true;
  } else if (errorCode && NON_RETRYABLE_CODES.has(errorCode)) {
    failureClass = "non_retryable";
    terminal = true;
  } else if (
    (errorCode && PROVIDER_RATE_LIMIT_CODES.has(errorCode)) ||
    (!!error && RATE_LIMIT_MESSAGE_RE.test(error))
  ) {
    failureClass = "provider_rate_limit";
    terminal = false;
  } else if (errorCode && TRANSIENT_INFRA_CODES.has(errorCode)) {
    failureClass = "transient_infra";
    terminal = false;
  } else {
    failureClass = "unknown";
    terminal = false;
  }

  const fingerprint = createHash("sha1")
    .update(`${input.agentId}|${failureClass}|${errorCode ?? ""}|${normalizeErrorSignature(error)}`)
    .digest("hex")
    .slice(0, 16);

  return { failureClass, terminal, fingerprint, errorCode };
}

export type CircuitEvaluation = {
  disposition: CircuitDisposition;
  occurrenceCount: number;
  state: string;
  failureId: string | null;
};

/**
 * Record a failed run against the breaker ledger and decide whether it may be
 * requeued. Terminal classes short-circuit to `block` without touching the
 * ledger. Otherwise the consecutive same-fingerprint streak is incremented and
 * mapped to retry (1) -> quarantine (2) -> dead_letter (3+).
 */
export async function evaluateRunCircuitBreaker(
  db: Db,
  input: {
    companyId: string;
    agentId: string;
    runId: string;
    classification: FailureClassification;
    now?: Date;
  },
): Promise<CircuitEvaluation> {
  const now = input.now ?? new Date();
  const { classification } = input;

  if (classification.terminal) {
    return { disposition: "block", occurrenceCount: 0, state: "blocked", failureId: null };
  }

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(heartbeatRunFailures)
      .where(
        and(
          eq(heartbeatRunFailures.companyId, input.companyId),
          eq(heartbeatRunFailures.agentId, input.agentId),
          eq(heartbeatRunFailures.fingerprint, classification.fingerprint),
          inArray(heartbeatRunFailures.state, [...ACTIVE_STATES]),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (!existing) {
      const inserted = await tx
        .insert(heartbeatRunFailures)
        .values({
          companyId: input.companyId,
          agentId: input.agentId,
          fingerprint: classification.fingerprint,
          failureClass: classification.failureClass,
          errorCode: classification.errorCode,
          state: "observed",
          occurrenceCount: 1,
          firstRunId: input.runId,
          lastRunId: input.runId,
          firstSeenAt: now,
          lastSeenAt: now,
          updatedAt: now,
        })
        .returning()
        .then((rows) => rows[0]);
      return { disposition: "retry", occurrenceCount: 1, state: "observed", failureId: inserted.id };
    }

    const newCount = existing.occurrenceCount + 1;
    let state: string;
    let disposition: CircuitDisposition;
    if (newCount >= CIRCUIT_DEAD_LETTER_THRESHOLD) {
      state = "dead_letter";
      disposition = "dead_letter";
    } else if (newCount >= CIRCUIT_QUARANTINE_THRESHOLD) {
      state = "quarantined";
      disposition = "quarantine";
    } else {
      state = "observed";
      disposition = "retry";
    }

    const updated = await tx
      .update(heartbeatRunFailures)
      .set({
        occurrenceCount: newCount,
        state,
        failureClass: classification.failureClass,
        errorCode: classification.errorCode,
        lastRunId: input.runId,
        lastSeenAt: now,
        updatedAt: now,
        ...(disposition === "quarantine" && !existing.quarantinedAt ? { quarantinedAt: now } : {}),
        ...(disposition === "dead_letter"
          ? {
              deadLetteredAt: existing.deadLetteredAt ?? now,
              ownerType: "human",
              nextAction:
                "Investigate repeated agent run failure and clear the dead-letter before re-enabling automatic retries",
            }
          : {}),
      })
      .where(eq(heartbeatRunFailures.id, existing.id))
      .returning()
      .then((rows) => rows[0]);

    return { disposition, occurrenceCount: newCount, state: updated.state, failureId: updated.id };
  });
}

/**
 * Reset the breaker for an agent after a successful run: any active failure rows
 * are marked resolved so a recovered agent is not permanently quarantined.
 * Returns the number of rows resolved.
 */
export async function resolveAgentCircuitOnSuccess(
  db: Db,
  companyId: string,
  agentId: string,
  now: Date = new Date(),
): Promise<number> {
  const resolved = await db
    .update(heartbeatRunFailures)
    .set({ state: "resolved", resolvedAt: now, updatedAt: now })
    .where(
      and(
        eq(heartbeatRunFailures.companyId, companyId),
        eq(heartbeatRunFailures.agentId, agentId),
        inArray(heartbeatRunFailures.state, [...ACTIVE_STATES]),
      ),
    )
    .returning({ id: heartbeatRunFailures.id });
  return resolved.length;
}
