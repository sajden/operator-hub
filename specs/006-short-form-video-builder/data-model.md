# Data Model: Short-Form Video Builder

## 1. ShortFormJob

Canonical persistent record for one pipeline run.

```json
{
  "id": "sfv_20260416_test1_ab12cd",
  "title": "test1",
  "status": "prepared",
  "createdAt": "2026-04-16T13:20:00.000Z",
  "updatedAt": "2026-04-16T13:24:00.000Z",
  "source": {
    "kind": "watcher_cloud",
    "label": "OneDrive no-bg-videos/test1",
    "sourcePath": "Seb/Videos/no-bg-videos/test1",
    "sourceFolderId": "01ABCDEF...",
    "revisionKey": "01ABCDEF...:2026-04-16T13:19:20.000Z"
  },
  "config": {
    "articleMode": "auto_then_fallback",
    "captionPreset": "clean-news",
    "transitionPreset": "fade",
    "sfxPreset": "soft-whoosh",
    "manualArticleUrl": null
  },
  "summary": {
    "clipCount": 3,
    "usableClipCount": 3,
    "fullTranscriptChars": 482,
    "articleSelected": true,
    "rendered": false
  },
  "paths": {
    "workspaceDir": ".local/short-form-video/jobs/sfv_20260416_test1_ab12cd",
    "manifestPath": ".local/short-form-video/jobs/sfv_20260416_test1_ab12cd/job.json",
    "renderManifestPath": ".local/short-form-video/jobs/sfv_20260416_test1_ab12cd/metadata/render-manifest.json",
    "reviewCutPath": null
  }
}
```

## 2. Job Status

Allowed top-level status values:

- `queued`
- `preparing`
- `prepared`
- `prepared_without_article`
- `review_required`
- `rendering`
- `done`
- `failed`

## 3. JobStep

Each job carries explicit step records.

```json
{
  "key": "transcribe",
  "status": "done",
  "startedAt": "2026-04-16T13:21:00.000Z",
  "finishedAt": "2026-04-16T13:22:30.000Z",
  "message": "3 clips transcribed",
  "warning": null,
  "error": null,
  "outputs": {
    "combinedTranscriptPath": "transcripts/full-transcript.json"
  }
}
```

Allowed step status values:

- `pending`
- `running`
- `done`
- `warning`
- `skipped`
- `failed`

Recommended step keys:

- `discover`
- `trim`
- `filter`
- `transcribe`
- `captions`
- `find_article`
- `capture_article`
- `prepare_manifest`
- `social_copy`
- `render`

## 4. ClipRecord

```json
{
  "index": 0,
  "sourceFileName": "20260414_154115000_iOS-nobg-20260414182750.mov",
  "sourcePath": "source/20260414_154115000_iOS-nobg-20260414182750.mov",
  "sortKey": "20260414_154115000_iOS-nobg-20260414182750.mov",
  "trim": {
    "leadingSeconds": 0.18,
    "trailingSeconds": 0.32
  },
  "kept": true,
  "rejectReason": null,
  "cleanedPath": "cleaned/clip-000.mov",
  "transcriptPath": "transcripts/clip-000.json",
  "durationSeconds": 5.42
}
```

## 5. TranscriptRecord

Per clip:

```json
{
  "clipIndex": 0,
  "text": "OpenAI is now going deeper into chip infrastructure.",
  "words": [
    { "word": "OpenAI", "start": 0.12, "end": 0.45 }
  ]
}
```

Combined:

```json
{
  "fullText": "...",
  "clips": ["transcripts/clip-000.json", "transcripts/clip-001.json"]
}
```

## 6. CaptionManifest

```json
{
  "preset": "clean-news",
  "pages": [
    {
      "start": 0.0,
      "end": 1.2,
      "text": "OPENAI GOES",
      "highlighted": ["OPENAI"]
    }
  ]
}
```

## 7. ArticleSelection

```json
{
  "selectedUrl": "https://example.com/article",
  "source": "auto",
  "confidence": 0.82,
  "reasoningSummary": "Matched topic, company, and product launch framing from transcript",
  "screenshotPath": "assets/article-bg.png"
}
```

Allowed `source` values:

- `auto`
- `article_txt`
- `manual_ui`
- `none`

## 8. RenderManifest

```json
{
  "jobId": "sfv_20260416_test1_ab12cd",
  "composition": {
    "width": 1080,
    "height": 1920,
    "fps": 30
  },
  "speakerClips": [
    { "path": "cleaned/clip-000.mov", "startFrame": 0, "durationFrames": 162 }
  ],
  "captionsPath": "captions/captions.json",
  "articleBackgroundPath": "assets/article-bg.png",
  "transitionPreset": "fade",
  "sfxPreset": "soft-whoosh"
}
```

## 9. WatcherState

Local watcher state:

```json
{
  "sourceKey": "local:/workspace/short-form-input/test1",
  "revisionKey": "3-files:2026-04-16T13:19:20.000Z",
  "jobId": "sfv_20260416_test1_ab12cd",
  "status": "claimed"
}
```

Cloud watcher state:

```json
{
  "sourceKey": "cloud:01ABCDEF...",
  "revisionKey": "01ABCDEF...:2026-04-16T13:19:20.000Z",
  "jobId": "sfv_20260416_test1_ab12cd",
  "status": "claimed"
}
```
