# Agent Remotion Prompt Playbook

Use this when an agent such as Claude Code or Codex should create a service explainer from a free-text prompt.

This playbook is intentionally closer to Remotion's AI workflow than to a bounded template renderer. The agent should behave like the video designer. The render tool should behave like the render button.

## Core model

There are three layers:

1. Design layer
- the agent interprets the brief
- it chooses one concrete use case
- it locks a visual metaphor
- it produces storyboard and styleframes before polishing motion

2. Editing layer
- the agent edits the Remotion project directly
- it changes scene code, timing, composition structure, palette, and asset usage

3. Render layer
- `operator-hub` renders the finished result deterministically through `render_service_explainer_motion`

Do not confuse these layers.

The tool does not invent the video.
The agent invents the video.
The tool renders it.

## Which project the agent should work in

For service explainers, the editable project is:
- [workers/remotion-service-explainer](/home/sajden/github/operator-hub/workers/remotion-service-explainer)

Treat this like the editable Remotion project in the Remotion Claude Code guide.

## The default workflow

### 1. Start from one concrete use case

Do not start from all services at once.

Good:
- `Koppla ihop system så att data hamnar rätt direkt`
- `Automatisera offertförfrågningar som idag hanteras manuellt`
- `Ge teamet en tydlig intern dashboard i stället för Excel och mejltrådar`

Bad:
- `Show automation, integrations and internal tools in one 8 second video`

The first iteration should explain one thing well.

### 2. Lock the visual metaphor before animating

Before editing motion, define one visual metaphor for the chosen use case.

Examples:
- `integration bus between isolated systems`
- `broken handoffs becoming one clean path`
- `manual inbox triage turning into one routed pipeline`
- `scattered status views collapsing into one calm dashboard`

If the metaphor is unclear, do not render yet.

### 3. Create 3 still styleframes first

Before producing a polished video, the agent should shape three still key moments:
- `problem`
- `intervention`
- `outcome`

The first good question is not `how should this animate?`
It is `what should each stage look like?`

A render should usually wait until these three moments are visually coherent.

### 4. Use bounded assets only

Assets may come from:
- local owner media
- collected stock media from the hub

Do not pull arbitrary remote URLs directly into the Remotion code.

If stock is needed:
1. use `search_stock_media`
2. use `collect_stock_media`
3. inspect the collected assets
4. only then wire them into the Remotion scene

Do not use an asset just because it exists.
The agent should reject images that feel:
- generic
- sci-fi
- mismatched to the metaphor
- too human-focused when the scene is about systems and data flow

### 5. Edit the Remotion project directly

The agent should work in:
- [workers/remotion-service-explainer/src](/home/sajden/github/operator-hub/workers/remotion-service-explainer/src)

Typical changes:
- restructure scenes
- replace weak scene primitives
- simplify text
- improve hierarchy
- change palette defaults
- change motion pacing
- replace decorative imagery with better visuals

### 6. Render through the hub only after the design pass

Once the storyboard, assets and scenes are coherent, render through:
- `render_service_explainer_motion`

This keeps output reproducible for:
- `operator-hub`
- `auto-web`
- future agents

## What the agent should do before the first render

Before the first serious render, produce these working notes in the task or commit message:
- chosen use case
- chosen visual metaphor
- chosen asset set
- one-line intent for each of the 3 stages

If these are not clear, the agent is rendering too early.

## Recommended prompt shape

A good prompt includes:
- one audience
- one use case
- one problem
- one desired emotional tone
- one constraint on assets

Example:

```text
Create a premium service explainer for small businesses about connecting systems.
Show the current problem first: CRM, email, Excel and booking data are moved manually.
Then show one integration layer connecting them.
End with a calmer operational view where data lands in the right place immediately.
Use only local or collected assets. Avoid generic people imagery.
```

## When the agent should not render yet

Do not render yet when:
- the brief still mixes multiple services
- the metaphor is weak
- the scene is still relying on placeholder copy
- the agent is compensating with more boxes instead of clearer motion
- assets have not been reviewed

## Relationship to Remotion's system prompt

Use Remotion's system-prompt guidance to inform how code is written:
- treat the worker like a real Remotion project
- keep compositions explicit
- use React-based scene code, not hidden magic
- prefer clear frame-driven logic over ad hoc hacks

But do not copy the Remotion docs blindly into this project.
Apply the guidance to this worker's current structure.

## Current mental model for Claude Code or Codex

Use this simple rule:
- agent = designer-director-engineer
- worker project = editable Remotion source
- `render_service_explainer_motion` = render button

That is the intended Claude-style loop.

## Best practice for service explainers

Prefer this sequence:
1. choose one use case
2. define the metaphor
3. make 3 coherent keyframes
4. animate the transitions
5. render
6. compare and iterate

Not this sequence:
1. prompt
2. auto-generate 3 random scenes
3. hope the render explains something

## Related docs

- [Render Service Explainer Motion](/home/sajden/github/operator-hub/docs/render-service-explainer-motion.md)
- [Agent Media Playbook](/home/sajden/github/operator-hub/docs/agent-media-playbook.md)
- [Agent Guide: Using `operator-hub` From Another Repo](/home/sajden/github/operator-hub/docs/agent-using-operator-hub.md)
- [workers/remotion-service-explainer/AGENT.md](/home/sajden/github/operator-hub/workers/remotion-service-explainer/AGENT.md)
