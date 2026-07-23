# Paperclip v0.07 — Overnight checkpoint source fixes (2026-07-23)

| Field | Value |
|---|---|
| Status | **Source fixes shipped; live v0.07 still NOT safely closed; v0.08 remains blocked** |
| Audit honored | Overnight Checkpoint 2026-07-22 22:30 PDT — FAIL |
| Worktree | `/home/sebastianheyneman_tryveto_com/work/paperclip-v0.07` |
| Prior source HEAD | `61b577b201b50769dd74eec917fb14e68a9d4f26` |
| Installed live (unchanged) | `48b95694828bf85486d8f853cafb5d7c9b196fcd` |
| Spec blob (unchanged) | `c9a2782c8e42c99d46729f54d4bc74bbe511a4e0` |
| Product base (pinned; not fetchable in this shallow clone) | `9cad4cb71670c00191e52ab44e877156dfaf2118` |

## P0 implemented in source

1. **Exact Git provenance** — `server/src/services/git-provenance.ts` inspects shallow/grafted repos and refuses surrogate blob-only “proof.” Documented as a live blocker while this clone remains shallow.
2. **Source HEAD ≠ installed release** — `sourceHeadEqualsInstalledIsInsufficient` + closeShip refuse hex-only equivalence without installed-runtime digest verification.
3. **Attestation binds installed runtime bytes** — `build-manifest.ts` requires `installedRuntimeDigests` and verifies `node_modules/@paperclipai/{shared,db,server}` trees. `closeShip` / `assertReleaseAttestationReadyForClose` fail closed (no warn-and-continue). Packaging writes digests via `PAPERCLIP_INSTALLED_RELEASE_ROOT`.
4. **Closed records immutable** — `voidShip` throws `shipped_record_immutable`; test flipped to document prohibited reopen.
5. **Lane isolation enforced** — removed `model.includes("sol")` Codex heuristic; `assertLaneMutationAllowed` + heartbeat sandbox/finalize-repair hard gates.

## P1 shipped in this change

6. **Bootstrap empty-cert refused** — requires implementation fact keys in evidence body + non-empty Cursor descendant provenance.
9. **Traffic classification** — agent `on_demand` no longer auto-stamped `natural`; requires explicit trusted boundary stamp.

## Still blocked for live closeout (not done here)

- Exact Git provenance on this host: shallow clone; product base + canonical spec commit not resolvable from origin shallow history.
- Source HEAD (`61b577b…` + this fix commit) ≠ installed live (`48b9569…`).
- Live install cutover / service restart / DB mutation of shipped capsules — **out of scope; one-way doors**.
- Migration journal↔ledger identity / nested migration trees on live.
- Document/version gate atomicity in issues routes (P1 #7) — not fully rewritten in this pass.
- `/api/health` still must not be treated as closure proof.

## Explicit non-actions taken

- Did **not** void/rewrite live closed release records.
- Did **not** restart production Paperclip or flip the release symlink.
- Did **not** open or unlock v0.08.
- Did **not** touch buyer-flow worktrees.


## Published artifacts

| Item | Value |
|---|---|
| Local lineage commit (on `veto/paperclip-v0.07-overnight-closeout`) | `33d78988c6f15e7eddf24b5f378964e02184aad0` |
| Published orphan snapshot (TryVeto/paperclip-v0.07-closeout `main`) | `4ffd3602535bcbf1811ffdfc15456b08c32576e2` |
| Repo URL | https://github.com/TryVeto/paperclip-v0.07-closeout |
| Unit tests | 28/28 pass (`version-contract-service`, `section2-corrective`, `git-provenance-closeout`) |

Push note: OAuth token lacks `workflow` scope, so publish is an orphan tree without `.github/workflows`. Full lineage remains locally on `veto/paperclip-v0.07-overnight-closeout` (parent `61b577b…`).
