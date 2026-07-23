#!/usr/bin/env node
/**
 * Package an immutable Paperclip release from a clean git checkout.
 *
 * Produces:
 *   <outDir>/
 *     package.json
 *     node_modules/   (fresh npm install of paperclipai + HEAD package tarballs)
 *     .release-artifacts/*.tgz
 *     build-manifest.json (immutable; includes package + release digests)
 *     RELEASE_PROVENANCE.json
 *
 * Refuses dirty trees and refuses to patch an existing live release in place.
 *
 * Usage:
 *   node scripts/package-immutable-release.mjs <outDir>
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  lstatSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
  rmSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appendFileSync } from "node:fs";

/** Walk outDir; rewrite absolute symlinks that still point into stageDir to relative targets. */
function rewriteStageAbsoluteSymlinks(rootDir, stageRoot) {
  const stageResolved = resolve(stageRoot);
  let rewritten = 0;
  let dangling = 0;
  const samples = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = join(dir, ent.name);
      // Prefer symlink check first — dirents that point at directories still report isDirectory().
      if (ent.isSymbolicLink()) {
        // fall through to rewrite below
      } else if (ent.isDirectory()) {
        stack.push(full);
        continue;
      } else {
        continue;
      }
      let target;
      try {
        target = readlinkSync(full);
      } catch {
        continue;
      }
      if (!target.startsWith("/")) continue;
      const targetResolved = resolve(target);
      if (!targetResolved.startsWith(stageResolved + "/") && targetResolved !== stageResolved) {
        dangling += 1;
        continue;
      }
      const mappedAbs = join(rootDir, relative(stageResolved, targetResolved));
      const rel = relative(dirname(full), mappedAbs);
      unlinkSync(full);
      symlinkSync(rel, full);
      rewritten += 1;
      if (samples.length < 5) {
        samples.push({
          link: relative(rootDir, full),
          old: target,
          new: rel,
        });
      }
    }
  }
  return { rewritten, dangling, samples };
}

const DEBUG_LOG = "/home/sebastianheyneman_tryveto_com/.cursor/debug-02fbe2.log";
function dbg(hypothesisId, location, message, data) {
  const payload = {
    sessionId: "02fbe2",
    runId: process.env.DEBUG_RUN_ID || "post-fix",
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  try {
    appendFileSync(DEBUG_LOG, `${JSON.stringify(payload)}\n`);
  } catch {
    /* ignore */
  }
  fetch("http://127.0.0.1:7545/ingest/4ed7b7c9-5622-400e-a37d-190daaa78dcd", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "02fbe2" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(process.argv[2] || "");
if (!outDir) {
  console.error("Usage: node scripts/package-immutable-release.mjs <outDir>");
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  console.log("+", cmd, args.join(" "));
  return execFileSync(cmd, args, {
    cwd: opts.cwd || repoRoot,
    encoding: "utf8",
    stdio: opts.stdio || "inherit",
    env: { ...process.env, ...(opts.env || {}) },
  });
}

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

const status = git(["status", "--porcelain"]);
if (status) {
  console.error("Refusing: dirty worktree\n" + status);
  process.exit(1);
}

const candidateSha = git(["rev-parse", "HEAD"]).toLowerCase();
if (existsSync(outDir)) {
  console.error(`Refusing: outDir already exists: ${outDir}`);
  process.exit(1);
}

const paperclipaiVersion = process.env.PAPERCLIP_CLI_VERSION || "2026.720.0";
const packsDir = mkdtempSync(join(tmpdir(), "paperclip-packs-"));
const stageDir = mkdtempSync(join(tmpdir(), "paperclip-release-stage-"));

try {
  console.log("== build packages ==");
  run("pnpm", ["--filter", "@paperclipai/plugin-sdk", "ensure-build-deps"]);
  run("pnpm", ["--filter", "@paperclipai/shared", "build"]);
  run("pnpm", ["--filter", "@paperclipai/db", "build"]);
  run("pnpm", ["--filter", "@paperclipai/ui", "build"]);
  run("pnpm", ["--filter", "@paperclipai/server", "build"]);
  run("bash", ["scripts/prepare-server-ui-dist.sh"], {
    env: { PAPERCLIP_RELEASE_REUSE_UI_DIST: "1" },
  });

  console.log("== pack ==");
  run("pnpm", ["pack", "--pack-destination", packsDir], { cwd: join(repoRoot, "packages/shared") });
  run("pnpm", ["pack", "--pack-destination", packsDir], { cwd: join(repoRoot, "packages/db") });
  run("pnpm", ["pack", "--pack-destination", packsDir], {
    cwd: join(repoRoot, "server"),
    env: { PAPERCLIP_RELEASE_REUSE_UI_DIST: "1" },
  });

  const packNames = {
    shared: "paperclipai-shared-0.3.1.tgz",
    db: "paperclipai-db-0.3.1.tgz",
    server: "paperclipai-server-0.3.1.tgz",
  };
  for (const name of Object.values(packNames)) {
    if (!existsSync(join(packsDir, name))) {
      throw new Error(`missing pack ${name} in ${packsDir}`);
    }
  }

  console.log("== fresh npm install paperclipai (adapters/runtime), then overlay HEAD packs ==");
  mkdirSync(stageDir, { recursive: true });
  const artifacts = join(stageDir, ".release-artifacts");
  mkdirSync(artifacts, { recursive: true });
  for (const name of Object.values(packNames)) {
    cpSync(join(packsDir, name), join(artifacts, name));
  }

  writeFileSync(
    join(stageDir, "package.json"),
    `${JSON.stringify(
      {
        name: "paperclip-veto-mainline-cloud-release",
        private: true,
        dependencies: {
          paperclipai: paperclipaiVersion,
        },
      },
      null,
      2,
    )}\n`,
  );

  // Fresh install of the published CLI meta-package (brings adapters + runtime deps).
  run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], { cwd: stageDir });

  // Overlay HEAD-built packages — installed bytes come from this checkout's packs.
  for (const [key, tgz] of Object.entries(packNames)) {
    const destName = key; // shared | db | server
    const dest = join(stageDir, "node_modules/@paperclipai", destName);
    const extract = mkdtempSync(join(tmpdir(), `extract-${key}-`));
    run("tar", ["-xzf", join(artifacts, tgz), "-C", extract]);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(extract, "package"), dest, { recursive: true });
    rmSync(extract, { recursive: true, force: true });
  }

  // Record that HEAD packs are the authoritative @paperclipai/{shared,db,server} bytes.
  const packageJson = JSON.parse(readFileSync(join(stageDir, "package.json"), "utf8"));
  packageJson.dependencies = {
    ...packageJson.dependencies,
    "@paperclipai/shared": `file:.release-artifacts/${packNames.shared}`,
    "@paperclipai/db": `file:.release-artifacts/${packNames.db}`,
    "@paperclipai/server": `file:.release-artifacts/${packNames.server}`,
  };
  writeFileSync(join(stageDir, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);

  if (!existsSync(join(stageDir, "node_modules/.bin/paperclipai"))) {
    throw new Error("paperclipai bin missing after install");
  }
  if (!existsSync(join(stageDir, "node_modules/@paperclipai/server/dist/services/version-contracts.js"))) {
    throw new Error("server dist missing after extract");
  }

  console.log("== write immutable build-manifest ==");
  const manifestPath = join(stageDir, "build-manifest.json");
  run("node", ["scripts/write-build-manifest.mjs", manifestPath], {
    env: {
      PAPERCLIP_RELEASE_ARTIFACTS_DIR: artifacts,
      PAPERCLIP_PRODUCT_BASE_SHA: process.env.PAPERCLIP_PRODUCT_BASE_SHA || "9cad4cb71670c00191e52ab44e877156dfaf2118",
    },
  });
  chmodSync(manifestPath, 0o444);

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.candidateSha !== candidateSha) {
    throw new Error(`manifest candidateSha ${manifest.candidateSha} != HEAD ${candidateSha}`);
  }
  if (!manifest.releaseDigest || !manifest.packageDigests?.length) {
    throw new Error("manifest missing releaseDigest/packageDigests");
  }

  writeFileSync(
    join(stageDir, "RELEASE_PROVENANCE.json"),
    `${JSON.stringify(
      {
        candidateSha,
        method: "fresh_npm_install_paperclipai_plus_head_package_tarballs",
        paperclipaiVersion,
        packageTarballs: Object.values(packNames),
        builtAt: manifest.builtAt,
        releaseDigest: manifest.releaseDigest,
        note: "No copy of a prior release directory; no surgical live node_modules patch.",
      },
      null,
      2,
    )}\n`,
  );

  console.log("== move stage to outDir ==");
  mkdirSync(dirname(outDir), { recursive: true });
  cpSync(stageDir, outDir, { recursive: true });

  const icuLink = join(
    outDir,
    "node_modules/@embedded-postgres/linux-x64/native/lib/libicui18n.so.60",
  );
  // #region agent log
  dbg("B", "package-immutable-release.mjs:pre-symlink-fix", "absolute stage symlinks before rewrite", {
    outDir,
    stageDir,
    binSample: (() => {
      try {
        return readlinkSync(join(outDir, "node_modules/.bin/paperclipai"));
      } catch (e) {
        return String(e);
      }
    })(),
    icuSample: (() => {
      try {
        return readlinkSync(icuLink);
      } catch (e) {
        return String(e);
      }
    })(),
    icuExistsBefore: existsSync(icuLink),
  });
  // #endregion

  // npm / package postinstall may create absolute symlinks into stageDir (.bin,
  // embedded-postgres native/lib, etc.). After stage cleanup those dangle.
  // Rewrite every absolute link that still points into stageDir to a relative target.
  const { rewritten, dangling, samples } = rewriteStageAbsoluteSymlinks(outDir, stageDir);

  const paperclipBin = join(outDir, "node_modules/.bin/paperclipai");
  let paperclipTarget = null;
  try {
    paperclipTarget = readlinkSync(paperclipBin);
  } catch {
    paperclipTarget = null;
  }
  let icuTarget = null;
  try {
    icuTarget = readlinkSync(icuLink);
  } catch {
    icuTarget = null;
  }

  // #region agent log
  dbg("B", "package-immutable-release.mjs:post-symlink-fix", "symlinks after stage-absolute rewrite", {
    rewritten,
    dangling,
    samples,
    binTarget: paperclipTarget,
    binExists: existsSync(paperclipBin),
    icuTarget,
    icuExists: existsSync(icuLink),
    icuIsAbsolute: typeof icuTarget === "string" && icuTarget.startsWith("/"),
  });
  // #endregion

  if (!existsSync(paperclipBin) || !existsSync(join(outDir, "node_modules/paperclipai/dist/index.js"))) {
    throw new Error("paperclipai bin broken after outDir promotion (absolute symlink leak)");
  }
  if (existsSync(dirname(icuLink)) && (!existsSync(icuLink) || (icuTarget && icuTarget.startsWith("/")))) {
    throw new Error("embedded-postgres ICU symlink broken after outDir promotion (absolute symlink leak)");
  }

  console.log(`Release ready: ${outDir}`);
  console.log(
    JSON.stringify(
      { candidateSha, releaseDigest: manifest.releaseDigest, rewrittenSymlinks: rewritten, danglingSymlinks: dangling },
      null,
      2,
    ),
  );
} finally {
  rmSync(packsDir, { recursive: true, force: true });
  rmSync(stageDir, { recursive: true, force: true });
}
