# Eval Operator Layer

Paperclip ships the **trace archive API** and **eval harness** in-repo. Veto-specific operator scripts (Taskfile tasks, bootstrap, label/promote wrappers) live in `veto-ops` and call into this repo.

## Architecture

| Layer | Owner | Responsibility |
|---|---|---|
| Trace archive | Paperclip server | Auto-save every terminal run for allowlisted companies |
| Export API + CLI | Paperclip | `GET /api/companies/:id/run-traces`, `paperclip run-traces` |
| Outcome labels | veto-ops | Human judgment in `labels.jsonl` (gitignored) |
| Scenario/matrix runner | `evals/` | Grade traces with hard checks; compare bundles |
| Corpus promotion | `evals/tools/promote-case.ts` | Labeled traces → private eval cases |

## Enable trace archive (server)

Set allowlisted company IDs (comma-separated UUIDs):

```bash
export RUN_TRACE_ARCHIVE_COMPANY_IDS="<veto-company-id>,<veto-eval-company-id>"
```

On terminal heartbeat status, Paperclip queues a `run_trace_archives` row and flushes bundles in the background.

## Commands (paperclip repo)

```bash
# Hard-check unit tests
pnpm evals:scenario:test

# Dry-run harness (no live wake)
pnpm evals:scenario -- --case core.assignment_pickup --dry-run

# Grade a completed run (set EVAL_RUN_ID to heartbeat run UUID)
EVAL_RUN_ID=<run-id> pnpm evals:scenario -- --case core.checkout_before_work

# Matrix compare bundles on same case
pnpm evals:matrix -- --case core.assignment_pickup --bundles frontline-eng-default --dry-run

# Export archived runs
EVAL_COMPANY_ID=<uuid> pnpm evals:export-runs

# Promote labeled run to corpus
EVAL_COMPANY_ID=<uuid> pnpm evals:promote-case -- --run-id <uuid>
```

## Outcome labeling (veto-ops)

Append one JSON line per judgment to `labels.jsonl` (see `labels.schema.json`). Set `promoteToEval: true` before running `promote-case`.

Example line:

```json
{"runId":"...","companyId":"...","outcome":"accepted","quality":"good","promoteToEval":true,"labeledAt":"2026-06-16T12:00:00.000Z","labeledBy":"seb"}
```

## Deploy checklist

1. Apply migration `0100_run_trace_archives.sql`
2. Deploy server with `RUN_TRACE_ARCHIVE_COMPANY_IDS` set
3. Complete a heartbeat on an allowlisted company → archive row within ~15s
4. Sync via `paperclip run-traces list -C <company-id> --json`
5. Label → promote → add/adjust eval cases as needed
