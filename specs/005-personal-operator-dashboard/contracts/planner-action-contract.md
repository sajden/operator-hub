# Contract: Planner Action Model

## Purpose

Defines how widgets and work items trigger product-level actions without binding the UI directly to raw providers or integrations.

## Action Catalog Response

### `GET /api/planner/actions`

Returns actions available for the requested scope.

Query parameters:
- `scope`: `dashboard`, `widget`, `board`, or `work_item`
- `sourceId`: optional identifier for the current widget, board, or work item

Response shape:

```json
{
  "actions": [
    {
      "id": "action-draft-follow-up",
      "actionType": "draft_message",
      "capabilityKey": "message.draft",
      "scope": "work_item",
      "displayLabel": "Draft follow-up",
      "enabled": true
    }
  ]
}
```

## Action Execution

### `POST /api/planner/actions/run`

Runs a user-triggered action in the context of a widget, board, or work item.

Request shape:

```json
{
  "actionId": "action-draft-follow-up",
  "source": {
    "type": "work_item",
    "id": "work-patrik-mail"
  },
  "context": {
    "boardId": "board-daily",
    "requestedByView": "dashboard-main"
  }
}
```

Response shape:

```json
{
  "run": {
    "id": "run-001",
    "status": "succeeded",
    "source": {
      "type": "work_item",
      "id": "work-patrik-mail"
    },
    "resultSummary": "Draft prepared for follow-up to Patrik."
  },
  "artifacts": [
    {
      "type": "text",
      "label": "Draft",
      "content": "Hej Patrik, ..."
    }
  ]
}
```

## Failure Contract

If an action cannot complete, the response must still preserve source context.

Example:

```json
{
  "run": {
    "id": "run-002",
    "status": "failed",
    "source": {
      "type": "widget",
      "id": "widget-follow-ups"
    },
    "errorMessage": "No provider is configured for message drafting."
  }
}
```

## Contract Rules

- The UI interacts with `actionId` and source context, not with provider-specific identifiers.
- Every action run must preserve source context so the result can be rendered back into the originating widget, board, or work item.
- Provider selection is internal to the hub and must remain replaceable without changing the UI contract.
- V1 actions are user-triggered only; no automatic rule execution is part of this contract.
