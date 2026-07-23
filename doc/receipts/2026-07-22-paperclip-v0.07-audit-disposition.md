# Paperclip v0.07 — Audit disposition (Cursor)

| Field | Value |
|---|---|
| Status | **FAIL accepted — deployed but not safely closed. Do not open v0.08.** |
| Audit time | 2026-07-22 21:59 PDT (Codex, read-only) |
| Spec blob | `c9a2782c8e42c99d46729f54d4bc74bbe511a4e0` |
| Spec commit | `11f920182fdf908e2476c144505b1e659427015d` |
| Product base | `9cad4cb71670c00191e52ab44e877156dfaf2118` |
| Live release (audit + still) | `48b95694828bf85486d8f853cafb5d7c9b196fcd` |

## Spec findings

| ID | Severity | Disposition |
|---|---|---|
| SPEC-1 | P0 | **Confirmed at audit.** Unapplied `0186`, missing heartbeat columns / `run_classification_tokens`, recovery loop while `/api/health` stayed OK (70 recovery failures / 144 missing-column errors through 21:58). **Ops patch after audit (not a safe close):** columns + tokens table applied on live; nested-migration packaging root cause fixed in source (`faacf54`). Post-22:00 PDT journal check: 0 missing-column errors, 0 recovery failures. Does not satisfy clean package→journal→ledger identity. |
| SPEC-2 | P0 | **Confirmed.** `48b9569…` resolves in the local worktree only; not on `origin` (`paperclipai/paperclip`). Manifest digests prove tarball hashes + candidate string, not `git` identity or installed runtime bytes. |
| SPEC-3 | P0 | **Confirmed.** Capsule void/reclose mutated the active shipped record: `3c50854…` → `f852853…` → `48b9569…`. Violates post-ship immutability. |
| SPEC-4 | P1 | **Confirmed.** Verification receipt insufficient (descendants=0, no decomposition, no Cursor ancestry / commands / artifacts). |
| SPEC-5 | P1 | **Confirmed.** Journal index reuse / dual migration trees caused SPEC-1. |
| SPEC-6 | P1 | **Confirmed.** Lane-isolation acceptance not demonstrated before closeout. |

## Standards findings

| ID | Severity | Disposition |
|---|---|---|
| STD-1 | P1 | Accepted — global vs repo instruction precedence conflicts with Cursor-only contract. |
| STD-2 | P1 | Accepted — repo `AGENTS.md` still points at V1 SPEC / stale Hermes context. |
| STD-3 | P1 | Accepted — host mandatory paths missing (outside this worktree). |
| STD-4 | P1 | Accepted — Board hiring `adapterConfig.systemPrompt` inert vs `instructionsBundle`. |
| STD-5 | P1 | Accepted — summarizer / CEO instruction contradictions. |
| STD-6 | P2 | Accepted — instruction load fails open; adapter resume differences. |

## What is genuinely working (agree with audit)

Canonical spec pin; private live service; untrusted caller evidence ignored for candidate selection; strict tarball digest verify for the three packages; router/lane hooks present in code. None of these cure SPEC-1..3 at audit time or SPEC-2/3 now.

## Required closure (Codex steps 1–7)

1. Repair schema/package mismatch from a Cursor-owned durable Git branch; prove journal↔ledger identity and clean startup.
2. Real Git candidate descending from pinned spec + product base; bind commit/tree, tarballs, and installed runtime bytes.
3. Remove shipped-record mutation; append-only observations; keep original candidate / deployed SHA / locked receipts immutable.
4. Regenerate verification from server-observed Cursor facts (descendants, workspaces, commits, ancestry, commands, artifacts).
5. Persist migration / router / isolation / exact-SHA / regression / v0.08-open acceptance results.
6. Collapse instruction stack; Board hire → `paperclip-create-agent`; validate bundled agent instructions.
7. Restart first-20 natural-run observation only after clean recovery and canary/probe exclusion.

## Explicit non-actions

- Do **not** open or activate v0.08.
- Do **not** treat post-audit ops patches (`0186` apply, `bwrap`/`uidmap`, userns sysctl, nested-migration build fix, smoke VET-589) as satisfying SPEC-2/3/4 or safe close.
- Do **not** treat `/api/health` as migration or heartbeat-recovery proof.
- Do **not** treat equal 40-hex strings alone as exact-SHA proof without published object resolvability.
