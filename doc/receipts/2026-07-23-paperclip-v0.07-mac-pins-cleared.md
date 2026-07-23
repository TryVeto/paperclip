# Paperclip v0.07 — Mac provenance pins cleared (2026-07-23)

| Field | Value |
|---|---|
| Status | **SPEC-2 FIXED — exact-git Mac pins now resolvable on host. Audit exit 0 (`PASS_CANDIDATE`). v0.08 still LOCKED. Not claiming overall safe close.** |
| Proof time (UTC) | `2026-07-23T17:11:49Z` |
| Live | `b314bcf41d46d3207cc609606452b0845a4abf4a` |
| Source HEAD (at proof) | `4d2b6b29c96239a551d8b82197c86db91eef9907` |
| Spec blob | `c9a2782c8e42c99d46729f54d4bc74bbe511a4e0` |
| Product base pin | `9cad4cb71670c00191e52ab44e877156dfaf2118` → tag `veto/v0.06-product-base-9cad4cb` |
| Spec commit pin | `11f920182fdf908e2476c144505b1e659427015d` → tag `veto/v0.07-spec-11f92018` |
| Remote | `tryveto` → `https://github.com/TryVeto/paperclip.git` |
| Mac source (Sebastian) | `/Users/seb/Code/paperclip-v0.07` (blob match confirmed) |

## What Sebastian pushed

```
9cad4cb71670c00191e52ab44e877156dfaf2118 → refs/tags/veto/v0.06-product-base-9cad4cb
11f920182fdf908e2476c144505b1e659427015d → refs/tags/veto/v0.07-spec-11f92018
```

Fetched on veto-mainline worktree:

```sh
git fetch tryveto \
  'refs/tags/veto/v0.06-product-base-9cad4cb:refs/tags/veto/v0.06-product-base-9cad4cb' \
  'refs/tags/veto/v0.07-spec-11f92018:refs/tags/veto/v0.07-spec-11f92018'
```

## cat-file proofs (this host)

| Object | Result |
|---|---|
| `9cad4cb71670c00191e52ab44e877156dfaf2118^{commit}` | OK |
| `11f920182fdf908e2476c144505b1e659427015d^{commit}` | OK |
| blob `c9a2782c8e42c99d46729f54d4bc74bbe511a4e0` | OK |
| tags resolve to same SHAs | OK |

Pins were **not** rewritten. Host reconstruction commit `c0c50b4ea…` remains blob-identical only; exact-git now uses the Mac commit SHAs.

## Companion P0 dispositions

| ID | Verdict |
|---|---|
| SPEC-1 (0186 / journal / recovery) | **FIXED** — unchanged; see `2026-07-23-paperclip-v0.07-p0-closeout.md` |
| SPEC-2 (durable exact-git) | **FIXED** — Mac product-base + spec-commit objects now on tryveto tags and local object store |
| SPEC-3 (ship immutability) | **FIXED** forward + historical archived (prior wake). Script verdict still says `PASS_CANDIDATE` / “require SPEC-3 historical disposition before claiming closed” — that is the audit’s conservative gate, not a new fail. Do **not** treat as safe close solely from this clear. |

## Fresh live-safe audit

Script: `scripts/audit-v007-live-safe.mjs` → exit **0**

| Check | Result |
|---|---|
| Live candidate / digests / nested migrations / recovery | **PASS** |
| GitHub resolvable live SHA + overnight branch | **PASS** |
| `EXACT_GIT_PRODUCT_BASE` | **PASS** (type=commit) |
| `EXACT_GIT_SPEC_COMMIT` | **PASS** (type=commit) |
| `HOST_RECONSTRUCTION_SPEC_BLOB` / `SPEC_BLOB_PIN_IN_MANIFEST` / `MANIFEST_PINS_MAC_SHAS` | **PASS** |
| `failed` / `p0Fail` | `[]` / `[]` |
| Verdict | `PASS_CANDIDATE` — Mac pins resolved; v008=`LOCKED` |

Prior residual receipt (`2026-07-23-paperclip-v0.07-mac-pin-residual.md`) recorded exit 2 with those two EXACT_GIT fails. This receipt supersedes that residual for SPEC-2 only.

## Explicit non-actions

- Did **not** unlock or open v0.08.
- Did **not** deploy / cut over / voidShip.
- Did **not** claim overall v0.07 safe close / Path-2 supersession complete.
- Did **not** rewrite pins or invent SHAs.

## Artifacts

- https://veto-mainline.tail2fd504.ts.net:10000/paperclip-v0.07-mac-pins-cleared/
