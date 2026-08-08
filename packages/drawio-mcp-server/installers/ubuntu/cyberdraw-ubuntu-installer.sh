#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "CyberDraw Ubuntu installer requires Node.js >= 22 on PATH." >&2
  exit 127
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

exec node "$SERVER_DIR/scripts/installation/ubuntu-installer.mjs" "$@"
