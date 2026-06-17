# API Contract: Short-Form Video Builder

Base path: `/api/short-form`

## 1. `GET /api/short-form/jobs`

Returns recent jobs for the short-form page and batch-job summaries.

### Response

```json
{
  "jobs": [
    {
      "id": "sfv_20260416_test1_ab12cd",
      "title": "test1",
      "status": "prepared",
      "sourceKind": "watcher_cloud",
      "createdAt": "2026-04-16T13:20:00.000Z",
      "updatedAt": "2026-04-16T13:24:00.000Z",
      "summary": {
        "clipCount": 3,
        "usableClipCount": 3,
        "articleSelected": true,
        "rendered": false
      }
    }
  ]
}
```

## 2. `POST /api/short-form/jobs`

Creates a new manual job record.

### Request

```json
{
  "title": "test1",
  "sourcePath": "/workspace/short-form-input/test1",
  "articleMode": "auto_then_fallback",
  "captionPreset": "clean-news"
}
```

### Response

```json
{
  "jobId": "sfv_20260416_test1_ab12cd"
}
```

## 3. `GET /api/short-form/jobs/:jobId`

Returns the full job document, including steps and paths needed for inspection.

### Response

```json
{
  "job": {
    "id": "sfv_20260416_test1_ab12cd",
    "status": "prepared",
    "steps": [],
    "clips": [],
    "articleSelection": {},
    "paths": {}
  }
}
```

## 4. `POST /api/short-form/jobs/:jobId/prepare`

Starts or reruns the prepare phase.

### Request

```json
{
  "force": false
}
```

### Response

```json
{
  "ok": true,
  "status": "preparing"
}
```

## 5. `POST /api/short-form/jobs/:jobId/render`

Starts or reruns the render phase from the prepared manifest.

### Request

```json
{
  "force": false
}
```

### Response

```json
{
  "ok": true,
  "status": "rendering"
}
```

## 6. `POST /api/short-form/jobs/:jobId/article`

Sets or clears the manual article override.

### Request

```json
{
  "manualArticleUrl": "https://example.com/article"
}
```

### Response

```json
{
  "ok": true,
  "articleSource": "manual_ui"
}
```

## 7. `POST /api/short-form/jobs/:jobId/rerun-article-capture`

Reruns article selection and screenshot preparation using the current override settings.

### Response

```json
{
  "ok": true,
  "status": "preparing"
}
```

## 8. `GET /api/short-form/watchers`

Returns watcher and cloud-watcher status for summary views.

### Response

```json
{
  "localWatcher": {
    "inputDir": "/workspace/short-form-input",
    "jobs": []
  },
  "cloudWatcher": {
    "inputPath": "Seb/Videos/no-bg-videos",
    "outputPath": "Seb/Videos/short-form-renders",
    "jobs": []
  }
}
```

## 9. `GET /api/short-form/jobs/:jobId/artifact`

Optional helper route for serving selected artifacts by key, such as review cut or article screenshot.

### Query Parameters

- `kind=review_cut`
- `kind=article_screenshot`
- `kind=render_manifest`

## Error Contract

Error responses should use:

```json
{
  "message": "Human-readable failure summary",
  "code": "SHORT_FORM_PREPARE_FAILED"
}
```
