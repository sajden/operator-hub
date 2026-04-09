# Agent Media Playbook

This is the practical playbook for agents such as `auto-web` that want to use `operator-hub` for media collection and video rendering.

Use this document as the linked contract for agent workflows.

If the goal is true prompt-to-video behavior with Claude Code or Codex editing a real Remotion project first, also use:
- [Agent Remotion Prompt Playbook](/home/sajden/github/operator-hub/docs/agent-remotion-prompt-playbook.md)

## Goal

An agent should be able to:
- collect owner media
- search and collect stock media
- capture bounded public previews
- render a site hero motion

The agent should not need to know:
- local filesystem layout
- Docker commands
- Remotion CLI details
- browser paths

The hub owns those details.

## Main flow

Typical order:

1. `collect_owner_media`
2. optional `search_stock_media`
3. optional `collect_stock_media`
4. optional `capture_public_profile_preview`
5. `render_site_hero_motion`

## Tool 1: `collect_owner_media`

Use when the project already has approved local images or explicit approved URLs.

Example:

```json
{
  "tool": "collect_owner_media",
  "arguments": {
    "projectSlug": "seb-castwall-site",
    "approvedLocalPaths": [
      "parkpal/hero/founder-portrait.jpg",
      "parkpal/product/dashboard-shot.png"
    ],
    "assetTypes": ["profile", "thumbnail"],
    "maxAssets": 4
  }
}
```

Use this first if project-owned media exists.

## Tool 2: `search_stock_media`

Use when project-owned media is not enough.

Example:

```json
{
  "tool": "search_stock_media",
  "arguments": {
    "query": "startup founder portrait",
    "providers": ["pexels"],
    "orientation": "portrait",
    "maxResults": 3
  }
}
```

This only returns candidates.

## Tool 3: `collect_stock_media`

Use after selecting one or more stock search results.

Example:

```json
{
  "tool": "collect_stock_media",
  "arguments": {
    "projectSlug": "seb-castwall-site",
    "selections": [
      {
        "provider": "pexels",
        "id": "7414220",
        "assetType": "stock_photo",
        "title": "Team of young entrepreneurs brainstorming and discussing startup strategies in a modern office setting.",
        "sourceUrl": "https://www.pexels.com/photo/woman-in-black-leather-jacket-sitting-on-chair-7414220/",
        "downloadUrl": "https://images.pexels.com/photos/7414220/pexels-photo-7414220.jpeg",
        "creatorName": "RDNE Stock project",
        "creatorUrl": "https://www.pexels.com/@rdne",
        "license": "Pexels License"
      }
    ]
  }
}
```

This saves the stock asset locally with provenance.

## Tool 4: `capture_public_profile_preview`

Use for one explicit public page or profile preview.

Example:

```json
{
  "tool": "capture_public_profile_preview",
  "arguments": {
    "projectSlug": "seb-castwall-site",
    "approvedUrl": "https://example.com/about",
    "label": "about-preview"
  }
}
```

Do not use this for freeform scraping.

## Tool 5: `render_site_hero_motion`

Use when there is enough media to render a video.

The hub:
- builds a composition
- builds a job
- dispatches the Dockerized Remotion worker
- returns the output path when render succeeds

This is a bounded render tool.
It is not the same thing as a free prompt-to-video coding loop.

For that pattern:
- let the agent edit the Remotion project directly
- then render through the hub

Example:

```json
{
  "tool": "render_site_hero_motion",
  "arguments": {
    "projectSlug": "seb-castwall-site",
    "title": "Parkpal Product Motion",
    "template": "product_story",
    "focus": "product",
    "tone": "operator_tech",
    "pace": "fast",
    "cta": "See Parkpal in action",
    "contentArea": "parkpal",
    "aspectRatio": "square",
    "durationInSeconds": 6,
    "fps": 24
  }
}
```

## Render brief fields

### `template`

Supported:
- `founder_intro`
- `startup_signal`
- `product_story`
- `case_strip`

### `focus`

Supported:
- `founder`
- `product`
- `brand`
- `mixed`

### `tone`

Supported:
- `clean_premium`
- `operator_tech`
- `bold_editorial`
- `calm_trust`

### `pace`

Supported:
- `slow`
- `medium`
- `fast`

### `contentArea`

Use this to bias asset selection toward a specific part of the project.

Examples:
- `parkpal`
- `parkpal/hero`
- `founder`

### `aspectRatio`

Supported:
- `square`
- `portrait`
- `landscape`

## Decision rules for agents

Use these defaults:

- If project-owned media exists, prefer `collect_owner_media` first.
- If project-owned media is weak or incomplete, use `search_stock_media`.
- Only collect stock assets that clearly match the brief.
- Use `product_story` when product/screenshots should lead.
- Use `founder_intro` when a founder portrait should lead.
- Use `startup_signal` for launch or startup-energy videos.
- Use `case_strip` for a quicker montage style.
- Use `operator_tech` for sharper, more high-tech visuals.
- Use `clean_premium` for calmer and more premium visuals.
- Use `fast` pace for launch/demo motion.
- Use `medium` pace as the default.

## Expected render result

Successful render result should include:
- `renderJob.status = rendered`
- `renderExecution.ok = true`
- `renderExecution.outputPath = .local/.../*.mp4`

## Current constraint

The system is deterministic and bounded.

That means:
- no freeform scraping
- no freeform image crawling
- no arbitrary render code generation at runtime

Agents should work through the hub contract, not around it.
