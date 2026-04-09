# `capture_search_demand_insights`

Reusable browser-assisted demand-research capability for `operator-hub`.

This tool is intended for:
- Google Ads / Keyword Planner sessions that are already authenticated
- optional Google Trends capture
- deterministic artifact storage for human review
- structured output that other systems can use for SEO, messaging, offer design, and strategy

It is intentionally generic and not tied to `auto-web`.

## What it does

The tool:
- reuses an optional local browser session via `session_hint`
- requires that session to be a dedicated research profile, not a normal work browser
- navigates to bounded source URLs for each seed query
- captures screenshot and rendered HTML artifacts
- extracts visible demand clues where possible
- normalizes findings into one deterministic JSON result
- degrades gracefully when some sources fail

## Tool name

- `capture_search_demand_insights`

## Input

The tool accepts snake_case input:

```json
{
  "project_slug": "parkpal",
  "seed_queries": ["parking app", "parking operations software"],
  "market": "SE",
  "language": "en",
  "mode": "background",
  "sources": ["google_keyword_planner", "google_trends"],
  "session_hint": "google-ads-main",
  "notes": "Founder-led parking ops research"
}
```

## Session model

If `session_hint` is provided, the tool looks for:

- [`.local/browser-sessions/<session_hint>/session.json`](/home/sajden/github/operator-hub/.local/browser-sessions)

Minimal example:

```json
{
  "dedicatedResearchProfile": true,
  "browserCommand": "/usr/bin/google-chrome-stable",
  "helperUrl": "http://host.docker.internal:8788",
  "userDataDir": "/home/sajden/.config/operator-hub-research-chrome",
  "profileDirectory": "Default",
  "sources": {
    "google_keyword_planner": {
      "seedUrlTemplate": "https://ads.google.com/aw/keywordplanner/home"
    },
    "google_trends": {
      "seedUrlTemplate": "https://trends.google.com/trends/explore?geo={market}&hl={language}&q={query}"
    }
  }
}
```

Notes:
- `Google Ads / Keyword Planner` is login-dependent.
- The tool does not manage credentials.
- The browser profile should already be authenticated.
- A dedicated research profile is required; active work profiles are not allowed.
- When `helperUrl` is set, `operator-hub` can call a host-side helper that uses the authenticated browser session while the hub stays in Docker.
- `Google Keyword Planner` runs are serialized per `session_hint`. Do not expect parallel Planner batches against the same session/profile to finish faster.

## Modes

- `background`
  - default
  - should not disturb active work
  - prefers headless capture where possible, especially for Google Trends

- `manual`
  - uses the same dedicated research profile
  - intended for cases where Google Ads flows need visible/manual help
  - still must not use a normal work profile

## Output

```json
{
  "ok": true,
  "project_slug": "parkpal",
  "run_id": "parkpal-abc123def456",
  "generated_at": "2026-03-25T10:00:00.000Z",
  "summary": "Captured demand data from google_trends. Structured keyword extraction was limited; inspect screenshots and raw captures for manual follow-up.",
  "themes": [],
  "keywords": [],
  "demand_signals": [],
  "service_angles": [],
  "source_coverage": [],
  "artifacts": []
}
```

Returned fields:
- `summary`
- `themes`
- `keywords`
- `demand_signals`
- `service_angles`
- `source_coverage`
- `artifacts`

## Artifact storage

Per run:

- [`.local/research/search-demand/<project_slug>/<run_id>/`](/home/sajden/github/operator-hub/.local/research/search-demand)

Files written:
- `screenshots/*.png`
- `raw/*.html`
- `raw-captures.json`
- `normalized-result.json`
- `summary.md`

Per project:
- `manifest.json`

## Extraction vs inference

Directly extracted:
- rendered page HTML text
- visible labels and nearby keyword text
- screenshots

Inferred by `operator-hub`:
- intent category
- demand bucket when only growth language is visible
- grouped themes
- service angles

## Known limitations

- `Google Ads / Keyword Planner` flows are UI/session dependent and may require a source-specific URL template in the session manifest.
- Structured parsing is heuristic and based on rendered HTML text, not official APIs.
- If the dedicated research profile is open in another browser instance, Chromium may fail to reuse it cleanly.
- This tool is designed to return partial success rather than fail the entire run when one source is unavailable.
- If the helper service is down, the tool now returns an explicit helper-unavailable error instead of a generic `fetch failed`.

## Manual verification

1. Create a session manifest if you need authenticated reuse:

```bash
mkdir -p /home/sajden/github/operator-hub/.local/browser-sessions/google-ads-main
```

2. Start the host-side helper if `operator-hub` is running in Docker:

```bash
/home/sajden/github/operator-hub/scripts/start_search_demand_helper_wsl.sh
```

For stable day-to-day use, install it once as a user service:

```bash
/home/sajden/github/operator-hub/scripts/install_search_demand_helper_service.sh
```

Then verify:

```bash
systemctl --user status operator-hub-search-demand-helper.service
curl http://127.0.0.1:8788/health
```

3. Start the hub:

```bash
cd /home/sajden/github/operator-hub/hub
npm run dev
```

4. Call the tool:

```bash
curl -sS http://localhost:8787/api/mcp/call \
  -H 'Content-Type: application/json' \
  -d '{
    "tool": "capture_search_demand_insights",
    "arguments": {
      "project_slug": "parkpal",
      "seed_queries": ["parking app", "parking operations software"],
      "market": "SE",
      "language": "en",
      "sources": ["google_trends"],
      "notes": "Manual demand capture test"
    }
  }'
```

5. Verify:
- response includes `source_coverage`
- artifacts are written under `.local/research/search-demand/parkpal/`
- `summary.md` exists

## Example invocation payload

```json
{
  "tool": "capture_search_demand_insights",
  "arguments": {
    "project_slug": "parkpal",
    "seed_queries": [
      "parking app",
      "parking operations software",
      "parking permit management"
    ],
    "market": "SE",
    "language": "en",
    "sources": ["google_keyword_planner", "google_trends"],
    "session_hint": "google-ads-main",
    "notes": "Research for homepage messaging and SEO"
  }
}
```
