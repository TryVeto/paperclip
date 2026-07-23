# Paperclip v0.07 — Codex P0 closeout (2026-07-23)

| Field | Value |
|---|---|
| Status | **PARTIAL — SPEC-1 FIXED, SPEC-2 PARTIAL (Mac pins residual), SPEC-3 FIXED forward + historical archived. v0.08 LOCKED. Not a safe close.** |
| Live | `b314bcf41d46d3207cc609606452b0845a4abf4a` |
| Source HEAD (at proof) | `77b8fe1d4fbad1d05bc58848c93cbe4785566ab6` |
| Capsule | `92a08833-2c9e-4860-93ef-70c1d30f944e` (`v0.07`) |
| Spec blob (unchanged) | `c9a2782c8e42c99d46729f54d4bc74bbe511a4e0` |
| Audit script | `scripts/audit-v007-live-safe.mjs` → exit 2 (Mac-pin P0s only) |

## P0 status table

| ID | Verdict | Evidence | What's left |
|---|---|---|---|
| **SPEC-1** | **FIXED** | Live journal↔source `_journal.json` byte-equal (185 entries, includes `0186_run_traffic_classification`); `0186` SQL bytes equal source↔live; nested `migrations/migrations` absent; DB has `heartbeat_runs` / `run_classification_tokens` `{traffic_class,actionable,actionability_reason}`; journalctl since `b314` cutover (`2026-07-23 08:03`): **0** `missing column`, **0** paused-wake spam. Health remains non-authoritative. | None for this P0. |
| **SPEC-2** | **PARTIAL** | Live candidate `b314bcf41…` resolves on `TryVeto/paperclip` commits API; overnight branch tip on tryveto; closeout lineage SHAs also on tryveto (`3c50854…`, `f852853…`, `48b9569…`, `b314bcf41…`). Manifest pins Mac SHAs correctly; host reconstruction `c0c50b4ea…` blob-matches canonical spec. | **NEEDS_SEBASTIAN (Mac):** objects `9cad4cb71670c00191e52ab44e877156dfaf2118` and `11f920182fdf908e2476c144505b1e659427015d` absent on this host and on tryveto (GitHub 422). Do **not** rewrite pins to `c0c50b4ea`. |
| **SPEC-3** | **FIXED** (forward) + **documented** (history) | Casual `void-ship` → HTTP **409** `shipped_record_immutable`; row unchanged (`shipped_at=2026-07-23T15:06:34.219Z`, `deployed_source_sha=b314bcf41…`, `hist_len=3`). Prior rewrites archived in `receipt_history` (not deleted): `3c50854` → `f852853` → `48b9569` → current `b314bcf41` via `section2_corrective_supersede:…`. Did **not** corrective-supersede again this wake. | Historical mutation already happened; residual is provenance honesty, not a live mutability hole. |

## Fresh live-safe audit summary

All non-Mac checks **PASS**. Residual `p0Fail`: `EXACT_GIT_PRODUCT_BASE`, `EXACT_GIT_SPEC_COMMIT` only. Verdict string: `FAIL — residual P0(s); v0.08 remains blocked`.

## Explicit non-actions / non-claims

- Did **not** open or unlock v0.08 (issue `6af9647b-…` remains `backlog`).
- Did **not** cut over live (already on Section-2 closed `b314bcf41…`).
- Did **not** invent or rewrite Mac pin SHAs.
- Did **not** claim overall PASS / safe close.
- Thinking-fast / `fast_decision_only` left as a separate track (service had brief EPIPE restarts during this wake; unrelated to these three P0s).

## Unblock for Mac pins (Sebastian)

```sh
# On the Mac checkout that has both objects:
git push tryveto 9cad4cb71670c00191e52ab44e877156dfaf2118:refs/tags/veto/v0.06-product-base-9cad4cb
git push tryveto 11f920182fdf908e2476c144505b1e659427015d:refs/tags/veto/v0.07-spec-11f92018
```

Then on veto-mainline: `git fetch tryveto '+refs/tags/veto/*:refs/tags/veto/*'` and re-run `node scripts/audit-v007-live-safe.mjs`.
