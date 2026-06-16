export type EvalHardCheckId =
  | "checkout_before_work"
  | "comment_before_exit"
  | "company_boundary"
  | "approval_gate"
  | "no_work_exit";

export interface EvalHardCheckResult {
  id: EvalHardCheckId;
  pass: boolean;
  detail: string;
}

export interface EvalTraceActivity {
  id: string;
  action: string;
  actorType: string;
  actorId: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  details?: Record<string, unknown> | null;
}

export interface EvalTrace {
  runId: string;
  companyId: string;
  agentId: string;
  issueId: string | null;
  runStatus: string;
  activity: EvalTraceActivity[];
  resultJson?: Record<string, unknown> | null;
}

export interface EvalCase {
  id: string;
  title: string;
  description: string;
  seed: {
    issueTitle: string;
    issueBody: string;
    status?: string;
    priority?: string;
  };
  expectedChecks: EvalHardCheckId[];
}

export interface EvalScenarioReceipt {
  caseId: string;
  runId: string | null;
  issueId: string | null;
  checks: EvalHardCheckResult[];
  passed: boolean;
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
}

export interface EvalMatrixBundle {
  id: string;
  label: string;
  agentId?: string;
  adapterType?: string;
  model?: string;
}

export interface EvalMatrixReceipt {
  caseId: string;
  bundles: Array<{
    bundleId: string;
    passed: boolean;
    checks: EvalHardCheckResult[];
    runId: string | null;
  }>;
  startedAt: string;
  finishedAt: string;
}
