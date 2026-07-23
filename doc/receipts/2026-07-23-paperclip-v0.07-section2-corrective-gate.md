# Paperclip v0.07 — Section 2 corrective gate (2026-07-23)

Status: **Section 2 corrective candidate closed on live `b314bcf41…`. v0.08 remains LOCKED.**

- Capsule: `92a08833-2c9e-4860-93ef-70c1d30f944e` (Product)
- Spec blob (unchanged): `c9a2782c8e42c99d46729f54d4bc74bbe511a4e0`
- Product base pin (object still Mac-only here): `9cad4cb71670c00191e52ab44e877156dfaf2118`
- Spec commit pin (object still Mac-only here): `11f920182fdf908e2476c144505b1e659427015d`
- Live / candidate / deployed / ship receipt: `b314bcf41d46d3207cc609606452b0845a4abf4a`
- Release digest: `b19da670dcf6649b7730fc74205352c081dc012c54b4d02a9893443aa0c6f613`
- Shipped at: `2026-07-23T15:06:34.219Z`
- Branch: `tryveto/veto/paperclip-v0.07-overnight-closeout`
- Cursor descendant for SPEC-4: VET-595 (`14a081af-…`) done → Thinking-zero

## Live symlink before change

Reverified at start of this turn: live was already `ba7dc9e4…`, then a concurrent cutover advanced it to `31f74ee…`. This turn packaged + cut over to `b314bcf41…` (archive-supersede void + re-verify + ship). Did not open v0.08.

## Section 2 predicates

1. Clean source → installed package/app bytes (not extract-over-`9cad4cb…-r2`): **PASS** — `RELEASE_PROVENANCE.method=fresh_npm_install_paperclipai_plus_head_package_tarballs`; note forbids prior-release copy / surgical patch.
2. Manifest binds Git-resolvable candidate SHA + package/runtime digests; process verifies installed release digest; candidate/deployed/running/ship agree: **PASS** (candidate `b314bcf41…` on `tryveto` branch tip; `digestVerify.ok=true` / `installedRuntimeOk=true` at startup; capsule agreement proven). Residual: Mac-only product-base/spec-commit *objects* still absent on this host (pins present in manifest; not the running candidate SHA).
3. No post-package patching of node_modules/release/app: **PASS** — provenance note + immutable `build-manifest.json` (`chattr +i`); cutover was full release tree install, not live surgical overlay.
4. Version/document/assignment/runtime/workspace/verification/ship enforcement wired through server+UI: **PASS** — live board `void-ship` / `verification` / `ship` exercised on this build; casual void rejected; forged caller SHAs ignored.
5. Verification/ship receipts from persisted server facts: **PASS** — forged `candidateSourceSha=aaa…` and `observedLiveSha=bbb…` ignored; receipt candidate/deployed = attestation `b314bcf41…`.
6. Migration journal append-only vs live ledger; restart/rollback/replay: **PASS** — source↔live `_journal.json` byte-equal (185 entries); nested `migrations/migrations` absent; `migration-replay.test.ts` 1/1 pass; service restart after cutover healthy. Explicit rollback drill not re-run this turn (prior production-shaped identity proof retained).
7. Thinking-slow source view read-only; approval/sandbox bypass rejected: **PASS** — `filesystemScope=workspace`, `dangerouslyBypassApprovalsAndSandbox=false`.
8. Runs persist trustworthy `traffic_class` / `actionable` / `actionability_reason` / request-receipt timing: **PASS** — columns present; distribution includes fail-closed system + trusted_board_user_session natural; not title-inferred.
9. Normal v0.07 ship close succeeds: **PASS** — `shipped_at=2026-07-23T15:06:34.219Z`, display `shipped`.

## Archive supersede (not a light void)

Prior closed ship `48b9569…` archived into `receipt_history` via `section2_corrective_supersede:…` reason. Casual void still returns `shipped_record_immutable`.

## Explicit non-actions

- Did **not** open or unlock v0.08.
- Did **not** implement Inkbox Desktop three front doors.
- Did **not** permanently delete quarantined apps.
