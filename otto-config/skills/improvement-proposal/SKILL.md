# Skill: Improvement Proposal

## When to use

When a failure pattern recurs (3+ instances), when a high-severity failure occurs once (customer impact, security, claims boundary), or when the Weekly Standards Review or Operating Ratchet identifies a systemic issue.

## Prerequisites

- The failure has been observed and logged as an experience_event
- The failure has been classified using the failure taxonomy (see curation.md)
- At least one concrete example exists with receipts or evidence

## Procedure

1. Create a Paperclip issue under the Operating System project (or meta label)
2. Use the template below
3. Write or reference eval cases that would catch the failure
4. Classify as two-way door (auto-apply with receipt) or one-way door (Sebastian approval)
5. If two-way: implement, run evals, post receipt
6. If one-way: stage proposal, wait for ratification

## Proposal template

```yaml
title: [short, specific — name the mechanism, not the symptom]
failure_pattern: [which taxonomy bucket]
examples:
  - [issue ID, date, what happened]
  - [issue ID, date, what happened]
  - [issue ID, date, what happened]
root_cause: [why this keeps happening — system gap, not agent laziness]
proposed_mechanism: [the specific skill/routine/workflow/tool/eval change]
target_file_or_surface: [which file or Paperclip object changes]
eval_cases_required:
  - [test case 1: input → expected behavior]
  - [test case 2: input → expected behavior]
expected_behavior_change: [what is now harder to do wrong]
risk: [what could this break or slow down]
rollback: [how to revert if it creates drag]
needs_sebastian_approval: [true/false — true for any one-way door]
```

## What makes a good proposal

- Names a mechanism, not a wish. Bad: "Otto should be more careful about repos." Good: "Add Source-of-Truth Gate before deploy/merge/customer-impacting work."
- Includes eval cases. If you cannot write a test that would catch the failure, the proposal is too vague.
- Includes rollback. If the mechanism creates drag without catching real problems, it should be revertible.
- Targets the smallest surface. Most improvements should be skills or checklists, not constitutional changes.

## What makes a bad proposal

- Based on a single anecdote (hold the line at 3 unless severity is high)
- Targets soul.md or standards.md when a skill or workflow change would suffice
- "Be more careful" — that is an intention, not a mechanism
- No eval cases — if you cannot test it, you cannot prove it works

## Acceptance criteria

- Proposal issue created with all template fields filled
- Eval cases written or referenced
- Door classification is explicit
- If two-way: implemented, tested, receipt posted
- If one-way: staged, waiting, Sebastian notified

## Failure modes

- Over-proposing: creating proposals for every minor issue. Guard: 3x threshold for non-critical failures.
- Under-specifying: vague mechanisms that cannot be tested. Guard: eval cases are required.
- Constitutional creep: too many proposals target soul.md/standards.md. Guard: most improvements should land in skills, routines, or workflows.
- Stale proposals: proposals that sit unratified forever. Guard: review open proposals in the Weekly Standards Review.

## History

Created 2026-06-19. Prompted by the need for a structured improvement pipeline that prevents both under-systematization (failures repeat) and over-systematization (everything becomes a rule).
