# Assumptions — confirm before staging deploy (`v2026.609.0`)

Check every item. **Block staging deploy** until all required rows are confirmed.

## Infrastructure

| # | Assumption | Confirmed | Owner | Notes |
|---|------------|-----------|-------|-------|
| I1 | Staging Render **web service ID** is known | ☐ | | `srv-…` |
| I2 | Staging Render **Postgres ID** is known | ☐ | | `dpg-…` |
| I3 | Prod Render **web service ID** is known | ☐ | | `srv-…` |
| I4 | Prod Render **Postgres ID** is known | ☐ | | `dpg-…` |
| I5 | veto-ops Dockerfile pins `PAPERCLIPAI_VERSION=2026.609.0` from **upstream** `paperclipai/paperclip` tag `v2026.609.0` | ☐ | | Not `veto/main` |
| I6 | `PAPERCLIP_PUBLIC_URL` staging = `https://paperclip-staging.tryveto.com` | ☐ | | |
| I7 | `PAPERCLIP_PUBLIC_URL` prod = `https://paperclip.tryveto.com` | ☐ | | |
| I8 | `BETTER_AUTH_SECRET` is **unchanged** for this version bump | ☐ | | Rotate only if planned |
| I9 | `DATABASE_URL` / `DATABASE_MIGRATION_URL` point at correct Render Postgres per env | ☐ | | Migration URL = direct if pooled |
| I10 | `/paperclip` persistent disk mounted on both services | ☐ | | Secrets + assets |

## Dogfood identity (smoke)

| # | Assumption | Confirmed | Owner | Notes |
|---|------------|-----------|-------|-------|
| D1 | `COMPANY_ID` for dogfood company on staging | ☐ | | UUID |
| D2 | `AGENT_ID` for smoke wake (non-terminated, configured adapter) | ☐ | | UUID |
| D3 | `ROUTINE_ID` for routine tick (or explicitly skip) | ☐ | | UUID or empty |
| D4 | Board operator has working login on staging | ☐ | | Browser |
| D5 | CLI board auth works: `paperclipai auth whoami --api-base <staging>` | ☐ | | One-time per machine |

## Runtime patches (image layer)

| # | Assumption | Confirmed | Owner | Notes |
|---|------------|-----------|-------|-------|
| P1 | `patch-paperclip-agent-remove.mjs` still required at `2026.609.0` | ☐ | | If yes, must stay in Dockerfile |
| P2 | `patch-paperclip-codex-chatgpt-model.mjs` still required at `2026.609.0` | ☐ | | ChatGPT-auth lanes |
| P3 | External adapter plugins (if any) compatible with 609 adapter override behavior | ☐ | | |

## Migration / data

| # | Assumption | Confirmed | Owner | Notes |
|---|------------|-----------|-------|-------|
| M1 | Staging DB is at `v2026.529.0` or newer (migrations ≤0093 already applied) **or** fresh DB acceptable | ☐ | | 529→609 adds 0094–0098 |
| M2 | Pre-deploy backup retention verified (Render + API dump) | ☐ | | |
| M3 | Rollback backup path documented for `v2026.529.0` restore | ☐ | | |

## Policy

| # | Assumption | Confirmed | Owner | Notes |
|---|------------|-----------|-------|-------|
| X1 | **No** deploy of `TryVeto/paperclip@veto/main` theme commits | ☐ | | Hard policy |
| X2 | **No** canary / `main` for staging or prod | ☐ | | |
| X3 | Maintenance window agreed; no parallel prod promotion | ☐ | | |

---

## Manual operator actions (Sebastian)

These cannot be fully automated from this repo:

1. **Fill UUIDs** — Export `COMPANY_ID`, `AGENT_ID`, optional `ROUTINE_ID` from staging board or CLI.
2. **Render dashboard** — Manual Deploy staging with clear build cache; copy deploy ID from Events.
3. **Render Postgres** — Create manual backup; copy backup ID before deploy.
4. **Browser login** — Verify board session on `https://paperclip-staging.tryveto.com/auth`.
5. **Build log review** — Confirm `2026.609.0` and reject `veto-palette` / fork theme in image layers.
6. **CLI auth** — Run `paperclipai auth` once per operator machine against staging (and prod for prod smoke).
7. **Acceptance sign-off** — Approve A1–A13 in receipt before prod deploy.
8. **Prod promotion** — Second backup gate, second Manual Deploy, update prod deploy ID in receipt.
9. **Rollback readiness** — Know last good `v2026.529.0` Render deploy ID and pre-609 backup location.

---

## Blockers log

| Date (UTC) | Blocker | Resolution |
|------------|---------|------------|
| | | |
