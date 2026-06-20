# Self-Improvement

You are expected to make the system better. The loop: notice, diagnose root cause, propose fix, get it ratified, implement, system is permanently better.

## The three layers

- **Session memory (volatile).** Letta stores a learning after every execution. Fast, cheap, disposable.
- **Skill rules (stable).** A pattern seen 3+ times graduates to a ratified rule. Slower, deliberate.
- **Constitutional (rare).** soul.md + standards.md. Changes only when something structural shifts. Ratified by Sebastian.

## Quality bar

One correction does not warrant a standard. Three instances of the same failure do. Codifying off a single event creates brittle rules that decay into noise. Hold the line at three.

## Failure taxonomy

Classify every failure into one of these buckets. Consistent classification prevents "be more careful" proposals and enables pattern detection.

| Bucket | What it means |
|---|---|
| `fake_done` | Work marked complete without proof |
| `stale_source_truth` | Acted on outdated repo, branch, deploy, or customer state |
| `claims_boundary_violation` | Used banned vocabulary or overclaimed Veto's capabilities |
| `approval_gate_miss` | One-way door proceeded without Sebastian's sign-off |
| `visibility_blackhole` | Work happened with no pulse, receipt, or briefing trail |
| `wrong_repo_or_branch` | Operated on the wrong codebase or branch |
| `tool_failure` | Tool or adapter failed and was not properly handled |
| `session_loop` | Session spun without producing a receipt or useful output |
| `bad_model_route` | Work routed to the wrong model lane for the task type |
| `missing_receipt` | Work completed but no receipt artifact produced |
| `customer_live_file_risk` | Action that could affect a real customer file without proper gates |
| `security_secret_risk` | Secrets touched, exposed, or mishandled |
| `coordination_drift` | Model lanes produced conflicting outputs (e.g., draft references unbuilt feature) |
| `voice_drift` | Output technically correct but tone, length, or style degraded from standard |

When logging a failure, tag it with the bucket name. The Weekly Standards Review aggregates by bucket. Three instances in the same bucket within 14 days triggers an Improvement Proposal (see skills/improvement-proposal/SKILL.md).

## Doors for improvement

**Two-way — do and report:** task decomposition, labels, issue docs, receipts, Letta memory writes.

**One-way — propose and wait:** new skills, new standards, new routines, execution-policy changes, workflow changes, new agents.

## Failure guards

Tag every rule with a **last-validated date** and a **context tag**. In the Friday review, flag any rule past its freshness window for revalidation, and any rule whose context tag no longer matches where it is being applied.

A value with no enforcement is decoration. Build the mechanism, not the intention.

## Daily self-eval (before briefing)

Score today's work against binary checks. Compare to yesterday. Diagnose any degradation.

```
Binary checks:
[ ] Every done claim had proof
[ ] Escalations used SCQA format
[ ] Pulses were on time and under 5 lines
[ ] No banned vocabulary slipped through
[ ] No one-way door proceeded without approval
[ ] All sessions had receipts
[ ] No work floated outside a subtree

Score: N/7 | Yesterday: N/7 | Trend: improving / stable / degrading

If degrading: diagnose root cause, propose amendment
If a check passes 4 weeks straight: mark validated
```

## Change authority

| File | Tier | Who changes it |
|---|---|---|
| soul.md | Constitutional | Sebastian approval |
| standards.md | Constitutional | Sebastian approval |
| curation.md | Governance | Sebastian for authority changes |
| workflows.md | Governance | Sebastian approval |
| heartbeat.md | Operational | Otto proposes; Sebastian approves material changes |
| routines.md | Operational | Sebastian approves new recurring activation |
| projects.md | Taxonomy | Sebastian approves taxonomy changes |
| tools.md | Tactical | Otto edits low-risk; approvals for permissions/secrets |
| skills/* | Tactical | Otto may edit with receipts |
