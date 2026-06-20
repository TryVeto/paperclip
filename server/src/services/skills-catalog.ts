import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type {
  CatalogSkill,
  CatalogSkillFileDetail,
  CatalogSkillListQuery,
  CatalogSkillSource,
} from "@paperclipai/shared";
import { HttpError, conflict, notFound, unprocessable } from "../errors.js";
import { ghFetch, resolveRawGitHubUrl } from "./github-fetch.js";
import { normalizePortablePath } from "./portable-path.js";

interface CatalogManifestFile {
  packageName: string;
  packageVersion: string;
  skills: CatalogSkill[];
}

const serviceDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serviceDir, "../../..");

// The skills-catalog package and its generated manifest live in different
// places depending on how the server is built and deployed:
//   - monorepo / source layout: <repo>/packages/skills-catalog/generated/catalog.json
//   - published / Docker layout: .../node_modules/@paperclipai/skills-catalog/(dist/)generated/catalog.json
// Resolving a single hardcoded monorepo path makes GET /api/skills/catalog 500
// in deployments that don't preserve the workspace tree, so probe known layouts.
function resolveCatalogPaths(): { packageRoot: string; manifestPath: string } {
  const candidateRoots: string[] = [path.join(repoRoot, "packages/skills-catalog")];
  for (const base of [repoRoot, path.resolve(serviceDir, ".."), serviceDir]) {
    candidateRoots.push(path.join(base, "node_modules/@paperclipai/skills-catalog"));
  }
  try {
    // Honors the package "exports" map in whatever layout is installed.
    const resolved = createRequire(import.meta.url).resolve(
      "@paperclipai/skills-catalog/catalog.json",
    );
    const root = resolved.includes(`${path.sep}dist${path.sep}`)
      ? path.resolve(path.dirname(resolved), "../..")
      : path.resolve(path.dirname(resolved), "..");
    candidateRoots.unshift(root);
  } catch {
    // Package not resolvable here; fall back to filesystem probing below.
  }
  for (const packageRoot of candidateRoots) {
    for (const rel of ["dist/generated/catalog.json", "generated/catalog.json"]) {
      const manifestPath = path.join(packageRoot, rel);
      if (existsSync(manifestPath)) return { packageRoot, manifestPath };
    }
  }
  // Nothing found: keep the monorepo default so the thrown error stays actionable.
  const fallbackRoot = path.join(repoRoot, "packages/skills-catalog");
  return {
    packageRoot: fallbackRoot,
    manifestPath: path.join(fallbackRoot, "generated/catalog.json"),
  };
}

const { packageRoot: catalogPackageRoot, manifestPath: catalogManifestPath } =
  resolveCatalogPaths();
let cachedCatalogManifest: {
  manifest: CatalogManifestFile;
  mtimeMs: number;
  size: number;
} | null = null;

function loadCatalogManifest(): CatalogManifestFile {
  if (!existsSync(catalogManifestPath)) {
    throw new Error(
      `Skills catalog manifest not found at ${catalogManifestPath}. Run pnpm --filter @paperclipai/skills-catalog build:manifest.`,
    );
  }
  return JSON.parse(readFileSync(catalogManifestPath, "utf8")) as CatalogManifestFile;
}

function getCatalogManifest() {
  if (!existsSync(catalogManifestPath)) {
    throw new Error(
      `Skills catalog manifest not found at ${catalogManifestPath}. Run pnpm --filter @paperclipai/skills-catalog build:manifest.`,
    );
  }
  const stats = statSync(catalogManifestPath);
  if (
    cachedCatalogManifest &&
    cachedCatalogManifest.mtimeMs === stats.mtimeMs &&
    cachedCatalogManifest.size === stats.size
  ) {
    return cachedCatalogManifest.manifest;
  }

  const manifest = loadCatalogManifest();
  cachedCatalogManifest = {
    manifest,
    mtimeMs: stats.mtimeMs,
    size: stats.size,
  };
  return manifest;
}

function getCatalogSkills() {
  const catalogManifest = getCatalogManifest();
  return catalogManifest.skills.map((skill) => ({
    ...skill,
    packageName: catalogManifest.packageName,
    packageVersion: catalogManifest.packageVersion,
  }));
}

function isMarkdownPath(filePath: string) {
  const fileName = path.posix.basename(filePath).toLowerCase();
  return fileName === "skill.md" || fileName.endsWith(".md");
}

function inferLanguageFromPath(filePath: string) {
  const fileName = path.posix.basename(filePath).toLowerCase();
  if (fileName === "skill.md" || fileName.endsWith(".md")) return "markdown";
  if (fileName.endsWith(".ts")) return "typescript";
  if (fileName.endsWith(".tsx")) return "tsx";
  if (fileName.endsWith(".js")) return "javascript";
  if (fileName.endsWith(".jsx")) return "jsx";
  if (fileName.endsWith(".json")) return "json";
  if (fileName.endsWith(".yml") || fileName.endsWith(".yaml")) return "yaml";
  if (fileName.endsWith(".sh")) return "bash";
  if (fileName.endsWith(".py")) return "python";
  if (fileName.endsWith(".html")) return "html";
  if (fileName.endsWith(".css")) return "css";
  return null;
}

function resolveCatalogPackageRoot() {
  return catalogPackageRoot;
}

function sourceRootPath(source: CatalogSkillSource) {
  return source.path ? normalizePortablePath(source.path) : "";
}

function resolveCatalogSourcePath(source: CatalogSkillSource, relativePath: string) {
  const sourceRoot = sourceRootPath(source);
  return sourceRoot ? `${sourceRoot}/${relativePath}` : relativePath;
}

async function fetchCatalogSourceFile(
  skill: CatalogSkill,
  relativePath: string,
): Promise<Buffer> {
  const source = skill.source;
  if (!source) {
    const packageRoot = resolveCatalogPackageRoot();
    const absolutePath = path.resolve(packageRoot, skill.path, relativePath);
    const skillRoot = path.resolve(packageRoot, skill.path);
    if (absolutePath !== skillRoot && !absolutePath.startsWith(`${skillRoot}${path.sep}`)) {
      throw notFound("Catalog skill file not found");
    }
    return fs.readFile(absolutePath);
  }

  if (source.type !== "github") {
    throw unprocessable(`Unsupported catalog source type: ${(source as { type: string }).type}`);
  }

  const sourcePath = resolveCatalogSourcePath(source, relativePath);
  const url = resolveRawGitHubUrl(source.hostname, source.owner, source.repo, source.commit, sourcePath);
  const response = await ghFetch(url);
  if (!response.ok) {
    throw unprocessable(`Failed to fetch pinned catalog file ${sourcePath} from ${source.owner}/${source.repo}@${source.commit}: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function readCatalogFileBytes(
  skill: CatalogSkill,
  relativePath: string,
): Promise<Buffer> {
  const fileEntry = skill.files.find((entry) => entry.path === relativePath);
  if (!fileEntry) {
    throw notFound("Catalog skill file not found");
  }

  const bytes = await fetchCatalogSourceFile(skill, relativePath);
  const actualSha = createHash("sha256").update(bytes).digest("hex");
  if (actualSha !== fileEntry.sha256) {
    throw unprocessable(`Pinned catalog file hash mismatch for ${skill.id}:${relativePath}.`);
  }
  return bytes;
}

function searchText(skill: CatalogSkill) {
  return [
    skill.id,
    skill.key,
    skill.slug,
    skill.name,
    skill.description,
    skill.category,
    skill.kind,
    ...skill.recommendedForRoles,
    ...skill.tags,
  ].join("\n").toLowerCase();
}

export function listCatalogSkills(query: CatalogSkillListQuery = {}): CatalogSkill[] {
  const normalizedQuery = query.q?.trim().toLowerCase() ?? "";
  return getCatalogSkills()
    .filter((skill) => !query.kind || skill.kind === query.kind)
    .filter((skill) => !query.category || skill.category === query.category)
    .filter((skill) => !normalizedQuery || searchText(skill).includes(normalizedQuery))
    .sort((left, right) => left.name.localeCompare(right.name) || left.key.localeCompare(right.key));
}

export function resolveCatalogSkillReference(reference: string): { skill: CatalogSkill | null; ambiguous: boolean } {
  const trimmed = reference.trim();
  if (!trimmed) return { skill: null, ambiguous: false };
  const catalogSkills = getCatalogSkills();

  const exact = catalogSkills.find((skill) => skill.id === trimmed || skill.key === trimmed);
  if (exact) return { skill: exact, ambiguous: false };

  const slugMatches = catalogSkills.filter((skill) => skill.slug === trimmed);
  if (slugMatches.length === 1) return { skill: slugMatches[0]!, ambiguous: false };
  if (slugMatches.length > 1) return { skill: null, ambiguous: true };
  return { skill: null, ambiguous: false };
}

export function getCatalogSkillOrThrow(reference: string): CatalogSkill {
  const result = resolveCatalogSkillReference(reference);
  if (result.ambiguous) {
    throw conflict(`Catalog skill slug "${reference}" is ambiguous. Use an id or key.`);
  }
  if (!result.skill) {
    throw notFound("Catalog skill not found");
  }
  return result.skill;
}

export async function readCatalogSkillFile(
  reference: string,
  relativePath = "SKILL.md",
): Promise<CatalogSkillFileDetail> {
  const skill = getCatalogSkillOrThrow(reference);
  const normalizedPath = normalizePortablePath(relativePath || "SKILL.md");
  const fileEntry = skill.files.find((entry) => entry.path === normalizedPath);
  if (!fileEntry) {
    throw notFound("Catalog skill file not found");
  }

  if (fileEntry.kind === "asset") {
    throw new HttpError(415, "Catalog asset previews are not supported.");
  }

  const content = (await readCatalogFileBytes(skill, normalizedPath)).toString("utf8");
  return {
    catalogSkillId: skill.id,
    path: normalizedPath,
    kind: fileEntry.kind,
    content,
    language: inferLanguageFromPath(normalizedPath),
    markdown: isMarkdownPath(normalizedPath),
  };
}

export async function copyCatalogSkillFile(reference: string, relativePath: string, targetPath: string): Promise<void> {
  const skill = getCatalogSkillOrThrow(reference);
  const normalizedPath = normalizePortablePath(relativePath || "SKILL.md");
  const fileEntry = skill.files.find((entry) => entry.path === normalizedPath);
  if (!fileEntry) {
    throw notFound("Catalog skill file not found");
  }

  await fs.writeFile(targetPath, await readCatalogFileBytes(skill, normalizedPath));
}

export function getCatalogPackageMetadata() {
  const catalogManifest = getCatalogManifest();
  return {
    packageName: catalogManifest.packageName,
    packageVersion: catalogManifest.packageVersion,
  };
}
