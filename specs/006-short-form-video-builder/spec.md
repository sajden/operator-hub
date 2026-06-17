# Feature Specification: Short-Form Video Builder

**Feature Branch**: `006-short-form-video-builder`  
**Created**: 2026-04-16  
**Status**: Draft  
**Input**: User description: "Build a short-form video builder in operator-hub that takes no-background talking-head clips from the same kind of OneDrive/watcher flow as bg-remover, lets me inspect the process in operator-hub, and also lets me run jobs manually when needed."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Monitor Incoming Video Jobs In Operator Hub (Priority: P1)

As the operator, I can see detected short-form video jobs in `operator-hub`, understand what stage each job is in, and review failures without needing to inspect raw folders first.

**Why this priority**: If the system is not observable, it will be hard to trust or debug. Visibility is the main reason this feature belongs in `operator-hub`.

**Independent Test**: Drop or detect a job folder with a few clips, open the short-form page, and verify the UI shows the job, its current stage, source folder, clip count, and any step failure.

**Acceptance Scenarios**:

1. **Given** a new job folder appears in the configured input location, **When** the watcher detects it, **Then** the job appears in `operator-hub` with a stable id, source path, and queued or processing status.
2. **Given** a job is running through multiple steps such as trim, transcription, article lookup, and render, **When** the operator opens the page, **Then** the UI shows per-step progress rather than a single opaque loading state.
3. **Given** one step fails, **When** the job stops or enters a review-required state, **Then** the UI preserves the job record and explains which step failed and why.

---

### User Story 2 - Manually Prepare And Render A Job (Priority: P1)

As the operator, I can manually create or trigger a job, inspect transcript, captions, and article choice, and then render the review cut when the prepared result looks acceptable.

**Why this priority**: The original spec is multi-step and partly heuristic. Manual review and manual reruns are necessary for a reliable v1.

**Independent Test**: Create a job manually from a local or cloud-backed folder, run preparation, inspect the prepared artifacts, override the article if needed, and trigger render from the UI.

**Acceptance Scenarios**:

1. **Given** the operator has a valid folder with no-background clips, **When** they trigger `Prepare`, **Then** the system sorts clips by filename, trims silence, filters bad clips, transcribes kept clips, and stores preview artifacts without rendering the final video yet.
2. **Given** article auto-discovery is wrong or low-confidence, **When** the operator supplies or edits a manual article URL, **Then** the system uses the override and regenerates the article screenshot and render manifest.
3. **Given** preparation has completed successfully, **When** the operator triggers `Render`, **Then** the system produces a review-cut video and stores the resulting artifact paths and metadata on the same job record.

---

### User Story 3 - Run The Same Pipeline From Watchers And OneDrive (Priority: P2)

As the operator, I can use the same short-form pipeline from both a local watcher path and a OneDrive/Graph-backed watcher path, without building two separate systems.

**Why this priority**: This mirrors the proven `bg-remover` pattern in `operator-hub` and keeps ingestion consistent across local and cloud flows.

**Independent Test**: Configure one local watcher and one cloud watcher, let each detect at least one job, and verify both create the same internal job shape and use the same downstream pipeline.

**Acceptance Scenarios**:

1. **Given** a new job folder appears in the local watch directory, **When** the watcher claims it, **Then** it is converted into the same internal job model used by the UI and processing tools.
2. **Given** a new job folder appears in the configured OneDrive path, **When** the cloud watcher detects it through Microsoft Graph, **Then** it is converted into the same internal job model with cloud-specific metadata preserved.
3. **Given** watcher ingestion has already created a job, **When** the operator later opens that job manually in the UI, **Then** the same job can be reviewed, retried, or rendered without duplication.

### Edge Cases

- A folder contains files that are still uploading or syncing and should not be processed yet.
- A folder contains no valid video clips after filtering.
- A clip is technically valid but becomes too short after silence trimming.
- A clip transcribes poorly or fails transcription while the rest succeed.
- Article discovery returns weak matches, non-news pages, or obvious false positives.
- The selected article page is blocked by a cookie wall, paywall, or broken mobile layout.
- The no-background clip format does not preserve alpha correctly in the render pipeline.
- The watcher restarts mid-job and must avoid duplicate processing.
- OneDrive access is temporarily unavailable or token scopes are insufficient.
- The operator wants to rerun only article capture or only render without repeating every earlier step.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support a short-form video job model where one source folder maps to one final review-cut video.
- **FR-002**: The system MUST support both local-watcher ingestion and OneDrive/Graph-backed cloud-watcher ingestion.
- **FR-003**: The system MUST use ascending filename order as the canonical clip sequence.
- **FR-004**: The system MUST detect when a folder or file is still being written and avoid processing unstable input.
- **FR-005**: The system MUST create a persistent internal job record before starting expensive processing.
- **FR-006**: The system MUST split execution into at least two explicit phases: `prepare` and `render`.
- **FR-007**: The `prepare` phase MUST trim leading and trailing silence conservatively for each clip.
- **FR-008**: The system MUST filter clearly unusable clips such as empty clips, broken clips, or clips with almost no speech.
- **FR-009**: The system MUST transcribe each kept clip and store per-clip transcript output plus a combined full-job transcript.
- **FR-010**: The system MUST generate caption data in a structured format consumable by Remotion.
- **FR-011**: The system MUST attempt article discovery from the combined transcript.
- **FR-012**: The system MUST support manual article override through `article.txt`, UI input, or both.
- **FR-013**: The system MUST continue without article background when article selection fails or confidence is too low.
- **FR-014**: The system MUST capture an article screenshot in a mobile- or vertical-friendly browser viewport when a usable article URL exists.
- **FR-015**: The system MUST generate a render manifest that includes cleaned clips, transcript references, caption references, article background asset state, and composition settings.
- **FR-016**: The render phase MUST produce a vertical review cut with a target composition of `1080x1920`.
- **FR-017**: The render phase MUST place the no-background speaker clips above the article background when one exists.
- **FR-018**: The render phase MUST support simple transitions only, limited to cut, fade, or wipe.
- **FR-019**: The render phase MUST support optional subtle transition SFX and MUST NOT require SFX to succeed.
- **FR-020**: The system MUST generate social-post text outputs from the prepared transcript and selected article context.
- **FR-021**: The UI MUST expose job-level status plus per-step status for discovery, prepare, and render activity.
- **FR-022**: The UI MUST support manual job creation or manual job trigger in addition to automatic watcher ingestion.
- **FR-023**: The UI MUST support rerunning at least `prepare`, `article capture`, and `render` from an existing job.
- **FR-024**: The hub MUST expose short-form job APIs so the app and future MCP/tool consumers use the same surface.
- **FR-025**: The job system MUST preserve logs, warnings, and failure reasons per job.
- **FR-026**: The system MUST store outputs and metadata in a deterministic workspace folder per job.
- **FR-027**: The watcher and cloud watcher MUST avoid creating duplicate jobs for the same source folder revision.
- **FR-028**: The system MUST support a `review_required` state distinct from `failed`.
- **FR-029**: The feature MUST integrate into the existing `operator-hub` navigation and batch-job visibility model rather than behaving as a disconnected mini-app.

### Experience Principles

- The product should feel inspectable, not magical.
- Manual control should exist wherever heuristics can reasonably fail.
- Watchers should create jobs automatically, but the operator should always be able to review or rerun.
- The UI should reveal pipeline stages clearly enough that the operator can explain why a job succeeded, paused, or failed.
- The v1 should favor reliability, deterministic outputs, and legible manifests over aggressive automation.

### Key Entities *(include if feature involves data)*

- **ShortFormJob**: The canonical record for one video job, from source-folder discovery through review-cut render.
- **JobSource**: Metadata describing whether the job came from manual creation, local watcher, or cloud watcher.
- **JobStep**: A named step such as discover, trim, transcribe, article lookup, article capture, manifest generation, render, or social copy.
- **ClipRecord**: Metadata and processing results for one source clip, including ordering, trim ranges, transcript, and filter status.
- **TranscriptRecord**: Per-clip and combined transcription outputs with timing data.
- **CaptionManifest**: Structured caption pages and highlight metadata for Remotion.
- **ArticleSelection**: Auto-selected or manually overridden article choice, including confidence and source.
- **RenderManifest**: The prepared job payload that the Remotion worker consumes.
- **WatcherState**: Persistent dedupe and progress state for the local watcher or cloud watcher.

## Assumptions

- `operator-hub` remains the orchestration layer and should reuse the same pattern as `bg-remover`: hub tools, watcher, cloud watcher, and dedicated page.
- This v1 is local-first and single-user.
- Manual review is acceptable and preferred when article selection confidence is low.
- Existing Remotion patterns in `operator-hub` should be reused instead of inventing a second rendering architecture.
- The input source may originate from a Windows/OneDrive workflow, but processing and visibility should be controlled from the Linux/WSL-hosted `operator-hub`.
- Full autoposting to social platforms remains out of scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A newly detected short-form source folder appears in the `operator-hub` UI within 60 seconds of becoming stable in the watched location.
- **SC-002**: The operator can inspect a job and identify its current step or failure point within 10 seconds of opening the short-form page.
- **SC-003**: For a valid job with at least two usable clips, the system can complete `prepare` without manual filesystem intervention.
- **SC-004**: The operator can override article selection and rerun article capture without recreating the whole job.
- **SC-005**: The system can render a `1080x1920` review cut from a prepared job and store the output path on the job record.
- **SC-006**: Local watcher and cloud watcher flows both create the same internal job shape and surface it through the same UI.
- **SC-007**: When article discovery fails, the job still reaches either `prepared_without_article` or `review_required` rather than hard-failing the entire pipeline.
