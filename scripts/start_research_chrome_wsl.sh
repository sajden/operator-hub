#!/usr/bin/env bash
set -euo pipefail

PROFILE_DIR="${HOME}/.config/operator-hub-research-chrome"
mkdir -p "${PROFILE_DIR}"

exec /usr/bin/google-chrome-stable \
  --user-data-dir="${PROFILE_DIR}" \
  --profile-directory=Default \
  --new-window \
  --no-first-run \
  "https://ads.google.com/" \
  "https://ads.google.com/aw/keywordplanner/home" \
  "https://trends.google.com/trends/"
