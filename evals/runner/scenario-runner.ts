import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allChecksPassed, runHardChecks } from "../checks/hard-checks.js";
import type { EvalCase, EvalScenarioReceipt } from "../types.js";
import { fetchRunTrace } from "./paperclip-client.js";
import { activityFromArchiveBundle, pollRunUntilTerminal } from "./poll-run.js";

const evalsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadCase(caseId: string): EvalCase {
  const casePath = path.join(evalsRoot, "cases", `${caseId}.json`);
  if (!existsSync(casePath)) {
    throw new Error(`Unknown eval case: ${caseId}`);
  }
  return JSON.parse(readFileSync(casePath, "utf8")) as EvalCase;
}

function loadEvalConfig(): { companyId: string; agentId: string } {
  const configPath = path.join(evalsRoot, "fixtures/eval-company.local.json");
  if (!existsSync(configPath)) {
    throw new Error("Missing eval-company.local.json — run eval bootstrap first");
  }
  const config = JSON.parse(readFileSync(configPath, "utf8")) as {
    companyId: string;
    agentId: string;
  };
  return config;
}

export async function runScenario(input: {
  caseId: string;
  dryRun?: boolean;
  proofFail?: boolean;
  apiBaseUrl?: string;
  token?: string;
}): Promise<EvalScenarioReceipt> {
  const startedAt = new Date().toISOString();
  const evalCase = loadCase(input.caseId);
  const config = loadEvalConfig();
  const apiBaseUrl = input.apiBaseUrl ?? process.env.PAPERCLIP_API_URL ?? "http://localhost:3100";

  if (input.dryRun) {
    const checks = runHardChecks(
      {
        runId: "dry-run",
        companyId: config.companyId,
        agentId: config.agentId,
        issueId: null,
        runStatus: "succeeded",
        activity: input.proofFail
          ? [{ id: "1", action: "issue.updated", actorType: "agent", actorId: config.agentId, entityType: "issue", entityId: "x", createdAt: startedAt }]
          : [
              { id: "1", action: "environment.lease_acquired", actorType: "agent", actorId: config.agentId, entityType: "issue", entityId: "x", createdAt: startedAt },
              { id: "2", action: "issue_comment.created", actorType: "agent", actorId: config.agentId, entityType: "issue_comment", entityId: "c", createdAt: startedAt },
            ],
      },
      evalCase.expectedChecks,
      { companyId: config.companyId },
    );
    return {
      caseId: input.caseId,
      runId: null,
      issueId: null,
      checks,
      passed: allChecksPassed(checks),
      dryRun: true,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  // Live path: expects operator to seed issue + wake agent externally for now.
  // Scenario runner reads archived trace once runId is supplied via EVAL_RUN_ID.
  const runId = process.env.EVAL_RUN_ID;
  if (!runId) {
    throw new Error("Live scenario requires EVAL_RUN_ID (heartbeat run id to grade)");
  }

  const terminal = await pollRunUntilTerminal(apiBaseUrl, config.companyId, runId, { token: input.token });
  const bundle = await fetchRunTrace(apiBaseUrl, config.companyId, runId, input.token);
  if (!bundle) {
    throw new Error(`No archived trace for run ${runId}`);
  }

  const trace = activityFromArchiveBundle(bundle as Record<string, unknown>, {
    runId,
    companyId: config.companyId,
    agentId: config.agentId,
    issueId: null,
    runStatus: terminal.runStatus,
  });
  const checks = runHardChecks(trace, evalCase.expectedChecks, { companyId: config.companyId });
  return {
    caseId: input.caseId,
    runId,
    issueId: trace.issueId,
    checks,
    passed: allChecksPassed(checks),
    dryRun: false,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const caseIdx = args.indexOf("--case");
  const caseId = caseIdx >= 0 ? args[caseIdx + 1] : "core.assignment_pickup";
  const dryRun = args.includes("--dry-run");
  const proofFail = args.includes("--proof-fail");

  const receipt = await runScenario({ caseId, dryRun, proofFail });
  console.log(JSON.stringify(receipt, null, 2));
  if (!receipt.passed) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
