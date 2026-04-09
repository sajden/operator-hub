# Search Demand Capture Worker

Standalone bounded browser-capture worker for `capture_search_demand_insights`.

It is intentionally narrow:
- one URL capture at a time
- reuses a local Chromium-compatible browser and optional existing profile
- saves rendered HTML and screenshot
- does not own extraction or normalization

## Run

```bash
cd /home/sajden/github/operator-hub/workers/search-demand-capture
npm run capture -- \
  --url "https://trends.google.com/trends/explore?geo=SE&hl=en&q=parking%20app" \
  --html-output /home/sajden/github/operator-hub/.local/research/search-demand/test/run/raw/trends.html \
  --screenshot-output /home/sajden/github/operator-hub/.local/research/search-demand/test/run/screenshots/trends.png \
  --user-data-dir /path/to/chrome-profile-root \
  --profile-directory Default
```

## Session reuse

Use:
- `--user-data-dir`
- optional `--profile-directory`

This worker assumes the profile is already authenticated when the source requires login.
