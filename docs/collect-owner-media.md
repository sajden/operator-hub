# `collect_owner_media`

First bounded media capability for shared `operator-hub` integrations.

This tool is intended for repos such as `auto-web` that need approved visual assets without building freeform scraping into each repo.

## Purpose

Collect explicitly approved owner media into a local asset store inside `operator-hub`.

The tool is intentionally narrow:
- only approved URLs may be touched
- only approved local files inside the project raw folder may be touched
- no crawling
- no discovery beyond the given source list
- direct-image ingest is preferred
- screenshots are allowed only for approved page URLs and only through a local browser command

## Tool name

- `collect_owner_media`

## Input

```json
{
  "projectSlug": "seb-castwall-site",
  "approvedUrls": [
    "https://example.com/portrait.jpg",
    "https://example.com/about"
  ],
  "approvedLocalPaths": [
    "portrait-01.jpg",
    "headshots/portrait-02.png"
  ],
  "assetTypes": ["profile", "screenshot"],
  "maxAssets": 4
}
```

### Fields

- `projectSlug`
  - required
  - used for deterministic local asset storage

- `approvedUrls[]`
  - optional
  - explicit URL allowlist
  - only `http` and `https`

- `approvedLocalPaths[]`
  - optional
  - explicit local-file allowlist for owner assets
  - each path must stay inside:
    - `.local/assets/owner-media/<projectSlug>/raw/`
  - relative paths are resolved from that `raw/` folder
  - absolute paths are accepted only if they still point inside that `raw/` folder

- source requirement
  - at least one of `approvedUrls[]` or `approvedLocalPaths[]` must be provided

- `assetTypes[]`
  - required
  - currently supported:
    - `screenshot`
    - `thumbnail`
    - `profile`

- `maxAssets`
  - optional
  - upper bound for saved assets

## Output

```json
{
  "ok": true,
  "projectSlug": "seb-castwall-site",
  "assets": [
    {
      "type": "profile",
      "sourceUrl": "local://.local/assets/owner-media/seb-castwall-site/raw/portrait-01.jpg",
      "localPath": ".local/assets/owner-media/seb-castwall-site/seb-castwall-site-profile-abc123def456.jpg",
      "width": 1200,
      "height": 1200
    }
  ],
  "errors": [],
  "attempted": 2,
  "savedTo": ".local/assets/owner-media/seb-castwall-site"
}
```

### Behavior

- `ok = true`
  - no collection errors

- `ok = false`
  - partial success or total failure
  - see `errors[]`

- `assets[]`
  - successfully collected assets only

- `errors[]`
  - per-source, per-asset-type failures with clear messages

## Local asset layout

Assets are written under:

- [`.local/assets/owner-media/`](/home/sajden/github/operator-hub/.local/assets/owner-media)

Per project:

- `.local/assets/owner-media/<projectSlug>/`

Each saved asset gets:
- binary/image file
- adjacent provenance metadata JSON
- `manifest.json` for the project collection

Recommended local source folder:

- `.local/assets/owner-media/<projectSlug>/raw/`

Example source files:

- `.local/assets/owner-media/seb-castwall-site/raw/portrait-01.jpg`
- `.local/assets/owner-media/seb-castwall-site/raw/headshots/portrait-02.png`

## Provenance metadata

Each asset metadata file records:
- `projectSlug`
- `assetType`
- `sourceUrl`
- `sourcePath`
- `localPath`
- `width`
- `height`
- `contentType`
- `collectedAt`
- provenance mode
  - `approved_direct_image`
  - `approved_local_file`
  - `browser_screenshot`
- deterministic key
- browser command if screenshot was used

## Current collection modes

### Direct image

Used when:
- the approved URL itself returns `image/*`

Supported now:
- `thumbnail`
- `profile`

### Local owner file

Used when:
- the request includes `approvedLocalPaths[]`
- each path points to an image file inside the project `raw/` folder

Supported now:
- `thumbnail`
- `profile`

Not supported:
- `screenshot` from local files

### Screenshot

Used when:
- asset type is `screenshot`
- the approved URL is a page URL
- a local Chromium-compatible command is available

Current browser discovery:
- `OPERATOR_HUB_SCREENSHOT_BROWSER`
- `/usr/bin/chromium`
- `/usr/bin/chromium-browser`
- `/usr/bin/google-chrome`
- `/usr/bin/google-chrome-stable`
- `/usr/bin/microsoft-edge`

If no compatible browser command is found:
- the tool returns partial success with a clear error

## Determinism

The tool is designed to be deterministic within the given input:
- only explicit URL/type combinations are attempted
- only explicit local-file/type combinations are attempted
- filenames are hash-based from `projectSlug + assetType + sourceUrl`
- no freeform scraping or source expansion is performed

## Extensibility

This tool is designed to be the first media capability, not the last.

Natural next tools:
- `capture_public_profile_preview`
- `render_site_hero_motion`
- `search_stock_media`

The current design keeps room for:
- richer asset typing
- provider-backed renderers
- Remotion MCP integration
- policy/approval enforcement per project

## Manual verification

1. Prepare a local source file:

```bash
mkdir -p /home/sajden/github/operator-hub/.local/assets/owner-media/seb-castwall-site/raw
cp /path/to/your/image.jpg /home/sajden/github/operator-hub/.local/assets/owner-media/seb-castwall-site/raw/portrait-01.jpg
```

2. Start the hub:

```bash
cd /home/sajden/github/operator-hub/hub
npm run dev
```

3. Call the tool through the existing MCP-like surface:

```bash
curl -sS http://localhost:8787/api/mcp/call \
  -H 'Content-Type: application/json' \
  -d '{
    "tool": "collect_owner_media",
    "arguments": {
      "projectSlug": "seb-castwall-site",
      "approvedLocalPaths": [
        "portrait-01.jpg"
      ],
      "assetTypes": ["profile"],
      "maxAssets": 1
    }
  }'
```

4. Verify:
- the response includes `assets[]`
- files exist under `.local/assets/owner-media/seb-castwall-site/`
- metadata JSON exists beside each asset
- `manifest.json` is updated

## Smoke-test path

A minimal local script is provided at:

- [hub/scripts/collect-owner-media-smoke.mjs](/home/sajden/github/operator-hub/hub/scripts/collect-owner-media-smoke.mjs)

Use it with explicit approved URLs or explicit approved local paths to verify local behavior without going through the UI.

Example with local files:

```bash
node /home/sajden/github/operator-hub/hub/scripts/collect-owner-media-smoke.mjs \
  seb-castwall-site \
  profile \
  "" \
  "portrait-01.jpg,headshots/portrait-02.png" \
  2
```
