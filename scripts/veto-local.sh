#!/bin/bash
# Local Veto Paperclip playground: fork server + built UI, fully isolated.
# Data lives in the server default ~/.paperclip/instances/default (own embedded
# postgres). Never touches the Codex pilot on :3100 (separate data dir under
# omnara/codex/scratch) or any production instance. Throwaway by design.
set -euo pipefail
cd "$(dirname "$0")/../server"
export PAPERCLIP_PORT="${PAPERCLIP_PORT:-3299}"
exec ./node_modules/.bin/tsx src/index.ts
