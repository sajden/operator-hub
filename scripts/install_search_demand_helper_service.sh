#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_UNIT="$REPO_ROOT/ops/systemd/operator-hub-search-demand-helper.service"
TARGET_DIR="$HOME/.config/systemd/user"
TARGET_UNIT="$TARGET_DIR/operator-hub-search-demand-helper.service"
NPM_BIN="${NPM_BIN:-$(command -v npm)}"
NODE_BIN="${NODE_BIN:-$(command -v node)}"

if [[ -z "$NPM_BIN" ]]; then
  echo "npm was not found in PATH"
  exit 1
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "node was not found in PATH"
  exit 1
fi

mkdir -p "$TARGET_DIR"
sed \
  -e "s|__REPO_ROOT__|$REPO_ROOT|g" \
  -e "s|__NPM_BIN__|$NPM_BIN|g" \
  -e "s|__NODE_BIN__|$NODE_BIN|g" \
  "$SOURCE_UNIT" > "$TARGET_UNIT"

echo "Installed unit file at $TARGET_UNIT"

if systemctl --user daemon-reload >/dev/null 2>&1; then
  systemctl --user enable --now operator-hub-search-demand-helper.service
  echo "Started operator-hub-search-demand-helper.service"
  echo "Check status with: systemctl --user status operator-hub-search-demand-helper.service"
  echo "Health check: curl http://127.0.0.1:8788/health"
else
  echo "systemctl --user is not reachable from this shell."
  echo "Run these commands in your own terminal session:"
  echo "  systemctl --user daemon-reload"
  echo "  systemctl --user enable --now operator-hub-search-demand-helper.service"
  echo "Then verify with:"
  echo "  curl http://127.0.0.1:8788/health"
fi
