# Feature Specification: Video Pipeline Service + Editor UI

**Feature Branch**: `007-video-editor-and-social-copy`
**Created**: 2026-04-26
**Updated**: 2026-04-27
**Status**: Draft

## Problem

The short-form video pipeline lives inside `operator-hub` which means:
- Restarting operator-hub drops watcher state and active jobs
- Everything is coupled — a broken social copy prompt requires restarting the whole hub
- The pipeline can't run independently on another machine or server
- The UI mixes orchestration logic with display logic

## Goal

Extract the entire video pipeline into a standalone `video-pipeline` service with its own Docker stack. `operator-hub` becomes a thin dashboard that reads status and triggers actions via API — it does not need to be running for the pipeline to function.

---

## Architecture

```
┌─────────────────────────────────────────┐
│            video-pipeline               │
│                                         │
│  watcher (OneDrive + local)             │
│  bg-removal triggering                  │
│  transcription                          │
│  render orchestration                   │
│  social copy (via social-copy-api)      │
│  OneDrive upload                        │
│  job state (JSON on disk)               │
│                                         │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │  bgremover   │  │ social-copy-api │  │
│  └──────────────┘  └─────────────────┘  │
└──────────────────┬──────────────────────┘
                   │ REST API
┌──────────────────▼──────────────────────┐
│             operator-hub                │
│  UI dashboard — reads/triggers via API  │
│  does NOT own any pipeline state        │
└─────────────────────────────────────────┘
```

`operator-hub` only needs `VIDEO_PIPELINE_URL` to connect. The pipeline can run on any machine.

---

## Part 1 — video-pipeline Service

New repo or top-level directory: `video-pipeline/`

### Docker stack (`video-pipeline/docker-compose.yml`)

```yaml
services:
  pipeline:        # main service — all pipeline logic
  bgremover:       # background removal (moved from operator-hub)
  social-copy-api: # OpenAI social copy generation
```

### Responsibilities

- **Watcher**: polls OneDrive (Microsoft Graph) for new no-bg clips per slot, detects when a slot is ready to render
- **Job orchestration**: runs steps in sequence — discover → transcribe → prepare → render → social_copy → upload
- **Job state**: owns all state files (`watcher-state.json`, `slot-cloud-state.json`, `bg-cloud-state.json`, per-job `job.json`)
- **REST API**: exposes endpoints for operator-hub UI to consume

### API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/jobs` | List all jobs (summary) |
| `GET` | `/jobs/:id` | Full job detail including steps, clips, paths |
| `GET` | `/jobs/:id/transcript` | All clip transcripts for a job |
| `GET` | `/jobs/:id/social-copy` | Social copy markdown |
| `POST` | `/jobs/:id/social-copy/generate` | Generate (or regenerate) social copy |
| `POST` | `/jobs/:id/approve-article` | Approve article and trigger render |
| `POST` | `/jobs/:id/render` | Trigger render |
| `POST` | `/jobs/:id/upload` | Trigger OneDrive upload |
| `GET` | `/watchers` | Watcher status (slots, last poll, pending) |
| `GET` | `/health` | Service health |

### What moves out of operator-hub

- `hub/shortFormVideoTools.mjs` → `pipeline/src/shortFormVideo.mjs`
- `hub/bgRemoverCloudWatcher.mjs` → `pipeline/src/bgWatcher.mjs`
- `hub/agents/findNewsArticle.mjs` → `pipeline/src/agents/findNewsArticle.mjs`
- `hub/agents/generateSocialCopy.mjs` → thin HTTP client (already done)
- All job state under `.local/short-form-video/` → owned by pipeline service
- `bgremover` container → moves to `video-pipeline/docker-compose.yml`
- `social-copy-api` container → moves to `video-pipeline/docker-compose.yml`

---

## Part 2 — social-copy-api (already built)

Lives at `workers/social-copy-api/`. No changes needed — just moves into the `video-pipeline` Docker stack instead of `operator-hub`.

---

## Part 3 — operator-hub becomes a thin dashboard

### What stays in operator-hub

- REST API routes that proxy/forward to `video-pipeline`
- React frontend (`app/`)
- Microsoft auth
- Any non-video features (SEO tools, advisor, etc.)

### What gets removed from operator-hub

- `shortFormVideoTools.mjs`
- `bgRemoverCloudWatcher.mjs`
- `hub/agents/findNewsArticle.mjs`
- `hub/agents/generateSocialCopy.mjs`
- `bgremover` from `docker-compose.yml`
- `social-copy-api` from `docker-compose.yml`
- All short-form job state ownership

### New env var

```
VIDEO_PIPELINE_URL=http://video-pipeline:3420
```

---

## Part 4 — Video Editor UI

Rebuild `ShortFormVideoPage` into a two-panel editor that shows every step and its output.

### Layout

```
┌──────────────────────────────────────────────────┐
│  video-6  •  done  •  13 clips  •  27 apr 2026   │
├──────────────┬───────────────────────────────────┤
│  STEG        │  DETALJER                         │
│              │                                   │
│  ✓ Hitta klipp│ (visar output för valt steg)     │
│  ✓ Transkribera                                  │
│  ✓ Förbered  │                                   │
│  ✓ Rendera   │                                   │
│  ✗ Social    │                                   │
│  ✓ Ladda upp │                                   │
└──────────────┴───────────────────────────────────┘
```

### Per-steg detaljvy

| Steg | Visar |
|---|---|
| Hitta klipp | Lista klipp, filnamn, filstorlek |
| Transkribera | Varje klipp med sin text + tystnadstrim |
| Förbered | Artikel (titel, URL, screenshot), klipplista |
| Rendera | Inbäddad videospelare för `review-cut.mp4` |
| Social copy | Markdown-preview per plattform + "Generera nu"-knapp om saknas |
| Ladda upp | OneDrive-sökväg, tidsstämpel |

---

## Migreringsordning

1. **Bygg `video-pipeline` service** med egen docker-compose (bgremover + social-copy-api)
2. **Flytta pipeline-logik** dit från operator-hub
3. **Uppdatera operator-hub** att anropa video-pipeline API istället för intern logik
4. **Bygg ny editor-UI** mot det nya API:t
5. **Ta bort gammal kod** ur operator-hub

## Out of Scope

- Redigera transkript i UI (framtid)
- Schemaläggning av poster till sociala medier (framtid)
- Flytta jobbstate till databas (utvärdera efter separation)
