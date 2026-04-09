# `render_site_hero_motion`

First bounded hero-motion render capability for shared `operator-hub` integrations.

This capability prepares a local render job and composition contract from collected media assets. It now also attempts to execute the Dockerized Remotion worker automatically when the image is available locally.

The composition is now scene-driven:
- the worker renders a `scenes[]` timeline
- each scene has a bounded `type`
- the tool can either accept explicit `scenes[]` or build defaults from the brief layer

## Purpose

Prepare a local hero-motion render job from:
- collected owner media
- collected stock media
- captured public previews

The current implementation:
- writes a deterministic composition JSON
- writes a render job JSON
- writes a render manifest
- attempts a real Dockerized Remotion render

Important:
- `@remotion/mcp` is a documentation MCP, not the video renderer itself
- this tool prepares the local render contract and can dispatch the standalone render runtime

## Tool name

- `render_site_hero_motion`

## Input

```json
{
  "projectSlug": "seb-castwall-site",
  "title": "Seb Castwall Hero Motion",
  "template": "startup_signal",
  "focus": "product",
  "tone": "operator_tech",
  "pace": "fast",
  "cta": "See Parkpal in action",
  "contentArea": "parkpal",
  "aspectRatio": "square",
  "durationInSeconds": 8,
  "fps": 30,
  "width": 1080,
  "height": 1080,
  "style": "clean-operator"
}
```

Optional overrides:
- `template`: `founder_intro` | `startup_signal` | `product_story` | `case_strip`
- `focus`: `founder` | `product` | `brand` | `mixed`
- `tone`: `clean_premium` | `operator_tech` | `bold_editorial` | `calm_trust`
- `pace`: `slow` | `medium` | `fast`
- `cta`
- `contentArea`
- `aspectRatio`: `square` | `portrait` | `landscape`
- `ownerAssetPaths[]`
- `stockAssetPaths[]`
- `previewAssetPaths[]`
- `scenes[]`

Supported scene types in v1:
- `full_bleed_photo`
- `split_product`
- `headline_overlay`
- `proof_grid`
- `founder_closeup`
- `device_focus`
- `ambient_logo_strip`

Each scene can include:
- `durationFrames`
- `primaryAsset`
- `supportingAssets[]`
- `headline`
- `subheadline`
- `kicker`
- `align`
- `overlayStyle`
- `motionStyle`

If omitted, the tool uses collected local manifests for that project.

## Output

```json
{
  "ok": true,
  "projectSlug": "seb-castwall-site",
  "renderJob": {
    "jobId": "seb-castwall-site-abc123def456",
    "status": "rendered",
    "compositionPath": ".local/renders/site-hero-motion/seb-castwall-site/seb-castwall-site-abc123def456.composition.json",
    "plannedOutputPath": ".local/renders/site-hero-motion/seb-castwall-site/seb-castwall-site-abc123def456.mp4"
  },
  "renderExecution": {
    "attempted": true,
    "mode": "docker",
    "image": "operator-hub-remotion-site-hero",
    "ok": true,
    "outputPath": ".local/renders/site-hero-motion/seb-castwall-site/seb-castwall-site-abc123def456.mp4",
    "error": null
  },
  "composition": {
    "id": "site-hero-motion",
    "title": "Seb Castwall Hero Motion",
    "style": "clean-operator",
    "motion": {
      "template": "startup_signal",
      "focus": "product",
      "tone": "operator_tech",
      "pace": "fast",
      "cta": "See Parkpal in action",
      "contentArea": "parkpal",
      "aspectRatio": "square"
    }
  },
  "savedTo": ".local/renders/site-hero-motion/seb-castwall-site"
}
```

## Local output layout

Render jobs are written under:

- [`.local/renders/site-hero-motion/`](/home/sajden/github/operator-hub/.local/renders/site-hero-motion)

Per project:

- `.local/renders/site-hero-motion/<projectSlug>/`

Each render job writes:
- `<jobId>.composition.json`
- `<jobId>.job.json`
- `manifest.json`
- `<jobId>.mp4` when Docker render succeeds

## Extensibility

This capability is intentionally prepared for the next step:
- real Remotion rendering
- `@remotion/mcp`
- rendered MP4 output
- multiple composition styles

The current brief layer already supports:
- different templates
- different focus priorities
- tone-specific visual treatment
- pace-sensitive motion
- CTA overlays
- filtering by `contentArea`
- scene-engine defaults with bounded scene types

## Manual verification

1. Ensure the project already has collected media assets.
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
    "tool": "render_site_hero_motion",
    "arguments": {
      "projectSlug": "seb-castwall-site",
      "title": "Seb Castwall Hero Motion",
      "durationInSeconds": 8,
      "fps": 30,
      "width": 1080,
      "height": 1080
    }
  }'
```

4. Verify:
- the response includes `renderJob`
- composition/job files exist under `.local/renders/site-hero-motion/seb-castwall-site/`
- `renderExecution.ok` is `true` when Docker render succeeds
- the MP4 exists under `.local/renders/site-hero-motion/seb-castwall-site/`

## Next step

Expand the render brief so agents can drive scene style and content more intelligently.
