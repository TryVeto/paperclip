import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const evalsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const apiBaseUrl = process.env.PAPERCLIP_API_URL ?? "http://localhost:3100";
  const companyId = process.env.EVAL_COMPANY_ID;
  const since = process.env.EVAL_SINCE;
  if (!companyId) throw new Error("EVAL_COMPANY_ID is required");

  const url = new URL(`/api/companies/${companyId}/run-traces`, apiBaseUrl);
  if (since) url.searchParams.set("since", since);
  url.searchParams.set("limit", process.env.EVAL_LIMIT ?? "50");

  const headers: Record<string, string> = { Accept: "application/json" };
  const token = process.env.PAPERCLIP_API_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`export-runs failed: ${res.status}`);
  const rows = await res.json();

  const outDir = path.join(evalsRoot, "corpus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `export-${Date.now()}.json`);
  writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ exported: rows.length, path: outPath }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
