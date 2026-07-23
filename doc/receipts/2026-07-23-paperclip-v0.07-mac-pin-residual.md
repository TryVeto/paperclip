# Paperclip v0.07 — Residual Mac-pin gate (2026-07-23)

| Field | Value |
|---|---|
| Status | **FAIL residual — only exact-git Mac pins remain as P0. v0.08 LOCKED.** |
| Live | `b314bcf41d46d3207cc609606452b0845a4abf4a` |
| Source HEAD (at proof) | `77b8fe1d4fbad1d05bc58848c93cbe4785566ab6` |
| Spec blob (present) | `c9a2782c8e42c99d46729f54d4bc74bbe511a4e0` |
| Host reconstruction spec commit | `c0c50b4eaf7131cae4cb3b98ab567db2288d2182` (blob-identical; **not** Mac `11f92018…`) |
| Product base pin (object missing) | `9cad4cb71670c00191e52ab44e877156dfaf2118` |
| Spec commit pin (object missing) | `11f920182fdf908e2476c144505b1e659427015d` |

## Companion P0 dispositions (this wake)

| ID | Verdict |
|---|---|
| SPEC-1 (0186 / journal / recovery) | **FIXED** — see `2026-07-23-paperclip-v0.07-p0-closeout.md` |
| SPEC-2 (durable exact-git) | **PARTIAL** — live + closeout SHAs on tryveto; **these two Mac pins only** still missing |
| SPEC-3 (ship immutability) | **FIXED** forward — casual void → `shipped_record_immutable`; history archived |

## Fresh live-safe audit (this wake)

Script: `scripts/audit-v007-live-safe.mjs` → `/tmp/audit-v007-live-safe.out` (exit 2)

| Check | Result |
|---|---|
| Live candidate / digests / nested migrations | **PASS** |
| GitHub resolvable live SHA + overnight branch | **PASS** |
| Startup `digestVerify.ok` + `installedRuntimeOk` | **PASS** |
| Recovery: missing-column / paused-wake spam since `b314` cutover | **PASS** (0 / 0) |
| Host reconstruction blob pin | **PASS** |
| Exact-git product base `9cad4cb…` | **FAIL — Mac-only** (absent locally + tryveto 422) |
| Exact-git spec commit `11f92018…` | **FAIL — Mac-only** (absent locally + tryveto 422) |

## What is blocked without Sebastian

Publish the two Mac commits onto a durable remote reachable from this host, e.g.:

```sh
# On the Mac checkout that has both objects:
git push tryveto 9cad4cb71670c00191e52ab44e877156dfaf2118:refs/tags/veto/v0.06-product-base-9cad4cb
git push tryveto 11f920182fdf908e2476c144505b1e659427015d:refs/tags/veto/v0.07-spec-11f92018
# or push the Mac veto/paperclip-v0.07 branch that contains them
```

Then on veto-mainline:

```sh
cd /home/sebastianheyneman_tryveto_com/work/paperclip-v0.07
git fetch tryveto '+refs/tags/veto/*:refs/tags/veto/*'
git cat-file -t 9cad4cb71670c00191e52ab44e877156dfaf2118
git cat-file -t 11f920182fdf908e2476c144505b1e659427015d
node scripts/audit-v007-live-safe.mjs
```

**Do not** rewrite pins to `c0c50b4ea` / invent substitute SHAs. Blob identity alone is not exact-git commit provenance.

## Explicit non-actions

- Did **not** open or unlock v0.08 (VET-582 / issue `6af9647b-…` remains `backlog`).
- Did **not** cut over live (already on Section-2 closed `b314bcf41…`).
- Did **not** claim safe close.

---

## Superseded (same day)

Sebastian pushed both Mac pins to `TryVeto/paperclip` tags. Host fetch + `audit-v007-live-safe.mjs` exit **0** with all EXACT_GIT checks **PASS**. See `2026-07-23-paperclip-v0.07-mac-pins-cleared.md`. **SPEC-2 FIXED.** Still not overall safe close; v0.08 LOCKED.
