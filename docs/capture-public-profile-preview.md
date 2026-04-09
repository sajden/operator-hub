# `capture_public_profile_preview`

Bounded screenshot capability for one explicit public profile or page URL.

This tool is intended to create deterministic visual previews for site-building and later motion/render workflows.

## Purpose

Capture a single public-page preview and save it locally with provenance metadata.

The tool is intentionally narrow:
- one explicit approved URL per call
- no crawling
- no scraping beyond the screenshot itself
- local screenshot only through a Chromium-compatible browser command

## Tool name

- `capture_public_profile_preview`

## Input

```json
{
  "projectSlug": "seb-castwall-site",
  "approvedUrl": "https://example.com/about",
  "label": "about-page",
  "viewportWidth": 1440,
  "viewportHeight": 900
}
```

## Output

```json
{
  "ok": true,
  "projectSlug": "seb-castwall-site",
  "preview": {
    "type": "public_profile_preview",
    "sourceUrl": "https://example.com/about",
    "localPath": ".local/assets/public-previews/seb-castwall-site/seb-castwall-site-about-page-abc123def456.png",
    "width": 1440,
    "height": 900
  },
  "savedTo": ".local/assets/public-previews/seb-castwall-site"
}
```

## Local asset layout

Assets are written under:

- [`.local/assets/public-previews/`](/home/sajden/github/operator-hub/.local/assets/public-previews)

Per project:

- `.local/assets/public-previews/<projectSlug>/`

Each saved preview gets:
- screenshot PNG
- adjacent provenance metadata JSON
- `manifest.json`

## Provenance metadata

Each preview metadata file records:
- `projectSlug`
- `label`
- `sourceUrl`
- `localPath`
- `width`
- `height`
- `contentType`
- `collectedAt`
- provenance mode
  - `public_profile_preview`

## Manual verification

1. Ensure a local Chromium-compatible browser exists or set:

```bash
export OPERATOR_HUB_SCREENSHOT_BROWSER=/path/to/chromium
```

2. Start the hub:

```bash
cd /home/sajden/github/operator-hub/hub
npm run dev
```

3. Call the tool:

```bash
curl -sS http://localhost:8787/api/mcp/call \
  -H 'Content-Type: application/json' \
  -d '{
    "tool": "capture_public_profile_preview",
    "arguments": {
      "projectSlug": "seb-castwall-site",
      "approvedUrl": "https://example.com/about",
      "label": "about-page"
    }
  }'
```

4. Verify:
- the response includes `preview`
- files exist under `.local/assets/public-previews/seb-castwall-site/`
- metadata JSON exists beside the screenshot

## Smoke-test path

A minimal local script is provided at:

- [hub/scripts/capture-public-profile-preview-smoke.mjs](/home/sajden/github/operator-hub/hub/scripts/capture-public-profile-preview-smoke.mjs)
