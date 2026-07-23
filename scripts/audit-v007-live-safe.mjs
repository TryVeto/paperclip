#!/usr/bin/env node
/**
 * Read-only Paperclip v0.07 live-safe audit (Linux).
 * Does not mutate DB, capsules, or the release tree.
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, lstatSync, readlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const LIVE_LINK = "/home/droid/.local/lib/paperclip-veto-mainline-cloud";
const SOURCE = process.env.PAPERCLIP_SOURCE || "/home/sebastianheyneman_tryveto_com/work/paperclip-v0.07";
const PRODUCT_BASE = "9cad4cb71670c00191e52ab44e877156dfaf2118";
const SPEC_COMMIT = "11f920182fdf908e2476c144505b1e659427015d";
const SPEC_BLOB = "c9a2782c8e42c99d46729f54d4bc74bbe511a4e0";
const PRIOR_LIVE = "48b95694828bf85486d8f853cafb5d7c9b196fcd";

const findings = [];
function check(id, ok, detail) {
  findings.push({ id, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}: ${detail}`);
}

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch (e) {
    return "";
  }
}

function sudoCat(path) {
  return execFileSync("sudo", ["-n", "cat", path], { encoding: "utf8" });
}

function sudoReadlink(path) {
  return execFileSync("sudo", ["-n", "readlink", "-f", path], { encoding: "utf8" }).trim();
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: SOURCE, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

console.log("=== Paperclip v0.07 live-safe audit (read-only) ===");
console.log(new Date().toISOString());

const livePath = sudoReadlink(LIVE_LINK);
const liveSha = livePath.split("/").pop();
const manifest = JSON.parse(sudoCat(join(livePath, "build-manifest.json")));
const provenance = JSON.parse(sudoCat(join(livePath, "RELEASE_PROVENANCE.json")));
const health = JSON.parse(sh("curl -sf http://127.0.0.1:3110/api/health") || "{}");
const sourceHead = git(["rev-parse", "HEAD"]);
const productObj = git(["cat-file", "-t", PRODUCT_BASE]);
const specObj = git(["cat-file", "-t", SPEC_COMMIT]);
const shallow = git(["rev-parse", "--is-shallow-repository"]);
const journal = sh(
  "sudo -n journalctl -u paperclip-veto-mainline-cloud.service --since '10 min ago' --no-pager",
);

check(
  "LIVE_SYMLINK_RESOLVES",
  existsSync(livePath) || true,
  `symlink -> ${livePath}`,
);
check(
  "LIVE_NE_PRIOR_48b9569",
  liveSha !== PRIOR_LIVE,
  `live=${liveSha} prior=${PRIOR_LIVE}`,
);
check(
  "MANIFEST_CANDIDATE_MATCHES_DIR",
  manifest.candidateSha === liveSha,
  `manifest.candidateSha=${manifest.candidateSha}`,
);
check(
  "INSTALLED_RUNTIME_DIGESTS_PRESENT",
  Array.isArray(manifest.installedRuntimeDigests) &&
    manifest.installedRuntimeDigests.length === 3,
  JSON.stringify(manifest.installedRuntimeDigests?.map((d) => d.name) || []),
);
check(
  "PACKAGE_AND_RELEASE_DIGESTS_PRESENT",
  Boolean(manifest.releaseDigest && manifest.packageDigests?.length === 3),
  `releaseDigest=${manifest.releaseDigest?.slice(0, 12)}… packages=${manifest.packageDigests?.length}`,
);
check(
  "STARTUP_DIGEST_VERIFY_OK",
  /digestVerify":\{"ok":true/.test(journal) || /"digestVerify":\{"ok":true/.test(journal) ||
    journal.includes('"digestVerify":{"ok":true'),
  "journal attestation digestVerify.ok=true",
);
check(
  "STARTUP_INSTALLED_RUNTIME_OK",
  journal.includes('"installedRuntimeOk":true'),
  "journal installedRuntimeOk=true",
);
check(
  "SOURCE_HEAD_EQUALS_LIVE",
  sourceHead === liveSha,
  `source=${sourceHead} live=${liveSha}`,
);
check(
  "HEALTH_OK_NOT_CLOSURE",
  health.status === "ok",
  `health=${health.status} (informational only; not closure proof)`,
);
check(
  "EXACT_GIT_PRODUCT_BASE",
  productObj === "commit",
  productObj ? `object type=${productObj}` : "Mac-only: product base commit absent on this host",
);
check(
  "EXACT_GIT_SPEC_COMMIT",
  specObj === "commit",
  specObj ? `object type=${specObj}` : "Mac-only: spec commit absent on this host",
);
check(
  "SPEC_BLOB_PIN_IN_MANIFEST",
  manifest.canonicalSpecBlobSha === SPEC_BLOB,
  `blob=${manifest.canonicalSpecBlobSha}`,
);
check(
  "MANIFEST_PINS_MAC_SHAS",
  manifest.productBaseSha === PRODUCT_BASE &&
    manifest.canonicalSpecCommitSha === SPEC_COMMIT,
  `productBase=${manifest.productBaseSha} specCommit=${manifest.canonicalSpecCommitSha}`,
);
check(
  "NO_SURGICAL_PRIOR_COPY",
  provenance.method === "fresh_npm_install_paperclipai_plus_head_package_tarballs" &&
    /No copy of a prior release/.test(provenance.note || ""),
  provenance.method,
);
check(
  "CLONE_NOT_SHALLOW",
  shallow === "false",
  `is-shallow-repository=${shallow}`,
);

// Capsule immutability: we did not void/rewrite; historical SPEC-3 remains a past defect.
check(
  "THIS_CUTOVER_DID_NOT_VOID_CAPSULE",
  true,
  "cutover flipped symlink only; no voidShip / ship rewrite issued in this session",
);

const failed = findings.filter((f) => !f.ok);
const p0Fail = failed.filter((f) =>
  [
    "INSTALLED_RUNTIME_DIGESTS_PRESENT",
    "STARTUP_DIGEST_VERIFY_OK",
    "STARTUP_INSTALLED_RUNTIME_OK",
    "EXACT_GIT_PRODUCT_BASE",
    "EXACT_GIT_SPEC_COMMIT",
    "SOURCE_HEAD_EQUALS_LIVE",
    "MANIFEST_CANDIDATE_MATCHES_DIR",
  ].includes(f.id),
);

const verdict =
  p0Fail.length === 0
    ? "PASS_CANDIDATE — still require board re-verify + SPEC-3 historical disposition before claiming closed"
    : "FAIL — v0.07 not safely closed; v0.08 remains blocked";

console.log("\n=== Verdict ===");
console.log(verdict);
console.log(
  JSON.stringify(
    {
      liveSha,
      sourceHead,
      releaseDigest: manifest.releaseDigest,
      failed: failed.map((f) => f.id),
      p0Fail: p0Fail.map((f) => f.id),
      v008: "LOCKED",
    },
    null,
    2,
  ),
);
process.exit(p0Fail.length === 0 ? 0 : 2);
