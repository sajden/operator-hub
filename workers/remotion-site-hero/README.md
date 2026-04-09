# Remotion Site Hero Worker

First standalone render worker for `operator-hub`.

Current role:
- read a bounded `render_site_hero_motion` job
- validate composition + referenced assets
- write an execution plan
- stay runnable on demand from CLI

This worker is intentionally small and deterministic so other repos or agents can invoke it without depending on the UI.

## Input contract

The worker expects a job created by:

- `render_site_hero_motion`

Example:

```bash
cd /home/sajden/github/operator-hub/workers/remotion-site-hero
npm run render:job -- \
  --job /home/sajden/github/operator-hub/.local/renders/site-hero-motion/seb-castwall-site/<jobId>.job.json \
  --dry-run
```

Actual render:

```bash
cd /home/sajden/github/operator-hub/workers/remotion-site-hero
npm run render:job -- \
  --job /home/sajden/github/operator-hub/.local/renders/site-hero-motion/seb-castwall-site/<jobId>.job.json
```

If Remotion cannot find a browser automatically, set:

```bash
export OPERATOR_HUB_REMOTION_BROWSER_EXECUTABLE=/usr/bin/google-chrome
```

Preview the composition locally:

```bash
cd /home/sajden/github/operator-hub/workers/remotion-site-hero
npm run preview
```

## Current behavior

The worker currently:
- validates job + composition existence
- validates referenced assets exist
- writes:
  - `outputs/<jobId>.execution-plan.json`
  - `outputs/<jobId>.input-props.json`
- can now trigger a local Remotion render if a browser is available

If rendering succeeds, the planned `.mp4` output path from the job file is used.

## Why this exists

This is the first step toward a real standalone render runtime that can be:
- called by `operator-hub`
- called by `auto-web`
- run locally
- later wrapped in Docker

## Docker

Build:

```bash
cd /home/sajden/github/operator-hub/workers/remotion-site-hero
docker build -t operator-hub-remotion-site-hero .
```

Run dry-run:

```bash
docker run --rm \
  -v /home/sajden/github/operator-hub:/workspace/operator-hub \
  -w /workspace \
  operator-hub-remotion-site-hero \
  npm run render:job -- \
    --job /workspace/operator-hub/.local/renders/site-hero-motion/seb-castwall-site/<jobId>.job.json \
    --dry-run
```

Run actual render:

```bash
docker run --rm \
  -v /home/sajden/github/operator-hub:/workspace/operator-hub \
  -w /workspace \
  operator-hub-remotion-site-hero \
  npm run render:job -- \
    --job /workspace/operator-hub/.local/renders/site-hero-motion/seb-castwall-site/<jobId>.job.json
```

## Next step

Replace the dry-run execution-plan step with a real Remotion render adapter while keeping the same job contract.
