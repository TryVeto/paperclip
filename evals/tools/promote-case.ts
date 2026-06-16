import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const evalsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function fetchArchiveBundle(apiBaseUrl: string, companyId: string, runId: string, token?: string) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const listUrl = new URL(`/api/companies/${companyId}/run-traces`, apiBaseUrl);
  listUrl.searchParams.set("runId", runId);
  const listRes = await fetch(listUrl, { headers });
  if (!listRes.ok) throw new Error(`list run-traces failed: ${listRes.status}`);
  const rows = await listRes.json() as Array<{ id: string; status: string }>;
  const archive = rows.find((row) => row.status === "ready") ?? rows[0];
  if (!archive) throw new Error(`No archive for run ${runId}`);

  const bundleUrl = new URL(`/api/run-traces/${archive.id}/bundle`, apiBaseUrl);
  const bundleRes = await fetch(bundleUrl, { headers });
  if (!bundleRes.ok) throw new Error(`bundle fetch failed: ${bundleRes.status}`);
  return { archiveId: archive.id, bundle: await bundleRes.json() };
}

function readLabel(runId: string): Record<string, unknown> | null {
  const labelsPath = path.join(evalsRoot, "../evals/labels/labels.jsonl");
  const localLabels = path.join(evalsRoot, "labels/labels.jsonl");
  const pathToUse = existsSync(localLabels) ? localLabels : labelsPath;
  if (!existsSync(pathToUse)) return null;
  const lines = readFileSync(pathToUse, "utf8").split("\n").filter(Boolean);
  for (const line of lines) {
    const row = JSON.parse(line) as Record<string, unknown>;
    if (row.runId === runId) return row;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const runIdx = args.indexOf("--run-id");
  const force = args.includes("--force");
  const runId = runIdx >= 0 ? args[runIdx + 1] : undefined;
  if (!runId) throw new Error("--run-id is required");

  const label = readLabel(runId);
  if (!label && !force) {
    throw new Error("No outcome label found — label trace first or pass --force");
  }
  if (label && label.promoteToEval !== true && !force) {
    throw new Error("Label promoteToEval is not true");
  }

  const apiBaseUrl = process.env.PAPERCLIP_API_URL ?? "http://localhost:3100";
  const companyId = process.env.EVAL_COMPANY_ID;
  if (!companyId) throw new Error("EVAL_COMPANY_ID is required");

  const { archiveId, bundle } = await fetchArchiveBundle(
    apiBaseUrl,
    companyId,
    runId,
    process.env.PAPERCLIP_API_TOKEN,
  );

  const corpusDir = path.join(evalsRoot, "corpus");
  mkdirSync(corpusDir, { recursive: true });
  const outPath = path.join(corpusDir, `corpus.${runId.slice(0, 8)}.json`);
  writeFileSync(outPath, `${JSON.stringify({ runId, archiveId, label, bundle }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ promoted: true, path: outPath }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
