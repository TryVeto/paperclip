# Paperclip v0.07 — False ship incident + honest re-ship

| Field | Value |
|---|---|
| Status | Closed — honest exact-SHA re-ship |
| Capsule | `92a08833-2c9e-4860-93ef-70c1d30f944e` (Product project) |
| Spec blob (unchanged) | `c9a2782c8e42c99d46729f54d4bc74bbe511a4e0` |
| Product base | `9cad4cb71670c00191e52ab44e877156dfaf2118` |
| **Do not open** | `v0.08` until further board instruction |

## Incident (preserved as history)

| Field | False claim |
|---|---|
| Claimed candidate | `3c50854bb764ebfc7bce85ac4ca2eacce5530dac` |
| Live packaging | Surgical overlay of `9cad4cb…-r2` with post-ship `node_modules` patches |
| Ship closed at | `2026-07-22T22:28:10.418Z` |
| Defects | Manufactured bootstrap verification; caller-trusted `submitVerification`; tautological pre-write ship gate; hardcoded descendant provenance; enforcement hooks omitted from overlay |

Archived into capsule `receipt_history[0]` via board `voidShip` at `2026-07-22T23:29:08.334Z`.

## Repair source

| Field | Value |
|---|---|
| Branch | `veto/paperclip-v0.07` |
| Repair commit / deployed SHA | `f852853394bee8c84c35f71f01f756776ca2af5c` |
| Changes | Harden `adoptBootstrap` / `submitVerification` / `closeShip`; add board `voidShip`; non-tautological pre-write gate; `receipt_history` migration `0185` |

## Immutable release

| Field | Value |
|---|---|
| Release dir | `/home/droid/.local/lib/paperclip-veto-mainline-cloud-releases/f852853394bee8c84c35f71f01f756776ca2af5c` |
| Packaging | `pnpm` build of `@paperclipai/{shared,db,ui,server}` + `pnpm pack`; extract over copy of `9cad4cb…-r2` (no live surgical overlay) |
| Manifest | `build-manifest.json` (mode 0444, `chattr +i`); `candidateSha=f852853…` |
| Symlink | `/home/droid/.local/lib/paperclip-veto-mainline-cloud` → SHA release |

## Re-close sequence (persisted facts)

1. Thinking-slow: `dangerouslyBypassApprovalsAndSandbox=false`, `filesystemScope=workspace` (confirmed).
2. Board `POST …/versions/v0.07/void-ship` — false ship archived; capsule remains `v0.07`.
3. Board `POST …/verification` with forged caller SHA `aaa…` / failed check — ignored; receipt candidate = attestation `f852853…`.
4. Board `POST …/ship` with forged `observedLiveSha=bbb…` — ignored; `deployed_source_sha=f852853…`; `shipped_at=2026-07-22T23:29:19.185Z`.
5. Gate snapshot used independent bootstrap blob pin + locked verification candidate vs running attestation (no pre-write `running===deployed` tautology).
6. **v0.08 not opened** (`project_version_contracts` has only `v0.07`).

## Standing ops (orthogonal to version blob)

Sebastian-facing deliverables default to Tailscale URI (`PAPERCLIP.md` + Thinking-fast/slow/zero `AGENTS.md`).
