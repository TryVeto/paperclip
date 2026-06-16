import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runScenario } from "./scenario-runner.js";
import type { EvalMatrixBundle, EvalMatrixReceipt } from "../types.js";

const evalsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadBundles(selected: string[] | null): EvalMatrixBundle[] {
  const manifestPath = path.join(evalsRoot, "bundles/veto-default.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { bundles: EvalMatrixBundle[] };
  if (!selected || selected.length === 0) return manifest.bundles;
  return manifest.bundles.filter((bundle) => selected.includes(bundle.id));
}

export async function runMatrix(input: {
  caseId: string;
  bundles?: string[];
  dryRun?: boolean;
}): Promise<EvalMatrixReceipt> {
  const startedAt = new Date().toISOString();
  const bundles = loadBundles(input.bundles ?? null);
  const results = [];

  for (const bundle of bundles) {
    process.env.EVAL_BUNDLE_ID = bundle.id;
    const receipt = await runScenario({
      caseId: input.caseId,
      dryRun: input.dryRun ?? false,
    });
    results.push({
      bundleId: bundle.id,
      passed: receipt.passed,
      checks: receipt.checks,
      runId: receipt.runId,
    });
  }

  return {
    caseId: input.caseId,
    bundles: results,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const caseIdx = args.indexOf("--case");
  const bundlesIdx = args.indexOf("--bundles");
  const caseId = caseIdx >= 0 ? args[caseIdx + 1] : "core.assignment_pickup";
  const bundles = bundlesIdx >= 0 ? args[bundlesIdx + 1]?.split(",").filter(Boolean) : undefined;
  const dryRun = args.includes("--dry-run");

  const receipt = await runMatrix({ caseId, bundles, dryRun });
  console.log(JSON.stringify(receipt, null, 2));
  const allPassed = receipt.bundles.every((row) => row.passed);
  if (!allPassed) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
