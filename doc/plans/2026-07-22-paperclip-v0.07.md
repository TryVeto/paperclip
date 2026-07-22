# Paperclip v0.07 — Enforced Version Contract

| Field | Contract |
|---|---|
| Status | Ready for Cursor implementation |
| Version | `v0.07` |
| Product base | shipped v0.06 source `9cad4cb71670c00191e52ab44e877156dfaf2118` |
| Specification owner | Codex |
| Implementation owner | Cursor |
| Canonical v0.07 spec | This file, at its Codex-authored git blob |
| Canonical v0.08+ spec | The version root issue's single `plan` document |
| Release order | One active version; the next version opens only after exact-SHA ship closure |

## 1. Outcome

Paperclip must make this operating rule true by construction:

> Codex writes one canonical specification for a version. Cursor writes every source, test, migration, and code-adjacent implementation change. That exact version is verified and shipped before the next version can begin.

The rule is enforced at database, document, assignment, runtime-dispatch, workspace, and ship boundaries. Prompts may explain the rule but are never an enforcement mechanism.

Success means a user cannot accidentally create two active versions, Cursor cannot change the accepted spec, Codex cannot change source, an adapter-router override cannot swap the two lanes, and Paperclip cannot call a version shipped unless the verified commit is the commit actually running.

## 2. Non-goals

v0.07 does not:

- choose models or change Thinking-fast/Thinking-slow model policy;
- redesign issues, documents, confirmations, decomposition, or workspaces;
- merge local `master` or unrelated upstream work into the v0.07 base;
- change v0.06 fast-decision behavior except for a separately proven compatibility fix required to migrate safely;
- create a second spec editor, spec repository, or workflow engine;
- treat post-ship monitoring as permission to rewrite a closed release record.

## 3. The version capsule

Add one `project_version_contracts` record around Paperclip's existing primitives. Issue documents remain the content store, accepted-plan decomposition remains the implementation manifest, and execution workspaces remain the source-isolation mechanism.

The record contains:

- company, project, version key, predecessor version, and root issue;
- product base SHA, implementation base SHA, and project source workspace;
- specification owner and canonical spec reference;
- accepted spec revision and confirmation for document-backed specs;
- accepted decomposition and fingerprint;
- verified candidate SHA and locked verification receipt;
- observed deployed SHA and locked ship receipt;
- block reason, timestamps, and `shipped_at`.

For v0.07 only, the canonical spec reference is a repository path plus the Codex spec commit and git blob hash; its implementation base is that spec commit, whose first parent must be the product base. For v0.08 onward, the canonical spec is injected from the root issue's stable `plan` document, so implementation base equals product base. Exactly one of those reference shapes is valid.

The database must enforce:

- unique `(company_id, project_id, version_key)`;
- unique `root_issue_id`;
- one active version per project with a partial unique index on `(company_id, project_id) WHERE shipped_at IS NULL`;
- lowercase 40-hex source SHAs;
- a shipped row has accepted spec, decomposition, verification receipt, candidate SHA, deployed SHA, ship receipt, and timestamp;
- `candidate_source_sha = deployed_source_sha` on a shipped row.

Display state is derived from evidence instead of maintained as a second source of truth:

| Evidence | Display state |
|---|---|
| No accepted spec | Specifying |
| Accepted spec, no verification receipt | Implementing |
| Verification receipt, no `shipped_at` | Ship ready |
| `shipped_at` present | Shipped |
| Active block reason present | Blocked, without releasing the version lock |

## 4. Open one version

Opening a version is one transaction. It creates or adopts one pristine root issue, binds the version capsule, assigns the bound specification owner, and activates the issue.

The operation rejects:

- any project with a row where `shipped_at IS NULL`;
- a version whose predecessor lacks an exact-SHA ship receipt;
- a dirty or mismatched product base workspace;
- a root issue with prior children, documents, assignment, or execution;
- an author whose resolved executor is not Codex.

Retries with the same idempotency key return the same version. Conflicting retries return `409 active_version_exists` or `409 version_identity_conflict` without partial issue activation.

Cancellation, backlog moves, issue completion, blocks, failed deployment, and binary rollback do not release the next version. The current version is repaired, its same spec is reopened, or it remains blocked.

## 5. Codex specification lane

For v0.08 onward, the only canonical specification is the root issue document at stable key `plan`. It may have revisions while specifying, but it never forks into `plan-2` or another normative document.

Before launch, Paperclip resolves the effective executor, including through `veto_runtime_router`. A specification run must resolve to `codex_local`. After every ordinary agent, issue, model-profile, and router override has been merged, the server applies these non-overridable capabilities last:

- source checkout mounted read-only;
- Codex CLI sandbox forced to `read-only`;
- approval/sandbox bypass flags rejected;
- disposable `spec_snapshot` that cannot be finalized, committed, or merged;
- canonical `plan` document is the only writable output channel.

Document authorization permits a spec revision only when the actor is the bound Codex author, the run is the active root-issue run, the version is still specifying, and the update uses the current base revision. Cursor, another Codex agent, board edits, generic restore, unlock, delete, and locked-document redirection are denied for the canonical key.

The board accepts one exact revision through the existing confirmation flow. Acceptance and document locking occur in the same transaction. The accepted revision is injected into every implementation run as immutable context.

If implementation proves the spec defective, the board may reopen the same version and same document. Reopening invalidates current decomposition and verification bindings, preserves their history, and requires a new accepted revision. It does not create another active version or another canonical spec.

## 6. Cursor implementation lane

Accepted-plan decomposition is the only path that creates source-producing descendants beneath a version root. Before inserting the first child, Paperclip validates the complete child set and binds its existing deterministic fingerprint to the accepted spec revision.

Every implementation, test, migration, integration, verification, and code-adjacent documentation task must resolve—after router delegation—to `cursor` or `cursor_cloud`. Cursor `plan` and `ask` modes are not valid implementation executors. Assignment drift is checked again immediately before every dispatch.

Cursor receives isolated execution workspaces rooted at the capsule's exact implementation base. For v0.07 that is the Codex spec commit; for later versions it is the prior exact shipped SHA, with the accepted document injected as immutable context. Independent children may run concurrently. A single integration child is blocked by all source-producing children and produces the candidate commit. The candidate lineage may contain only:

1. the Codex-authored v0.07 spec commit during bootstrap; and
2. commits finalized from Cursor-managed implementation workspaces.

Generic child creation beneath the version root, reassignment to Codex, untracked outside commits, a changed canonical spec blob/revision, and silent merges from another branch all fail the version gate.

Cursor may write source, tests, migrations, generated files, and code-adjacent operational documentation. Cursor may not write or revise the canonical version spec. Codex may inspect source while specifying but may not produce a source commit.

## 7. Verification receipt

Cursor runs the checks required by the accepted specification and submits their structured results. Paperclip—not Cursor—constructs and locks the authoritative verification receipt from persisted facts.

The receipt records:

- version and product base SHA;
- canonical spec reference and accepted revision/blob;
- decomposition ID and fingerprint;
- every implementation issue, resolved executor, finalized workspace, and produced commit;
- candidate source SHA and ancestry proof;
- each required command/check, result, timestamp, and artifact reference;
- named failed predicates, if any.

Verification succeeds only if all descendants are done, every source-producing run resolved to Cursor, every workspace finalized, the candidate descends from the permitted base/spec commit, the canonical spec is unchanged, and every required check passed. A failed predicate leaves the same version active and produces no ship-ready receipt.

## 8. Exact-SHA ship closure

The board never supplies `observedLiveSha` as a trusted value.

Outside the application process, the build step requires a clean tree, derives the candidate SHA from `git rev-parse HEAD`, and writes a read-only manifest into the release artifact containing that SHA, product base SHA, canonical spec reference/hash, and build timestamp. The running Paperclip server reads that bundled manifest at startup and exposes it to the version service as a server-side deployment attestation. Runtime environment variables and request bodies may identify evidence, but cannot override attested fields.

`closeShip` reconstructs the gate under a project-scoped transaction lock and requires:

```text
accepted canonical spec == decomposition spec
decomposition candidate == verification candidate
verification candidate == running build manifest SHA
running build manifest SHA == ship receipt deployed SHA
canonical spec is unchanged and locked
all implementation descendants are done with Cursor provenance
all required verification predicates passed
```

Paperclip generates and locks the ship receipt from that snapshot, writes `deployed_source_sha`, and sets `shipped_at` atomically. The same close request is idempotent; any conflicting receipt or SHA is rejected. Only this transaction releases the database uniqueness gate so the next version can open.

Post-ship observations append to the release history. They cannot alter the closed spec, candidate, deployed SHA, or receipts.

## 9. v0.07 bootstrap

v0.06 cannot retroactively enforce v0.07, so this version has one explicit bootstrap exception:

1. Codex authors only this canonical file on branch `veto/paperclip-v0.07`, based on exact live v0.06 SHA `9cad4cb71670c00191e52ab44e877156dfaf2118`.
2. The handoff records the Codex spec commit, file path, and blob hash. Cursor starts from that exact commit and does not edit the file.
3. Cursor implements v0.07 in Cursor-managed workspaces. The pre-ship check proves the canonical blob still equals the handoff blob and the candidate descends from the v0.06 base through the spec commit without an unrelated merge.
4. Cursor produces one candidate and a locked bootstrap evidence document using existing Paperclip document primitives. It is input evidence, not the authoritative verification receipt.
5. Deploy that exact candidate with its immutable build manifest.
6. The deployed v0.07 binary exposes one board-only, idempotent `adopt-bootstrap` operation. It works only when no version capsule exists; only for `v0.07`; only for the fixed v0.06 base; only when the running manifest, candidate, spec blob, and bootstrap evidence agree. The server reconstructs the facts, generates the authoritative locked verification receipt, and creates the v0.07 capsule in ship-ready form.
7. The board closes v0.07 through the normal exact-SHA gate. v0.08 is the first version opened and enforced end-to-end by the new capsule.

`adopt-bootstrap` self-disables after the first capsule exists. It is not a general import or bypass endpoint.

## 10. Service boundaries

Implement one version-contract service plus pure policy functions. Existing services call it; they do not copy its rules.

| Boundary | Required enforcement |
|---|---|
| Version open | predecessor, one-active-version, pristine root, base SHA, spec owner |
| Document mutation | canonical author, active run, current revision, lock/restore/delete denial |
| Assignment/decomposition | accepted revision, Cursor-only full child set, idempotent fingerprint |
| Runtime dispatch | validate router-resolved executor; apply immutable lane capabilities last |
| Workspace realization | disposable read-only spec snapshot or isolated Cursor workspace at exact base |
| Workspace finalization | executor provenance and produced commit |
| Verification | reconstruct facts; server-generate locked receipt and named failures |
| Ship close | running build attestation, exact SHA equality, atomic receipt and `shipped_at` |

The UI change is deliberately small: show the active version, canonical spec link, derived state, candidate/deployed SHA, receipt links, and named blocking predicates in existing project and issue views. Do not add another spec editor.

## 11. Acceptance tests

1. Two concurrent version-open requests yield one active capsule and one deterministic conflict.
2. A next version cannot open while the current version is specifying, implementing, blocked, ship-ready, failed to deploy, or rolled back.
3. A next version opens only after `shipped_at` and exact-SHA receipts exist.
4. A router-backed spec run resolving to Codex receives a disposable read-only snapshot; source write, commit, finalize, and merge attempts fail with unchanged HEAD/status.
5. A router-backed spec run resolving to Cursor fails before launch even if its outer adapter is `veto_runtime_router`.
6. Only the bound Codex run can revise the canonical `plan`; Cursor, board PUT, restore, unlock, delete, and another Codex agent fail without creating a derived plan.
7. Acceptance binds and locks one exact revision atomically. Decomposition against any other revision fails.
8. Decomposition rejects the entire child set before insert if any assignee resolves outside Cursor or uses a non-implementation mode. Identical retry returns identical child IDs.
9. Adapter/delegate drift after assignment fails at dispatch.
10. Concurrent Cursor children receive separate workspaces at the exact implementation base; integration cannot run before all blockers finalize.
11. Candidate verification fails for an outside commit, changed spec, unrelated merge, incomplete child, non-Cursor provenance, failed workspace, malformed SHA, or failed required check.
12. Verification and ship receipts are generated from server-side facts, locked, and idempotent; conflicting retries fail.
13. Ship closure rejects every one-character mismatch among candidate, verification, running manifest, and receipt SHAs.
14. A request-supplied deployed SHA cannot override the running build attestation.
15. The v0.07 bootstrap pins base `9cad4cb71670c00191e52ab44e877156dfaf2118`, preserves this file's exact blob, rejects local `master`, adopts once, and then self-disables.
16. Existing non-version planning issues, ordinary locked-document behavior, accepted-plan decomposition, adapters, and workspaces retain current behavior.
17. Migration tests prove the one-active partial unique index under concurrency and reject duplicate migration registration on the target branch.
18. A binary rollback preserves capsules and receipts and cannot silently resume agents without the version enforcement described below.

## 12. Migration and rollback

The migration is additive. It creates the capsule table, constraints, indexes, API/shared types, and no destructive backfill. Cursor must select a migration identifier that is unique on the exact target branch and run the repository's migration journal consistency checks.

A runtime flag may freeze new version opens. It may not disable enforcement for an already-active capsule.

Before reverting a v0.07 binary to v0.06, pause the bound Codex/Cursor agents and freeze version-project issue mutation. Preserve the capsule table, documents, activities, and receipts. Agents remain paused until v0.07 enforcement is restored or a correcting version is shipped. A production rollback is appended to history and never rewrites the original ship SHA.

## 13. Ship gate

v0.07 is complete only when all of the following are true:

- this canonical spec blob is unchanged;
- implementation and verification provenance contain Cursor only;
- unit, integration, migration, router-resolution, workspace-isolation, and exact-SHA acceptance tests pass;
- ordinary non-version workflows pass regression tests;
- one candidate SHA is recorded in a server-generated verification receipt;
- the deployed server's build manifest reports that same SHA;
- `adopt-bootstrap` succeeds once and is then unavailable;
- the normal server-generated ship receipt closes v0.07;
- a dry-run attempt to open v0.08 succeeds only after that closure.

## 14. Cursor handoff

Cursor owns every implementation change for this version. It must start from the Codex spec commit, preserve this file byte-for-byte, implement the smallest coherent version capsule around existing primitives, and return one candidate SHA plus the verification evidence required above. No implementation by Codex and no second v0.07 spec are permitted.
