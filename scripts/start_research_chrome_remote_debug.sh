#!/usr/bin/env bash
set -euo pipefail

BROWSER_EXE="${1:-/mnt/c/Program Files/Google/Chrome/Application/chrome.exe}"
USER_DATA_DIR="${2:-/mnt/c/Users/sebas/AppData/Local/Google/Chrome/User Data}"
PROFILE_DIRECTORY="${3:-Profile 3}"
REMOTE_PORT="${4:-9222}"

POWERSHELL_EXE="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"

if [ ! -f "$BROWSER_EXE" ]; then
  echo "Browser executable not found: $BROWSER_EXE" >&2
  exit 1
fi

win_browser="$(wslpath -w "$BROWSER_EXE")"
win_user_data="$(wslpath -w "$USER_DATA_DIR")"

"$POWERSHELL_EXE" -NoProfile -Command "
\$argList = @(
  '--remote-debugging-address=0.0.0.0',
  '--remote-debugging-port=$REMOTE_PORT',
  '--user-data-dir=$win_user_data',
  '--profile-directory=$PROFILE_DIRECTORY',
  '--new-window',
  '--no-first-run',
  'about:blank'
)
Start-Process -FilePath '$win_browser' -ArgumentList \$argList
"

echo "Started Chrome remote debugging on http://127.0.0.1:$REMOTE_PORT using $PROFILE_DIRECTORY"
