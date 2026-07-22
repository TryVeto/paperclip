# Paperclip v0.07 bootstrap evidence (Cursor input)

This document is **input evidence** for board `adopt-bootstrap`. It is not the
authoritative verification receipt (Paperclip generates that server-side).

| Field | Value |
|---|---|
| Candidate SHA | 71ea473dbdd1a9d7afb041043356f3388f3a2dca |
| Spec path | doc/plans/2026-07-22-paperclip-v0.07.md |
| Immutable spec blob | c9a2782c8e42c99d46729f54d4bc74bbe511a4e0 |
| Handoff spec commit (Mac) | 11f920182fdf908e2476c144505b1e659427015d |
| Product base (v0.06) | 9cad4cb71670c00191e52ab44e877156dfaf2118 |
| Local reconstructed spec commit | c0c50b4eaf7131cae4cb3b98ab567db2288d2182 (parent of first Cursor commit after local Codex-shaped spec commit) |
| Local Codex-shaped commit | c0c50b4eaf7131cae4cb3b98ab567db2288d2182 |
| Implementation provenance | Cursor only |
| Tests | `vitest run src/__tests__/version-contract-service.test.ts` — 9 passed |
| Migration | `0184_project_version_contracts` — `pnpm -C packages/db check:migrations` passed |
| Host note | Handoff git objects `11f92018` / `9cad4cb` were unreachable on veto-mainline; worktree reconstructed from paperclipai/paperclip tip with byte-identical canonical blob. |

## Pre-ship checks

- [x] Canonical blob equals handoff blob `c9a2782c…`
- [x] Spec file not modified by Cursor commits
- [x] Unit/policy acceptance tests green
- [ ] Deploy candidate with `scripts/write-build-manifest.mjs` into release artifact
- [ ] Board `adopt-bootstrap` once on deployed binary
- [ ] Board `closeShip` for v0.07
- [ ] Dry-run open v0.08 only after `shipped_at`

