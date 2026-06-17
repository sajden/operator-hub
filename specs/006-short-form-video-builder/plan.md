# Implementation Plan: Short-Form Video Builder

**Branch**: `006-short-form-video-builder` | **Date**: 2026-04-16 | **Spec**: [/home/sajden/github/operator-hub/specs/006-short-form-video-builder/spec.md](/home/sajden/github/operator-hub/specs/006-short-form-video-builder/spec.md)
**Input**: Feature specification from `/specs/006-short-form-video-builder/spec.md`

## Summary

Add a new short-form video workflow to `operator-hub` using the same architectural pattern as `bg-remover`: a hub tool layer for job lifecycle and processing orchestration, a local watcher, a cloud watcher backed by Microsoft Graph, and a dedicated UI page for manual job control and pipeline visibility. Split the pipeline into explicit `prepare` and `render` phases so transcript, captions, article selection, and screenshot artifacts can be reviewed before the final review cut is rendered.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Node.js 22+ (hub/workers)  
**Primary Dependencies**: React 18, Vite, existing `operator-hub` hub server, existing Microsoft Graph auth flow, existing Remotion worker patterns, browser automation tooling already used by the repo where available  
**Storage**: Local filesystem under `operator-hub/.local/short-form-video/` for jobs, artifacts, logs, and watcher state; optional mirrored cloud metadata for OneDrive-backed jobs  
**Testing**: Manual smoke validation for watcher detection, prepare flow, article override flow, and render flow; targeted direct-module validation for job manifests and step state transitions  
**Target Platform**: Local `operator-hub` runtime in Docker/WSL/Linux with app access in desktop browser  
**Project Type**: Web app + local hub + media-processing worker flow  
**Performance Goals**: New jobs visible in UI within 60 seconds of stable detection; step updates reflected in UI within 5 seconds; operator can review a prepared job without reading raw output folders  
**Constraints**: Local-first orchestration, must align with existing `bg-remover` watcher pattern, article discovery and screenshot capture are heuristic and must support manual fallback, no autoposting in v1  
**Scale/Scope**: One user, a small queue of active jobs, one or a few watched folders, one review-cut per job

## Constitution Check

*GATE: Must pass before implementation work proceeds.*

- Constitution file remains a placeholder template with no stricter conflicting constraints.
- Gate result: **PASS**.
- Planning intent: reuse existing `operator-hub` patterns instead of inventing a new service boundary.

## Project Structure

### Documentation (this feature)

```text
specs/006-short-form-video-builder/
├── spec.md
├── plan.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── short-form-api-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
operator-hub/
├── app/
│   └── src/
│       ├── data/
│       │   └── shortFormClient.ts
│       ├── pages/
│       │   ├── BatchJobsPage.tsx
│       │   └── ShortFormVideoPage.tsx
│       ├── components/
│       │   └── short-form/
│       └── types/
│           └── shortForm.ts
├── hub/
│   ├── server.mjs
│   ├── shortFormVideoTools.mjs
│   ├── shortFormWatcher.mjs
│   ├── shortFormCloudWatcher.mjs
│   └── remotionTools.mjs
├── workers/
│   └── remotion-short-form-video/
├── .local/
│   └── short-form-video/
└── specs/
    └── 006-short-form-video-builder/
```

**Structure Decision**: Implement the feature fully inside `operator-hub`. Keep ingestion, job status, and API ownership in `hub/`, and keep the video composition implementation in a dedicated Remotion worker similar to existing render workers.

## Architecture Decisions

### 1. Job lifecycle is explicit

Use one canonical job record with these major lifecycle states:

- `queued`
- `preparing`
- `prepared`
- `prepared_without_article`
- `review_required`
- `rendering`
- `done`
- `failed`

This is stricter than `bg-remover` because the pipeline is multi-step and heuristic.

### 2. Prepare and render are separate actions

Preparation owns:
- clip discovery and ordering
- silence trim
- clip filtering
- transcription
- caption generation
- article selection
- article capture
- manifest generation
- social-copy generation

Render owns:
- consumption of the prepared manifest
- Remotion composition
- review-cut export

This separation improves debuggability and lets the operator intervene between stages.

### 3. One pipeline, three ingestion modes

All downstream processing should consume the same internal `ShortFormJob` model regardless of source:

- `manual`
- `watcher_local`
- `watcher_cloud`

The watcher-specific modules only discover and register jobs; they should not invent separate processing logic.

### 4. Persistent workspace per job

Each job should resolve to:

```text
.local/short-form-video/jobs/<job-id>/
  source/
  cleaned/
  transcripts/
  captions/
  assets/
  renders/
  metadata/
  logs/
  job.json
```

This lets the UI and rerun actions rely on deterministic paths.

### 5. Watcher dedupe is folder-revision based

Watcher state should track:
- source identity
- source revision marker
- claimed job id
- last status

For local folders this can be based on stable folder path + file inventory snapshot.  
For cloud folders this can be based on Graph folder/item ids + latest modified timestamps.

### 6. Article selection is reviewable, not authoritative

Article discovery should produce:
- selected URL
- source (`auto`, `article_txt`, `manual_ui`, `none`)
- confidence
- reasoning summary

Low confidence should route to `review_required` or `prepared_without_article`, not a hidden best-guess render.

## Implementation Phases

### Phase 1: Foundation

- Define job data model and API contract.
- Add hub storage layout and job persistence.
- Add frontend route and client scaffolding.

### Phase 2: Job orchestration

- Implement manual job creation and job listing.
- Implement prepare pipeline state machine.
- Implement per-step status and log persistence.

### Phase 3: Watchers

- Implement local watcher.
- Implement cloud watcher using existing Microsoft auth flow.
- Add watcher status to the batch-jobs overview.

### Phase 4: Rendering

- Implement prepared manifest -> Remotion worker handoff.
- Persist render outputs and step metadata.
- Expose rerender endpoints and UI controls.

### Phase 5: Review UX

- Add transcript, caption, article, and artifact review panels.
- Add manual article override and rerun controls.
- Improve failure and review-required presentation.

## Risks And Mitigations

- **Alpha-video compatibility risk**: Validate alpha-preserving source handling early and isolate any FFmpeg conversion requirements behind the prepare pipeline.
- **Article capture fragility**: Make article background optional and preserve rerun controls so one bad page does not poison the job.
- **Watcher duplication risk**: Persist watcher state and source revisions instead of keeping only in-memory session state.
- **Long-running processing risk**: Persist step state on disk after each major step so the UI remains trustworthy across process restarts.
- **OneDrive path ambiguity**: Keep cloud jobs tied to Graph item/folder ids and only mirror local working copies inside the job workspace.

## Recommended MVP Scope

The smallest useful MVP is:

1. Manual job creation
2. `prepare` pipeline
3. Manual article override
4. `render` pipeline
5. Dedicated UI page with step visibility

Watchers should be added immediately after that, reusing the same job lifecycle.
