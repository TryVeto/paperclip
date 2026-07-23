import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  documents,
  issueDocuments,
  issuePlanDecompositions,
  issues,
  projectVersionContracts,
  projects,
} from "@paperclipai/db";
import {
  V007_BOOTSTRAP,
  type AdoptBootstrapInput,
  type CloseShipInput,
  type OpenVersionInput,
  type SubmitVerificationInput,
  type VoidShipInput,
} from "@paperclipai/shared";
import { conflict, forbidden, badRequest, notFound } from "../errors.js";
import {
  applyImmutableCapabilitiesToRuntimeConfig,
  assertExecutorForLane,
  assertLaneMutationAllowed,
  buildImmutableLaneCapabilities,
  CURSOR_IMPLEMENTATION_ADAPTERS,
  deriveDisplayState,
  evaluateShipGate,
  isCodexSpecificationOwner,
  isCursorImplementationMode,
  isSha40,
  isV007BootstrapEligible,
  normalizeSha,
  resolveEffectiveExecutor,
  versionLaneForIssue,
  type ImmutableLaneCapabilities,
  type VersionContractRow,
} from "./version-contract-policy.js";
import {
  assertReleaseAttestationReadyForClose,
  getBuildManifestAttestation,
  getLastReleaseDigestVerify,
  type BuildManifestAttestation,
} from "../build-manifest.js";
import { sourceHeadEqualsInstalledIsInsufficient } from "./git-provenance.js";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const FREEZE_OPENS_ENV = "PAPERCLIP_FREEZE_VERSION_OPENS";
const THINKING_ZERO_AGENT_NAME = "Thinking-zero";

type VerificationCheck = {
  name: string;
  passed: boolean;
  detail?: string;
  command?: string;
  artifactRef?: string;
  timestamp?: string;
};

function parseBootstrapImplementationFacts(body: string): {
  ok: boolean;
  missing: string[];
  facts: Record<string, string>;
} {
  const required = [
    "dispatch_executor",
    "workspace",
    "commit",
    "ancestry",
    "command",
    "artifact",
  ] as const;
  const facts: Record<string, string> = {};
  const missing: string[] = [];
  for (const key of required) {
    // Accept either `key: value` or `- key: value` lines in the evidence body.
    const re = new RegExp(`(?:^|\\n)\\s*-?\\s*${key}\\s*:\\s*(\\S[^\\n]*)`, "i");
    const m = body.match(re);
    const value = m?.[1]?.trim() ?? "";
    if (!value || value.toLowerCase() === "none" || value === "-" || value === "n/a") {
      missing.push(key);
    } else {
      facts[key] = value;
    }
  }
  return { ok: missing.length === 0, missing, facts };
}

async function listDescendantIssues(tx: Tx, rootIssueId: string) {
  const rows = await tx.execute(sql`
    WITH RECURSIVE descendants AS (
      SELECT id, parent_id, status, assignee_agent_id, project_id, company_id
      FROM issues
      WHERE parent_id = ${rootIssueId}
      UNION ALL
      SELECT i.id, i.parent_id, i.status, i.assignee_agent_id, i.project_id, i.company_id
      FROM issues i
      INNER JOIN descendants d ON i.parent_id = d.id
    )
    SELECT id, parent_id, status, assignee_agent_id, project_id, company_id
    FROM descendants
  `);
  const list = (rows as unknown as { rows?: Array<Record<string, unknown>> }).rows ??
    (Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : []);
  return list.map((r) => ({
    id: String(r.id),
    parentId: r.parent_id ? String(r.parent_id) : null,
    status: String(r.status ?? ""),
    assigneeAgentId: r.assignee_agent_id ? String(r.assignee_agent_id) : null,
    projectId: r.project_id ? String(r.project_id) : null,
    companyId: r.company_id ? String(r.company_id) : null,
  }));
}

async function evaluateDescendantsCursorProvenance(
  tx: Tx,
  rootIssueId: string,
): Promise<{ ok: boolean; issues: Array<Record<string, unknown>>; failedPredicates: string[] }> {
  const descendants = await listDescendantIssues(tx, rootIssueId);
  const failedPredicates: string[] = [];
  const issueSummaries: Array<Record<string, unknown>> = [];

  for (const child of descendants) {
    if (child.status === "cancelled") {
      issueSummaries.push({ id: child.id, status: child.status, skipped: true });
      continue;
    }
    if (child.status !== "done") {
      failedPredicates.push(`descendant_not_done:${child.id}`);
    }
    let resolvedExecutor: string | null = null;
    let adapterType: string | null = null;
    if (child.assigneeAgentId) {
      const [agent] = await tx.select().from(agents).where(eq(agents.id, child.assigneeAgentId)).limit(1);
      adapterType = agent?.adapterType ?? null;
      resolvedExecutor = resolveEffectiveExecutor({
        adapterType: agent?.adapterType ?? "unknown",
        delegateAdapter: (agent?.adapterConfig as Record<string, unknown> | null)?.delegateAdapter as
          | string
          | undefined,
      });
      const mode = ((agent?.adapterConfig as Record<string, unknown> | null)?.mode as string) ?? null;
      if (!CURSOR_IMPLEMENTATION_ADAPTERS.has(resolvedExecutor)) {
        failedPredicates.push(`descendant_non_cursor:${child.id}:${resolvedExecutor}`);
      } else if (!isCursorImplementationMode(mode)) {
        failedPredicates.push(`descendant_invalid_cursor_mode:${child.id}:${mode}`);
      }
    } else if (child.status === "done") {
      failedPredicates.push(`descendant_missing_assignee:${child.id}`);
    }
    issueSummaries.push({
      id: child.id,
      status: child.status,
      assigneeAgentId: child.assigneeAgentId,
      adapterType,
      resolvedExecutor,
    });
  }

  return { ok: failedPredicates.length === 0, issues: issueSummaries, failedPredicates };
}

function asRow(row: typeof projectVersionContracts.$inferSelect): VersionContractRow {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    versionKey: row.versionKey,
    predecessorVersionId: row.predecessorVersionId,
    rootIssueId: row.rootIssueId,
    productBaseSha: row.productBaseSha,
    implementationBaseSha: row.implementationBaseSha,
    specificationOwnerAgentId: row.specificationOwnerAgentId,
    canonicalSpecKind: row.canonicalSpecKind,
    canonicalSpecPath: row.canonicalSpecPath,
    canonicalSpecCommitSha: row.canonicalSpecCommitSha,
    canonicalSpecBlobSha: row.canonicalSpecBlobSha,
    acceptedSpecRevisionId: row.acceptedSpecRevisionId,
    acceptedSpecConfirmationId: row.acceptedSpecConfirmationId,
    acceptedDecompositionId: row.acceptedDecompositionId,
    acceptedDecompositionFingerprint: row.acceptedDecompositionFingerprint,
    candidateSourceSha: row.candidateSourceSha,
    verificationReceipt: (row.verificationReceipt as Record<string, unknown> | null) ?? null,
    verificationReceiptLockedAt: row.verificationReceiptLockedAt,
    deployedSourceSha: row.deployedSourceSha,
    shipReceipt: (row.shipReceipt as Record<string, unknown> | null) ?? null,
    shipReceiptLockedAt: row.shipReceiptLockedAt,
    blockReason: row.blockReason,
    shippedAt: row.shippedAt,
  };
}

export function versionContractService(db: Db) {
  async function getByProject(projectId: string, versionKey?: string) {
    if (versionKey) {
      const [row] = await db
        .select()
        .from(projectVersionContracts)
        .where(
          and(
            eq(projectVersionContracts.projectId, projectId),
            eq(projectVersionContracts.versionKey, versionKey),
          ),
        )
        .limit(1);
      return row ? asRow(row) : null;
    }
    const [active] = await db
      .select()
      .from(projectVersionContracts)
      .where(
        and(eq(projectVersionContracts.projectId, projectId), isNull(projectVersionContracts.shippedAt)),
      )
      .limit(1);
    return active ? asRow(active) : null;
  }

  async function getByRootIssue(rootIssueId: string) {
    const [row] = await db
      .select()
      .from(projectVersionContracts)
      .where(eq(projectVersionContracts.rootIssueId, rootIssueId))
      .limit(1);
    return row ? asRow(row) : null;
  }

  async function getActiveForIssue(issueId: string) {
    const [issue] = await db.select().from(issues).where(eq(issues.id, issueId)).limit(1);
    if (!issue?.projectId) return null;
    const byRoot = await getByRootIssue(issueId);
    if (byRoot) return { capsule: byRoot, issue };
    if (issue.parentId) {
      const parentCapsule = await getByRootIssue(issue.parentId);
      if (parentCapsule) return { capsule: parentCapsule, issue };
    }
    const active = await getByProject(issue.projectId);
    return active ? { capsule: active, issue } : null;
  }

  return {
    getByProject,
    getByRootIssue,
    getActiveForIssue,
    deriveDisplayState,

    async openVersion(projectId: string, input: OpenVersionInput) {
      if (process.env[FREEZE_OPENS_ENV] === "1" || process.env[FREEZE_OPENS_ENV] === "true") {
        throw forbidden("Version opens are frozen", { code: "version_opens_frozen" });
      }

      const productBaseSha = normalizeSha(input.productBaseSha);
      if (!isSha40(productBaseSha)) throw badRequest("invalid productBaseSha");

      return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`version-open:${projectId}`}))`);

        const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        if (!project) throw notFound("Project not found");

        if (input.idempotencyKey) {
          const [existingByKey] = await tx
            .select()
            .from(projectVersionContracts)
            .where(
              and(
                eq(projectVersionContracts.companyId, project.companyId),
                eq(projectVersionContracts.projectId, projectId),
                eq(projectVersionContracts.openIdempotencyKey, input.idempotencyKey),
              ),
            )
            .limit(1);
          if (existingByKey) return { ...asRow(existingByKey), displayState: deriveDisplayState(asRow(existingByKey)) };
        }

        const [active] = await tx
          .select()
          .from(projectVersionContracts)
          .where(
            and(
              eq(projectVersionContracts.companyId, project.companyId),
              eq(projectVersionContracts.projectId, projectId),
              isNull(projectVersionContracts.shippedAt),
            ),
          )
          .limit(1);
        if (active) {
          throw conflict("active_version_exists", {
            code: "active_version_exists",
            versionKey: active.versionKey,
          });
        }

        if (input.predecessorVersionId) {
          const [pred] = await tx
            .select()
            .from(projectVersionContracts)
            .where(eq(projectVersionContracts.id, input.predecessorVersionId))
            .limit(1);
          if (!pred?.shippedAt || !pred.shipReceipt || !pred.deployedSourceSha) {
            throw conflict("predecessor_not_shipped", { code: "predecessor_not_shipped" });
          }
        } else {
          // Opening a successor without predecessor: require no prior active; prior shipped ok.
          const [sameKey] = await tx
            .select()
            .from(projectVersionContracts)
            .where(
              and(
                eq(projectVersionContracts.projectId, projectId),
                eq(projectVersionContracts.versionKey, input.versionKey),
              ),
            )
            .limit(1);
          if (sameKey) {
            throw conflict("version_identity_conflict", { code: "version_identity_conflict" });
          }
        }

        const [owner] = await tx.select().from(agents).where(eq(agents.id, input.specificationOwnerAgentId)).limit(1);
        if (!owner) throw badRequest("specification owner agent not found");
        const ownerExecutor = resolveEffectiveExecutor({
          adapterType: owner.adapterType,
          delegateAdapter: (owner.adapterConfig as Record<string, unknown> | null)?.delegateAdapter as
            | string
            | undefined,
          routingDelegate: (owner.adapterConfig as Record<string, unknown> | null)?.routingDelegate as
            | string
            | undefined,
        });
        // Spec owner must resolve to Codex via adapter type or explicit delegateAdapter /
        // routingDelegate — never by inferring authority from a model string containing "sol".
        if (
          !isCodexSpecificationOwner({
            adapterType: owner.adapterType,
            resolvedExecutor: ownerExecutor,
          })
        ) {
          throw conflict("specification_owner_not_codex", {
            code: "specification_owner_not_codex",
            adapterType: owner.adapterType,
            resolved: ownerExecutor,
          });
        }

        let rootIssueId = input.rootIssueId;
        if (rootIssueId) {
          const [root] = await tx.select().from(issues).where(eq(issues.id, rootIssueId)).limit(1);
          if (!root || root.projectId !== projectId) throw badRequest("root issue not in project");
          const [child] = await tx
            .select({ id: issues.id })
            .from(issues)
            .where(eq(issues.parentId, rootIssueId))
            .limit(1);
          if (child) throw conflict("root_issue_not_pristine", { code: "root_issue_not_pristine", reason: "has_children" });
          if (root.assigneeAgentId) {
            throw conflict("root_issue_not_pristine", { code: "root_issue_not_pristine", reason: "has_assignment" });
          }
        } else {
          const [created] = await tx
            .insert(issues)
            .values({
              companyId: project.companyId,
              projectId,
              title: `Version ${input.versionKey}`,
              status: "todo",
              priority: "medium",
              assigneeAgentId: input.specificationOwnerAgentId,
            })
            .returning();
          rootIssueId = created.id;
        }

        // Assign owner if adopting existing pristine root without assignee
        await tx
          .update(issues)
          .set({
            assigneeAgentId: input.specificationOwnerAgentId,
            status: "todo",
            updatedAt: new Date(),
          })
          .where(eq(issues.id, rootIssueId));

        const kind = input.canonicalSpecKind ?? "plan_document";
        const implementationBaseSha = normalizeSha(
          input.implementationBaseSha ??
            (kind === "bootstrap_file" ? (input.canonicalSpecCommitSha as string) : productBaseSha),
        );

        try {
          const [inserted] = await tx
            .insert(projectVersionContracts)
            .values({
              companyId: project.companyId,
              projectId,
              versionKey: input.versionKey,
              predecessorVersionId: input.predecessorVersionId ?? null,
              rootIssueId: rootIssueId!,
              productBaseSha,
              implementationBaseSha,
              projectWorkspaceId: input.projectWorkspaceId ?? null,
              specificationOwnerAgentId: input.specificationOwnerAgentId,
              canonicalSpecKind: kind,
              canonicalSpecPath: kind === "bootstrap_file" ? input.canonicalSpecPath ?? null : null,
              canonicalSpecCommitSha:
                kind === "bootstrap_file" ? normalizeSha(input.canonicalSpecCommitSha!) : null,
              canonicalSpecBlobSha:
                kind === "bootstrap_file" ? normalizeSha(input.canonicalSpecBlobSha!) : null,
              openIdempotencyKey: input.idempotencyKey,
            })
            .returning();
          const row = asRow(inserted);
          return { ...row, displayState: deriveDisplayState(row) };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("project_version_contracts_one_active_per_project_uq")) {
            throw conflict("active_version_exists", { code: "active_version_exists" });
          }
          if (
            message.includes("project_version_contracts_company_project_version_uq") ||
            message.includes("project_version_contracts_root_issue_uq")
          ) {
            throw conflict("version_identity_conflict", { code: "version_identity_conflict" });
          }
          throw err;
        }
      });
    },

    async assertCanonicalPlanMutation(input: {
      issueId: string;
      documentKey: string;
      actorAgentId?: string | null;
      actorType: "agent" | "board" | "system";
      runId?: string | null;
      isActiveRootRun?: boolean;
      baseRevisionId?: string | null;
      currentRevisionId?: string | null;
      action: "upsert" | "restore" | "unlock" | "delete" | "redirect";
    }) {
      if (input.documentKey !== "plan") return { enforced: false as const };
      const found = await getActiveForIssue(input.issueId);
      if (!found || found.capsule.rootIssueId !== input.issueId) return { enforced: false as const };
      const capsule = found.capsule;
      if (capsule.shippedAt) throw forbidden("Canonical plan is closed for a shipped version");
      if (capsule.acceptedSpecRevisionId && input.action !== "upsert") {
        // After acceptance, unlock/delete/restore/redirect denied
        throw forbidden("Canonical version plan is locked", { code: "canonical_plan_locked", action: input.action });
      }
      if (input.action === "redirect") {
        throw forbidden("Canonical version plan cannot redirect to a derived document", {
          code: "canonical_plan_redirect_denied",
        });
      }
      if (input.actorType === "board" && input.action === "upsert") {
        throw forbidden("Board cannot revise the canonical version plan", { code: "board_plan_put_denied" });
      }
      if (input.action === "unlock" || input.action === "delete" || input.action === "restore") {
        throw forbidden("Canonical version plan mutation denied", { code: "canonical_plan_mutation_denied", action: input.action });
      }
      // specifying only
      if (capsule.acceptedSpecRevisionId) {
        throw forbidden("Version is past specifying; reopen required to revise plan", {
          code: "version_not_specifying",
        });
      }
      if (input.actorAgentId !== capsule.specificationOwnerAgentId) {
        throw forbidden("Only the bound Codex specification owner may revise the canonical plan", {
          code: "canonical_plan_author_denied",
        });
      }
      if (!input.isActiveRootRun) {
        throw forbidden("Canonical plan revision requires the active root-issue run", {
          code: "canonical_plan_run_denied",
        });
      }
      if (
        input.baseRevisionId &&
        input.currentRevisionId &&
        input.baseRevisionId !== input.currentRevisionId
      ) {
        throw conflict("Canonical plan base revision mismatch", { code: "canonical_plan_base_mismatch" });
      }
      return { enforced: true as const, capsule };
    },

    async onPlanAccepted(input: {
      rootIssueId: string;
      revisionId: string;
      confirmationId: string;
      lockDocument: () => Promise<void>;
    }) {
      const capsule = await getByRootIssue(input.rootIssueId);
      if (!capsule) return { bound: false as const };
      return db.transaction(async (tx) => {
        await input.lockDocument();
        const [updated] = await tx
          .update(projectVersionContracts)
          .set({
            acceptedSpecRevisionId: input.revisionId,
            acceptedSpecConfirmationId: input.confirmationId,
            // reopen clears prior decomposition/verification
            acceptedDecompositionId: null,
            acceptedDecompositionFingerprint: null,
            candidateSourceSha: null,
            verificationReceipt: null,
            verificationReceiptLockedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(projectVersionContracts.id, capsule.id))
          .returning();
        return { bound: true as const, capsule: asRow(updated) };
      });
    },

    async reopenSpec(versionId: string) {
      const [updated] = await db
        .update(projectVersionContracts)
        .set({
          acceptedSpecRevisionId: null,
          acceptedSpecConfirmationId: null,
          acceptedDecompositionId: null,
          acceptedDecompositionFingerprint: null,
          candidateSourceSha: null,
          verificationReceipt: null,
          verificationReceiptLockedAt: null,
          blockReason: null,
          updatedAt: new Date(),
        })
        .where(and(eq(projectVersionContracts.id, versionId), isNull(projectVersionContracts.shippedAt)))
        .returning();
      if (!updated) throw notFound("Active version not found");
      return asRow(updated);
    },

    async assertDecomposition(input: {
      rootIssueId: string;
      acceptedPlanRevisionId: string;
      children: Array<{
        assigneeAgentId?: string | null;
        adapterType?: string | null;
        delegateAdapter?: string | null;
        mode?: string | null;
      }>;
      fingerprint: string;
      decompositionId: string;
    }) {
      const capsule = await getByRootIssue(input.rootIssueId);
      if (!capsule) return { enforced: false as const };
      if (!capsule.acceptedSpecRevisionId && capsule.canonicalSpecKind !== "bootstrap_file") {
        throw conflict("decomposition_requires_accepted_spec", { code: "decomposition_requires_accepted_spec" });
      }
      if (
        capsule.acceptedSpecRevisionId &&
        capsule.acceptedSpecRevisionId !== input.acceptedPlanRevisionId
      ) {
        throw conflict("decomposition_revision_mismatch", { code: "decomposition_revision_mismatch" });
      }
      for (const child of input.children) {
        const effective = resolveEffectiveExecutor({
          adapterType: child.adapterType ?? "cursor",
          delegateAdapter: child.delegateAdapter,
        });
        const check = assertExecutorForLane("implementation", effective);
        if (!check.ok) {
          throw conflict("decomposition_assignee_not_cursor", {
            code: "decomposition_assignee_not_cursor",
            predicate: check.predicate,
          });
        }
        if (!isCursorImplementationMode(child.mode)) {
          throw conflict("decomposition_invalid_cursor_mode", {
            code: "decomposition_invalid_cursor_mode",
            mode: child.mode,
          });
        }
      }
      const [updated] = await db
        .update(projectVersionContracts)
        .set({
          acceptedDecompositionId: input.decompositionId,
          acceptedDecompositionFingerprint: input.fingerprint,
          updatedAt: new Date(),
        })
        .where(eq(projectVersionContracts.id, capsule.id))
        .returning();
      return { enforced: true as const, capsule: asRow(updated) };
    },

    async resolveLaneForIssue(issueId: string): Promise<{
      lane: ReturnType<typeof versionLaneForIssue>;
      capsule: VersionContractRow | null;
      capabilities: ImmutableLaneCapabilities;
    }> {
      const found = await getActiveForIssue(issueId);
      if (!found) {
        return {
          lane: "none",
          capsule: null,
          capabilities: buildImmutableLaneCapabilities({ lane: "none", implementationBaseSha: null }),
        };
      }
      const lane = versionLaneForIssue({
        capsule: found.capsule,
        issueId: found.issue.id,
        parentIssueId: found.issue.parentId,
      });
      // Treat any descendant under version project with parent chain to root as implementation
      let effectiveLane = lane;
      if (effectiveLane === "none" && found.capsule && found.issue.projectId === found.capsule.projectId) {
        // Walk parents cheaply: if any ancestor is root, implementation
        let parentId = found.issue.parentId;
        let depth = 0;
        while (parentId && depth < 32) {
          if (parentId === found.capsule.rootIssueId) {
            effectiveLane = "implementation";
            break;
          }
          const [p] = await db.select({ parentId: issues.parentId }).from(issues).where(eq(issues.id, parentId)).limit(1);
          parentId = p?.parentId ?? null;
          depth += 1;
        }
      }
      return {
        lane: effectiveLane,
        capsule: found.capsule,
        capabilities: buildImmutableLaneCapabilities({
          lane: effectiveLane,
          implementationBaseSha: found.capsule.implementationBaseSha,
        }),
      };
    },

    applyImmutableLaneCapabilities(runtimeConfig: Record<string, unknown>, caps: ImmutableLaneCapabilities) {
      return applyImmutableCapabilitiesToRuntimeConfig(runtimeConfig, caps);
    },

    assertLaneMutation(caps: ImmutableLaneCapabilities, action: "finalize" | "commit" | "merge" | "sandbox_write") {
      const check = assertLaneMutationAllowed(caps, action);
      if (!check.ok) {
        throw conflict("lane_mutation_forbidden", {
          code: "lane_mutation_forbidden",
          predicate: check.predicate,
          action,
        });
      }
      return { ok: true as const };
    },

    assertDispatchExecutor(input: {
      lane: ReturnType<typeof versionLaneForIssue>;
      adapterType: string;
      delegateAdapter?: string | null;
      routingDelegate?: string | null;
    }) {
      if (input.lane === "none") return { ok: true as const };
      const effective = resolveEffectiveExecutor({
        adapterType: input.adapterType,
        delegateAdapter: input.delegateAdapter,
        routingDelegate: input.routingDelegate,
      });
      // Outer adapter may be veto_runtime_router; check resolved delegate.
      const check = assertExecutorForLane(input.lane, effective);
      if (!check.ok) {
        throw conflict("dispatch_executor_drift", {
          code: "dispatch_executor_drift",
          predicate: check.predicate,
          adapterType: input.adapterType,
          resolved: effective,
        });
      }
      return { ok: true as const, effective };
    },

    async submitVerification(projectId: string, input: SubmitVerificationInput) {
      const attestation = getBuildManifestAttestation();
      if (!attestation?.candidateSha) {
        throw conflict("missing_build_manifest_attestation", { code: "missing_build_manifest_attestation" });
      }

      // Caller SHA/checkResults are untrusted evidence only — never authority.
      const untrustedCallerEvidence = {
        candidateSourceSha: input.candidateSourceSha ? normalizeSha(input.candidateSourceSha) : null,
        checkResults: input.checkResults ?? [],
      };

      return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`version-verify:${projectId}`}))`);
        const [row] = await tx
          .select()
          .from(projectVersionContracts)
          .where(
            and(
              eq(projectVersionContracts.projectId, projectId),
              eq(projectVersionContracts.versionKey, input.versionKey),
            ),
          )
          .limit(1);
        if (!row) throw notFound("Version not found");
        const capsule = asRow(row);
        if (capsule.shippedAt) throw conflict("version_already_shipped", { code: "version_already_shipped" });

        const failedPredicates: string[] = [];
        const checks: VerificationCheck[] = [];
        const candidate = normalizeSha(attestation.candidateSha);
        if (!isSha40(candidate)) failedPredicates.push("malformed_or_missing_candidate_sha");

        if (capsule.canonicalSpecKind === "plan_document" && !capsule.acceptedSpecRevisionId) {
          failedPredicates.push("missing_accepted_spec");
        }
        if (capsule.canonicalSpecKind === "plan_document" && !capsule.acceptedDecompositionId) {
          failedPredicates.push("missing_decomposition");
        }
        if (capsule.canonicalSpecKind === "bootstrap_file") {
          const blobOk =
            normalizeSha(capsule.canonicalSpecBlobSha ?? "") === V007_BOOTSTRAP.immutableSpecBlobSha;
          checks.push({
            name: "canonical_spec_blob_pin",
            passed: blobOk,
            detail: capsule.canonicalSpecBlobSha ?? undefined,
          });
          if (!blobOk) failedPredicates.push("canonical_spec_blob_changed");
        }

        const provenance = await evaluateDescendantsCursorProvenance(tx, capsule.rootIssueId);
        failedPredicates.push(...provenance.failedPredicates);
        checks.push({
          name: "descendants_done_cursor_provenance",
          passed: provenance.ok,
          detail: `descendants=${provenance.issues.length}`,
        });

        if (capsule.acceptedDecompositionId) {
          const [decomp] = await tx
            .select()
            .from(issuePlanDecompositions)
            .where(eq(issuePlanDecompositions.id, capsule.acceptedDecompositionId))
            .limit(1);
          const decompOk =
            Boolean(decomp) &&
            (capsule.canonicalSpecKind !== "plan_document" ||
              decomp!.acceptedPlanRevisionId === capsule.acceptedSpecRevisionId);
          checks.push({
            name: "decomposition_binding",
            passed: decompOk,
            detail: decomp?.id,
          });
          if (!decompOk) failedPredicates.push("decomposition_binding_mismatch");
        }

        checks.push({
          name: "running_build_attestation",
          passed: isSha40(candidate),
          detail: candidate,
        });

        const receipt = {
          versionKey: capsule.versionKey,
          productBaseSha: capsule.productBaseSha,
          canonicalSpec: {
            kind: capsule.canonicalSpecKind,
            path: capsule.canonicalSpecPath,
            commitSha: capsule.canonicalSpecCommitSha,
            blobSha: capsule.canonicalSpecBlobSha,
            acceptedRevisionId: capsule.acceptedSpecRevisionId,
          },
          decompositionId: capsule.acceptedDecompositionId,
          decompositionFingerprint: capsule.acceptedDecompositionFingerprint,
          candidateSourceSha: candidate,
          implementationIssues: provenance.issues,
          checks,
          untrustedCallerEvidence,
          failedPredicates,
          generatedAt: new Date().toISOString(),
          generatedBy: "paperclip.versionContractService.submitVerification",
        };

        if (failedPredicates.length > 0) {
          await tx
            .update(projectVersionContracts)
            .set({
              blockReason: failedPredicates.join(","),
              updatedAt: new Date(),
            })
            .where(eq(projectVersionContracts.id, capsule.id));
          return { ok: false as const, receipt, failedPredicates, displayState: "blocked" as const };
        }

        if (capsule.verificationReceiptLockedAt && capsule.verificationReceipt) {
          const prev = capsule.verificationReceipt as Record<string, unknown>;
          if (normalizeSha(String(prev.candidateSourceSha ?? "")) !== candidate) {
            throw conflict("verification_receipt_conflict", { code: "verification_receipt_conflict" });
          }
          return {
            ok: true as const,
            receipt: capsule.verificationReceipt,
            failedPredicates: [],
            displayState: "ship_ready" as const,
          };
        }

        const [updated] = await tx
          .update(projectVersionContracts)
          .set({
            candidateSourceSha: candidate,
            verificationReceipt: receipt,
            verificationReceiptLockedAt: new Date(),
            blockReason: null,
            updatedAt: new Date(),
          })
          .where(eq(projectVersionContracts.id, capsule.id))
          .returning();

        return {
          ok: true as const,
          receipt,
          failedPredicates: [],
          displayState: deriveDisplayState(asRow(updated)),
          capsule: asRow(updated),
        };
      });
    },

    getRunningBuildAttestation(): BuildManifestAttestation | null {
      return getBuildManifestAttestation();
    },

    async closeShip(projectId: string, input: CloseShipInput) {
      // Close path: never warn-and-continue. Installed runtime digests must verify.
      let attestation: BuildManifestAttestation;
      try {
        ({ attestation } = assertReleaseAttestationReadyForClose());
      } catch (err) {
        throw conflict("release_attestation_not_verified", {
          code: "release_attestation_not_verified",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
      const digestVerify = getLastReleaseDigestVerify();
      if (!digestVerify?.ok || !digestVerify.installedRuntimeOk) {
        throw conflict("release_attestation_not_verified", {
          code: "release_attestation_not_verified",
          detail: digestVerify?.detail ?? "missing_verify",
        });
      }

      // Request-supplied observedLiveSha / source HEAD are evidence only and cannot
      // override attestation. Equal hex strings alone never prove install identity.
      void input.observedLiveSha;
      const sourceHeadClaim = sourceHeadEqualsInstalledIsInsufficient({
        sourceHeadSha: process.env.PAPERCLIP_SOURCE_HEAD_SHA ?? null,
        installedCandidateSha: attestation.candidateSha,
        installedRuntimeDigestOk: digestVerify.installedRuntimeOk,
      });
      if (
        process.env.PAPERCLIP_SOURCE_HEAD_SHA &&
        !sourceHeadClaim.equivalentClaimAllowed &&
        sourceHeadClaim.reason === "hex_match_without_installed_runtime_digest"
      ) {
        throw conflict("source_head_ne_installed_release", {
          code: "source_head_ne_installed_release",
          reason: sourceHeadClaim.reason,
        });
      }

      return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`version-ship:${projectId}`}))`);
        const [row] = await tx
          .select()
          .from(projectVersionContracts)
          .where(
            and(
              eq(projectVersionContracts.projectId, projectId),
              eq(projectVersionContracts.versionKey, input.versionKey),
            ),
          )
          .limit(1);
        if (!row) throw notFound("Version not found");
        const capsule = asRow(row);

        if (capsule.shippedAt && capsule.shipReceipt) {
          const prev = capsule.shipReceipt as Record<string, unknown>;
          if (normalizeSha(String(prev.deployedSourceSha ?? "")) === normalizeSha(attestation.candidateSha)) {
            return { ...capsule, displayState: deriveDisplayState(capsule), idempotent: true };
          }
          throw conflict("ship_receipt_conflict", { code: "ship_receipt_conflict" });
        }

        if (!capsule.verificationReceipt || !capsule.verificationReceiptLockedAt || !capsule.candidateSourceSha) {
          throw conflict("verification_required", { code: "verification_required" });
        }

        const lockedReceipt = capsule.verificationReceipt as Record<string, unknown>;
        const verificationCandidate = normalizeSha(String(lockedReceipt.candidateSourceSha ?? ""));
        const running = normalizeSha(attestation.candidateSha);

        const acceptedCanonicalSpec =
          capsule.canonicalSpecKind === "bootstrap_file"
            ? normalizeSha(capsule.canonicalSpecBlobSha ?? "")
            : (capsule.acceptedSpecRevisionId ?? "");

        let decompositionSpec = "";
        let decompositionCandidate = "";
        if (capsule.canonicalSpecKind === "bootstrap_file") {
          // Independent pin constant — not a copy of the capsule column into both sides.
          decompositionSpec = V007_BOOTSTRAP.immutableSpecBlobSha;
          decompositionCandidate = verificationCandidate;
        } else if (capsule.acceptedDecompositionId) {
          const [decomp] = await tx
            .select()
            .from(issuePlanDecompositions)
            .where(eq(issuePlanDecompositions.id, capsule.acceptedDecompositionId))
            .limit(1);
          decompositionSpec = decomp?.acceptedPlanRevisionId ?? "";
          const fp = capsule.acceptedDecompositionFingerprint ?? "";
          decompositionCandidate = isSha40(fp) ? normalizeSha(fp) : verificationCandidate;
        }

        const provenance = await evaluateDescendantsCursorProvenance(tx, capsule.rootIssueId);
        const receiptFailed = Array.isArray(lockedReceipt.failedPredicates)
          ? (lockedReceipt.failedPredicates as unknown[])
          : [];

        const gate = evaluateShipGate({
          acceptedCanonicalSpec,
          decompositionSpec,
          decompositionCandidate,
          verificationCandidate,
          runningBuildManifestSha: running,
          // Intentionally omitted pre-write — deployed SHA is written from attestation below.
          shipReceiptDeployedSha: null,
          canonicalSpecUnchanged:
            capsule.canonicalSpecKind !== "bootstrap_file" ||
            normalizeSha(capsule.canonicalSpecBlobSha ?? "") === V007_BOOTSTRAP.immutableSpecBlobSha,
          canonicalSpecLocked:
            capsule.canonicalSpecKind === "bootstrap_file" || Boolean(capsule.acceptedSpecRevisionId),
          descendantsDoneCursorProvenance: provenance.ok,
          requiredPredicatesPassed: receiptFailed.length === 0 && provenance.failedPredicates.length === 0,
        });

        if (!gate.ok) {
          throw conflict("ship_gate_failed", { code: "ship_gate_failed", failures: gate.failures });
        }

        const shipReceipt = {
          versionKey: capsule.versionKey,
          productBaseSha: capsule.productBaseSha,
          deployedSourceSha: running,
          verificationCandidate,
          buildManifest: attestation,
          releaseDigestVerify: digestVerify,
          sourceHeadEquivalence: sourceHeadClaim,
          gateSnapshot: {
            acceptedCanonicalSpec,
            decompositionSpec,
            decompositionCandidate,
            verificationCandidate,
            runningBuildManifestSha: running,
          },
          generatedAt: new Date().toISOString(),
          generatedBy: "paperclip.versionContractService.closeShip",
        };

        const [updated] = await tx
          .update(projectVersionContracts)
          .set({
            deployedSourceSha: running,
            shipReceipt,
            shipReceiptLockedAt: new Date(),
            shippedAt: new Date(),
            blockReason: null,
            updatedAt: new Date(),
          })
          .where(eq(projectVersionContracts.id, capsule.id))
          .returning();

        const result = asRow(updated);
        return { ...result, displayState: deriveDisplayState(result), idempotent: false };
      });
    },

    async voidShip(projectId: string, input: VoidShipInput) {
      return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`version-ship:${projectId}`}))`);
        const [row] = await tx
          .select()
          .from(projectVersionContracts)
          .where(
            and(
              eq(projectVersionContracts.projectId, projectId),
              eq(projectVersionContracts.versionKey, input.versionKey),
            ),
          )
          .limit(1);
        if (!row) throw notFound("Version not found");
        if (!row.shippedAt) {
          throw conflict("version_not_shipped", { code: "version_not_shipped" });
        }

        // Closed release records are immutable. voidShip must not clear shippedAt,
        // deployedSourceSha, shipReceipt, or verification locks. Append-only
        // observations belong in a separate audit channel — never reopen-by-void.
        throw conflict("shipped_record_immutable", {
          code: "shipped_record_immutable",
          detail: "closed releases cannot be voided or rewritten; open a new version instead",
          versionKey: input.versionKey,
          shippedAt: row.shippedAt?.toISOString?.() ?? String(row.shippedAt),
          deployedSourceSha: row.deployedSourceSha,
          reason: input.reason ?? null,
        });
      });
    },

    async adoptBootstrap(input: AdoptBootstrapInput) {
      const attestation = getBuildManifestAttestation();
      if (!attestation?.candidateSha) {
        throw conflict("missing_build_manifest_attestation", { code: "missing_build_manifest_attestation" });
      }

      return db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`version-bootstrap:${input.companyId}`}))`,
        );

        // Race-safe: lock any existing capsules before counting.
        await tx.execute(sql`SELECT id FROM project_version_contracts FOR UPDATE`);
        const existing = await tx.select({ id: projectVersionContracts.id }).from(projectVersionContracts);
        const attestedCandidate = normalizeSha(attestation.candidateSha);

        const eligible = isV007BootstrapEligible({
          existingCapsuleCount: existing.length,
          versionKey: input.versionKey,
          productBaseSha: input.productBaseSha,
          specBlobSha: input.specBlobSha,
          runningManifestSha: attestedCandidate,
          candidateSha: attestedCandidate,
        });
        if (!eligible.ok) {
          throw conflict("adopt_bootstrap_rejected", {
            code: "adopt_bootstrap_rejected",
            predicate: eligible.predicate,
          });
        }
        if (normalizeSha(input.candidateSourceSha) !== attestedCandidate) {
          throw conflict("adopt_bootstrap_rejected", {
            code: "adopt_bootstrap_rejected",
            predicate: "manifest_candidate_mismatch",
          });
        }

        const [project] = await tx.select().from(projects).where(eq(projects.id, input.projectId)).limit(1);
        if (!project || project.companyId !== input.companyId) {
          throw conflict("adopt_bootstrap_rejected", {
            code: "adopt_bootstrap_rejected",
            predicate: "project_company_mismatch",
          });
        }

        const [root] = await tx.select().from(issues).where(eq(issues.id, input.rootIssueId)).limit(1);
        if (!root || root.projectId !== input.projectId || root.companyId !== input.companyId) {
          throw conflict("adopt_bootstrap_rejected", {
            code: "adopt_bootstrap_rejected",
            predicate: "root_issue_ownership_mismatch",
          });
        }

        const [doc] = await tx
          .select()
          .from(documents)
          .where(eq(documents.id, input.bootstrapEvidenceDocumentId))
          .limit(1)
          .for("update");
        if (!doc || doc.companyId !== input.companyId) {
          throw conflict("adopt_bootstrap_rejected", {
            code: "adopt_bootstrap_rejected",
            predicate: "bootstrap_evidence_missing",
          });
        }
        if (!doc.latestBody || !doc.latestBody.trim()) {
          throw conflict("adopt_bootstrap_rejected", {
            code: "adopt_bootstrap_rejected",
            predicate: "bootstrap_evidence_empty",
          });
        }

        const implFacts = parseBootstrapImplementationFacts(doc.latestBody);
        if (!implFacts.ok) {
          throw conflict("adopt_bootstrap_rejected", {
            code: "adopt_bootstrap_rejected",
            predicate: "bootstrap_missing_implementation_facts",
            missing: implFacts.missing,
          });
        }

        const provenance = await evaluateDescendantsCursorProvenance(tx, input.rootIssueId);
        if (!provenance.ok || provenance.issues.filter((i) => !i.skipped).length === 0) {
          throw conflict("adopt_bootstrap_rejected", {
            code: "adopt_bootstrap_rejected",
            predicate: "bootstrap_missing_cursor_implementation",
            failedPredicates: provenance.failedPredicates,
            descendantCount: provenance.issues.length,
          });
        }

        const [link] = await tx
          .select()
          .from(issueDocuments)
          .where(eq(issueDocuments.documentId, input.bootstrapEvidenceDocumentId))
          .limit(1);
        if (
          !link ||
          link.companyId !== input.companyId ||
          link.issueId !== input.rootIssueId
        ) {
          throw conflict("adopt_bootstrap_rejected", {
            code: "adopt_bootstrap_rejected",
            predicate: "bootstrap_evidence_not_bound_to_root",
          });
        }

        const lockAt = new Date();
        await tx
          .update(documents)
          .set({
            lockedAt: lockAt,
            lockedByUserId: "board:adopt-bootstrap",
            updatedAt: lockAt,
          })
          .where(eq(documents.id, doc.id));

        const verificationReceipt = {
          versionKey: "v0.07",
          productBaseSha: V007_BOOTSTRAP.productBaseSha,
          canonicalSpec: {
            kind: "bootstrap_file",
            path: V007_BOOTSTRAP.specPath,
            commitSha: normalizeSha(input.specCommitSha),
            blobSha: V007_BOOTSTRAP.immutableSpecBlobSha,
          },
          decompositionId: input.decompositionId ?? null,
          decompositionFingerprint: input.decompositionFingerprint ?? null,
          candidateSourceSha: attestedCandidate,
          bootstrapEvidence: {
            documentId: doc.id,
            revisionId: doc.latestRevisionId,
            revisionNumber: doc.latestRevisionNumber,
            lockedAt: lockAt.toISOString(),
            bodyChars: doc.latestBody.length,
            issueDocumentId: link.id,
            issueId: link.issueId,
            implementationFacts: implFacts.facts,
          },
          implementationIssues: provenance.issues,
          checks: [
            { name: "bootstrap_evidence_present", passed: true },
            { name: "bootstrap_evidence_nonempty", passed: true },
            { name: "bootstrap_evidence_locked", passed: true },
            { name: "bootstrap_implementation_facts", passed: true, detail: Object.keys(implFacts.facts).join(",") },
            {
              name: "descendants_done_cursor_provenance",
              passed: true,
              detail: `descendants=${provenance.issues.length}`,
            },
            { name: "running_build_attestation", passed: true, detail: attestedCandidate },
          ],
          untrustedCallerEvidence: {
            candidateSourceSha: normalizeSha(input.candidateSourceSha),
          },
          failedPredicates: [],
          generatedAt: new Date().toISOString(),
          generatedBy: "paperclip.versionContractService.adoptBootstrap",
        };

        const [inserted] = await tx
          .insert(projectVersionContracts)
          .values({
            companyId: input.companyId,
            projectId: input.projectId,
            versionKey: "v0.07",
            rootIssueId: input.rootIssueId,
            productBaseSha: V007_BOOTSTRAP.productBaseSha,
            implementationBaseSha: normalizeSha(input.specCommitSha),
            specificationOwnerAgentId: input.specificationOwnerAgentId,
            canonicalSpecKind: "bootstrap_file",
            canonicalSpecPath: V007_BOOTSTRAP.specPath,
            canonicalSpecCommitSha: normalizeSha(input.specCommitSha),
            canonicalSpecBlobSha: V007_BOOTSTRAP.immutableSpecBlobSha,
            acceptedDecompositionId: input.decompositionId ?? null,
            acceptedDecompositionFingerprint: input.decompositionFingerprint ?? null,
            candidateSourceSha: attestedCandidate,
            verificationReceipt,
            verificationReceiptLockedAt: lockAt,
            openIdempotencyKey: `adopt-bootstrap:v0.07:${attestedCandidate}`,
          })
          .returning();

        const row = asRow(inserted);
        return { ...row, displayState: deriveDisplayState(row) };
      });
    },

    /** Route helper: board or Thinking-zero may submit verification. */
    async assertVerificationAuthorized(actor: {
      type: string;
      agentId?: string | null;
    }) {
      if (actor.type === "board") return { ok: true as const };
      if (actor.type === "agent" && actor.agentId) {
        const [agent] = await db.select().from(agents).where(eq(agents.id, actor.agentId)).limit(1);
        if (agent?.name === THINKING_ZERO_AGENT_NAME) return { ok: true as const, agent };
      }
      throw forbidden("Verification requires board or Thinking-zero", {
        code: "verification_actor_denied",
      });
    },

    async projectVersionView(projectId: string) {
      const active = await getByProject(projectId);
      if (!active) return null;
      return {
        ...active,
        displayState: deriveDisplayState(active),
        runningBuildManifest: getBuildManifestAttestation(),
      };
    },
  };
}

export type VersionContractService = ReturnType<typeof versionContractService>;
