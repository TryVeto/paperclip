# Skill: Operating Ratchet

## When to use

When a failure pattern recurs (3+ instances in 14 days in the same taxonomy bucket), when a high-severity failure occurs (customer impact, security, claims boundary), during the Weekly Standards Review, or during the nightly operating ratchet cycle.

## Job

Turn experience into mechanisms. Not memory. Not intentions. Mechanisms that make the failure harder to repeat.

## Inputs required

- Classified failure events from the failure taxonomy (see curation.md)
- Evidence: issue IDs, dates, receipts, session transcripts
- The current skill/routine/workflow/tool that should have caught it

## Procedure

1. Pull recent failures from the taxonomy
2. Identify the top recurring pattern (or the highest-severity single event)
3. Diagnose root cause — system gap, not agent laziness
4. Write one Improvement Proposal (see skills/improvement-proposal/SKILL.md)
5. Write or reference eval cases that would catch the failure
6. Classify as two-way door (auto-apply) or one-way door (Sebastian approval)
7. If two-way: implement, run evals, post receipt
8. If one-way: stage, notify Sebastian, wait
9. After install: monitor for 7 days — did it help? Did it create drag?
10. If it creates ceremony without catching real problems, revert or weaken

## Output

```
# Operating Ratchet · YYYY-MM-DD

## Top pattern
Failure bucket: [taxonomy name]
Instances (14d): N
Severity: [low / medium / high / critical]

## Root cause
[Why this keeps happening — one paragraph]

## Proposed mechanism
[The specific change — name the file, the gate, the check]
Target: [skills/X/SKILL.md | workflows.md | routines.md | tools.md]

## Eval cases
1. [input → expected behavior]
2. [input → expected behavior]

## Door classification
[Two-way: auto-apply with receipt | One-way: needs Sebastian]

## Risk
[What this could break or slow down]

## Rollback
[How to revert if it creates drag]

## Status
[proposed / implemented / monitoring / ratified / reverted]
```

## Constraints

- **One improvement per ratchet cycle.** No giant self-rewrites.
- **Most improvements land in skills or checklists.** Constitutional changes are rare.
- **No eval case, no promotion.** If you cannot test it, you cannot prove it works.
- **Monitor before ratifying.** 7 days of evidence that it helps without creating drag.

## Stop if

- The pattern has fewer than 3 instances (unless high-severity)
- The proposed fix targets soul.md or standards.md when a skill change would suffice
- The fix is "be more careful" (that is an intention, not a mechanism)

## Eval cases

- Given 3 instances of stale_source_truth, the ratchet proposes a Source-of-Truth Gate, not a memory note
- Given 1 instance of a low-severity failure, the ratchet logs it but does not propose a mechanism
- Given a proposed mechanism with no eval cases, the ratchet rejects it as incomplete

## Metadata

```
context: self-improvement, failure response
last_validated: 2026-06-19
freshness: validate monthly
owner: otto
```
