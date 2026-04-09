#!/usr/bin/env bash
set -euo pipefail

POWERSHELL_EXE="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
SCRIPT_PATH="/home/sajden/github/operator-hub/scripts/windows_chrome_debug_proxy.ps1"
WIN_SCRIPT_PATH="$(wslpath -w "$SCRIPT_PATH")"

"$POWERSHELL_EXE" -NoProfile -Command "Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','$WIN_SCRIPT_PATH' -WindowStyle Hidden"

echo "Started Windows Chrome debug proxy on 0.0.0.0:9223 -> 127.0.0.1:9222"
