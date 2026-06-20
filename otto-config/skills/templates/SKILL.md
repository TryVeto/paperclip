# Skill: Templates

## When to use

When creating any recurring Paperclip object. Use the matching template every time. Consistency makes work scannable, reviewable, and auditable without Sebastian having to parse a new format each time.

## Pulse (every 30 minutes)

```
TASK:   [issue ID] [one-line summary of what you are doing right now]
STATUS: on track / slow / blocked
LAST:   [the concrete action you just completed]
NEXT:   [the concrete action you will take next]
NEEDS:  [what you need from Sebastian, or "nothing"]
```

## Task / Issue

```
# [VET-NNN] [descriptive title — verb + noun]

## Objective
[One paragraph. What this task accomplishes and why it matters for Veto.]

## Acceptance criteria
1. [Specific, testable condition]
2. [Specific, testable condition]
3. [Specific, testable condition]

## Scope
Allowed paths: [list]
Forbidden paths: [list]

## Context
- Parent issue: [VET-NNN]
- Project: Product / Growth
- Labels: [area:X]
- Related: [links to related issues, PRs, docs]

## Done when
All acceptance criteria met + receipt posted + relevant gates cleared.
```

## Session Packet

```yaml
issue_id: VET-NNN
repo: [repo name]
base_ref: main
branch: work/vet-nnn-short-description
executor: claude-code / codex / cursor-cloud
objective: >
  [One paragraph. Concrete. What the session produces.]
allowed_paths:
  - [explicit list]
forbidden_paths:
  - .env*
  - infra/prod/**
  - scripts/deploy/**
done_when:
  - [numbered acceptance criteria]
checks:
  - pnpm test
  - pnpm typecheck
  - [targeted smoke if available]
receipt_required: true
expires_after: task_complete
```

## Receipt

```
# Receipt: [VET-NNN] [task title]

## Acceptance criteria
1. [criterion] → PASS / FAIL
2. [criterion] → PASS / FAIL
3. [criterion] → PASS / FAIL

## Proof
- [test output, log excerpt, artifact link, or screenshot]
- PR: [link]
- Branch: [name]
- CI: passing / failing

## Gates
- Security lens: cleared / N/A
- Legal/claims lens: cleared / N/A
- Coverage-of-change: [new test name] fails on base, passes on branch

## What is now true that was not true before
[One line.]
```

## Daily Briefing

```
# Daily Briefing · YYYY-MM-DD

Shipped:
- [VET-NNN] [title] — [receipt link]

In progress:
- [VET-NNN] [title] — [expected next step]

Blocked:
- [VET-NNN] [title] — blocked on [what]

Needs Sebastian:
- [VET-NNN] [what decision / approval] — [recommendation]

Sessions:
- N active: [list with issue IDs]
- Receipts returned: N
- Review queue: N

Risks:
- [what could go wrong tomorrow]

First move:
- [the single thing you pick up first]
```

## Cleanliness Receipt

```
# Cleanliness Receipt · YYYY-MM-DD

Fixed automatically:
- [what you found and fixed]

Needs Sebastian:
- [what requires a decision]

Blocked:
- [what is stuck and why]

Suspect / fake-done:
- [any issues marked done without proof]

Reality check:
- Deploy state matches board: yes / no
- Repo state matches board: yes / no
- Orphaned work found: N items
```

## Weekly Standards Review

```
# Standards Review · Week of YYYY-MM-DD

Self-eval trend: [improving / stable / degrading]
Average daily score: N/7

Where did an agent fake progress?
- [specifics or "none detected"]

Where did a gate catch something?
- [specifics or "no gate fires this week"]

Where did a gate create drag without catching anything?
- [specifics or "no drag detected"]

What correction should become canon?
- [proposal link or "none — no pattern reached 3x"]

What routine should be killed or tightened?
- [specifics or "all routines earned their place"]

Failure taxonomy this week:
- fake_done: N
- stale_source_truth: N
- claims_boundary_violation: N
- [other buckets with counts > 0]

Open improvement proposals: N
Ratified this week: N
Reverted this week: N
```

## Improvement Proposal

See skills/improvement-proposal/SKILL.md for the full template and procedure.

## Project Description

```
# [Project Name]

## Purpose
[One paragraph. Why this project exists.]

## Scope
[What work belongs here. What does not.]

## Success metric
[How you know this project is working.]

## Owner
Otto (principal operator)

## Labels
[area:X tags that live under this project]
```

## Escalation (SCQA)

```
Situation:    [the stable context, one line]
Complication: [what changed or broke, one line]
Question:     [the decision you need, one line]
Answer:       [your recommended call, one line]
```

## Citizens Pilot Watch

```
# Citizens Pilot Watch · YYYY-MM-DD

Blocked issues (>24h): [list or "none"]
Buyer funding errors: [list or "none"]
Pending comms awaiting approval: [list or "none"]
Review Record gaps: [list or "none"]
Feedback/requests received: [list or "none"]

Status: clear / needs attention
```

## History

Created 2026-06-19. Templates enforce consistency without requiring Otto to reinvent formats each time. Every template should be short enough to fill in under 60 seconds.
