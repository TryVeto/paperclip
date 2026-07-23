import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { isSha40, normalizeSha } from "./services/version-contract-policy.js";

export type PackageDigest = {
  name: string;
  sha256: string;
  bytes: number;
  path: string;
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
};

let cached: BuildManifestAttestation | null | undefined;
let lastVerify: { ok: boolean; detail: string } | null = null;

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
    };
  } catch {
    return null;
  }
}

/**
 * Verify installed release artifacts match the bundled manifest digests.
 * Looks for `.release-artifacts/<basename>` next to the manifest, then under release root.
 */
export function verifyInstalledReleaseDigest(
  attestation: BuildManifestAttestation,
  manifestPath: string,
): { ok: boolean; detail: string } {
  if (!attestation.packageDigests?.length || !attestation.releaseDigest) {
    return { ok: false, detail: "manifest_missing_package_or_release_digest" };
  }
  const expected = computeReleaseDigest({
    candidateSha: attestation.candidateSha,
    packageDigests: attestation.packageDigests,
  });
  if (expected !== attestation.releaseDigest) {
    return { ok: false, detail: "manifest_release_digest_self_inconsistent" };
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
      return { ok: false, detail: `missing_artifact:${base}` };
    }
    const actual = sha256File(found);
    if (actual.sha256 !== pkg.sha256) {
      return { ok: false, detail: `digest_mismatch:${base}` };
    }
  }
  return { ok: true, detail: "verified" };
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

  const strict =
    process.env.PAPERCLIP_RELEASE_DIGEST_STRICT === "1" ||
    process.env.PAPERCLIP_RELEASE_DIGEST_STRICT === "true";

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
  lastVerify = { ok: false, detail: "no_manifest" };
  return null;
}

export function getBuildManifestAttestation(): BuildManifestAttestation | null {
  if (cached === undefined) {
    return loadBuildManifestAtStartup();
  }
  return cached;
}

export function getLastReleaseDigestVerify(): { ok: boolean; detail: string } | null {
  return lastVerify;
}

/** Test-only: replace attestation without reading disk. */
export function setBuildManifestAttestationForTests(value: BuildManifestAttestation | null) {
  cached = value;
  lastVerify = value
    ? { ok: Boolean(value.releaseDigest && value.packageDigests?.length), detail: "test" }
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
