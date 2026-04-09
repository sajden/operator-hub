# Remotion Service Explainer Agent Guide

Use this worker like an editable Remotion project, not like a fixed scene pack.

Start with `SYSTEM-PROMPT.md` and this guide before changing scene code.

## Goal

Create short service explainer videos that make a concrete business problem understandable.

The best outputs do not merely show three layouts.
They show a transformation:
- problem
- intervention
- calmer result

## Working rule

Pick one service use case per video.

Good first use cases:
- connect systems so data lands in the right place
- automate a manual intake or follow-up step
- replace scattered status tracking with one internal overview

Avoid mixing multiple use cases into the first cut.

## Required design checkpoints

Before polishing animation, the agent should lock:

1. Audience
- usually small or medium businesses

2. Use case
- one concrete problem only

3. Visual metaphor
- one strong metaphor that can carry the whole video

4. Styleframes
- three still key moments:
  - problem
  - intervention
  - outcome

## Visual quality rules

Prefer:
- one dominant idea per scene
- fewer elements with stronger hierarchy
- transformation over accumulation
- clean left-to-right or center-to-out motion
- visuals that make the process understandable without long reading

Avoid:
- too many boxes
- slide-deck layouts
- decorative screenshots that do not explain the process
- human stock images when the scene is about systems and data movement
- text doing all the explanatory work

## Asset rules

Use only:
- local owner assets
- collected stock assets from operator-hub

If using stock assets:
1. search
2. collect
3. inspect
4. reject bad matches
5. wire in only approved files

Reject assets that feel:
- generic office stock
- futuristic sci-fi
- visually noisy
- unrelated to the process being explained

## Default narrative structure

### Stage 1: Problem
Show what is hard today.
Examples:
- manual handoffs
- duplicate data entry
- unclear status
- scattered systems

### Stage 2: Intervention
Show the smallest clear structural change.
Examples:
- one integration layer
- one automation route
- one internal tool or dashboard

### Stage 3: Outcome
Show what becomes calmer.
Examples:
- data lands in the right system directly
- fewer manual steps
- one clear status view
- less operational friction

## Code strategy

Prefer editing:
- `src/ServiceExplainerMotion.mjs`
- `src/motion.mjs`
- `src/scenes/*`
- `src/Root.mjs` when composition defaults or preview setup need updates

Do not start by expanding scene count.
Start by making the existing sequence explain something clearly.

## Rendering rule

Do not treat render as exploration.
Render after the storyboard is coherent.

Use:
- `render_service_explainer_motion`

The render tool is for validating the current design pass, not for discovering the idea from scratch.
