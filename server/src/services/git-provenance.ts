/**
 * Exact Git provenance for version-contract closeout.
 *
 * Blob-only / surrogate SHA equality is never sufficient proof when the repo is
 * shallow, grafted, or missing the commit object. Callers that need exact-SHA
 * identity must use assertExactGitProvenance and treat refusals as blockers.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { isSha40, normalizeSha } from "./version-contract-policy.js";

export type GitProvenanceInspection = {
  repoRoot: string;
  headSha: string | null;
  shallow: boolean;
  grafted: boolean;
  /** True when .git/shallow exists or git reports a shallow clone. */
  exactProvenancePossible: boolean;
  blockers: string[];
};

export type ExactGitProvenanceInput = {
  repoRoot: string;
  /** Commit that must resolve as a real git object in this repo. */
  candidateSha: string;
  /**
   * Optional blob SHA (e.g. spec file). Matching a blob alone must never satisfy
   * exact commit provenance — this field is evidence only.
   */
  surrogateBlobSha?: string | null;
  /** Optional path whose `git hash-object` must equal surrogateBlobSha when set. */
  blobPath?: string | null;
  /**
   * When true (default), refuse if candidate equals a blob SHA but is not a
   * resolvable commit — classic surrogate "proof".
   */
  refuseBlobOnlySurrogate?: boolean;
};

export type ExactGitProvenanceResult =
  | { ok: true; candidateSha: string; inspection: GitProvenanceInspection }
  | { ok: false; code: string; detail: string; inspection: GitProvenanceInspection };

function runGit(repoRoot: string, args: string[]): string {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function tryGit(repoRoot: string, args: string[]): string | null {
  try {
    return runGit(repoRoot, args);
  } catch {
    return null;
  }
}

export function inspectGitProvenance(repoRoot: string): GitProvenanceInspection {
  const blockers: string[] = [];
  const shallowFile = join(repoRoot, ".git", "shallow");
  const shallowByFile = existsSync(shallowFile);
  const shallowByGit = tryGit(repoRoot, ["rev-parse", "--is-shallow-repository"]) === "true";
  const shallow = shallowByFile || shallowByGit;

  let grafted = false;
  const graftFile = join(repoRoot, ".git", "info", "grafts");
  if (existsSync(graftFile)) {
    const body = readFileSync(graftFile, "utf8").trim();
    if (body.length > 0) grafted = true;
  }
  const replaceRefs = join(repoRoot, ".git", "replace");
  if (existsSync(replaceRefs)) {
    const listed = tryGit(repoRoot, ["replace", "-l"]);
    if (listed && listed.length > 0) grafted = true;
  }

  const headShaRaw = tryGit(repoRoot, ["rev-parse", "HEAD"]);
  const headSha = headShaRaw && isSha40(normalizeSha(headShaRaw)) ? normalizeSha(headShaRaw) : null;

  if (shallow) blockers.push("shallow_clone");
  if (grafted) blockers.push("grafted_or_replace_refs");
  if (!headSha) blockers.push("head_unresolvable");

  return {
    repoRoot,
    headSha,
    shallow,
    grafted,
    exactProvenancePossible: blockers.length === 0,
    blockers,
  };
}

/**
 * Refuse surrogate blob-only "proof": a 40-hex string that hashes a file blob
 * but is not a resolvable commit object must never close exact-SHA gates.
 */
export function assertExactGitProvenance(input: ExactGitProvenanceInput): ExactGitProvenanceResult {
  const inspection = inspectGitProvenance(input.repoRoot);
  const candidateSha = normalizeSha(input.candidateSha);
  if (!isSha40(candidateSha)) {
    return {
      ok: false,
      code: "malformed_candidate_sha",
      detail: "candidate SHA must be lowercase 40-hex",
      inspection,
    };
  }

  if (!inspection.exactProvenancePossible) {
    return {
      ok: false,
      code: "exact_git_provenance_impossible",
      detail: `repo blockers: ${inspection.blockers.join(",")}`,
      inspection,
    };
  }

  const objectType = tryGit(input.repoRoot, ["cat-file", "-t", candidateSha]);
  if (objectType !== "commit") {
    const refuseBlobOnly = input.refuseBlobOnlySurrogate !== false;
    if (refuseBlobOnly && objectType === "blob") {
      return {
        ok: false,
        code: "surrogate_blob_only_proof_refused",
        detail: `candidate ${candidateSha} resolves as blob, not commit`,
        inspection,
      };
    }
    return {
      ok: false,
      code: "candidate_not_resolvable_commit",
      detail: `git cat-file -t => ${objectType ?? "missing"}`,
      inspection,
    };
  }

  // Optional: if a blob path is supplied, verify hash-object — never promote blob to commit.
  if (input.surrogateBlobSha && input.blobPath) {
    const blobWant = normalizeSha(input.surrogateBlobSha);
    const blobGot = tryGit(input.repoRoot, ["hash-object", input.blobPath]);
    if (!blobGot || normalizeSha(blobGot) !== blobWant) {
      return {
        ok: false,
        code: "surrogate_blob_mismatch",
        detail: `hash-object ${input.blobPath} != ${blobWant}`,
        inspection,
      };
    }
    if (blobWant === candidateSha) {
      return {
        ok: false,
        code: "surrogate_blob_only_proof_refused",
        detail: "candidate SHA equals blob SHA; commit identity required",
        inspection,
      };
    }
  }

  // Ancestry smoke: commit must have a parent list readable (root commits allowed).
  const parents = tryGit(input.repoRoot, ["rev-list", "--parents", "-n", "1", candidateSha]);
  if (!parents || !parents.startsWith(candidateSha)) {
    return {
      ok: false,
      code: "candidate_ancestry_unreadable",
      detail: "rev-list --parents failed for candidate",
      inspection,
    };
  }

  return { ok: true, candidateSha, inspection };
}

/**
 * Source checkout HEAD must never be treated as the installed release candidate
 * merely because the hex strings match. Callers compare independent facts.
 */
export function sourceHeadEqualsInstalledIsInsufficient(input: {
  sourceHeadSha: string | null | undefined;
  installedCandidateSha: string | null | undefined;
  installedRuntimeDigestOk: boolean;
}): { equivalentClaimAllowed: boolean; reason: string } {
  const head = input.sourceHeadSha ? normalizeSha(input.sourceHeadSha) : null;
  const installed = input.installedCandidateSha ? normalizeSha(input.installedCandidateSha) : null;
  if (!head || !installed || !isSha40(head) || !isSha40(installed)) {
    return { equivalentClaimAllowed: false, reason: "missing_or_malformed_sha" };
  }
  if (head !== installed) {
    return { equivalentClaimAllowed: false, reason: "source_head_ne_installed_candidate" };
  }
  if (!input.installedRuntimeDigestOk) {
    return {
      equivalentClaimAllowed: false,
      reason: "hex_match_without_installed_runtime_digest",
    };
  }
  return {
    equivalentClaimAllowed: true,
    reason: "hex_match_and_installed_runtime_digest_ok",
  };
}
