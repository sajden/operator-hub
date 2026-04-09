# remotion-service-explainer

Dedicated Remotion worker for `render_service_explainer_motion`.

This worker should be treated like a real editable Remotion project for service explainers.
Do not treat it like a fixed template renderer.

## Purpose

Use this worker to explain one concrete service problem at a time, such as:
- connecting systems so data lands in the right place
- automating a manual intake or follow-up step
- replacing scattered status views with one calm overview

The intended loop is:
1. prompt
2. choose one use case
3. lock a visual metaphor
4. shape 3 still styleframes
5. edit the Remotion code
6. render through the hub

## Key files

- `src/ServiceExplainerMotion.mjs`
- `src/motion.mjs`
- `src/scenes/*`
- `AGENT.md`
- `SYSTEM-PROMPT.md`

## Commands

Preview locally:

```bash
cd /home/sajden/github/operator-hub/workers/remotion-service-explainer
npm install
npm run preview
```

Render a job:

```bash
cd /home/sajden/github/operator-hub/workers/remotion-service-explainer
npm run render:job -- --job /abs/path/to/job.json
```
