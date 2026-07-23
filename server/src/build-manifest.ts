import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, basename, relative } from "node:path";
import { isSha40, normalizeSha } from "./services/version-contract-policy.js";

export type PackageDigest = {
  name: string;
  sha256: string;
  bytes: number;
  path: string;
};

export type InstalledRuntimeDigest = {
  /** Package name under @paperclipai/* (e.g. server, db, shared). */
  name: string;
  /** sha256 over canonical sorted relative-path + content pairs. */
  sha256: string;
  fileCount: number;
};

export type BuildManifestAttestation = {
  candidateSha: string;
  productBaseSha: string;
  canonicalSpecPath?: string;
  canonicalSpecCommitSha?: string;
  canonicalSpecBlobSha?: string;
  builtAt: string;
  source: "bundled_manifest";
  /** sha256 digests of release package tarballs (or equivalent artifact files). */
  packageDigests?: PackageDigest[];
  /** sha256 over canonical digest payload — verified at startup against installed artifacts. */
  releaseDigest?: string;
  /**
   * Digests of installed @paperclipai/{server,db,shared} trees. Required for
   * closeShip — tarball digests alone are not installed-runtime proof.
   */
  installedRuntimeDigests?: InstalledRuntimeDigest[];
};

let cached: BuildManifestAttestation | null | undefined;
let lastVerify: { ok: boolean; detail: string; installedRuntimeOk: boolean } | null = null;

const DEFAULT_RUNTIME_PACKAGES = ["shared", "db", "server"] as const;

export function sha256File(path: string): { sha256: string; bytes: number } {
  const buf = readFileSync(path);
  return { sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length };
}

export function computeReleaseDigest(input: {
  candidateSha: string;
  packageDigests: Array<{ name: string; sha256: string }>;
}): string {
  const packages = [...input.packageDigests]
    .map((p) => ({ name: p.name, sha256: p.sha256.toLowerCase() }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const payload = JSON.stringify({
    candidateSha: normalizeSha(input.candidateSha),
    packages,
  });
  return createHash("sha256").update(payload).digest("hex");
}

/** Canonical tree digest for an installed package directory (files only; no nested node_modules). */
export function computeInstalledPackageTreeDigest(packageDir: string): {
  sha256: string;
  fileCount: number;
} | null {
  if (!existsSync(packageDir) || !statSync(packageDir).isDirectory()) return null;
  const files: Array<{ rel: string; sha256: string }> = [];
  const stack = [packageDir];
  while (stack.length) {
    const dir = stack.pop()!;
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
        // skip unreadable
      }
    }
  }
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  const payload = JSON.stringify(files);
  return {
    sha256: createHash("sha256").update(payload).digest("hex"),
    fileCount: files.length,
  };
}

export function collectInstalledRuntimeDigests(
  releaseRoot: string,
  packageNames: readonly string[] = DEFAULT_RUNTIME_PACKAGES,
): InstalledRuntimeDigest[] {
  const out: InstalledRuntimeDigest[] = [];
  for (const name of packageNames) {
    const dir = join(releaseRoot, "node_modules", "@paperclipai", name);
    const dig = computeInstalledPackageTreeDigest(dir);
    if (!dig) continue;
    out.push({ name, sha256: dig.sha256, fileCount: dig.fileCount });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function loadFromPath(path: string): BuildManifestAttestation | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    const candidateSha = normalizeSha(String(raw.candidateSha ?? raw.candidate_source_sha ?? ""));
    const productBaseSha = normalizeSha(String(raw.productBaseSha ?? raw.product_base_sha ?? ""));
    if (!isSha40(candidateSha) || !isSha40(productBaseSha)) return null;
    const packageDigests = Array.isArray(raw.packageDigests)
      ? (raw.packageDigests as PackageDigest[])
          .filter((d) => d && typeof d.name === "string" && typeof d.sha256 === "string")
          .map((d) => ({
            name: String(d.name),
            sha256: String(d.sha256).toLowerCase(),
            bytes: Number(d.bytes ?? 0),
            path: String(d.path ?? d.name),
          }))
      : undefined;
    const releaseDigest =
      typeof raw.releaseDigest === "string" ? String(raw.releaseDigest).toLowerCase() : undefined;
    const installedRuntimeDigests = Array.isArray(raw.installedRuntimeDigests)
      ? (raw.installedRuntimeDigests as InstalledRuntimeDigest[])
          .filter((d) => d && typeof d.name === "string" && typeof d.sha256 === "string")
          .map((d) => ({
            name: String(d.name),
            sha256: String(d.sha256).toLowerCase(),
            fileCount: Number(d.fileCount ?? 0),
          }))
      : undefined;
    return {
      candidateSha,
      productBaseSha,
      canonicalSpecPath: raw.canonicalSpecPath ? String(raw.canonicalSpecPath) : undefined,
      canonicalSpecCommitSha: raw.canonicalSpecCommitSha
        ? normalizeSha(String(raw.canonicalSpecCommitSha))
        : undefined,
      canonicalSpecBlobSha: raw.canonicalSpecBlobSha
        ? normalizeSha(String(raw.canonicalSpecBlobSha))
        : undefined,
      builtAt: String(raw.builtAt ?? raw.built_at ?? new Date(0).toISOString()),
      source: "bundled_manifest",
      packageDigests,
      releaseDigest,
      installedRuntimeDigests,
    };
  } catch {
    return null;
  }
}

/**
 * Verify installed release artifacts match the bundled manifest digests.
 * Verifies tarball digests when present, and always requires installed runtime
 * tree digests to match node_modules/@paperclipai/{shared,db,server}.
 */
export function verifyInstalledReleaseDigest(
  attestation: BuildManifestAttestation,
  manifestPath: string,
): { ok: boolean; detail: string; installedRuntimeOk: boolean } {
  if (!attestation.packageDigests?.length || !attestation.releaseDigest) {
    return {
      ok: false,
      detail: "manifest_missing_package_or_release_digest",
      installedRuntimeOk: false,
    };
  }
  const expected = computeReleaseDigest({
    candidateSha: attestation.candidateSha,
    packageDigests: attestation.packageDigests,
  });
  if (expected !== attestation.releaseDigest) {
    return {
      ok: false,
      detail: "manifest_release_digest_self_inconsistent",
      installedRuntimeOk: false,
    };
  }

  const manifestDir = resolve(manifestPath, "..");
  const searchRoots = [
    join(manifestDir, ".release-artifacts"),
    join(manifestDir),
    resolve(process.cwd(), ".release-artifacts"),
  ];

  for (const pkg of attestation.packageDigests) {
    const base = basename(pkg.path || pkg.name);
    let found: string | null = null;
    for (const root of searchRoots) {
      const candidate = join(root, base);
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        found = candidate;
        break;
      }
    }
    if (!found) {
      return { ok: false, detail: `missing_artifact:${base}`, installedRuntimeOk: false };
    }
    const actual = sha256File(found);
    if (actual.sha256 !== pkg.sha256) {
      return { ok: false, detail: `digest_mismatch:${base}`, installedRuntimeOk: false };
    }
  }

  // Installed runtime bytes — required. Tarball match alone is insufficient.
  if (!attestation.installedRuntimeDigests?.length) {
    return {
      ok: false,
      detail: "manifest_missing_installed_runtime_digests",
      installedRuntimeOk: false,
    };
  }

  const releaseRoots = [manifestDir, process.cwd()];
  let installedRuntimeOk = false;
  let runtimeDetail = "installed_runtime_root_not_found";
  for (const root of releaseRoots) {
    const actual = collectInstalledRuntimeDigests(root);
    if (actual.length === 0) continue;
    const expectedMap = new Map(
      attestation.installedRuntimeDigests.map((d) => [d.name, d.sha256.toLowerCase()]),
    );
    const mismatches: string[] = [];
    for (const got of actual) {
      const want = expectedMap.get(got.name);
      if (!want) {
        mismatches.push(`unexpected_runtime_pkg:${got.name}`);
        continue;
      }
      if (want !== got.sha256) {
        mismatches.push(`runtime_digest_mismatch:${got.name}`);
      }
      expectedMap.delete(got.name);
    }
    for (const missing of expectedMap.keys()) {
      mismatches.push(`missing_runtime_pkg:${missing}`);
    }
    if (mismatches.length === 0) {
      installedRuntimeOk = true;
      runtimeDetail = "installed_runtime_verified";
      break;
    }
    runtimeDetail = mismatches.join(",");
  }

  if (!installedRuntimeOk) {
    return { ok: false, detail: runtimeDetail, installedRuntimeOk: false };
  }

  return { ok: true, detail: "verified", installedRuntimeOk: true };
}

function isStrictReleaseDigestMode(): boolean {
  const raw = process.env.PAPERCLIP_RELEASE_DIGEST_STRICT;
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  // Production / release installs fail closed by default.
  return process.env.NODE_ENV === "production" || process.env.PAPERCLIP_ENV === "production";
}

/**
 * Load the immutable build manifest baked into the release artifact.
 * Env/request bodies cannot override attested fields — only the bundled file path may be located via env.
 */
export function loadBuildManifestAtStartup(explicitPath?: string): BuildManifestAttestation | null {
  const candidates = [
    explicitPath,
    process.env.PAPERCLIP_BUILD_MANIFEST_PATH,
    resolve(process.cwd(), "build-manifest.json"),
    resolve(process.cwd(), "dist/build-manifest.json"),
    resolve(process.cwd(), ".release/build-manifest.json"),
  ].filter(Boolean) as string[];

  const strict = isStrictReleaseDigestMode();

  for (const path of candidates) {
    const loaded = loadFromPath(path);
    if (loaded) {
      const verify = verifyInstalledReleaseDigest(loaded, path);
      lastVerify = verify;
      if (!verify.ok) {
        if (strict) {
          throw new Error(`build manifest release digest verification failed: ${verify.detail}`);
        }
      }
      cached = loaded;
      return loaded;
    }
  }
  cached = null;
  lastVerify = { ok: false, detail: "no_manifest", installedRuntimeOk: false };
  if (strict) {
    throw new Error("build manifest attestation required but not found");
  }
  return null;
}

export function getBuildManifestAttestation(): BuildManifestAttestation | null {
  if (cached === undefined) {
    return loadBuildManifestAtStartup();
  }
  return cached;
}

export function getLastReleaseDigestVerify(): {
  ok: boolean;
  detail: string;
  installedRuntimeOk: boolean;
} | null {
  return lastVerify;
}

/**
 * Close-path gate: never warn-and-continue. Installed runtime digests must verify.
 */
export function assertReleaseAttestationReadyForClose(): {
  attestation: BuildManifestAttestation;
  verify: { ok: boolean; detail: string; installedRuntimeOk: boolean };
} {
  const attestation = getBuildManifestAttestation();
  if (!attestation?.candidateSha) {
    throw new Error("missing_build_manifest_attestation");
  }
  const verify = lastVerify;
  if (!verify?.ok || !verify.installedRuntimeOk) {
    throw new Error(
      `release_attestation_not_verified:${verify?.detail ?? "no_verify"}`,
    );
  }
  return { attestation, verify };
}

/** Test-only: replace attestation without reading disk. */
export function setBuildManifestAttestationForTests(
  value: BuildManifestAttestation | null,
  verify?: { ok: boolean; detail: string; installedRuntimeOk?: boolean } | null,
) {
  cached = value;
  if (verify === null) {
    lastVerify = null;
    return;
  }
  if (verify) {
    lastVerify = {
      ok: verify.ok,
      detail: verify.detail,
      installedRuntimeOk: verify.installedRuntimeOk ?? verify.ok,
    };
    return;
  }
  lastVerify = value
    ? {
        ok: Boolean(
          value.releaseDigest && value.packageDigests?.length && value.installedRuntimeDigests?.length,
        ),
        detail: "test",
        installedRuntimeOk: Boolean(value.installedRuntimeDigests?.length),
      }
    : null;
}

/** List .tgz artifacts under a release-artifacts directory. */
export function listReleaseArtifactTarballs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".tgz"))
    .map((name) => join(dir, name))
    .sort();
}
