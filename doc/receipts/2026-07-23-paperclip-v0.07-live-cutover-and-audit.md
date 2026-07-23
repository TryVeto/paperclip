# Paperclip v0.07 — Live cutover + live-safe audit (2026-07-23)

| Field | Value |
|---|---|
| Status | **Live cut over to closeout build; lineage pushed with workflows; audit still FAIL; v0.08 remains LOCKED** |
| Live install (after) | `ba7dc9e4f436655d823e4f2e3d38f02fd933d0b3` |
| Live install (before) | `48b95694828bf85486d8f853cafb5d7c9b196fcd` |
| Release digest | `a570429163194002517f46f638491c32558aab9c8e74811e81a37068d7b9b3c4` |
| Spec blob (unchanged) | `c9a2782c8e42c99d46729f54d4bc74bbe511a4e0` |
| Product base pin (object missing here) | `9cad4cb71670c00191e52ab44e877156dfaf2118` |
| Spec commit pin (object missing here) | `11f920182fdf908e2476c144505b1e659427015d` |
| Published branch tip | `103e1c1344e3dc13d8fbe710992534081f42c9d3` (+ receipt update below) |
| Remote branch | https://github.com/TryVeto/paperclip/tree/veto/paperclip-v0.07-overnight-closeout |

## Checklist execution

| Step | Result |
|---|---|
| 1. `gh auth refresh … -s workflow` | **Done** — `gh auth status` scopes now `gist, read:org, repo, workflow` (account `seb-veto`) |
| 2. Deepen/fetch `9cad4cb…` / `11f920…` | **Still Mac-only** — missing on `origin`, `tryveto`, `closeout`, and overnight git bundle; `git fetch … <sha>` → `not our ref`. Spec **blob** `c9a2782…` is present. |
| 3. Package + install | **Done** — `scripts/package-immutable-release.mjs` → `/tmp/paperclip-release-ba7dc9e4…` then installed under `…/releases/ba7dc9e4…` with `installedRuntimeDigests` for `db`/`server`/`shared` |
| 4. Live symlink cutover | **Done** — no active agent execution observed (only paused-agent recovery noise + board reads); flipped symlink; restarted `paperclip-veto-mainline-cloud`; did **not** void/rewrite capsule |
| 5. Live-safe audit | **FAIL** — re-ran `/tmp/audit-v007-live-safe.mjs` after push; P0 exact-git still fail (see notes) |
| 6. Commit + push | **Done** — `git push -u tryveto HEAD:refs/heads/veto/paperclip-v0.07-overnight-closeout` succeeded; **10** `.github/workflows/*` files on remote tip (full lineage, not orphan) |

## Push proof (post–workflow-scope)

```text
To https://github.com/TryVeto/paperclip.git
 * [new branch]          HEAD -> veto/paperclip-v0.07-overnight-closeout
remote tip: 103e1c1344e3dc13d8fbe710992534081f42c9d3
workflows on tip: 10 (agent-runtime-images, commitperclip-review, docker, e2e, pr,
  refresh-lockfile, release-smoke, release-verify, release, storybook-visual)
```

## Live evidence

- Symlink: `/home/droid/.local/lib/paperclip-veto-mainline-cloud` → `…/releases/ba7dc9e4f436655d823e4f2e3d38f02fd933d0b3`
- Startup journal (ActiveEnterTimestamp `2026-07-23 07:16:30 PDT`):
  `digestVerify: { ok: true, detail: "verified", installedRuntimeOk: true }` with `installedRuntimeDigestCount: 3`
- `GET /api/health` → 200 (informational only; not closure proof)
- `build-manifest.json` mode 0444 + `chattr +i`

### installedRuntimeDigests

| name | sha256 | fileCount |
|---|---|---|
| db | `4e223ccaad7adf0a44a04f63f2727bf11e17e4b22921e3369c725fd7e2efc519` | 815 |
| server | `2c11116b6d7d727ea1cc524f5ae96b24134cdc15d977c68cba476d1aaeb25952` | 1578 |
| shared | `599c0e17f1b1a6a5ed3a883b8134859c95f248b7fec277e151af6d2ba8537435` | 730 |

## Source SHAs on this host

| Role | SHA |
|---|---|
| Packaged / live | `ba7dc9e4f436655d823e4f2e3d38f02fd933d0b3` |
| Branch tip (includes prior cutover receipt) | `103e1c1344e3dc13d8fbe710992534081f42c9d3` |
| Build-fix parent | `36e1ec5851ede4a718bed176eb5cb1f59081cf8f` |
| Prior published closeout lineage tip (pre-cutover) | `14347071a5134a2fadc3bb1ec78bde0ab54b5f55` |
| Harden pass | `33d78988c6f15e7eddf24b5f378964e02184aad0` |

## Audit re-run notes (honest)

Re-ran `node /tmp/audit-v007-live-safe.mjs` after the lineage push. Verdict: **FAIL** — `v008: LOCKED`.

| Check | Result | Note |
|---|---|---|
| `EXACT_GIT_PRODUCT_BASE` | **FAIL** | Mac-only object still absent — real P0 |
| `EXACT_GIT_SPEC_COMMIT` | **FAIL** | Mac-only object still absent — real P0 |
| `SOURCE_HEAD_EQUALS_LIVE` | **FAIL** | Expected after receipt commit: HEAD=`103e1c134…`, live packaged=`ba7dc9e4…` (ancestor). Not a live regression. |
| `STARTUP_DIGEST_VERIFY_OK` / `STARTUP_INSTALLED_RUNTIME_OK` | **FAIL in script** | Script window is `--since '10 min ago'`; attestation line is from `07:16:34` and still present in journal outside that window. Live digests unchanged. |

Did **not** void the live closed capsule. Did **not** unlock v0.08.

## Explicit non-claims

- **v0.07 is not safely closed** — exact-git provenance for product base + canonical spec commit remains Mac-only.
- **v0.08 stays locked.**
- Historical SPEC-3 (prior void/reclose of shipped capsule) is not cured by this cutover; this session did not mutate the closed record.
- `/api/health` is not closure proof.

## Audit command

```sh
node /tmp/audit-v007-live-safe.mjs
# receipt: /tmp/audit-v007-live-safe.out
```

## Remaining Sebastian checklist

- [ ] On Mac (or any host that has them), publish git objects `9cad4cb71670c00191e52ab44e877156dfaf2118` and `11f920182fdf908e2476c144505b1e659427015d` to a reachable remote (e.g. push a branch/tag containing both to `TryVeto/paperclip`), **or** formally accept blob-only provenance and rewrite the audit contract.
- [ ] After objects are fetchable here: `git fetch tryveto <both-shas>` → re-run `node /tmp/audit-v007-live-safe.mjs` → only then consider unlock of v0.08 / safe-close claim.
- [ ] Do **not** void/rewrite the live closed capsule while chasing provenance.
