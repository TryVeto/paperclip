import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import {
  assertExactGitProvenance,
  inspectGitProvenance,
  sourceHeadEqualsInstalledIsInsufficient,
} from "../services/git-provenance.js";
import {
  assertReleaseAttestationReadyForClose,
  setBuildManifestAttestationForTests,
} from "../build-manifest.js";

describe("git provenance", () => {
  it("refuses surrogate blob-only proof when candidate is a blob object", () => {
    const dir = mkdtempSync(join(tmpdir(), "paperclip-prov-"));
    execFileSync("git", ["init"], { cwd: dir });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
    writeFileSync(join(dir, "spec.md"), "canonical spec\n");
    execFileSync("git", ["add", "spec.md"], { cwd: dir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: dir });
    const blobSha = execFileSync("git", ["hash-object", "spec.md"], {
      cwd: dir,
      encoding: "utf8",
    }).trim();
    const result = assertExactGitProvenance({
      repoRoot: dir,
      candidateSha: blobSha,
      surrogateBlobSha: blobSha,
      blobPath: "spec.md",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("surrogate_blob_only_proof_refused");
    }
  });

  it("detects shallow clones as exact-provenance blockers", () => {
    const dir = mkdtempSync(join(tmpdir(), "paperclip-shallow-"));
    execFileSync("git", ["init"], { cwd: dir });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
    writeFileSync(join(dir, "a.txt"), "a\n");
    execFileSync("git", ["add", "a.txt"], { cwd: dir });
    execFileSync("git", ["commit", "-m", "a"], { cwd: dir });
    mkdirSync(join(dir, ".git"), { recursive: true });
    // Simulate shallow marker without needing a remote.
    writeFileSync(join(dir, ".git", "shallow"), "a".repeat(40) + "\n");
    const inspection = inspectGitProvenance(dir);
    expect(inspection.shallow).toBe(true);
    expect(inspection.exactProvenancePossible).toBe(false);
    expect(inspection.blockers).toContain("shallow_clone");
  });

  it("refuses hex-equal source HEAD vs installed without runtime digest", () => {
    const sha = "a".repeat(40);
    const claim = sourceHeadEqualsInstalledIsInsufficient({
      sourceHeadSha: sha,
      installedCandidateSha: sha,
      installedRuntimeDigestOk: false,
    });
    expect(claim.equivalentClaimAllowed).toBe(false);
    expect(claim.reason).toBe("hex_match_without_installed_runtime_digest");
  });

  it("allows equivalence only when installed runtime digest verified", () => {
    const sha = "b".repeat(40);
    const claim = sourceHeadEqualsInstalledIsInsufficient({
      sourceHeadSha: sha,
      installedCandidateSha: sha,
      installedRuntimeDigestOk: true,
    });
    expect(claim.equivalentClaimAllowed).toBe(true);
  });
});

describe("close-path attestation fail-closed", () => {
  it("throws when digest verify is missing or not ok", () => {
    setBuildManifestAttestationForTests(
      {
        candidateSha: "c".repeat(40),
        productBaseSha: "d".repeat(40),
        builtAt: new Date().toISOString(),
        source: "bundled_manifest",
        packageDigests: [{ name: "x", sha256: "e".repeat(64), bytes: 1, path: "x.tgz" }],
        releaseDigest: "f".repeat(64),
      },
      { ok: false, detail: "manifest_missing_installed_runtime_digests", installedRuntimeOk: false },
    );
    expect(() => assertReleaseAttestationReadyForClose()).toThrow(/release_attestation_not_verified/);
  });

  it("passes when installed runtime verified", () => {
    setBuildManifestAttestationForTests(
      {
        candidateSha: "c".repeat(40),
        productBaseSha: "d".repeat(40),
        builtAt: new Date().toISOString(),
        source: "bundled_manifest",
        packageDigests: [{ name: "x", sha256: "e".repeat(64), bytes: 1, path: "x.tgz" }],
        releaseDigest: "f".repeat(64),
        installedRuntimeDigests: [{ name: "server", sha256: "1".repeat(64), fileCount: 1 }],
      },
      { ok: true, detail: "verified", installedRuntimeOk: true },
    );
    const ready = assertReleaseAttestationReadyForClose();
    expect(ready.attestation.candidateSha).toBe("c".repeat(40));
    expect(ready.verify.installedRuntimeOk).toBe(true);
  });
});
