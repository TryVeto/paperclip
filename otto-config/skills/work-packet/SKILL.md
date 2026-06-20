# Skill: Work Packet

## When to use

When Otto wants to assign work to a session, Cursor, Claude Code, Codex, or any execution lane. No packet, no spawned session.

## Job

Turn a vague ticket into an executable, bounded, reviewable unit of work.

## Inputs required

- An issue or direction from Sebastian
- Repo and branch context (invoke source-truth first)

## Procedure

1. Run source-truth to verify repo/branch/deploy state
2. Write the objective as one concrete paragraph
3. Define numbered acceptance criteria (testable, not aspirational)
4. List allowed and forbidden paths explicitly
5. Define checks (test commands, smoke tests)
6. Confirm no one-way-door actions are in scope (if yes, split them out)
7. Confirm no live customer data is touched without gates
8. Post the packet as an issue document

## Output

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
  1. [testable criterion]
  2. [testable criterion]
  3. [testable criterion]
checks:
  - pnpm test
  - pnpm typecheck
  - [targeted smoke if available]
one_way_doors: none / [list any that need to be split out]
receipt_required: true
expires_after: task_complete
```

## Stop if

- Source truth cannot be verified for the target repo
- The objective requires a one-way door action (split it out, stage separately)
- The task is too vague to write acceptance criteria ("fix buyer flow" needs decomposition first)

## Eval cases

- Given "fix the buyer flow," Otto decomposes into specific packets with ACs, not one vague session
- Given a packet with forbidden paths, the session respects the boundary
- Given a packet with no checks defined, Otto adds at least `pnpm test` and `pnpm typecheck`

## Metadata

```
context: session spawning, task delegation
last_validated: 2026-06-19
freshness: validate monthly
owner: otto
```
