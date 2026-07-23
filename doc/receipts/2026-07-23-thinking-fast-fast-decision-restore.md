# Thinking-fast fast-decision restore (2026-07-23)

## Root cause
Thinking-fast uses `veto_runtime_router` + sentinel model `fast_decision_only` so Cursor cannot fall through. Live wakes are supposed to be intercepted by server `fast-decision-v1` (Luna via `PAPERCLIP_FAST_DECISION_*`). That service existed on releases `3c50854…` / `9cad…-r2` but was absent from overnight rebuilds (`ba7dc9e4…`, `31f74ee…`, `b314bcf41…`) and from source. Wakes hit the router, which only accepts `cursor|sol-extra-high` → `Invalid route alias "fast_decision_only"`.

## Fix
- Restored `server/src/services/fast-decision.ts` from the known-good live compiled module.
- Re-wired `executeFastDecisionRun` + Cursor fallthrough deny into `server/src/services/heartbeat.ts` (from `3c50854` live heartbeat), before adapter execute.
- DB exactly-once indexes already present on live; no new migration required.
- Did **not** remap Thinking-fast to `cursor` (preserves no-Cursor policy).

## Live cutover
Documented after package install (candidate SHA = this commit).

## Live cutover proof
- Candidate / live SHA: `23fc90fbab20f7a9f7a8dfb9fed5a802b4c8c541`
- Release digest: `2e7bc4b647ae74a00043d6aa8c81e86510e2c0f3f33b92bcc4462b42b5dba254`
- Symlink: `/home/droid/.local/lib/paperclip-veto-mainline-cloud` → `…/releases/23fc90fb…`
- Startup: `digestVerify.ok=true`, `installedRuntimeOk=true`
- Thinking-fast `adapterConfig.model` restored to `fast_decision_only`; status `idle`
- Dry invoke run `8eaf37ef-9efd-4214-a7f4-1aecda2db127` → **succeeded** in ~1s with `fastDecision.action=no_op`, `emptyInbox=true`, `cursorFallback=false`

## Sebastian verify
1. Board: Thinking-fast should show idle (not error).
2. On VET-596 (or VET-594): Clear error if needed → Assign/Retry to Thinking-fast.
3. Expect Luna fast-decision (or escalate to Thinking-slow), **not** `Invalid route alias`.
