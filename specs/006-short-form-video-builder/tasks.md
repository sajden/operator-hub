# Tasks: Short-Form Video Builder

**Input**: Design documents from `/specs/006-short-form-video-builder/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/short-form-api-contract.md

**Tests**: Manual smoke validation is the primary validation mode for v1. Add targeted direct-module checks where practical.

**Organization**: Tasks are grouped by user story so the feature can be delivered incrementally.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: Which user story the task belongs to

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Create short-form feature docs and contract files in `/home/sajden/github/operator-hub/specs/006-short-form-video-builder/`
- [ ] T002 [P] Add frontend short-form type and client scaffolds in `/home/sajden/github/operator-hub/app/src/types/shortForm.ts` and `/home/sajden/github/operator-hub/app/src/data/shortFormClient.ts`
- [ ] T003 [P] Add hub module scaffolds in `/home/sajden/github/operator-hub/hub/shortFormVideoTools.mjs`, `/home/sajden/github/operator-hub/hub/shortFormWatcher.mjs`, and `/home/sajden/github/operator-hub/hub/shortFormCloudWatcher.mjs`
- [ ] T004 [P] Add route and page scaffold in `/home/sajden/github/operator-hub/app/src/pages/ShortFormVideoPage.tsx` and route wiring in `/home/sajden/github/operator-hub/app/src/App.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T005 Implement persistent job storage and workspace helpers in `/home/sajden/github/operator-hub/hub/shortFormVideoTools.mjs`
- [ ] T006 [P] Implement API routes from `short-form-api-contract.md` in `/home/sajden/github/operator-hub/hub/server.mjs`
- [ ] T007 [P] Add batch summary integration for short-form watchers in `/home/sajden/github/operator-hub/app/src/pages/BatchJobsPage.tsx` and `/home/sajden/github/operator-hub/hub/server.mjs`
- [ ] T008 Define Remotion worker scaffold for short-form rendering in `/home/sajden/github/operator-hub/workers/remotion-short-form-video/`

**Checkpoint**: Manual job records can be created and listed in the UI.

---

## Phase 3: User Story 1 - Monitor Incoming Video Jobs In Operator Hub (Priority: P1)

**Goal**: The operator can see short-form jobs, their current steps, and failures in `operator-hub`.

**Independent Test**: Detect or create a job and confirm the page shows stable job metadata, step statuses, and stored errors.

- [ ] T009 [P] [US1] Implement short-form job list and detail data loading in `/home/sajden/github/operator-hub/app/src/data/shortFormClient.ts` and `/home/sajden/github/operator-hub/app/src/pages/ShortFormVideoPage.tsx`
- [ ] T010 [P] [US1] Build reusable short-form status UI components in `/home/sajden/github/operator-hub/app/src/components/short-form/`
- [ ] T011 [US1] Implement job step persistence, logs, and summary shaping in `/home/sajden/github/operator-hub/hub/shortFormVideoTools.mjs`
- [ ] T012 [US1] Integrate short-form navigation and batch-job entry points in `/home/sajden/github/operator-hub/app/src/App.tsx`, `/home/sajden/github/operator-hub/app/src/components/shell/PlannerSidebar.tsx`, and `/home/sajden/github/operator-hub/app/src/pages/BatchJobsPage.tsx`

**Checkpoint**: Job visibility and inspection work before full processing is complete.

---

## Phase 4: User Story 2 - Manually Prepare And Render A Job (Priority: P1)

**Goal**: The operator can create a job, run prepare, inspect outputs, override article choice, and render a review cut.

**Independent Test**: Create a manual job, run prepare, override article if needed, and render successfully from the page.

- [ ] T013 [US2] Implement manual job creation and source-folder registration in `/home/sajden/github/operator-hub/hub/shortFormVideoTools.mjs` and `/home/sajden/github/operator-hub/hub/server.mjs`
- [ ] T014 [US2] Implement clip discovery, filename ordering, trimming, filtering, and transcript persistence in `/home/sajden/github/operator-hub/hub/shortFormVideoTools.mjs`
- [ ] T015 [US2] Implement caption manifest generation, article selection, article override handling, and article screenshot persistence in `/home/sajden/github/operator-hub/hub/shortFormVideoTools.mjs`
- [ ] T016 [US2] Implement render manifest generation and Remotion render handoff in `/home/sajden/github/operator-hub/hub/shortFormVideoTools.mjs`, `/home/sajden/github/operator-hub/hub/remotionTools.mjs`, and `/home/sajden/github/operator-hub/workers/remotion-short-form-video/`
- [ ] T017 [US2] Implement review UI for transcript, captions, article selection, and artifact paths in `/home/sajden/github/operator-hub/app/src/pages/ShortFormVideoPage.tsx` and `/home/sajden/github/operator-hub/app/src/components/short-form/`
- [ ] T018 [US2] Implement manual `Prepare`, `Render`, and `Rerun article capture` actions in `/home/sajden/github/operator-hub/app/src/data/shortFormClient.ts` and `/home/sajden/github/operator-hub/app/src/pages/ShortFormVideoPage.tsx`

**Checkpoint**: Manual end-to-end pipeline is demoable without watchers.

---

## Phase 5: User Story 3 - Run The Same Pipeline From Watchers And OneDrive (Priority: P2)

**Goal**: Local watcher and cloud watcher both feed the same internal job model and page.

**Independent Test**: Detect a local job folder and a cloud job folder; verify both appear with the same lifecycle shape and can be reviewed in the same page.

- [ ] T019 [P] [US3] Implement local folder watcher with stable-folder detection and dedupe state in `/home/sajden/github/operator-hub/hub/shortFormWatcher.mjs`
- [ ] T020 [P] [US3] Implement OneDrive/Graph-backed cloud watcher with dedupe state in `/home/sajden/github/operator-hub/hub/shortFormCloudWatcher.mjs`
- [ ] T021 [US3] Connect watcher registration and job-claim logic into `/home/sajden/github/operator-hub/hub/shortFormVideoTools.mjs` and `/home/sajden/github/operator-hub/hub/server.mjs`
- [ ] T022 [US3] Add watcher summaries and recent detected jobs to `/home/sajden/github/operator-hub/app/src/pages/BatchJobsPage.tsx` and `/home/sajden/github/operator-hub/app/src/pages/ShortFormVideoPage.tsx`

**Checkpoint**: Automatic ingestion works through the same UI and APIs as manual jobs.

---

## Phase 6: Polish & Validation

- [ ] T023 [P] Improve review-required and failure UX states in `/home/sajden/github/operator-hub/app/src/components/short-form/` and `/home/sajden/github/operator-hub/app/src/pages/ShortFormVideoPage.tsx`
- [ ] T024 [P] Document runtime env vars, watcher paths, and expected workspace outputs in `/home/sajden/github/operator-hub/README.md` and `/home/sajden/github/operator-hub/specs/006-short-form-video-builder/quickstart.md`
- [ ] T025 Record manual validation outcomes for manual jobs, local watcher jobs, and cloud watcher jobs in `/home/sajden/github/operator-hub/specs/006-short-form-video-builder/quickstart.md`

## Suggested MVP Scope

Recommended MVP:

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4

That delivers the highest-value path: visible jobs, manual prepare, manual article override, and manual render.
