# Paperclip v0.07 — Section 2 corrective re-ship

| Field | Value |
|---|---|
| Status | Closed — Section 2 gaps closed on exact SHA |
| Capsule | `92a08833-2c9e-4860-93ef-70c1d30f944e` (Product) |
| Spec blob (unchanged) | `c9a2782c8e42c99d46729f54d4bc74bbe511a4e0` |
| Product base | `9cad4cb71670c00191e52ab44e877156dfaf2118` |
| Deployed / candidate SHA | `48b95694828bf85486d8f853cafb5d7c9b196fcd` |
| Release digest | `b00da8f9fddc8fff023ce933ee51a10a2513e4609e7ebf0719ab518e804f1358` |
| Shipped at | `2026-07-23T04:20:32.209Z` |
| **Do not open** | `v0.08` until further board instruction |

## Prior ships archived

| SHA | Packaging defect | Voided |
|---|---|---|
| `3c50854…` | Surgical live overlay; false verification | Earlier incident |
| `f852853…` | Extract-over-`9cad4cb…-r2`; no package/release digests | `2026-07-23T04:20:32.154Z` (this re-ship) |

## Section 2 gaps closed

| Gap | Evidence |
|---|---|
| Clean reproducible packaging | `scripts/package-immutable-release.mjs` — fresh `npm install paperclipai@2026.720.0` + HEAD `@paperclipai/{shared,db,server}` tarballs; method `fresh_npm_install_paperclipai_plus_head_package_tarballs` |
| No extract-over-r2 | Provenance note forbids prior-release copy / live surgical patch |
| Package + release digests | `build-manifest.json` includes `packageDigests` + `releaseDigest`; startup `digestVerify.ok=true` with `PAPERCLIP_RELEASE_DIGEST_STRICT=1` |
| Traffic classification | Migration `0186_run_traffic_classification`; live queries select `traffic_class` / `actionable` / `request_received_at` |
| Migration replay | `packages/db/src/migration-replay.test.ts` passes (vitest) |
| Absolute symlink leak | npm stage left absolute `.bin` + embedded-postgres `native/lib` links; packager rewrites all stage-absolute symlinks (35 on this build). ICU `libicui18n.so.60` → relative `libicui18n.so.60.2` |

## Immutable release

| Field | Value |
|---|---|
| Release dir | `/home/droid/.local/lib/paperclip-veto-mainline-cloud-releases/48b95694828bf85486d8f853cafb5d7c9b196fcd` |
| Symlink | `/home/droid/.local/lib/paperclip-veto-mainline-cloud` → SHA dir |
| Manifest | mode 0444, `chattr +i`; `PAPERCLIP_BUILD_MANIFEST_PATH` drop-in |
| Health | `GET /api/health` → 200 after cutover |

## Re-close sequence

1. Board `POST …/versions/v0.07/void-ship` — archived `f852853…` ship.
2. Board `POST …/verification` with forged caller SHA `aaa…` — ignored; receipt candidate = attestation `48b9569…`.
3. Board `POST …/ship` with forged `observedLiveSha=bbb…` — ignored; `deployed_source_sha=48b9569…`.
4. Gate snapshot: bootstrap blob pin + verification/running attestation all `48b9569…` (no pre-write tautology).
5. **v0.08 not opened.**

## Source commits (branch `veto/paperclip-v0.07`)

| SHA | Role |
|---|---|
| `d307d05` | Digests, traffic class, migration replay test, packager |
| `fe29822` | Migration-replay TS narrowing |
| `6bffc0f` | Rewrite absolute `.bin` after copy |
| `48b9569` | Rewrite **all** stage-absolute symlinks (ICU / embedded-postgres) — **shipped** |
