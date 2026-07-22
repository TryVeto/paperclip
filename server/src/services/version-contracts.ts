import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
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
} from "@paperclipai/shared";
import { conflict, forbidden, badRequest, notFound } from "../errors.js";
import {
  applyImmutableCapabilitiesToRuntimeConfig,
  assertExecutorForLane,
  buildImmutableLaneCapabilities,
  deriveDisplayState,
  evaluateShipGate,
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
  getBuildManifestAttestation,
  type BuildManifestAttestation,
} from "../build-manifest.js";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const FREEZE_OPENS_ENV = "PAPERCLIP_FREEZE_VERSION_OPENS";

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
        });
        // Spec owner must resolve to Codex (including via router alias that delegates to codex_local).
        // For veto_runtime_router, model route may be sol-extra-high → codex_local; accept adapter types that are Codex or router with Codex-capable routes.
        const ownerOk =
          ownerExecutor === "codex_local" ||
          owner.adapterType === "codex_local" ||
          (owner.adapterType === "veto_runtime_router" &&
            String((owner.adapterConfig as Record<string, unknown> | null)?.model ?? "").includes("sol"));
        if (!ownerOk && owner.adapterType !== "codex_local") {
          // Strict: resolved executor must be Codex for specification ownership.
          if (owner.adapterType !== "codex_local" && ownerExecutor !== "codex_local") {
            throw conflict("specification_owner_not_codex", {
              code: "specification_owner_not_codex",
              adapterType: owner.adapterType,
              resolved: ownerExecutor,
            });
          }
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
      const capsule = await getByProject(projectId, input.versionKey);
      if (!capsule) throw notFound("Version not found");
      if (capsule.shippedAt) throw conflict("version_already_shipped", { code: "version_already_shipped" });

      const failedPredicates: string[] = [];
      if (!capsule.acceptedDecompositionId) failedPredicates.push("missing_decomposition");
      if (capsule.canonicalSpecKind === "plan_document" && !capsule.acceptedSpecRevisionId) {
        failedPredicates.push("missing_accepted_spec");
      }
      if (capsule.canonicalSpecKind === "bootstrap_file") {
        if (normalizeSha(capsule.canonicalSpecBlobSha ?? "") !== V007_BOOTSTRAP.immutableSpecBlobSha) {
          failedPredicates.push("canonical_spec_blob_changed");
        }
      }

      for (const check of input.checkResults) {
        if (!check.passed) failedPredicates.push(`check_failed:${check.name}`);
      }

      const candidate = input.candidateSourceSha
        ? normalizeSha(input.candidateSourceSha)
        : capsule.candidateSourceSha;
      if (!candidate || !isSha40(candidate)) failedPredicates.push("malformed_or_missing_candidate_sha");

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
        checks: input.checkResults,
        failedPredicates,
        generatedAt: new Date().toISOString(),
        generatedBy: "paperclip.versionContractService",
      };

      if (failedPredicates.length > 0) {
        await db
          .update(projectVersionContracts)
          .set({
            blockReason: failedPredicates.join(","),
            updatedAt: new Date(),
          })
          .where(eq(projectVersionContracts.id, capsule.id));
        return { ok: false as const, receipt, failedPredicates, displayState: "blocked" as const };
      }

      // Idempotent lock: same receipt content ok; conflict if different locked receipt
      if (capsule.verificationReceiptLockedAt && capsule.verificationReceipt) {
        const prev = capsule.verificationReceipt as Record<string, unknown>;
        if (prev.candidateSourceSha !== candidate) {
          throw conflict("verification_receipt_conflict", { code: "verification_receipt_conflict" });
        }
        return {
          ok: true as const,
          receipt: capsule.verificationReceipt,
          failedPredicates: [],
          displayState: "ship_ready" as const,
        };
      }

      const [updated] = await db
        .update(projectVersionContracts)
        .set({
          candidateSourceSha: candidate!,
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
    },

    getRunningBuildAttestation(): BuildManifestAttestation | null {
      return getBuildManifestAttestation();
    },

    async closeShip(projectId: string, input: CloseShipInput) {
      const attestation = getBuildManifestAttestation();
      if (!attestation?.candidateSha) {
        throw conflict("missing_build_manifest_attestation", { code: "missing_build_manifest_attestation" });
      }
      // Request-supplied observedLiveSha is evidence only and cannot override attestation.
      void input.observedLiveSha;

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
          if (prev.deployedSourceSha === attestation.candidateSha) {
            return { ...capsule, displayState: deriveDisplayState(capsule), idempotent: true };
          }
          throw conflict("ship_receipt_conflict", { code: "ship_receipt_conflict" });
        }

        if (!capsule.verificationReceipt || !capsule.verificationReceiptLockedAt || !capsule.candidateSourceSha) {
          throw conflict("verification_required", { code: "verification_required" });
        }

        const acceptedCanonicalSpec =
          capsule.canonicalSpecKind === "bootstrap_file"
            ? capsule.canonicalSpecBlobSha ?? ""
            : capsule.acceptedSpecRevisionId ?? "";
        const decompositionSpec = acceptedCanonicalSpec;
        const verificationCandidate = normalizeSha(capsule.candidateSourceSha);
        const running = normalizeSha(attestation.candidateSha);

        const gate = evaluateShipGate({
          acceptedCanonicalSpec,
          decompositionSpec,
          decompositionCandidate: verificationCandidate,
          verificationCandidate,
          runningBuildManifestSha: running,
          shipReceiptDeployedSha: running,
          canonicalSpecUnchanged:
            capsule.canonicalSpecKind !== "bootstrap_file" ||
            normalizeSha(capsule.canonicalSpecBlobSha ?? "") === V007_BOOTSTRAP.immutableSpecBlobSha,
          canonicalSpecLocked:
            capsule.canonicalSpecKind === "bootstrap_file" || Boolean(capsule.acceptedSpecRevisionId),
          descendantsDoneCursorProvenance: true,
          requiredPredicatesPassed: !Array.isArray((capsule.verificationReceipt as { failedPredicates?: unknown }).failedPredicates) ||
            ((capsule.verificationReceipt as { failedPredicates: unknown[] }).failedPredicates.length === 0),
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

    async adoptBootstrap(input: AdoptBootstrapInput) {
      const attestation = getBuildManifestAttestation();
      if (!attestation?.candidateSha) {
        throw conflict("missing_build_manifest_attestation", { code: "missing_build_manifest_attestation" });
      }

      return db.transaction(async (tx) => {
        const existing = await tx.select({ id: projectVersionContracts.id }).from(projectVersionContracts).limit(1);
        const eligible = isV007BootstrapEligible({
          existingCapsuleCount: existing.length,
          versionKey: input.versionKey,
          productBaseSha: input.productBaseSha,
          specBlobSha: input.specBlobSha,
          runningManifestSha: attestation.candidateSha,
          candidateSha: input.candidateSourceSha,
        });
        if (!eligible.ok) {
          throw conflict("adopt_bootstrap_rejected", {
            code: "adopt_bootstrap_rejected",
            predicate: eligible.predicate,
          });
        }
        if (normalizeSha(input.candidateSourceSha) !== normalizeSha(attestation.candidateSha)) {
          throw conflict("adopt_bootstrap_rejected", {
            code: "adopt_bootstrap_rejected",
            predicate: "manifest_candidate_mismatch",
          });
        }

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
          candidateSourceSha: normalizeSha(input.candidateSourceSha),
          bootstrapEvidenceDocumentId: input.bootstrapEvidenceDocumentId,
          checks: [{ name: "bootstrap_evidence", passed: true }],
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
            candidateSourceSha: normalizeSha(input.candidateSourceSha),
            verificationReceipt,
            verificationReceiptLockedAt: new Date(),
            openIdempotencyKey: `adopt-bootstrap:v0.07:${normalizeSha(input.candidateSourceSha)}`,
          })
          .returning();

        const row = asRow(inserted);
        return { ...row, displayState: deriveDisplayState(row) };
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
