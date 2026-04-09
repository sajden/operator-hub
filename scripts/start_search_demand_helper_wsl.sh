#!/usr/bin/env bash
set -euo pipefail

cd /home/sajden/github/operator-hub/workers/search-demand-capture
exec npm run serve-helper
