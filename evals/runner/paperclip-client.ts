import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export interface PaperclipCliResult<T = unknown> {
  ok: boolean;
  stdout: string;
  stderr: string;
  data: T | null;
}

function runPaperclip(args: string[]): PaperclipCliResult {
  const cliEntry = path.join(repoRoot, "cli/src/index.ts");
  const result = spawnSync("node", [path.join(repoRoot, "cli/node_modules/tsx/dist/cli.mjs"), cliEntry, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const ok = result.status === 0;
  let data: unknown = null;
  const jsonLine = stdout
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("{") || line.startsWith("["));
  if (jsonLine) {
    try {
      data = JSON.parse(jsonLine);
    } catch {
      data = null;
    }
  }
  return { ok, stdout, stderr, data: data as unknown };
}

export function paperclipGet<T>(args: string[]): PaperclipCliResult<T> {
  return runPaperclip([...args, "--json"]) as PaperclipCliResult<T>;
}

export function paperclipPost<T>(args: string[]): PaperclipCliResult<T> {
  return runPaperclip([...args, "--json"]) as PaperclipCliResult<T>;
}

export async function fetchRunTrace(apiBaseUrl: string, companyId: string, runId: string, token?: string) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const listUrl = new URL(`/api/companies/${companyId}/run-traces`, apiBaseUrl);
  listUrl.searchParams.set("runId", runId);
  const listRes = await fetch(listUrl, { headers });
  if (!listRes.ok) throw new Error(`run-traces list failed: ${listRes.status}`);
  const rows = await listRes.json() as Array<{ id: string; status: string }>;
  const archive = rows[0];
  if (!archive) return null;

  const bundleUrl = new URL(`/api/run-traces/${archive.id}/bundle`, apiBaseUrl);
  const bundleRes = await fetch(bundleUrl, { headers });
  if (!bundleRes.ok) throw new Error(`run-traces bundle failed: ${bundleRes.status}`);
  return bundleRes.json();
}
