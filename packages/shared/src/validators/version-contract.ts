import { z } from "zod";

export const GIT_SHA40 = z.string().regex(/^[0-9a-f]{40}$/, "expected lowercase 40-hex git SHA");

export const versionDisplayStateSchema = z.enum([
  "specifying",
  "implementing",
  "ship_ready",
  "shipped",
  "blocked",
]);
export type VersionDisplayState = z.infer<typeof versionDisplayStateSchema>;

export const canonicalSpecKindSchema = z.enum(["bootstrap_file", "plan_document"]);

export const openVersionSchema = z.object({
  versionKey: z.string().min(1).max(64),
  productBaseSha: GIT_SHA40,
  implementationBaseSha: GIT_SHA40.optional(),
  specificationOwnerAgentId: z.string().uuid(),
  projectWorkspaceId: z.string().uuid().optional().nullable(),
  rootIssueId: z.string().uuid().optional(),
  predecessorVersionId: z.string().uuid().optional().nullable(),
  idempotencyKey: z.string().min(1).max(128),
  /** v0.08+ uses plan_document; bootstrap v0.07 uses bootstrap_file. */
  canonicalSpecKind: canonicalSpecKindSchema.default("plan_document"),
  canonicalSpecPath: z.string().optional(),
  canonicalSpecCommitSha: GIT_SHA40.optional(),
  canonicalSpecBlobSha: GIT_SHA40.optional(),
});
export type OpenVersionInput = z.infer<typeof openVersionSchema>;

export const submitVerificationSchema = z.object({
  versionKey: z.string().min(1),
  checkResults: z
    .array(
      z.object({
        name: z.string().min(1),
        passed: z.boolean(),
        command: z.string().optional(),
        artifactRef: z.string().optional(),
        detail: z.string().optional(),
        timestamp: z.string().datetime().optional(),
      }),
    )
    .default([]),
  candidateSourceSha: GIT_SHA40.optional(),
});
export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;

export const closeShipSchema = z.object({
  versionKey: z.string().min(1),
  /** Evidence only — never trusted over the running build attestation. */
  observedLiveSha: GIT_SHA40.optional(),
});
export type CloseShipInput = z.infer<typeof closeShipSchema>;

export const adoptBootstrapSchema = z.object({
  versionKey: z.literal("v0.07"),
  productBaseSha: z.literal("9cad4cb71670c00191e52ab44e877156dfaf2118"),
  specCommitSha: GIT_SHA40,
  specBlobSha: z.literal("c9a2782c8e42c99d46729f54d4bc74bbe511a4e0"),
  specPath: z.literal("doc/plans/2026-07-22-paperclip-v0.07.md"),
  /** Untrusted evidence only — server binds candidate from running attestation. */
  candidateSourceSha: GIT_SHA40,
  bootstrapEvidenceDocumentId: z.string().uuid(),
  rootIssueId: z.string().uuid(),
  projectId: z.string().uuid(),
  companyId: z.string().uuid(),
  specificationOwnerAgentId: z.string().uuid(),
  decompositionId: z.string().uuid().optional(),
  decompositionFingerprint: z.string().optional(),
});
export type AdoptBootstrapInput = z.infer<typeof adoptBootstrapSchema>;

export const voidShipSchema = z.object({
  versionKey: z.string().min(1),
  reason: z.string().min(1).max(2000).optional(),
});
export type VoidShipInput = z.infer<typeof voidShipSchema>;

/** Fixed handoff constants for Paperclip v0.07 bootstrap. */
export const V007_BOOTSTRAP = {
  versionKey: "v0.07",
  productBaseSha: "9cad4cb71670c00191e52ab44e877156dfaf2118",
  handoffSpecCommitSha: "11f920182fdf908e2476c144505b1e659427015d",
  immutableSpecBlobSha: "c9a2782c8e42c99d46729f54d4bc74bbe511a4e0",
  specPath: "doc/plans/2026-07-22-paperclip-v0.07.md",
} as const;
