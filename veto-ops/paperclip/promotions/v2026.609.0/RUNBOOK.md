# Paperclip promotion runbook — `v2026.609.0`

Operator runbook for Veto's release-first Paperclip dogfood. Lives in **veto-ops**; Paperclip core stays upstream.

## Policy

| Environment | Pin | Artifact |
|-------------|-----|----------|
| Staging | `v2026.609.0` | `paperclipai@2026.609.0` built from upstream tag `v2026.609.0` |
| Production | `v2026.609.0` | Same after staging sign-off |
| Rollback / N-1 | `v2026.529.0` | `paperclipai@2026.529.0` |
| **Forbidden** | `veto/main`, `canary`, `main`, any commit ahead of `v2026.609.0` | — |

| URL | Role |
|-----|------|
| `https://paperclip-staging.tryveto.com` | Staging validation |
| `https://paperclip.tryveto.com` | Production |

## Scope

- **In veto-ops:** image pin, Render deploy, backups, smoke, receipt, rollback.
- **Not in Paperclip core:** Veto theme, Cognee, receipts UI, deploy overlays.
- **Image patches (if still used):** `patch-paperclip-agent-remove.mjs`, `patch-paperclip-codex-chatgpt-model.mjs` — apply in Dockerfile only.

## Promotion ID

Generate once per attempt:

```bash
export PROMOTION_ID="promo-$(date -u +%Y%m%d)-6090"
mkdir -p "artifacts/${PROMOTION_ID}"
```

---

## Phase 0 — Confirm assumptions

Complete [ASSUMPTIONS.md](./ASSUMPTIONS.md) **before** staging deploy. Any unchecked blocker stops the promotion.

---

## Phase 1 — Backup gate (blocking)

Deploy is **blocked** until recorded in the receipt.

### 1.1 Record current staging state

```bash
curl -sf https://paperclip-staging.tryveto.com/api/health \
  | jq '{status, version, bootstrapStatus}' \
  | tee "artifacts/${PROMOTION_ID}/pre-deploy-health.json"
```

In Render: note **staging service ID**, **current deploy ID**, and **Postgres backup ID** (if managed).

### 1.2 Staging database backup

**API (preferred, board auth):**

```bash
npx paperclipai@2026.609.0 instance database-backup \
  --api-base https://paperclip-staging.tryveto.com --json \
  | tee "artifacts/${PROMOTION_ID}/staging-pre-deploy-db-backup.json"
```

**Render Postgres:** Dashboard → staging database → **Create backup** → record backup ID.

### 1.3 Secrets / disk

If the service mounts `/paperclip`: copy `instances/default/secrets/key` and note disk snapshot ID (if available).

### 1.4 Gate sign-off

| Gate | Pass |
|------|------|
| G1 | Pre-deploy DB backup artifact or Render backup ID recorded |
| G2 | Backup verified (`jq` on API JSON or `pg_restore --list` on dump) |
| G3 | Secrets key backed up separately from DB |
| G4 | Current staging version + Render deploy ID recorded |
| G5 | [ASSUMPTIONS.md](./ASSUMPTIONS.md) blockers cleared |

Fill `backup_gate` in [receipt.template.yaml](./receipt.template.yaml).

---

## Phase 2 — Staging deploy (Render)

1. In veto-ops infra, pin **`PAPERCLIPAI_VERSION=2026.609.0`** (upstream `paperclipai/paperclip` tag `v2026.609.0`).
2. **Do not** build from `TryVeto/paperclip@veto/main` or any theme commit.
3. Push veto-ops change; trigger **Manual Deploy** on staging with **Clear build cache**.
4. Confirm build log shows `2026.609.0` and upstream source — no `veto-palette.css` / theme hashes.
5. Wait for service **Live**; migrations 0090–0098 apply on first boot.
6. Version check:

```bash
curl -sf https://paperclip-staging.tryveto.com/api/health | jq '{status, version}'
# version must be "2026.609.0"
```

Record `render.staging.deploy_id` in the receipt.

---

## Phase 3 — Staging smoke

```bash
export PROMOTION_ID="promo-YYYYMMDD-6090"   # same as Phase 1
export COMPANY_ID="<dogfood-company-uuid>"
export AGENT_ID="<smoke-agent-uuid>"
export ROUTINE_ID=""                        # optional

./smoke.sh
```

Or run sections manually — see [smoke.sh](./smoke.sh).

All acceptance criteria in §4 must pass before prod.

---

## Phase 4 — Acceptance criteria

| ID | Criterion |
|----|-----------|
| A1 | `/api/health` → `version: "2026.609.0"` on staging |
| A2 | Deploy artifact is upstream `v2026.609.0`, not `veto/main` |
| A3 | Migrations 0090–0098 applied; no migration crash loop |
| A4 | Board login at staging URL succeeds |
| A5 | Issue create + comment smoke pass |
| A6 | Agent wake leaves `queued` within 60s |
| A7 | Routine run recorded (or `ROUTINE_ID` empty / skipped) |
| A8 | `secrets doctor` — no `unhealthy` providers |
| A9 | `adapter list` returns without 5xx |
| A10 | Post-smoke `instance database-backup` succeeds |
| A11 | `doctor` exits 0 or warnings-only |
| A12 | 30 min soak — no new 5xx on `/api/health` |
| A13 | Existing dogfood data visible (no loss) |

**Approver sign-off required** before Phase 5.

---

## Phase 5 — Production promotion

Repeat backup gate against **prod** URL and Postgres before deploy.

1. Pin prod Render service to `PAPERCLIPAI_VERSION=2026.609.0`.
2. Manual deploy (clear build cache).
3. Confirm `https://paperclip.tryveto.com/api/health` → `version: "2026.609.0"`.
4. Run smoke with `PAPERCLIP_BASE_URL=https://paperclip.tryveto.com` (subset: health, login, issue, wake minimum).
5. Complete receipt `prod_deploy` section; archive under `artifacts/${PROMOTION_ID}/`.

---

## Phase 6 — Rollback

### Triggers (any one)

- Health not `ok` within 10 min of deploy
- Migration failure / restart loop
- `version` ≠ expected pin
- Login broken or unexpected `bootstrapStatus` regression
- Wake stuck `queued` >5 min with healthy adapters
- `secrets doctor` newly `unhealthy`
- Data loss or sustained 5xx on core APIs
- Wrong artifact deployed (`veto/main`, canary, wrong tag)

### Procedure

1. **Binary rollback:** Redeploy last good Render deploy **or** set `PAPERCLIPAI_VERSION=2026.529.0` and deploy.
2. **DB rollback (only if schema/data broken):** Stop service → restore **pre-deploy backup** → restore secrets key → start on `v2026.529.0`.

Paperclip has no down-migrations. DB restore is the only safe schema rollback.

---

## What Sebastian must do manually

See [ASSUMPTIONS.md](./ASSUMPTIONS.md) § Manual operator actions. Summary:

1. **Confirm assumptions** (company/agent UUIDs, Render IDs, secrets provider, maintenance window).
2. **Approve backup gate** and record backup IDs in the receipt.
3. **Merge veto-ops pin** to `2026.609.0` and click **Manual Deploy** on Render staging (clear cache).
4. **Verify build log** — upstream `2026.609.0` only; reject if theme/`veto/main` artifacts appear.
5. **Board login** on staging in browser (CLI smoke cannot replace this).
6. **Run or supervise** `./smoke.sh`; paste results into receipt.
7. **Sign acceptance** (A1–A13) before prod.
8. **Repeat backup gate + deploy** for prod; sign final receipt.
9. **Keep rollback deploy** one click away (`v2026.529.0` + pre-deploy backup path documented).

---

## Artifacts in this directory

| File | Purpose |
|------|---------|
| [RUNBOOK.md](./RUNBOOK.md) | This document |
| [smoke.sh](./smoke.sh) | Staging/prod smoke command script |
| [receipt.template.yaml](./receipt.template.yaml) | Promotion receipt (copy per run) |
| [ASSUMPTIONS.md](./ASSUMPTIONS.md) | Pre-flight checklist |
| `artifacts/<promotion-id>/` | Per-run logs and backups metadata |
