#!/usr/bin/env bash
# Paperclip promotion smoke — v2026.609.0
# Usage:
#   export COMPANY_ID=<uuid> AGENT_ID=<uuid>
#   export ROUTINE_ID=<uuid>   # optional; leave unset to skip routine check
#   ./smoke.sh                 # defaults to staging
#   PAPERCLIP_BASE_URL=https://paperclip.tryveto.com ./smoke.sh   # prod subset
#
# Prerequisites:
#   - npx paperclipai@2026.609.0 available
#   - Board CLI auth: paperclipai auth whoami --api-base "$PAPERCLIP_BASE_URL"
#   - Do NOT run against veto/main builds

set -euo pipefail

PAPERCLIPAI_VERSION="${PAPERCLIPAI_VERSION:-2026.609.0}"
PAPERCLIP_BASE_URL="${PAPERCLIP_BASE_URL:-https://paperclip-staging.tryveto.com}"
PROMOTION_ID="${PROMOTION_ID:-promo-$(date -u +%Y%m%d)-6090}"
ARTIFACT_DIR="${ARTIFACT_DIR:-artifacts/${PROMOTION_ID}}"
CLI=(npx "paperclipai@${PAPERCLIPAI_VERSION}")

COMPANY_ID="${COMPANY_ID:?Set COMPANY_ID (dogfood company UUID)}"
AGENT_ID="${AGENT_ID:?Set AGENT_ID (smoke agent UUID)}"
ROUTINE_ID="${ROUTINE_ID:-}"

mkdir -p "$ARTIFACT_DIR"
LOG="$ARTIFACT_DIR/smoke.log"
exec > >(tee -a "$LOG") 2>&1

echo "=== Paperclip smoke ==="
echo "base_url=$PAPERCLIP_BASE_URL version=$PAPERCLIPAI_VERSION promotion=$PROMOTION_ID"
echo "started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

run_cli() {
  "${CLI[@]}" "$@" --api-base "$PAPERCLIP_BASE_URL" --json
}

# --- 1. Health ---
echo "--- health ---"
HEALTH_JSON="$ARTIFACT_DIR/health.json"
curl -sf "${PAPERCLIP_BASE_URL}/api/health" | tee "$HEALTH_JSON" | jq '{
  status,
  version,
  bootstrapStatus,
  deploymentMode,
  authReady
}'

VERSION=$(jq -r '.version // empty' "$HEALTH_JSON")
if [[ "$VERSION" != "2026.609.0" ]]; then
  echo "FAIL: expected version 2026.609.0, got ${VERSION:-<none>}"
  exit 1
fi
if [[ "$(jq -r '.status' "$HEALTH_JSON")" != "ok" ]]; then
  echo "FAIL: health status not ok"
  exit 1
fi

# --- 2. Login (CLI session probe) ---
echo "--- auth whoami ---"
run_cli auth whoami | tee "$ARTIFACT_DIR/whoami.json" | jq '{userId, email, role: .instanceRole}'

# Browser login still required manually — see RUNBOOK.md

# --- 3. Create issue ---
echo "--- issue create ---"
ISSUE_JSON="$ARTIFACT_DIR/issue-create.json"
run_cli issue create \
  -C "$COMPANY_ID" \
  --title "staging-promo-${PROMOTION_ID}" \
  | tee "$ISSUE_JSON"
ISSUE_ID=$(jq -r '.id' "$ISSUE_JSON")
echo "ISSUE_ID=$ISSUE_ID"

# --- 4. Comment ---
echo "--- issue comment ---"
COMMENT_JSON="$ARTIFACT_DIR/issue-comment.json"
run_cli issue comment "$ISSUE_ID" \
  --body "smoke comment ${PROMOTION_ID}" \
  | tee "$COMMENT_JSON"
COMMENT_ID=$(jq -r '.id' "$COMMENT_JSON")
echo "COMMENT_ID=$COMMENT_ID"

COUNT=$(run_cli issue comments "$ISSUE_ID" | jq --arg id "$COMMENT_ID" '[.[] | select(.id == $id)] | length')
if [[ "$COUNT" != "1" ]]; then
  echo "FAIL: comment not found in thread"
  exit 1
fi

# --- 5. Wake agent ---
echo "--- agent wake ---"
WAKE_JSON="$ARTIFACT_DIR/agent-wake.json"
run_cli agent wake "$AGENT_ID" \
  --reason "smoke ${PROMOTION_ID}" \
  | tee "$WAKE_JSON"
RUN_ID=$(jq -r '.run.id // .runId // empty' "$WAKE_JSON")
echo "RUN_ID=$RUN_ID"

if [[ -z "$RUN_ID" ]]; then
  echo "FAIL: no run id from wake"
  exit 1
fi

echo "--- poll run status (max 5 min) ---"
FINAL_STATUS=""
for _ in $(seq 1 30); do
  RUN_JSON=$(run_cli run get "$RUN_ID" -C "$COMPANY_ID")
  FINAL_STATUS=$(echo "$RUN_JSON" | jq -r '.status')
  echo "  status=$FINAL_STATUS"
  case "$FINAL_STATUS" in
    succeeded|failed|cancelled) break ;;
  esac
  sleep 10
done
echo "$RUN_JSON" | tee "$ARTIFACT_DIR/run-final.json" > /dev/null
echo "FINAL_STATUS=$FINAL_STATUS"

if [[ "$FINAL_STATUS" == "queued" ]]; then
  echo "FAIL: run still queued after 5 min"
  exit 1
fi

# --- 6. Routine tick (optional) ---
if [[ -n "$ROUTINE_ID" ]]; then
  echo "--- routine run ---"
  run_cli routine run "$ROUTINE_ID" | tee "$ARTIFACT_DIR/routine-run.json"
  run_cli routine runs "$ROUTINE_ID" | jq '.[0] | {id, status, createdAt}' \
    | tee "$ARTIFACT_DIR/routine-runs-head.json"
else
  echo "--- routine run skipped (ROUTINE_ID unset) ---"
fi

# --- 7. Adapters + secrets ---
echo "--- adapter list ---"
run_cli adapter list | tee "$ARTIFACT_DIR/adapters.json" \
  | jq '[.[] | {adapterType, healthStatus: (.healthStatus // "unknown")}]'

echo "--- secrets doctor ---"
"${CLI[@]}" secrets doctor \
  --api-base "$PAPERCLIP_BASE_URL" \
  -C "$COMPANY_ID" \
  | tee "$ARTIFACT_DIR/secrets-doctor.txt"

# --- 8. Backup + doctor ---
echo "--- instance database-backup ---"
run_cli instance database-backup | tee "$ARTIFACT_DIR/post-smoke-db-backup.json"

echo "--- doctor ---"
set +e
"${CLI[@]}" doctor --api-base "$PAPERCLIP_BASE_URL" 2>&1 | tee "$ARTIFACT_DIR/doctor.log"
DOCTOR_EXIT=$?
set -e
echo "DOCTOR_EXIT=$DOCTOR_EXIT"

echo "=== smoke complete ==="
echo "ended_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "Copy into receipt:"
echo "  issue_create_id: $ISSUE_ID"
echo "  comment_id: $COMMENT_ID"
echo "  agent_wake_run_id: $RUN_ID"
echo "  agent_wake_final_status: $FINAL_STATUS"
echo "  post_smoke_backup_path: $ARTIFACT_DIR/post-smoke-db-backup.json"
