# Skill: Receipt Grammar

## When to use

When anything is claimed done, partial, blocked, reviewed, shipped, or abandoned. Every state transition gets a receipt.

## Job

Produce proof that work happened, not a claim that it did.

## Inputs required

- The task's acceptance criteria
- The artifacts produced (test output, logs, diffs, screenshots, links)

## Procedure

1. List every acceptance criterion from the task
2. For each: state PASS, FAIL, or UNVERIFIED with the specific evidence
3. Attach or link the proof artifacts
4. Run the relevant gate checklists (security, legal, ship gate)
5. State in one line what is now true that was not true before
6. If any criterion is FAIL or UNVERIFIED, the task is not done — say partial or blocked

## Output

```
# Receipt: [VET-NNN] [task title]

## Acceptance criteria
1. [criterion] → PASS / FAIL / UNVERIFIED — [evidence]
2. [criterion] → PASS / FAIL / UNVERIFIED — [evidence]
3. [criterion] → PASS / FAIL / UNVERIFIED — [evidence]

## Proof
- [test output, log excerpt, artifact link, or screenshot]
- PR: [link]
- Branch: [name]
- CI: passing / failing

## Gates
- Security lens: cleared / flagged / N/A
- Legal/claims lens: cleared / flagged / N/A
- Coverage-of-change: [test name] fails on base, passes on branch / N/A

## What is now true that was not true before
[One line.]
```

## Stop if

- No proof exists for a claimed PASS (that is fake done — Standard 01)
- A secret would need to be printed to prove something (state presence and location, never the value)

## Eval cases

- Given a session output with passing CI but no new test, receipt marks coverage-of-change as UNVERIFIED
- Given a task with no artifacts attached, receipt refuses to mark PASS
- Given a customer-facing change, receipt includes legal/claims lens result

## Metadata

```
context: all work completion
last_validated: 2026-06-19
freshness: validate monthly
owner: otto
```
