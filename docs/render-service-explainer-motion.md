# `render_service_explainer_motion`

Bounded Remotion capability for short service explainer motion.

This renderer is for:
- service-page explanation
- before/after process visuals
- problem -> decision -> outcome storytelling

It is not a generic hero-video renderer.

## What it does

The tool:
- creates a render job under `.local/renders/service-explainer-motion/<projectSlug>/`
- uses local owner-media and/or previously collected stock-media
- supports a structured `brief`
- accepts explicit `scenes[]` or builds default explainer scenes
- renders via a dedicated Dockerized Remotion worker when available

## First version

Current v1 focus:
- `mode: "three_step_process"`
- scene types:
  - `problem_flow`
  - `decision_router`
  - `outcome_dashboard`

The default scene plan maps:
- `brief.problem` -> `problem_flow`
- `brief.decision` -> `decision_router`
- `brief.outcome` -> `outcome_dashboard`

## Input

```json
{
  "projectSlug": "seb-castwall-site",
  "title": "Services Explainer Motion",
  "mode": "three_step_process",
  "serviceType": "automation",
  "tone": "clean_premium",
  "pace": "medium",
  "aspectRatio": "landscape",
  "durationInSeconds": 10,
  "fps": 30,
  "palette": {
    "bgDark": "#111821",
    "bgLight": "#f6f2ea",
    "accent": "#e9c58d",
    "accentCool": "#7aa2ff"
  },
  "brief": {
    "problem": "Too many manual steps and unclear follow-up",
    "decision": "Choose automation as the first step",
    "outcome": "Less manual work and clearer status"
  },
  "ownerAssetPaths": [],
  "stockAssetPaths": []
}
```

## Asset rules

- The composition does not fetch freeform external image URLs.
- Assets should come from:
  - local owner-media
  - collected stock-media (for example via the Pexels flow)
- If no assets are provided, the first version still renders using shape/system visuals only.

## Output

```json
{
  "ok": true,
  "projectSlug": "seb-castwall-site",
  "renderJob": {
    "jobId": "seb-castwall-site-abc123",
    "status": "rendered",
    "compositionPath": ".local/renders/service-explainer-motion/seb-castwall-site/job.composition.json",
    "plannedOutputPath": ".local/renders/service-explainer-motion/seb-castwall-site/job.mp4"
  },
  "renderExecution": {
    "attempted": true,
    "mode": "docker",
    "ok": true,
    "outputPath": ".local/renders/service-explainer-motion/seb-castwall-site/job.mp4"
  },
  "composition": {
    "id": "service-explainer-motion",
    "mode": "three_step_process",
    "serviceType": "automation",
    "tone": "clean_premium"
  },
  "savedTo": ".local/renders/service-explainer-motion/seb-castwall-site"
}
```

## File layout

```text
.local/renders/service-explainer-motion/<projectSlug>/
```

Per job:
- `<jobId>.composition.json`
- `<jobId>.job.json`
- `manifest.json`
- `<jobId>.mp4`

## Known limitations

- The first version focuses on one strong mode, not a full explainer-template library.
- The worker image must exist before Docker rendering succeeds.
- AI can help generate `scenes[]` or refine the Remotion code, but the runtime remains deterministic and job-based.
