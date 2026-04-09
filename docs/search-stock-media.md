# `search_stock_media`

First bounded stock-media discovery capability for shared `operator-hub` integrations.

This tool is intended for repos such as `auto-web` that need safe candidate discovery from approved stock providers before any asset is collected locally.

## Purpose

Search approved stock-photo providers and return candidate metadata with provenance.

The tool is intentionally narrow:
- only supported providers may be queried
- no freeform scraping
- no direct downloading in this step
- returns bounded candidate lists only
- intended to feed a later `collect_stock_media` capability

## Tool name

- `search_stock_media`

## Input

```json
{
  "query": "confident founder portrait natural light",
  "providers": ["pexels", "unsplash"],
  "orientation": "portrait",
  "maxResults": 8
}
```

### Fields

- `query`
  - required
  - search phrase sent to the provider

- `providers[]`
  - optional
  - supported now:
    - `pexels`
    - `unsplash`
  - defaults to both in a deterministic order

- `orientation`
  - optional
  - supported now:
    - `landscape`
    - `portrait`
    - `squarish`
  - defaults to `landscape`

- `maxResults`
  - optional
  - total upper bound across providers

## Output

```json
{
  "ok": true,
  "query": "confident founder portrait natural light",
  "orientation": "portrait",
  "providers": ["pexels", "unsplash"],
  "results": [
    {
      "provider": "pexels",
      "assetType": "stock_photo",
      "id": "123456",
      "title": "Founder portrait near a window",
      "previewUrl": "https://images.pexels.com/photos/123456/pexels-photo-123456.jpeg",
      "sourceUrl": "https://www.pexels.com/photo/example/",
      "downloadUrl": "https://images.pexels.com/photos/123456/pexels-photo-123456.jpeg",
      "width": 4000,
      "height": 6000,
      "creatorName": "Jane Doe",
      "creatorUrl": "https://www.pexels.com/@jane-doe",
      "license": "Pexels License",
      "provenance": {
        "mode": "stock_search",
        "provider": "pexels",
        "query": "confident founder portrait natural light",
        "orientation": "portrait"
      }
    }
  ],
  "errors": [],
  "attemptedProviders": 2
}
```

### Behavior

- `ok = true`
  - all attempted providers succeeded

- `ok = false`
  - partial success or total failure
  - see `errors[]`

- `results[]`
  - candidate assets only
  - no files are downloaded or saved locally in this step

- `errors[]`
  - provider-level failures such as:
    - missing API key
    - provider request failure

## Approved providers

### Pexels

Configuration:

- `OPERATOR_HUB_PEXELS_API_KEY`

Search endpoint used:

- provider photo search API

### Unsplash

Configuration:

- `OPERATOR_HUB_UNSPLASH_ACCESS_KEY`

Search endpoint used:

- provider photo search API

## Determinism

The tool is designed to stay bounded and predictable:
- provider set is explicit
- orientation is explicit
- results are sorted deterministically by provider and provider asset id
- no scraping or provider expansion is performed

## Extensibility

This tool is intended to pair with:
- `collect_stock_media`
- `capture_public_profile_preview`
- `render_site_hero_motion`

It leaves room for:
- richer stock providers
- license filtering
- style tags
- local collection of selected stock candidates

## Manual verification

1. Set one or more provider keys in the hub environment.

Example:

```bash
export OPERATOR_HUB_PEXELS_API_KEY="..."
export OPERATOR_HUB_UNSPLASH_ACCESS_KEY="..."
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
    "tool": "search_stock_media",
    "arguments": {
      "query": "confident founder portrait natural light",
      "providers": ["pexels", "unsplash"],
      "orientation": "portrait",
      "maxResults": 8
    }
  }'
```

4. Verify:
- `results[]` returns candidate rows
- `errors[]` clearly explains missing or failing providers
- no local files are created yet

## Smoke-test path

A minimal local script is provided at:

- [hub/scripts/search-stock-media-smoke.mjs](/home/sajden/github/operator-hub/hub/scripts/search-stock-media-smoke.mjs)
