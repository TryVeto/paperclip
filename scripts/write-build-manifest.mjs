#!/usr/bin/env node
/**
 * Write an immutable build-manifest.json for exact-SHA ship attestation.
 * Requires a clean worktree. Derives candidate SHA from `git rev-parse HEAD`.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function git(args: string[]) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const outPath = resolve(process.argv[2] || "build-manifest.json");
const productBaseSha =
  process.env.PAPERCLIP_PRODUCT_BASE_SHA || "9cad4cb71670c00191e52ab44e877156dfaf2118";
const specPath = process.env.PAPERCLIP_SPEC_PATH || "doc/plans/2026-07-22-paperclip-v0.07.md";

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

let canonicalSpecBlobSha: string | undefined;
let canonicalSpecCommitSha: string | undefined;
if (existsSync(specPath)) {
  canonicalSpecBlobSha = git(["hash-object", specPath]).toLowerCase();
  canonicalSpecCommitSha = candidateSha;
}

const manifest = {
  candidateSha,
  productBaseSha: productBaseSha.toLowerCase(),
  canonicalSpecPath: specPath,
  canonicalSpecCommitSha,
  canonicalSpecBlobSha,
  builtAt: new Date().toISOString(),
};

writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o444 });
console.log(`Wrote ${outPath}`);
console.log(JSON.stringify(manifest, null, 2));
