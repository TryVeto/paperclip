/**
 * Trusted run traffic classification. Never inferred from issue titles.
 * Fail-closed: unset → system / non-actionable.
 */

export const RUN_TRAFFIC_CLASSES = [
  "natural",
  "canary",
  "synthetic",
  "operator_probe",
  "system",
] as const;

export type RunTrafficClass = (typeof RUN_TRAFFIC_CLASSES)[number];

export type RunTrafficClassification = {
  trafficClass: RunTrafficClass;
  actionable: boolean;
  actionabilityReason: string;
  requestReceivedAt: Date;
};

const FAIL_CLOSED: RunTrafficClassification = {
  trafficClass: "system",
  actionable: false,
  actionabilityReason: "unset_fail_closed",
  requestReceivedAt: new Date(0),
};

export function isRunTrafficClass(value: unknown): value is RunTrafficClass {
  return typeof value === "string" && (RUN_TRAFFIC_CLASSES as readonly string[]).includes(value);
}

/**
 * Resolve classification for a new run from trusted wake options only.
 * Payload fields are ignored unless a board-consumed classification token already
 * resolved them into opts.trafficClassification (trusted boundary).
 */
export function resolveRunTrafficClassification(input: {
  source?: string | null;
  triggerDetail?: string | null;
  requestedByActorType?: "user" | "agent" | "system" | null;
  /** Explicit stamp from a trusted boundary (board session, consumed canary token, Inkbox ingress). */
  trafficClassification?: Partial<RunTrafficClassification> | null;
  /** Authoritative receipt time when known (provider/gateway/board submit). */
  requestReceivedAt?: Date | string | null;
}): RunTrafficClassification {
  const now = new Date();
  const requestReceivedAt =
    input.requestReceivedAt instanceof Date
      ? input.requestReceivedAt
      : typeof input.requestReceivedAt === "string" && input.requestReceivedAt
        ? new Date(input.requestReceivedAt)
        : now;

  const explicit = input.trafficClassification;
  if (explicit && isRunTrafficClass(explicit.trafficClass)) {
    return {
      trafficClass: explicit.trafficClass,
      actionable: Boolean(explicit.actionable),
      actionabilityReason:
        typeof explicit.actionabilityReason === "string" && explicit.actionabilityReason.trim()
          ? explicit.actionabilityReason.trim()
          : "trusted_boundary_stamp",
      requestReceivedAt:
        explicit.requestReceivedAt instanceof Date ? explicit.requestReceivedAt : requestReceivedAt,
    };
  }

  // Trusted board user sessions may stamp natural/actionable without a token.
  if (input.requestedByActorType === "user") {
    return {
      trafficClass: "natural",
      actionable: true,
      actionabilityReason: "trusted_board_user_session",
      requestReceivedAt,
    };
  }
  // Agent on_demand is NOT automatically natural — that over-classified probes and
  // canaries as observation traffic. Require an explicit trusted boundary stamp.
  if (input.requestedByActorType === "agent" && input.source === "on_demand") {
    return {
      trafficClass: "system",
      actionable: false,
      actionabilityReason: "agent_on_demand_requires_explicit_stamp",
      requestReceivedAt,
    };
  }

  // Timers / automation / system: fail closed for observation sampling.
  if (input.source === "timer" || input.source === "automation" || input.triggerDetail === "system") {
    return {
      trafficClass: "system",
      actionable: false,
      actionabilityReason: `source_${input.source ?? "unknown"}`,
      requestReceivedAt,
    };
  }

  return { ...FAIL_CLOSED, requestReceivedAt };
}

export function classificationInsertFields(c: RunTrafficClassification) {
  return {
    trafficClass: c.trafficClass,
    actionable: c.actionable,
    actionabilityReason: c.actionabilityReason,
    requestReceivedAt: c.requestReceivedAt,
  };
}
