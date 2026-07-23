# Paperclip v0.07 — Safe-close publish step (2026-07-23)

| Field | Value |
|---|---|
| Status | **Partial — durable objects published; GitHub branch push still gated; v0.08 blocked; live not cut over** |
| Source HEAD | `14347071a5134a2fadc3bb1ec78bde0ab54b5f55` (+ follow-on closeout commits on this branch) |
| Live install (unchanged) | `48b95694828bf85486d8f853cafb5d7c9b196fcd` |
| Spec blob (unchanged) | `c9a2782c8e42c99d46729f54d4bc74bbe511a4e0` |

## SPEC-2 evidence

| Hypothesis | Verdict | Evidence |
|---|---|---|
| A. OAuth lacks `workflow` → `git push` of full lineage rejected | **CONFIRMED** | `refusing to allow an OAuth App to create or update workflow … without workflow scope` (scopes: `gist,read:org,repo`) |
| B. Mac pins `9cad4cb` / `11f92018` absent on host | **CONFIRMED** | `git cat-file` miss; local Codex-shaped commit is `c0c50b4ea` (blob match; parent `4e8cd757`, not product base) |
| C. Git bundle makes `48b9569` + overnight HEAD resolvable off worktree | **CONFIRMED** | Bundle clone `cat-file -t` → `commit` for both |
| D. GitHub branch ref for overnight lineage | **BLOCKED** | Objects fetchable by SHA after rejected push; `POST …/git/refs` → 404 for those SHAs (workflow-scope gate). Orphan `main` republished without workflows. |
| E. Clone depth | **REJECTED as blocker** | Worktree now `shallow=false` (3223 commits); Mac pins still missing |

## Durable publish artifacts

| Artifact | Value |
|---|---|
| Git bundle URL | https://veto-mainline.tail2fd504.ts.net:10000/paperclip-v0.07-git-bundle/paperclip-v0.07-overnight-closeout-14347071.bundle |
| Bundle SHA-256 | `e5411b4c8a19afdcfed7241229d46047e8c9c2814372c0ab86b13fc69a4f8501` |
| Orphan snapshot (TryVeto/paperclip-v0.07-closeout `main`) | `c748e91d0b6cc011b284f5ceca5be60731e69977` |
| Note | Orphan commit SHA ≠ lineage SHAs. Bundle preserves real `48b9569…` / `14347071…`. |

## Still required for GitHub branch resolvability

Sebastian: grant the publishing token **`workflow` scope** (or push
`veto/paperclip-v0.07-overnight-closeout` from a credential that has it), then
re-run:

```sh
git push tryveto HEAD:refs/heads/veto/paperclip-v0.07-overnight-closeout
```

Also: publish Mac objects `9cad4cb…` and `11f92018…` (or formally accept
host reconstruction `c0c50b4ea` + blob pin as the durable spec commit).

## Explicit non-actions

- Did not cut over live install / restart Paperclip.
- Did not open v0.08.
- Did not void or rewrite the live shipped capsule.
