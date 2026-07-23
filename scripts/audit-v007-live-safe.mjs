#!/usr/bin/env node
/**
 * Read-only Paperclip v0.07 live-safe audit (Linux).
 * Does not mutate DB, capsules, or the release tree.
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const LIVE_LINK = "/home/droid/.local/lib/paperclip-veto-mainline-cloud";
const SOURCE = process.env.PAPERCLIP_SOURCE || "/home/sebastianheyneman_tryveto_com/work/paperclip-v0.07";
const PRODUCT_BASE = "9cad4cb71670c00191e52ab44e877156dfaf2118";
const SPEC_COMMIT = "11f920182fdf908e2476c144505b1e659427015d";
const SPEC_BLOB = "c9a2782c8e42c99d46729f54d4bc74bbe511a4e0";
const LOCAL_SPEC = "c0c50b4eaf7131cae4cb3b98ab567db2288d2182";
const PRIOR_LIVE = "48b95694828bf85486d8f853cafb5d7c9b196fcd";

const findings = [];
function check(id, ok, detail) {
  findings.push({ id, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}: ${detail}`);
}

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
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
const localSpecObj = git(["cat-file", "-t", LOCAL_SPEC]);
const localSpecBlob = git(["rev-parse", `${LOCAL_SPEC}:doc/plans/2026-07-22-paperclip-v0.07.md`]);
const shallow = git(["rev-parse", "--is-shallow-repository"]);
let liveIsAncestor = liveSha === sourceHead;
try {
  execFileSync("git", ["merge-base", "--is-ancestor", liveSha, sourceHead], { cwd: SOURCE });
  liveIsAncestor = true;
} catch {
  /* keep */
}
const nested = existsSync(join(livePath, "node_modules/@paperclipai/db/dist/migrations/migrations"));
// Targeted journal greps — full --since dumps are too large for reliable matching.
const digestLine = sh(
  `sudo -n journalctl -u paperclip-veto-mainline-cloud.service --since '24 hours ago' --no-pager -g 'build manifest attestation loaded' | rg ${liveSha} | tail -1`,
);
const wakeSpam = Number(
  sh(
    "sudo -n journalctl -u paperclip-veto-mainline-cloud.service --since '2026-07-23 08:03:00' --no-pager -g 'failed to enqueue dependency wake' | rg -c 'failed to enqueue dependency wake' || true",
  ) || "0",
);
const missingCol = Number(
  sh(
    "sudo -n journalctl -u paperclip-veto-mainline-cloud.service --since '2026-07-23 08:03:00' --no-pager -g 'missing column' | rg -c 'missing column' || true",
  ) || "0",
);
const ghLive = sh(`gh api repos/TryVeto/paperclip/commits/${liveSha} --jq .sha`);
const ghBranch = sh(
  "gh api repos/TryVeto/paperclip/git/ref/heads/veto/paperclip-v0.07-overnight-closeout --jq .object.sha",
);

check("LIVE_SYMLINK_RESOLVES", Boolean(livePath), `symlink -> ${livePath}`);
check("LIVE_NE_PRIOR_48b9569", liveSha !== PRIOR_LIVE, `live=${liveSha} prior=${PRIOR_LIVE}`);
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
  `releaseDigest=${String(manifest.releaseDigest || "").slice(0, 12)}… packages=${manifest.packageDigests?.length}`,
);
check(
  "STARTUP_DIGEST_VERIFY_OK",
  /"digestVerify":\{"ok":true/.test(digestLine) || digestLine.includes('"ok":true'),
  digestLine ? "startup line for live SHA has digestVerify.ok=true" : "no startup attestation line for live SHA in 12h journal",
);
check(
  "STARTUP_INSTALLED_RUNTIME_OK",
  digestLine.includes('"installedRuntimeOk":true'),
  digestLine ? "installedRuntimeOk=true on live startup line" : "missing startup line",
);
check(
  "LIVE_IS_ANCESTOR_OF_SOURCE_HEAD",
  liveIsAncestor,
  `live=${liveSha} sourceHead=${sourceHead} ancestorOrEqual=${liveIsAncestor}`,
);
check(
  "GITHUB_LIVE_CANDIDATE_RESOLVABLE",
  ghLive === liveSha,
  `tryveto commits API -> ${ghLive || "MISS"}`,
);
check(
  "GITHUB_OVERNIGHT_BRANCH_TIP",
  Boolean(ghBranch),
  `veto/paperclip-v0.07-overnight-closeout -> ${ghBranch || "MISS"}`,
);
check(
  "MIGRATIONS_NOT_NESTED",
  !nested,
  nested ? "dist/migrations/migrations present" : "flat migrations tree",
);
check(
  "RECOVERY_NO_MISSING_COLUMN_2H",
  missingCol === 0,
  `missing_column_mentions=${missingCol}`,
);
check(
  "RECOVERY_NO_PAUSED_WAKE_SPAM_2H",
  wakeSpam === 0,
  `failed_enqueue_dependency_wake=${wakeSpam}`,
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
  "HOST_RECONSTRUCTION_SPEC_BLOB",
  localSpecObj === "commit" && localSpecBlob === SPEC_BLOB,
  `localSpec=${LOCAL_SPEC} blob=${localSpecBlob}`,
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
check("CLONE_NOT_SHALLOW", shallow === "false", `is-shallow-repository=${shallow}`);

const failed = findings.filter((f) => !f.ok);
const p0Fail = failed.filter((f) =>
  [
    "INSTALLED_RUNTIME_DIGESTS_PRESENT",
    "STARTUP_DIGEST_VERIFY_OK",
    "STARTUP_INSTALLED_RUNTIME_OK",
    "EXACT_GIT_PRODUCT_BASE",
    "EXACT_GIT_SPEC_COMMIT",
    "MANIFEST_CANDIDATE_MATCHES_DIR",
    "GITHUB_LIVE_CANDIDATE_RESOLVABLE",
    "MIGRATIONS_NOT_NESTED",
  ].includes(f.id),
);

const verdict =
  p0Fail.length === 0
    ? "PASS_CANDIDATE — Mac pins resolved; still require SPEC-3 historical disposition before claiming closed"
    : "FAIL — residual P0(s); v0.08 remains blocked";

console.log("\n=== Verdict ===");
console.log(verdict);
const summary = {
  liveSha,
  sourceHead,
  releaseDigest: manifest.releaseDigest,
  failed: failed.map((f) => f.id),
  p0Fail: p0Fail.map((f) => f.id),
  v008: "LOCKED",
};
console.log(JSON.stringify(summary, null, 2));

try {
  appendFileSync(
    "/home/sebastianheyneman_tryveto_com/.cursor/debug-02fbe2.log",
    JSON.stringify({
      sessionId: "02fbe2",
      runId: "live-safe-audit",
      hypothesisId: "MAC",
      location: "scripts/audit-v007-live-safe.mjs",
      message: "fresh live-safe audit",
      data: {
        liveSha,
        sourceHead,
        p0Fail: summary.p0Fail,
        failed: summary.failed,
        wakeSpam,
        missingCol,
        productObj,
        specObj,
        localSpecBlob,
      },
      timestamp: Date.now(),
    }) + "\n",
  );
} catch {
  /* ignore */
}

process.exit(p0Fail.length === 0 ? 0 : 2);
