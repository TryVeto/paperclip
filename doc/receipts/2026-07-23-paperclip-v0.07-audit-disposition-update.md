# Paperclip v0.07 — Audit disposition (updated 2026-07-23)

| Field | Value |
|---|---|
| Status | **PARTIAL closeout of Codex P0s — not safely closed. Do not open v0.08.** |
| Original audit | 2026-07-22 21:59 PDT (Codex, read-only) |
| This proof | 2026-07-23 ~10:05 PDT — live-safe re-verify |
| Spec blob | `c9a2782c8e42c99d46729f54d4bc74bbe511a4e0` |
| Spec commit pin (object Mac-only) | `11f920182fdf908e2476c144505b1e659427015d` |
| Product base pin (object Mac-only) | `9cad4cb71670c00191e52ab44e877156dfaf2118` |
| Live release | `b314bcf41d46d3207cc609606452b0845a4abf4a` |
| Capsule ship | `92a08833-…` shipped `2026-07-23T15:06:34.219Z` on `b314bcf41…` |

## Spec findings (P0)

| ID | Severity | Disposition |
|---|---|---|
| SPEC-1 | P0 | **FIXED.** Live flat journal↔source identity (185 entries); `0186` present + applied (`traffic_class` columns exist); 0 missing-column / paused-wake recovery noise since `b314` cutover. `/api/health` still non-authoritative. |
| SPEC-2 | P0 | **PARTIAL.** Live candidate + overnight branch + closeout lineage SHAs resolve on `TryVeto/paperclip`. Residual EXACT_GIT P0s: Mac product-base + spec-commit objects absent on host and tryveto. Host `c0c50b4ea…` is blob-identical only — pins not rewritten. |
| SPEC-3 | P0 | **FIXED (forward) + historical disposition.** Casual void → `shipped_record_immutable` (409); active ship unchanged. Historical rewrite `3c50854` → `f852853` → `48b9569` → `b314bcf41` retained in `receipt_history` via archive/supersede path. |

## Spec findings (P1 — not closed this wake)

| ID | Severity | Disposition |
|---|---|---|
| SPEC-4 | P1 | Still accepted — verification depth / Cursor ancestry not re-litigated here. |
| SPEC-5 | P1 | Packaging dual-tree root cause addressed for SPEC-1; journal identity proven. |
| SPEC-6 | P1 | Lane-isolation acceptance still outstanding. |

## Standards findings

Unchanged from 2026-07-22 disposition (STD-1..6 accepted).

## Explicit non-actions

- Do **not** open or activate v0.08 (board issue remains `backlog`).
- Do **not** treat this as overall PASS / safe close while Mac pins are missing.
- Do **not** invent substitute SHAs for Mac pins.
- Do **not** casually void the live capsule again.

## Receipts

- https://veto-mainline.tail2fd504.ts.net:10000/paperclip-v0.07-p0-closeout/
- https://veto-mainline.tail2fd504.ts.net:10000/paperclip-v0.07-mac-pin-residual/
- https://veto-mainline.tail2fd504.ts.net:10000/paperclip-v0.07-audit-disposition/
