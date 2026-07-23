# Paperclip v0.07 — Audit disposition (Cursor)

| Field | Value |
|---|---|
| Status | **FAIL accepted — deployed but not safely closed. Do not open v0.08.** |
| Audit time | 2026-07-22 21:59 PDT (Codex, read-only) |
| Spec blob |  |
| Spec commit |  |
| Live release (at audit / still) |  |

## Spec findings

| ID | Severity | Disposition |
|---|---|---|
| SPEC-1 | P0 | **Confirmed at audit.** Unapplied  / missing columns / recovery loop while health=ok. **Ops patch after audit (not a safe close):** columns +  present on live; missing-column errors since 22:00 PDT = ; recovery failures since 22:00 = . Live probe: . Nested migration packaging root cause remains a closure defect until a clean rebuild from published source. |
| SPEC-2 | P0 | **Confirmed.**  is a local worktree commit () but not on  (ls-remote hits=). Manifest digests ≠ git identity / installed runtime bytes. |
| SPEC-3 | P0 | **Confirmed.** Capsule void/reclose  →  →  mutates the active shipped record. Violates post-ship immutability. |
| SPEC-4 | P1 | **Confirmed.** Verification receipt insufficient (descendants=0, no decomposition, no Cursor ancestry/artifacts). |
| SPEC-5 | P1 | **Confirmed.** Journal/index reuse + dual migration trees caused SPEC-1. |
| SPEC-6 | P1 | **Confirmed.** Lane-isolation acceptance not demonstrated before closeout. |

## Standards findings

| ID | Severity | Disposition |
|---|---|---|
| STD-1 | P1 | Accepted — instruction precedence vs Cursor-only contract. |
| STD-2 | P1 | Accepted — repo  still points at V1 SPEC / stale Hermes context. |
| STD-3 | P1 | Accepted — host-level mandatory paths missing (outside this worktree). |
| STD-4 | P1 | Accepted — board hiring  inert vs . |
| STD-5 | P1 | Accepted — summarizer / CEO instruction contradictions. |
| STD-6 | P2 | Accepted — instruction load fails open; adapter resume differences. |

## Required closure (unchanged from audit)

Follow Codex steps 1–7. Especially: publish durable Git candidate; flat migration identity; immutable ship records (append-only observations); server-observed verification; acceptance tests persisted; collapse instruction stack; restart natural-run observer only after clean recovery and canary exclusion.

## Explicit non-actions

- Do **not** open/activate v0.08.
- Do **not** treat post-audit ops patches ( apply, /, userns sysctl, nested-migration build fix) as satisfying SPEC-2/3/4 or safe close.
- Do **not** treat  as migration or heartbeat-recovery proof.
