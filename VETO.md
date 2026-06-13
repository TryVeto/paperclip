# Veto fork of Paperclip

This is TryVeto's fork of [paperclipai/paperclip](https://github.com/paperclipai/paperclip) (MIT).
Working branch: **`veto/main`**, based on the upstream release tag **`v2026.609.0`** — the same
version pinned in the production images (`/Users/seb/Code/os/infra/cloudflare/Dockerfile` and
`/Users/seb/Code/os/infra/render/Dockerfile`). The fork exists so the Veto design standard and
future product changes live in source, not in post-install patch scripts.

## What differs from upstream

Design standard (sources: `This Cycle/_Meta/STYLE_GUIDE.md`, the veto-design system):

- `ui/src/veto-palette.css` — new. Inter (self-hosted variable font), the recalibrated Tailwind
  palette (status hue identity preserved; chroma/lightness brought to Veto levels: ok 155,
  warn 60, stop 27; neutrals on the cool 270 axis), OpenType features, tabular figures,
  ink-on-paper selection.
- `ui/src/index.css` — `:root` and `.dark` tokens moved onto the 270 axis; tiered radii
  (chips 6 / controls 8 / inputs 10 / cards 12) replacing upstream's square corners.
- `ui/index.html` + `ui/src/context/ThemeContext.tsx` — light is the default theme; dark stays
  available and reads on the same 270 axis.
- `ui/public/` — Veto favicon set (dark tile, white v) for favicon.svg/ico/pngs and the
  webmanifest colors. `worktree-favicon.*` intentionally unchanged — worktree instances brand
  themselves at runtime.
- Inter woff2 files committed under `ui/public/fonts/` so fonts serve same-origin (CSP-clean).

Deliberate non-changes: code/diff/terminal surfaces keep their monospace stack (data
legibility, not brand voice), and the "Paperclip" product name/wordmark is untouched so far.

## Not yet ported from the image patch scripts

The production Dockerfiles still apply two runtime repairs to the npm-published build that
should become source fixes here if we deploy from the fork:

- `patch-paperclip-agent-remove.mjs` — FK cleanup on agent hard-delete.
- `patch-paperclip-codex-chatgpt-model.mjs` — codex_local default model for ChatGPT-auth lanes.

## Syncing upstream

```sh
git fetch upstream --tags
git checkout veto/main
git merge <new-release-tag>   # resolve, re-verify, update the pin note above
```

The boundary line, as everywhere: the office decides. Veto records the review.
