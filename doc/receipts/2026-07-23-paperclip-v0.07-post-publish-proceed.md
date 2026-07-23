# Paperclip v0.07 — Post-publish proceed (2026-07-23)

| Field | Value |
|---|---|
| Status | **Progress: GitHub lineage published; live on flat-migration + paused-wake fix. Still NOT safely closed (Mac pins missing). v0.08 locked.** |
| Live install | `31f74ee6823606902c290aacab26135e30350f1b` |
| Prior live | `ba7dc9e4f436655d823e4f2e3d38f02fd933d0b3` |
| Branch | `veto/paperclip-v0.07-overnight-closeout` on https://github.com/TryVeto/paperclip |
| Release digest | `7fc45770fff2c4ecb7ae3a7b39583f2515ce91b3e2f35ff8668dfe9b878f9a49` |

## What landed this wake

1. **SPEC-2 (partial cure):** `workflow` scope present; pushed full lineage to
   `tryveto` `veto/paperclip-v0.07-overnight-closeout`. Fresh clone fetch resolves
   `48b9569…`, `ba7dc9e4…`, `31f74ee68…`.
2. **SPEC-1 package identity:** live journal/SQL byte-identical to source; no nested
   `dist/migrations/migrations`; `0186` present (see migration-identity receipt).
3. **Recovery noise:** skip non-invokable assignees in dependency-wake backstop;
   post-cutover journal (≥07:52 PDT): **0** `failed to enqueue dependency wake`,
   **0** `missing column`.

## Still FAIL for safe close

| Gate | Status |
|---|---|
| Mac product base `9cad4cb…` object | **Missing** on host/GitHub lineage |
| Mac spec commit `11f92018…` object | **Missing** (local reconstruction `c0c50b4ea` + blob pin only) |
| Historical SPEC-3 void/reclose | **Not cured** by cutovers |
| v0.08 | **Locked** |

## Explicit non-claims

- Not a safe close of v0.07
- `/api/health` is not closure proof
- Did not mutate the shipped capsule record
