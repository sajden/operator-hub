# `collect_stock_media`

Bounded stock-media collection capability for shared `operator-hub` integrations.

This tool is intended to run after `search_stock_media`. It takes explicit stock selections and saves them locally with provenance metadata.

## Purpose

Collect explicitly selected stock assets into a local stock-media store inside `operator-hub`.

The tool is intentionally narrow:
- only explicit selections may be collected
- no provider crawling
- no freeform discovery
- files are stored locally with provenance and licensing context

## Tool name

- `collect_stock_media`

## Input

```json
{
  "projectSlug": "seb-castwall-site",
  "selections": [
    {
      "provider": "pexels",
      "id": "123456",
      "assetType": "stock_photo",
      "title": "Founder portrait near a window",
      "sourceUrl": "https://www.pexels.com/photo/example/",
      "downloadUrl": "https://images.pexels.com/photos/123456/pexels-photo-123456.jpeg",
      "creatorName": "Jane Doe",
      "creatorUrl": "https://www.pexels.com/@jane-doe",
      "license": "Pexels License"
    }
  ]
}
```

### Fields

- `projectSlug`
  - required

- `selections[]`
  - required
  - explicit chosen stock candidates

Each selection must include:
- `provider`
- `id`
- `sourceUrl`
- `downloadUrl`

Optional but recommended:
- `assetType`
- `title`
- `creatorName`
- `creatorUrl`
- `license`

## Output

```json
{
  "ok": true,
  "projectSlug": "seb-castwall-site",
  "assets": [
    {
      "provider": "pexels",
      "id": "123456",
      "type": "stock_photo",
      "title": "Founder portrait near a window",
      "sourceUrl": "https://www.pexels.com/photo/example/",
      "localPath": ".local/assets/stock-media/seb-castwall-site/seb-castwall-site-pexels-abc123def456.jpg",
      "width": 4000,
      "height": 6000
    }
  ],
  "errors": [],
  "attempted": 1,
  "savedTo": ".local/assets/stock-media/seb-castwall-site"
}
```

## Local asset layout

Assets are written under:

- [`.local/assets/stock-media/`](/home/sajden/github/operator-hub/.local/assets/stock-media)

Per project:

- `.local/assets/stock-media/<projectSlug>/`

Each saved asset gets:
- image file
- adjacent provenance metadata JSON
- `manifest.json`

## Provenance metadata

Each asset metadata file records:
- `projectSlug`
- `assetType`
- `title`
- `provider`
- `providerAssetId`
- `sourceUrl`
- `downloadUrl`
- `localPath`
- `width`
- `height`
- `contentType`
- `creatorName`
- `creatorUrl`
- `license`
- provenance mode
  - `approved_stock_asset`

## Determinism

The tool is designed to stay bounded and predictable:
- only explicit stock selections are attempted
- filenames are deterministic from `projectSlug + provider + id + downloadUrl`
- no extra provider lookups are performed

## Manual verification

1. Run `search_stock_media` and choose a result.
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
    "tool": "collect_stock_media",
    "arguments": {
      "projectSlug": "seb-castwall-site",
      "selections": [
        {
          "provider": "pexels",
          "id": "123456",
          "assetType": "stock_photo",
          "title": "Founder portrait near a window",
          "sourceUrl": "https://www.pexels.com/photo/example/",
          "downloadUrl": "https://images.pexels.com/photos/123456/pexels-photo-123456.jpeg",
          "creatorName": "Jane Doe",
          "creatorUrl": "https://www.pexels.com/@jane-doe",
          "license": "Pexels License"
        }
      ]
    }
  }'
```

4. Verify:
- local files exist under `.local/assets/stock-media/seb-castwall-site/`
- metadata JSON exists beside each asset
- `manifest.json` is updated

## Smoke-test path

A minimal local script is provided at:

- [hub/scripts/collect-stock-media-smoke.mjs](/home/sajden/github/operator-hub/hub/scripts/collect-stock-media-smoke.mjs)
