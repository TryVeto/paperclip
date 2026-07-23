#!/usr/bin/env node
/**
 * Write an immutable build-manifest.json for exact-SHA ship attestation.
 * Requires a clean worktree. Derives candidate SHA from `git rev-parse HEAD`.
 *
 * Optional: PAPERCLIP_RELEASE_ARTIFACTS_DIR — directory of package .tgz files whose
 * sha256 digests are recorded and folded into releaseDigest.
 *
 * Usage: node scripts/write-build-manifest.mjs [outPath]
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, basename, join, relative } from "node:path";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function sha256File(path) {
  const buf = readFileSync(path);
  return { sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length };
}

function computeReleaseDigest(candidateSha, packageDigests) {
  const packages = [...packageDigests]
    .map((p) => ({ name: p.name, sha256: p.sha256.toLowerCase() }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return createHash("sha256")
    .update(JSON.stringify({ candidateSha: candidateSha.toLowerCase(), packages }))
    .digest("hex");
}

function computeInstalledPackageTreeDigest(packageDir) {
  if (!existsSync(packageDir) || !statSync(packageDir).isDirectory()) return null;
  const files = [];
  const stack = [packageDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!ent.isFile() && !ent.isSymbolicLink()) continue;
      try {
        if (statSync(full).isDirectory()) continue;
        const rel = relative(packageDir, full).split("\\").join("/");
        files.push({ rel, sha256: sha256File(full).sha256 });
      } catch {
        // skip
      }
    }
  }
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  return {
    sha256: createHash("sha256").update(JSON.stringify(files)).digest("hex"),
    fileCount: files.length,
  };
}

const outPath = resolve(process.argv[2] || "build-manifest.json");
const productBaseSha =
  process.env.PAPERCLIP_PRODUCT_BASE_SHA || "9cad4cb71670c00191e52ab44e877156dfaf2118";
const specPath = process.env.PAPERCLIP_SPEC_PATH || "doc/plans/2026-07-22-paperclip-v0.07.md";
const artifactsDir = process.env.PAPERCLIP_RELEASE_ARTIFACTS_DIR
  ? resolve(process.env.PAPERCLIP_RELEASE_ARTIFACTS_DIR)
  : null;
const installedRoot = process.env.PAPERCLIP_INSTALLED_RELEASE_ROOT
  ? resolve(process.env.PAPERCLIP_INSTALLED_RELEASE_ROOT)
  : null;

const status = git(["status", "--porcelain"]);
if (status) {
  console.error("Refusing to write build manifest: worktree is dirty");
  process.exit(1);
}

const candidateSha = git(["rev-parse", "HEAD"]).toLowerCase();
if (!/^[0-9a-f]{40}$/.test(candidateSha)) {
  console.error("Invalid HEAD sha");
  process.exit(1);
}

let canonicalSpecBlobSha;
let canonicalSpecCommitSha;
if (existsSync(specPath)) {
  canonicalSpecBlobSha = git(["hash-object", specPath]).toLowerCase();
  canonicalSpecCommitSha =
    (process.env.PAPERCLIP_SPEC_COMMIT_SHA || "11f920182fdf908e2476c144505b1e659427015d").toLowerCase();
}

const packageDigests = [];
if (artifactsDir && existsSync(artifactsDir)) {
  for (const name of readdirSync(artifactsDir).filter((n) => n.endsWith(".tgz")).sort()) {
    const full = join(artifactsDir, name);
    if (!statSync(full).isFile()) continue;
    const dig = sha256File(full);
    packageDigests.push({
      name: basename(name).replace(/-\d+\.\d+\.\d+\.tgz$/, "").replace(/\.tgz$/, ""),
      sha256: dig.sha256,
      bytes: dig.bytes,
      path: name,
    });
  }
}

const installedRuntimeDigests = [];
if (installedRoot && existsSync(installedRoot)) {
  for (const name of ["db", "server", "shared"]) {
    const dir = join(installedRoot, "node_modules", "@paperclipai", name);
    const dig = computeInstalledPackageTreeDigest(dir);
    if (!dig) continue;
    installedRuntimeDigests.push({ name, sha256: dig.sha256, fileCount: dig.fileCount });
  }
  installedRuntimeDigests.sort((a, b) => a.name.localeCompare(b.name));
}

const manifest = {
  candidateSha,
  productBaseSha: productBaseSha.toLowerCase(),
  canonicalSpecPath: specPath,
  canonicalSpecCommitSha,
  canonicalSpecBlobSha,
  builtAt: new Date().toISOString(),
  packageDigests,
  installedRuntimeDigests: installedRuntimeDigests.length ? installedRuntimeDigests : undefined,
  releaseDigest: packageDigests.length
    ? computeReleaseDigest(candidateSha, packageDigests)
    : undefined,
};

writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o444 });
console.log(`Wrote ${outPath}`);
console.log(JSON.stringify(manifest, null, 2));
if (!packageDigests.length) {
  console.warn("WARNING: no packageDigests — set PAPERCLIP_RELEASE_ARTIFACTS_DIR for Section-2 compliance");
}
if (!installedRuntimeDigests.length) {
  console.warn(
    "WARNING: no installedRuntimeDigests — set PAPERCLIP_INSTALLED_RELEASE_ROOT so closeShip can bind installed bytes",
  );
}
