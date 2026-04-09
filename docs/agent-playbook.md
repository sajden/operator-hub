# Agent Playbook

This is the top-level entry point for agents that use `operator-hub`.

Use this document first.

It answers:
- what `operator-hub` is for
- what layers exist
- where to find the right contracts
- which docs to use for each workflow

## What `operator-hub` is

`operator-hub` is the shared capability layer for local operator workflows and other repos.

It should be the place where agents go for:
- planner and board operations
- project graph and Excel sync
- Microsoft OAuth and calendar access
- bounded media collection
- bounded Remotion render workflows

It should not be treated as:
- a random UI repo
- a place to invent new integration contracts ad hoc
- a direct replacement for provider APIs

Agents should prefer the hub contracts over custom one-off scripts.

## Main layers

### 1. App layer

Purpose:
- human-facing UI
- dashboard, boards, week, connections, media

Primary reference:
- [Current Architecture Map](/home/sajden/github/operator-hub/docs/current-architecture-map.md)

### 2. Hub layer

Purpose:
- tools
- skills
- integrations
- persistence
- dispatch

Primary references:
- [Integration Hub Architecture](/home/sajden/github/operator-hub/docs/integration-hub-architecture.md)
- [Using The Hub From Other Repos](/home/sajden/github/operator-hub/docs/using-hub-from-other-repos.md)

### 3. Worker layer

Purpose:
- on-demand execution runtimes
- currently Remotion render execution

Primary reference:
- [Agent Media Runtime Setup](/home/sajden/github/operator-hub/docs/agent-media-runtime-setup.md)

## Agent workflow map

Choose the domain first.

### Planner / execution workflows

Use when the task is about:
- daily board
- week planning
- work items
- actions
- M365 calendar import/sync

Start here:
- [Current Architecture Map](/home/sajden/github/operator-hub/docs/current-architecture-map.md)

### Integration / provider workflows

Use when the task is about:
- OAuth
- provider connections
- Microsoft Graph
- future Google or other external systems

Start here:
- [Integration Hub Architecture](/home/sajden/github/operator-hub/docs/integration-hub-architecture.md)

### Media / render workflows

Use when the task is about:
- owner media
- stock media
- previews
- video rendering

Start here:
- [Agent Media Playbook](/home/sajden/github/operator-hub/docs/agent-media-playbook.md)

Supporting docs:
- [Collect Owner Media](/home/sajden/github/operator-hub/docs/collect-owner-media.md)
- [Search Stock Media](/home/sajden/github/operator-hub/docs/search-stock-media.md)
- [Collect Stock Media](/home/sajden/github/operator-hub/docs/collect-stock-media.md)
- [Capture Public Profile Preview](/home/sajden/github/operator-hub/docs/capture-public-profile-preview.md)
- [Render Site Hero Motion](/home/sajden/github/operator-hub/docs/render-site-hero-motion.md)
- [Agent Remotion Prompt Playbook](/home/sajden/github/operator-hub/docs/agent-remotion-prompt-playbook.md)

## Default agent rules

Agents should:
- use existing hub tools before inventing new local scripts
- keep workflows bounded and deterministic
- prefer local manifests and saved assets over re-fetching when possible
- treat provider APIs as internal implementation details when a hub tool already exists
- treat Docker workers as execution runtimes, not planning/intelligence layers

Agents should not:
- add freeform scraping
- bypass explicit approved URLs or approved local paths
- hardcode provider-specific behavior into unrelated features
- assume UI routes are the primary contract

## How to choose the right document

If the agent needs:

- a system overview:
  - use this file

- the current planner/calendar/app behavior:
  - use [Current Architecture Map](/home/sajden/github/operator-hub/docs/current-architecture-map.md)

- the target hub/provider model:
  - use [Integration Hub Architecture](/home/sajden/github/operator-hub/docs/integration-hub-architecture.md)

- exact media tool usage:
  - use [Agent Media Playbook](/home/sajden/github/operator-hub/docs/agent-media-playbook.md)

- exact runtime/worker model:
  - use [Agent Media Runtime Setup](/home/sajden/github/operator-hub/docs/agent-media-runtime-setup.md)

## Current stable agent-facing surfaces

These are the primary agent-facing contracts today:
- `/api/mcp/call`
- `/api/skills/run`
- `/api/hub/tools`
- `/api/skills`

Agents should prefer these over ad hoc file edits when a capability already exists.

## Recommended next-level structure

As the repo grows, keep this pattern:
- one top-level agent playbook
- one playbook per major domain
- one architecture map for current behavior
- one architecture doc for target state

That keeps the repo understandable for both humans and agents.
