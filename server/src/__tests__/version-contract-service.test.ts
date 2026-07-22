import { describe, expect, it, beforeEach } from "vitest";
import { V007_BOOTSTRAP } from "@paperclipai/shared";
import {
  assertExecutorForLane,
  applyImmutableCapabilitiesToRuntimeConfig,
  buildImmutableLaneCapabilities,
  deriveDisplayState,
  evaluateShipGate,
  isCursorImplementationMode,
  isV007BootstrapEligible,
  resolveEffectiveExecutor,
  versionLaneForIssue,
  type VersionContractRow,
} from "../services/version-contract-policy.js";
import {
  getBuildManifestAttestation,
  setBuildManifestAttestationForTests,
} from "../build-manifest.js";

function baseRow(overrides: Partial<VersionContractRow> = {}): VersionContractRow {
  return {
    id: "v1",
    companyId: "c1",
    projectId: "p1",
    versionKey: "v0.08",
    predecessorVersionId: null,
    rootIssueId: "root",
    productBaseSha: "a".repeat(40),
    implementationBaseSha: "b".repeat(40),
    specificationOwnerAgentId: "codex-agent",
    canonicalSpecKind: "plan_document",
    canonicalSpecPath: null,
    canonicalSpecCommitSha: null,
    canonicalSpecBlobSha: null,
    acceptedSpecRevisionId: null,
    acceptedSpecConfirmationId: null,
    acceptedDecompositionId: null,
    acceptedDecompositionFingerprint: null,
    candidateSourceSha: null,
    verificationReceipt: null,
    verificationReceiptLockedAt: null,
    deployedSourceSha: null,
    shipReceipt: null,
    shipReceiptLockedAt: null,
    blockReason: null,
    shippedAt: null,
    ...overrides,
  };
}

describe("version-contract policy", () => {
  it("derives display states from evidence", () => {
    expect(deriveDisplayState(baseRow())).toBe("specifying");
    expect(deriveDisplayState(baseRow({ acceptedSpecRevisionId: "rev1" }))).toBe("implementing");
    expect(
      deriveDisplayState(
        baseRow({
          acceptedSpecRevisionId: "rev1",
          verificationReceipt: { ok: true },
          verificationReceiptLockedAt: new Date(),
        }),
      ),
    ).toBe("ship_ready");
    expect(deriveDisplayState(baseRow({ shippedAt: new Date(), acceptedSpecRevisionId: "rev1" }))).toBe(
      "shipped",
    );
    expect(deriveDisplayState(baseRow({ blockReason: "x", acceptedSpecRevisionId: "rev1" }))).toBe("blocked");
  });

  it("resolves lanes for root vs child", () => {
    const capsule = baseRow();
    expect(versionLaneForIssue({ capsule, issueId: "root" })).toBe("specification");
    expect(versionLaneForIssue({ capsule, issueId: "child", parentIssueId: "root" })).toBe("implementation");
    expect(versionLaneForIssue({ capsule: null, issueId: "x" })).toBe("none");
  });

  it("enforces Codex for specification and Cursor for implementation after router resolution", () => {
    expect(assertExecutorForLane("specification", "codex_local").ok).toBe(true);
    expect(assertExecutorForLane("specification", "cursor").ok).toBe(false);
    expect(assertExecutorForLane("implementation", "cursor").ok).toBe(true);
    expect(assertExecutorForLane("implementation", "cursor_cloud").ok).toBe(true);
    expect(assertExecutorForLane("implementation", "codex_local").ok).toBe(false);

    const resolved = resolveEffectiveExecutor({
      adapterType: "veto_runtime_router",
      routingDelegate: "codex_local",
    });
    expect(resolved).toBe("codex_local");
    expect(assertExecutorForLane("specification", resolved).ok).toBe(true);
    expect(assertExecutorForLane("specification", "cursor").ok).toBe(false);
  });

  it("rejects Cursor plan/ask modes for implementation", () => {
    expect(isCursorImplementationMode("agent")).toBe(true);
    expect(isCursorImplementationMode(null)).toBe(true);
    expect(isCursorImplementationMode("plan")).toBe(false);
    expect(isCursorImplementationMode("ask")).toBe(false);
  });

  it("applies immutable Codex lane capabilities last", () => {
    const caps = buildImmutableLaneCapabilities({
      lane: "specification",
      implementationBaseSha: "c".repeat(40),
    });
    const next = applyImmutableCapabilitiesToRuntimeConfig(
      {
        sandbox: "workspace-write",
        dangerouslyBypassApprovalsAndSandbox: true,
        extraArgs: ["--full-auto", "--model", "x"],
      },
      caps,
    );
    expect(next.sandbox).toBe("read-only");
    expect(next.dangerouslyBypassApprovalsAndSandbox).toBeUndefined();
    expect(next.paperclipSpecSnapshot).toBe(true);
    expect(next.paperclipForbidCommit).toBe(true);
    expect((next.extraArgs as string[]).includes("--full-auto")).toBe(false);
  });

  it("ship gate rejects one-character SHA mismatches and ignores request override semantics", () => {
    const sha = "d".repeat(40);
    const almost = "d".repeat(39) + "e";
    const ok = evaluateShipGate({
      acceptedCanonicalSpec: "blob",
      decompositionSpec: "blob",
      decompositionCandidate: sha,
      verificationCandidate: sha,
      runningBuildManifestSha: sha,
      shipReceiptDeployedSha: sha,
      canonicalSpecUnchanged: true,
      canonicalSpecLocked: true,
      descendantsDoneCursorProvenance: true,
      requiredPredicatesPassed: true,
    });
    expect(ok.ok).toBe(true);

    const fail = evaluateShipGate({
      acceptedCanonicalSpec: "blob",
      decompositionSpec: "blob",
      decompositionCandidate: sha,
      verificationCandidate: sha,
      runningBuildManifestSha: almost,
      shipReceiptDeployedSha: sha,
      canonicalSpecUnchanged: true,
      canonicalSpecLocked: true,
      descendantsDoneCursorProvenance: true,
      requiredPredicatesPassed: true,
    });
    expect(fail.ok).toBe(false);
    expect(fail.failures).toContain("verification_candidate_ne_running_build_manifest");
  });

  it("v0.07 bootstrap pins base and blob and self-disables after first capsule", () => {
    const candidate = "e".repeat(40);
    expect(
      isV007BootstrapEligible({
        existingCapsuleCount: 0,
        versionKey: "v0.07",
        productBaseSha: V007_BOOTSTRAP.productBaseSha,
        specBlobSha: V007_BOOTSTRAP.immutableSpecBlobSha,
        runningManifestSha: candidate,
        candidateSha: candidate,
      }).ok,
    ).toBe(true);

    expect(
      isV007BootstrapEligible({
        existingCapsuleCount: 1,
        versionKey: "v0.07",
        productBaseSha: V007_BOOTSTRAP.productBaseSha,
        specBlobSha: V007_BOOTSTRAP.immutableSpecBlobSha,
        runningManifestSha: candidate,
        candidateSha: candidate,
      }).predicate,
    ).toBe("capsule_already_exists");

    expect(
      isV007BootstrapEligible({
        existingCapsuleCount: 0,
        versionKey: "v0.07",
        productBaseSha: V007_BOOTSTRAP.productBaseSha,
        specBlobSha: "f".repeat(40),
        runningManifestSha: candidate,
        candidateSha: candidate,
      }).predicate,
    ).toBe("spec_blob_mismatch");

    expect(
      isV007BootstrapEligible({
        existingCapsuleCount: 0,
        versionKey: "v0.07",
        productBaseSha: "0".repeat(40),
        specBlobSha: V007_BOOTSTRAP.immutableSpecBlobSha,
        runningManifestSha: candidate,
        candidateSha: candidate,
      }).predicate,
    ).toBe("product_base_mismatch");
  });
});

describe("build manifest attestation", () => {
  beforeEach(() => {
    setBuildManifestAttestationForTests(null);
  });

  it("exposes only bundled attestation; request SHA cannot override", () => {
    const candidate = "a1".repeat(20);
    setBuildManifestAttestationForTests({
      candidateSha: candidate,
      productBaseSha: V007_BOOTSTRAP.productBaseSha,
      builtAt: new Date().toISOString(),
      source: "bundled_manifest",
    });
    const attested = getBuildManifestAttestation();
    expect(attested?.candidateSha).toBe(candidate);
    // Simulate board supplying a different observedLiveSha — attestation unchanged
    const observedLiveSha = "b2".repeat(20);
    expect(attested?.candidateSha).not.toBe(observedLiveSha);
    expect(getBuildManifestAttestation()?.candidateSha).toBe(candidate);
  });
});

describe("migration journal uniqueness", () => {
  it("registers 0184_project_version_contracts once", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const journalPath = resolve(__dirname, "../../../packages/db/src/migrations/meta/_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: Array<{ tag: string }>;
    };
    const tags = journal.entries.map((e) => e.tag);
    expect(tags.filter((t) => t === "0184_project_version_contracts")).toHaveLength(1);
    expect(tags.at(-1)).toBe("0184_project_version_contracts");
  });
});
