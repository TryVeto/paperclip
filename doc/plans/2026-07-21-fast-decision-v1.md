# Fast Decision v1

## Goal

Give allowlisted, decision-only agents a one-shot heartbeat path that completes in a median of 10 seconds or less without changing the normal adapter path for every other agent.

## Constraints

- Dispatch before runtime-state, workspace, session, skills, environment, runtime-service, and MCP setup.
- Send only a capped issue title, issue body, latest comment, and wake reason.
- Make exactly one Responses API call with no Paperclip tools and strict structured output.
- Accept only `comment_and_done`, `escalate_slow`, `backlog`, or `no_op`.
- Treat timeouts, transport failures, invalid output, active `no_op`, and any tool/file requirement as one idempotent escalation to the configured slow agent.
- Apply the selected disposition deterministically with the heartbeat run ID as the idempotency boundary.
- Keep normal heartbeat events, usage, cost, and activity records.
- Gate the path by an instance feature flag and an explicit agent ID allowlist. Reject non-loopback model endpoints unless separately opted in.

## Delivery

1. Add a dependency-free one-shot Responses API client with bounded input/output and a hard timeout.
2. Add an early heartbeat branch after claim and the final invokability check, before `ensureRuntimeState`.
3. Lock the run and issue while applying the action; persist an applied marker in `heartbeat_runs.result_json` in the same transaction.
4. Add at most one run-attributed issue comment, update issue state/assignee, finalize the fast run, release its execution lock, and enqueue a slow fallback with a run-derived idempotency key when required.
5. Preserve the existing heartbeat path unchanged when the feature is disabled or the agent is not allowlisted.

## Runtime configuration

- `PAPERCLIP_FAST_DECISION_ENABLED`: master feature flag; only the explicit value `true` or `1` enables the lane.
- `PAPERCLIP_FAST_DECISION_AGENT_IDS`: comma-separated allowlist of agent UUIDs.
- `PAPERCLIP_FAST_DECISION_BASE_URL`: Responses-compatible API base URL. Loopback is required unless `PAPERCLIP_FAST_DECISION_ALLOW_REMOTE=true`, in which case HTTPS is required.
- `PAPERCLIP_FAST_DECISION_API_KEY_ENV`: name of the environment variable that contains the API key; the key itself is never stored in Paperclip configuration.
- `PAPERCLIP_FAST_DECISION_MODEL`: dedicated one-shot model route.
- `PAPERCLIP_FAST_DECISION_REASONING_EFFORT`: `none`, `minimal`, or `low`.
- `PAPERCLIP_FAST_DECISION_TIMEOUT_MS`: hard request-and-response deadline from 100 through 15,000 milliseconds; default 8,000.
- `PAPERCLIP_FAST_DECISION_FALLBACK_AGENT_ID`: slow-agent UUID used for the single idempotent escalation.
- `PAPERCLIP_FAST_DECISION_PROVIDER`, `PAPERCLIP_FAST_DECISION_BILLER`, and `PAPERCLIP_FAST_DECISION_BILLING_TYPE`: explicit accounting attribution.

## Verification gate

- Focused unit tests for configuration, caps, schema validation, timeout, and single-call behavior.
- Heartbeat integration tests for the early branch, deterministic actions, idempotency, and one slow escalation.
- Repository typecheck, test suite, and build.
- Three quiet serial live canaries: median total runtime at most 10 seconds, every run at most 15 seconds, correct disposition and audit trail, and no retry, duplicate mutation, or wake loop.
- Observe p95 across the first 20 natural runs without synthetic load.

## Rollback

Set `PAPERCLIP_FAST_DECISION_ENABLED=false` and restart Paperclip. The normal adapter path remains intact and requires no data rollback.
