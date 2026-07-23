# Paperclip v0.07 — Migration / package identity proof (2026-07-23)

| Field | Value |
|---|---|
| Status | **Package↔source journal identity OK on live `ba7dc9e4…`; nested migrations gone; SPEC-1 package root cause cured on this install. Exact-git product base/spec commit still FAIL. v0.08 locked.** |
| Live install | `ba7dc9e4f436655d823e4f2e3d38f02fd933d0b3` |
| Prior nested install | `48b95694828bf85486d8f853cafb5d7c9b196fcd` |

## Runtime evidence

| Check | Result |
|---|---|
| `dist/migrations/migrations` nested dir | **Absent** (`NESTED_OK`) |
| Live journal entries vs source | **Equal** (185 entries) |
| SQL file set vs source | **Equal** (185 files) |
| Duplicate journal idxs | **None** |
| `0186_run_traffic_classification.sql` bytes | **Equal** source↔live |
| `meta/_journal.json` bytes | **Equal** source↔live |
| `missing column` / schema recovery since cutover | **0** (ops noise is paused-agent wake, below) |

## Remaining non-migration noise (not SPEC-1)

Every ~30s: `failed to enqueue dependency wake from issue graph liveness backstop` for
paused agent `022700df-…` on issue `35ce41ae-…` (`Agent is not invokable… paused`).
Source fix: skip non-invokable assignees in `reconcileResolvedDependencyWakeBackstop`
before `enqueueWakeup` (separate cutover after this receipt).

## Explicit non-claims

- Does **not** prove exact-git resolvability of Mac pins `9cad4cb…` / `11f92018…`
- Does **not** safely close v0.07 or unlock v0.08
- `/api/health` remains non-authoritative for closure
