import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { isSha40, normalizeSha } from "./services/version-contract-policy.js";

export type BuildManifestAttestation = {
  candidateSha: string;
  productBaseSha: string;
  canonicalSpecPath?: string;
  canonicalSpecCommitSha?: string;
  canonicalSpecBlobSha?: string;
  builtAt: string;
  source: "bundled_manifest";
};

let cached: BuildManifestAttestation | null | undefined;

function loadFromPath(path: string): BuildManifestAttestation | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    const candidateSha = normalizeSha(String(raw.candidateSha ?? raw.candidate_source_sha ?? ""));
    const productBaseSha = normalizeSha(String(raw.productBaseSha ?? raw.product_base_sha ?? ""));
    if (!isSha40(candidateSha) || !isSha40(productBaseSha)) return null;
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
    };
  } catch {
    return null;
  }
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

  for (const path of candidates) {
    const loaded = loadFromPath(path);
    if (loaded) {
      cached = loaded;
      return loaded;
    }
  }
  cached = null;
  return null;
}

export function getBuildManifestAttestation(): BuildManifestAttestation | null {
  if (cached === undefined) {
    return loadBuildManifestAtStartup();
  }
  return cached;
}

/** Test-only: replace attestation without reading disk. */
export function setBuildManifestAttestationForTests(value: BuildManifestAttestation | null) {
  cached = value;
}
