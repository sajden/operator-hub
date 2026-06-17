# Quickstart: Short-Form Video Builder

## Prerequisites

- `operator-hub` checked out locally
- Node.js 22+
- Existing local hub runtime working
- Any required media-processing dependencies installed for the eventual implementation
- Optional Microsoft login configured if cloud watcher validation is needed

## 1. Start the hub

```bash
cd /home/sajden/github/operator-hub/hub
npm run dev
```

Expected:
- hub starts successfully
- short-form endpoints respond when implemented

## 2. Start the frontend

```bash
cd /home/sajden/github/operator-hub/app
npm install
npm run dev
```

Open the Vite URL.

## 3. Open the short-form page

Expected first release behavior:
- route exists in the main shell
- job list is visible
- operator can inspect at least one selected job
- page shows step-level status, not only one global state

## 4. Manual job smoke test

1. Create or point to a folder containing at least two no-background clips.
2. Create a short-form job manually.
3. Run `Prepare`.
4. Review transcript, captions, article selection, and screenshot state.
5. If needed, set a manual article URL and rerun article capture.
6. Run `Render`.

Expected result:
- job advances from `queued` to `preparing` to a prepared state
- review artifacts are visible before render
- render writes a `review-cut.mp4` path into the job record

## 5. Local watcher smoke test

1. Put a stable job folder into the configured local watch input.
2. Wait for watcher detection.
3. Open the short-form page or batch-jobs page.

Expected result:
- a new short-form job appears automatically
- source is labeled as local watcher
- no duplicate job is created for the same unchanged folder

## 6. Cloud watcher smoke test

1. Configure Microsoft auth for `operator-hub`.
2. Put a valid job folder into the configured OneDrive path.
3. Wait for the cloud watcher poll interval.

Expected result:
- a new short-form job appears automatically
- source is labeled as cloud watcher
- the same internal job lifecycle is used as for manual and local jobs

## 7. Validation Record

- Spec written on 2026-04-16.
- Implementation validation not yet recorded.
