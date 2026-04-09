# Agent Media Runtime Setup

This is the intended runtime model for repos such as `auto-web`.

## Goal

`operator-hub` should act as the shared capability layer.

Agents and other repos should be able to:
- collect owner media
- search and collect stock media
- capture public previews
- prepare bounded render jobs
- run standalone workers on demand

## Runtime layers

### 1. Capability layer

Lives in:

- [hub/](/home/sajden/github/operator-hub/hub)

This layer exposes tools and skills such as:
- `collect_owner_media`
- `search_stock_media`
- `collect_stock_media`
- `capture_public_profile_preview`
- `prepare_site_media_package`
- `render_site_hero_motion`

### 2. Knowledge layer

Lives in:

- `@remotion/mcp`

This is installed in:

- [hub/package.json](/home/sajden/github/operator-hub/hub/package.json)

Purpose:
- help an AI assistant understand Remotion docs

Important:
- it is not the renderer

### 3. Execution layer

Lives in:

- [workers/remotion-site-hero/](/home/sajden/github/operator-hub/workers/remotion-site-hero)

Purpose:
- run a standalone worker on demand
- validate jobs
- later execute real renders

## Current flow

1. Agent calls `prepare_site_media_package`
2. Agent or repo calls `render_site_hero_motion`
3. Hub writes:
   - composition JSON
   - job JSON
4. Standalone worker runs:
   - `workers/remotion-site-hero`

## Current standalone worker command

```bash
cd /home/sajden/github/operator-hub/workers/remotion-site-hero
npm run render:job -- \
  --job /home/sajden/github/operator-hub/.local/renders/site-hero-motion/seb-castwall-site/<jobId>.job.json \
  --dry-run
```

## Why this structure

This keeps capabilities:
- fristående
- on-demand
- agent-callable
- separable from UI
- dockerizable later without changing tool contracts

## Next step

Replace the dry-run worker with a real Remotion runtime while keeping:
- the same job format
- the same hub tool/skill surface
