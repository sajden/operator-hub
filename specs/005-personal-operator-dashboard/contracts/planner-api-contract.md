# Contract: Planner API

## Purpose

Defines the hub-facing API surface for the personal operator dashboard domain: dashboard views, boards, work items, widgets, and progress summaries.

## Endpoints

### `GET /api/planner/dashboard`

Returns the resolved dashboard payload for a given view mode.

Query parameters:
- `mode`: `desktop` or `tv`
- `viewId`: optional explicit dashboard view identifier

Response shape:

```json
{
  "view": {
    "id": "dashboard-main",
    "name": "Main Dashboard",
    "viewMode": "desktop",
    "themePreference": "light"
  },
  "widgets": [
    {
      "id": "widget-today",
      "widgetType": "today",
      "title": "Today",
      "layout": { "x": 0, "y": 0, "w": 6, "h": 5 },
      "data": {},
      "actions": []
    }
  ],
  "summary": {
    "inProgressCount": 2,
    "completedTodayCount": 3,
    "carryOverCount": 1
  }
}
```

### `GET /api/planner/boards`

Returns available planner boards.

Response shape:

```json
{
  "boards": [
    {
      "id": "board-daily",
      "slug": "daily",
      "name": "Daily Execution",
      "boardType": "daily",
      "linkedDomain": "planner"
    }
  ]
}
```

### `POST /api/planner/boards`

Creates a new board.

Request shape:

```json
{
  "name": "Research",
  "slug": "research",
  "boardType": "research",
  "description": "Ideas, experiments and niche exploration."
}
```

### `GET /api/planner/boards/:boardId`

Returns full board data including columns and work items.

Response shape:

```json
{
  "board": {
    "id": "board-daily",
    "slug": "daily",
    "name": "Daily Execution",
    "boardType": "daily"
  },
  "columns": [
    {
      "id": "col-today",
      "name": "Today",
      "columnKind": "today",
      "position": 2
    }
  ],
  "workItems": [
    {
      "id": "work-patrik-mail",
      "title": "Skicka mail till Patrik",
      "status": "planned",
      "columnId": "col-today",
      "focusDate": "2026-03-17",
      "importance": "high",
      "frictionType": "follow_up"
    }
  ]
}
```

### `POST /api/planner/work-items`

Creates a new work item.

Request shape:

```json
{
  "boardId": "board-daily",
  "columnId": "col-inbox",
  "title": "Skicka mail till Patrik",
  "details": "Follow up on previous conversation.",
  "importance": "high",
  "frictionType": "follow_up"
}
```

### `PATCH /api/planner/work-items/:workItemId`

Updates mutable work item fields such as title, details, focus date, status, due date, or goal linkage.

### `POST /api/planner/work-items/:workItemId/move`

Moves a work item between columns or into the day's focus.

Request shape:

```json
{
  "columnId": "col-in-progress",
  "focusDate": "2026-03-17"
}
```

### `PATCH /api/planner/views/:viewId/widgets`

Replaces or updates widget instances for a dashboard or TV view.

Request shape:

```json
{
  "widgets": [
    {
      "id": "widget-goals",
      "widgetType": "goals",
      "title": "Current Goals",
      "layout": { "x": 6, "y": 0, "w": 3, "h": 4 },
      "config": { "limit": 3 }
    }
  ]
}
```

## Contract Rules

- Dashboard and board responses must expose stable identifiers for widgets, boards, columns, and work items.
- Work item updates and move operations must operate on a single canonical item record, not cloned copies.
- TV mode payloads may reduce widget count or data density, but must rely on the same underlying planner entities.
- Planner responses must remain useful even when no external service provider is configured.
