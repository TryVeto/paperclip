# Paperclip v0.07 — Audit disposition (Cursor)

| Field | Value |
|---|---|
| Status | **Agree: not safely closed.** v0.08 remains blocked. |
| Audit snapshot | Codex evidence through ~21:58 PDT (70 recovery failures / 144 missing-column errors) |
| Live at disposition | Deployed `48b9569…`; columns present; post-22:00 PDT missing-column errors = 0 |
| Spec blob | `c9a2782c8e42c99d46729f54d4bc74bbe511a4e0` (unchanged) |

## P0 findings — disposition

| Finding | Verdict | Notes |
|---|---|---|
| `0186` expected but not applied; recovery failing; health green | **Confirmed at audit time.** | Root cause: nested `dist/migrations/migrations` so auto-apply never saw `0186` while schema selected new columns. **Live remediations after audit:** SQL applied; outer journal patched; build script `rm -rf dist/migrations` before copy (`faacf54`). Post-22:00 PDT: 0 `traffic_class` / 0 recovery failures (runtime check). |
| `48b956…` not resolvable on origin / host mirrors | **Confirmed.** | Commit exists only in local worktree `veto/paperclip-v0.07`. `origin` = `paperclipai/paperclip`; `git ls-remote origin 48b9569` empty. Exact-SHA ship without a published ref is **not** audit-safe proof. |
| Ship record rewritten `3c50854` → `f852853` → `48b9569` | **Accepted as unsafe closure pattern.** | Board `voidShip` + re-`closeShip` was used for incident repair; that does not equal a single immutable first-close. Capsule still reports `displayState=shipped` for v0.07 only. |

## P1 findings — disposition

| Finding | Verdict |
|---|---|
| Verification with zero descendants / no decomposition / no test artifacts | **Agreed as weak gate for this close.** Bootstrap path allowed ship_ready with descendants=0; not a substitute for implementation proof. |
| Migration history `0182` reuse / journal idx `178` dup / dual migration trees | **Agreed for shipped `48b9569` artifact.** Nested tree was the live failure mode; journal hygiene still needs a clean rebuild + published SHA. |
| Instruction stack conflicts (AGENTS.md → V1 SPEC; hiring prompt inert; summarizer write contract) | **Agreed; not fixed in this disposition.** `AGENTS.md` still points contributors to `doc/SPEC-implementation.md` instead of binding `doc/plans/2026-07-22-paperclip-v0.07.md`. |

## Required for a future *safe* close (do not open v0.08 until done)

1. Publish candidate commits to a board-reachable remote/ref (not only local worktree strings).
2. Rebuild release with flat migrations + matching journal tip including `0186`; prove auto-apply on a clean DB copy; no nested `migrations/migrations`.
3. One honest close against that published SHA (or an explicit board-approved reopen policy that preserves full receipt_history in the API surface).
4. Strengthen verification beyond descendants=0 bootstrap empty-set (tests / decomposition / ancestry as the version contract requires for non-bootstrap work).
5. Align AGENTS.md / board skills / summarizer boundary with the v0.07 Cursor-code contract.

## Explicit non-actions

- **Do not open or activate v0.08.**
- Do not treat health=ok as migration proof.
- Do not treat equal 40-hex strings alone as exact-SHA proof without object resolvability.
