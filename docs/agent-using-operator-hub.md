# Agent Guide: Using `operator-hub` From Another Repo

This is the practical guide for agents and repos that want to use `operator-hub` as shared local infrastructure.

Use this when the question is:
- how should another repo call the hub?
- which endpoint should an agent use?
- should a repo talk to Microsoft, media tools, or Remotion directly?

Short answer:
- no
- call `operator-hub`

## Core rule

Another repo should treat `operator-hub` as the shared capability hub.

That means:
- call hub tools
- call hub skills
- let the hub own external integrations
- let the hub own media stores and render dispatch

Do not:
- reimplement the same provider logic in each repo
- call Microsoft Graph directly if the hub already exposes the capability
- call Remotion Docker directly from another repo if the hub already exposes a render tool

## Base URL

Local default:

```text
http://127.0.0.1:8787
```

Normal runtime note:
- `operator-hub` now normally runs as part of the `ai-cam` Docker stack
- another repo can still use `http://127.0.0.1:8787` from the host
- inside Docker-to-Docker routing, the internal service URL is:

```text
http://operator-hub:8787
```

## Main agent-facing surfaces

### Tool discovery

```text
GET /api/hub/tools
GET /api/mcp/tools
```

Use this to discover available tool contracts.

### Tool execution

```text
POST /api/mcp/call
```

Payload shape:

```json
{
  "tool": "tool_name",
  "arguments": {}
}
```

### Skill discovery

```text
GET /api/skills
```

### Skill execution

```text
POST /api/skills/run
```

Payload shape:

```json
{
  "skill": "skill_name",
  "arguments": {}
}
```

## Decision rule: tool or skill?

Use a tool when:
- you know the exact capability you want
- the step is bounded and low-level

Use a skill when:
- you want a multi-step workflow
- you want the hub to orchestrate several tools

## Current domains exposed by the hub

### Planner / work management

Use for:
- boards
- work items
- planner actions
- calendar-backed planning

### Project graph / Excel

Use for:
- graph reads/writes
- projection
- workbook sync

### Media / render

Use for:
- owner media
- stock media
- previews
- Remotion render jobs

Primary reference:
- [Agent Media Playbook](/home/sajden/github/operator-hub/docs/agent-media-playbook.md)
- [Agent Remotion Prompt Playbook](/home/sajden/github/operator-hub/docs/agent-remotion-prompt-playbook.md)

### Integrations

Use for:
- Microsoft auth-backed capabilities
- future provider-backed capabilities

Primary reference:
- [Integration Hub Architecture](/home/sajden/github/operator-hub/docs/integration-hub-architecture.md)

## Example: another repo wants a video

Recommended flow:

1. Collect owner media if available
2. Search stock media if needed
3. Collect chosen stock media
4. Call `render_site_hero_motion`

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

Expected result:
- the hub prepares the job
- the hub dispatches the Dockerized Remotion worker
- the hub returns `renderExecution.outputPath`

## Example: another repo wants project help

```json
{
  "tool": "get_project_summary",
  "arguments": {
    "projectId": "parkpal"
  }
}
```

Or:

```json
{
  "skill": "suggest_next_outreach_steps",
  "arguments": {
    "projectId": "parkpal"
  }
}
```

## Recommended agent prompt pattern

If an external repo is AI-driven, point it to:
- [Agent Playbook](/home/sajden/github/operator-hub/docs/agent-playbook.md)
- [Agent Media Playbook](/home/sajden/github/operator-hub/docs/agent-media-playbook.md)
- this file

That gives the agent:
- top-level orientation
- domain-specific media guidance
- practical API usage guidance

## What another repo should cache mentally

An agent using `operator-hub` should assume:
- tools are the stable low-level contracts
- skills are the stable workflow contracts
- Docker workers are execution details owned by the hub
- local files and manifests are internal implementation details unless explicitly returned

## Current best practice

From another repo:
- discover with `/api/hub/tools` or `/api/skills`
- execute through `/api/mcp/call` or `/api/skills/run`
- do not bypass the hub when a capability already exists

That keeps the system reusable and prevents duplicate integration logic.
