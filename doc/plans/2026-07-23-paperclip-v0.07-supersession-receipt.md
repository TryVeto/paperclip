# Paperclip v0.07 — Path 2 supersession receipt

| Field | Value |
|---|---|
| Date | 2026-07-23 |
| Decision | **Path 2** — board-authorized supersession of v0.07 by Paperclip v1 |
| Selected by | Sebastian (instruction to ship the accepted v1 g1 specification in full) |
| Prior-version status | **v0.07 remains `FAIL`** |
| Successor | Paperclip **v1** accepted generation **g1** |
| Immutable v0.07 spec blob (untouched) | `c9a2782c8e42c99d46729f54d4bc74bbe511a4e0` |
| Canonical v1 specification | `doc/plans/2026-07-23-paperclip-v1.md` |
| Artifact URL | https://veto-mainline.tail2fd504.ts.net:10000/paperclip-v0.07-supersession/ |

## What this does

v0.07 is **explicitly superseded** by v1. Its failed audit, historical evidence,
and blockers remain mandatory migration inputs. This receipt freezes that
disposition for the board and for implementers.

## What this does not do

- Does **not** rewrite ship history green.
- Does **not** void, reclose, or launder any prior v0.07 capsule as PASS.
- Does **not** unlock a fake-green v0.07 closeout.
- Does **not** deploy v1 or claim v1 shipped.

## Selected v1 migration base

| Field | Value |
|---|---|
| Product base repository (Mac lineage) | `/Users/seb/Code/paperclip-v0.07` |
| Base commit | `11f920182fdf908e2476c144505b1e659427015d` |
| Base tree | `cc7dd772bdfdc96a44faf04a64fb511a587ef364` |
| Product base lineage (v0.06 proven surface) | via `9cad4cb71670c00191e52ab44e877156dfaf2118` |

Note (host truth, 2026-07-23): on veto-mainline these Mac pin objects may still be
absent from local git object stores. Absence does not change the contracted base;
it remains a fetch/publish residual for Slice A, not a license to invent a
substitute green close of v0.07.

## Frozen prior-version truth

| Claim | Disposition |
|---|---|
| v0.07 PASS | **Rejected** — remains FAIL |
| Mutable / false ship history | **Preserved as incident**; not rewritten |
| Audit blockers (schema identity, candidate provenance, mutable closure, lane spoof, instruction stack, dishonest health) | **Inputs to v1 migration**, not cured by this receipt |
| Separate product versions v0.08 / v0.09 | **Superseded as release keys** by the v1 consolidation (access + culture + kernel); ideas may land as internal slices, not as separately shipped products |

## Authority chain

1. Accepted Paperclip v1 g1 specification (Version contract → §22).
2. This Path 2 supersession receipt.
3. Deployment remains Sebastian-only; implementation does not equal ship.

## Closure statement

**v0.07 = FAIL, superseded by v1 (g1). Base = `11f92018…` / tree `cc7dd772…`. History stays honest.**
