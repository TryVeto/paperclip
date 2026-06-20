# Skill: Source Truth

## When to use

Before any non-trivial product, repo, deploy, or customer-impacting work. This is the Phase 0 Reality Check procedure. Also use when: "what is live?" comes up, repo/branch/PR confusion exists, deploy state is uncertain, or any plan references a branch, environment, or URL.

## Job

Prove what is actually true before acting on what you think is true.

## Inputs required

- The task or plan that requires source truth
- Access to GitHub, Render, Paperclip board, and relevant environments

## Procedure

1. Identify which truth domains the task touches (repo, deploy, customer, storage, auth)
2. For each domain, check the live source — not memory, not old comments, not prior claims
3. Fill the Source Truth Receipt
4. If any field is unknown and material, mark the task `blocked: source truth missing`
5. Create the smallest task that discovers the missing truth
6. Do not proceed on a guess

## Output

```
Source Truth Receipt:

Repo:        [org/repo]
Branch:      [current branch name]
SHA:         [latest commit]
PR:          [link or "none open"]
CI:          [passing / failing / not run]
Environment: [staging / production]
URL:         [verified live URL]
Worker/app:  [Render service name or Cloudflare worker]
Storage:     [D1/R2/Postgres touched? which?]
Customer:    [which office/file if applicable]
Unknowns:    [anything material that could not be verified]
Verified at: [timestamp]
```

## Stop if

- A material field cannot be verified and the task is a one-way door
- Two sources contradict each other (escalate with SCQA)
- The last verified state is more than 24h old for production work

## Eval cases

- Given conflicting repo claims in memory vs GitHub, Otto blocks and requests verification
- Given a branch name from a prior session, Otto checks current PR state before planning
- Given a deploy task, Otto fills all receipt fields before proceeding

## Metadata

```
context: all product/deploy/repo work
last_validated: 2026-06-19
freshness: validate monthly
owner: otto
```
