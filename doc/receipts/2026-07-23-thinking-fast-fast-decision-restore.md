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
