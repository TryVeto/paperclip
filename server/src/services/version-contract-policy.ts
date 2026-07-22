import type { VersionDisplayState } from "@paperclipai/shared";
import { V007_BOOTSTRAP } from "@paperclipai/shared";

export const CURSOR_IMPLEMENTATION_ADAPTERS = new Set(["cursor", "cursor_cloud"]);
export const CODEX_SPEC_ADAPTERS = new Set(["codex_local"]);

export type VersionContractRow = {
  id: string;
  companyId: string;
  projectId: string;
  versionKey: string;
  predecessorVersionId: string | null;
  rootIssueId: string;
  productBaseSha: string;
  implementationBaseSha: string;
  specificationOwnerAgentId: string;
  canonicalSpecKind: string;
  canonicalSpecPath: string | null;
  canonicalSpecCommitSha: string | null;
  canonicalSpecBlobSha: string | null;
  acceptedSpecRevisionId: string | null;
  acceptedSpecConfirmationId: string | null;
  acceptedDecompositionId: string | null;
  acceptedDecompositionFingerprint: string | null;
  candidateSourceSha: string | null;
  verificationReceipt: Record<string, unknown> | null;
  verificationReceiptLockedAt: Date | string | null;
  deployedSourceSha: string | null;
  shipReceipt: Record<string, unknown> | null;
  shipReceiptLockedAt: Date | string | null;
  blockReason: string | null;
  shippedAt: Date | string | null;
};

export type LaneKind = "specification" | "implementation" | "none";

export function deriveDisplayState(row: VersionContractRow): VersionDisplayState {
  if (row.blockReason) return "blocked";
  if (row.shippedAt) return "shipped";
  if (row.verificationReceiptLockedAt && row.verificationReceipt) return "ship_ready";
  const hasAcceptedSpec =
    Boolean(row.acceptedSpecRevisionId) ||
    (row.canonicalSpecKind === "bootstrap_file" && Boolean(row.canonicalSpecBlobSha));
  if (hasAcceptedSpec) return "implementing";
  return "specifying";
}

export function isSha40(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

export function normalizeSha(value: string): string {
  return value.trim().toLowerCase();
}

/** Resolve effective adapter after router delegation. */
export function resolveEffectiveExecutor(input: {
  adapterType: string;
  delegateAdapter?: string | null;
  routingDelegate?: string | null;
}): string {
  return (
    input.delegateAdapter ||
    input.routingDelegate ||
    input.adapterType
  ).toLowerCase();
}

export function assertExecutorForLane(lane: LaneKind, effectiveExecutor: string): {
  ok: boolean;
  predicate?: string;
} {
  if (lane === "none") return { ok: true };
  if (lane === "specification") {
    if (!CODEX_SPEC_ADAPTERS.has(effectiveExecutor)) {
      return { ok: false, predicate: `specification_lane_requires_codex_got_${effectiveExecutor}` };
    }
    return { ok: true };
  }
  if (!CURSOR_IMPLEMENTATION_ADAPTERS.has(effectiveExecutor)) {
    return { ok: false, predicate: `implementation_lane_requires_cursor_got_${effectiveExecutor}` };
  }
  return { ok: true };
}

export function isCursorImplementationMode(mode: string | null | undefined): boolean {
  if (!mode) return true;
  const normalized = mode.toLowerCase();
  return normalized !== "plan" && normalized !== "ask";
}

export function versionLaneForIssue(input: {
  capsule: VersionContractRow | null;
  issueId: string;
  parentIssueId?: string | null;
}): LaneKind {
  if (!input.capsule || input.capsule.shippedAt) return "none";
  if (input.issueId === input.capsule.rootIssueId) return "specification";
  if (input.parentIssueId === input.capsule.rootIssueId) return "implementation";
  // Descendants of root also implementation
  if (input.capsule.rootIssueId) {
    // Caller may pass ancestor check separately; default none unless parent is root.
  }
  return "none";
}

export type ImmutableLaneCapabilities = {
  sourceCheckoutReadOnly: boolean;
  codexSandboxForcedReadOnly: boolean;
  rejectApprovalSandboxBypass: boolean;
  disposableSpecSnapshot: boolean;
  planDocumentOnlyWritableOutput: boolean;
  workspaceBaseSha: string | null;
  forbidFinalize: boolean;
  forbidCommit: boolean;
  forbidMerge: boolean;
};

export function buildImmutableLaneCapabilities(input: {
  lane: LaneKind;
  implementationBaseSha: string | null;
}): ImmutableLaneCapabilities {
  if (input.lane === "specification") {
    return {
      sourceCheckoutReadOnly: true,
      codexSandboxForcedReadOnly: true,
      rejectApprovalSandboxBypass: true,
      disposableSpecSnapshot: true,
      planDocumentOnlyWritableOutput: true,
      workspaceBaseSha: input.implementationBaseSha,
      forbidFinalize: true,
      forbidCommit: true,
      forbidMerge: true,
    };
  }
  if (input.lane === "implementation") {
    return {
      sourceCheckoutReadOnly: false,
      codexSandboxForcedReadOnly: false,
      rejectApprovalSandboxBypass: false,
      disposableSpecSnapshot: false,
      planDocumentOnlyWritableOutput: false,
      workspaceBaseSha: input.implementationBaseSha,
      forbidFinalize: false,
      forbidCommit: false,
      forbidMerge: false,
    };
  }
  return {
    sourceCheckoutReadOnly: false,
    codexSandboxForcedReadOnly: false,
    rejectApprovalSandboxBypass: false,
    disposableSpecSnapshot: false,
    planDocumentOnlyWritableOutput: false,
    workspaceBaseSha: null,
    forbidFinalize: false,
    forbidCommit: false,
    forbidMerge: false,
  };
}

export function applyImmutableCapabilitiesToRuntimeConfig(
  runtimeConfig: Record<string, unknown>,
  caps: ImmutableLaneCapabilities,
): Record<string, unknown> {
  const next = { ...runtimeConfig };
  if (caps.codexSandboxForcedReadOnly) {
    next.sandbox = "read-only";
    next.sandboxMode = "read-only";
  }
  if (caps.rejectApprovalSandboxBypass) {
    delete next.approvalBypass;
    delete next.sandboxBypass;
    delete next.dangerouslyBypassApprovalsAndSandbox;
    if (next.extraArgs && Array.isArray(next.extraArgs)) {
      next.extraArgs = (next.extraArgs as string[]).filter(
        (arg) =>
          !["--dangerously-bypass-approvals-and-sandbox", "--full-auto", "--yolo"].includes(String(arg)),
      );
    }
  }
  if (caps.disposableSpecSnapshot) {
    next.paperclipSpecSnapshot = true;
    next.paperclipForbidFinalize = true;
    next.paperclipForbidCommit = true;
    next.paperclipForbidMerge = true;
  }
  if (caps.workspaceBaseSha) {
    next.paperclipImplementationBaseSha = caps.workspaceBaseSha;
  }
  next.paperclipLaneCapabilities = caps;
  return next;
}

export type ShipGateSnapshot = {
  acceptedCanonicalSpec: string;
  decompositionSpec: string;
  decompositionCandidate: string;
  verificationCandidate: string;
  runningBuildManifestSha: string;
  shipReceiptDeployedSha: string;
  canonicalSpecUnchanged: boolean;
  canonicalSpecLocked: boolean;
  descendantsDoneCursorProvenance: boolean;
  requiredPredicatesPassed: boolean;
};

export function evaluateShipGate(gate: ShipGateSnapshot): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  if (gate.acceptedCanonicalSpec !== gate.decompositionSpec) {
    failures.push("accepted_canonical_spec_ne_decomposition_spec");
  }
  if (gate.decompositionCandidate !== gate.verificationCandidate) {
    failures.push("decomposition_candidate_ne_verification_candidate");
  }
  if (gate.verificationCandidate !== gate.runningBuildManifestSha) {
    failures.push("verification_candidate_ne_running_build_manifest");
  }
  if (gate.runningBuildManifestSha !== gate.shipReceiptDeployedSha) {
    failures.push("running_build_manifest_ne_ship_receipt_deployed");
  }
  if (!gate.canonicalSpecUnchanged) failures.push("canonical_spec_changed");
  if (!gate.canonicalSpecLocked) failures.push("canonical_spec_unlocked");
  if (!gate.descendantsDoneCursorProvenance) failures.push("descendant_cursor_provenance_incomplete");
  if (!gate.requiredPredicatesPassed) failures.push("required_verification_predicates_failed");
  return { ok: failures.length === 0, failures };
}

export function isV007BootstrapEligible(input: {
  existingCapsuleCount: number;
  versionKey: string;
  productBaseSha: string;
  specBlobSha: string;
  runningManifestSha: string;
  candidateSha: string;
}): { ok: boolean; predicate?: string } {
  if (input.existingCapsuleCount > 0) return { ok: false, predicate: "capsule_already_exists" };
  if (input.versionKey !== V007_BOOTSTRAP.versionKey) return { ok: false, predicate: "version_key_not_v0_07" };
  if (normalizeSha(input.productBaseSha) !== V007_BOOTSTRAP.productBaseSha) {
    return { ok: false, predicate: "product_base_mismatch" };
  }
  if (normalizeSha(input.specBlobSha) !== V007_BOOTSTRAP.immutableSpecBlobSha) {
    return { ok: false, predicate: "spec_blob_mismatch" };
  }
  if (!isSha40(input.runningManifestSha) || !isSha40(input.candidateSha)) {
    return { ok: false, predicate: "malformed_sha" };
  }
  if (normalizeSha(input.runningManifestSha) !== normalizeSha(input.candidateSha)) {
    return { ok: false, predicate: "manifest_candidate_mismatch" };
  }
  return { ok: true };
}
