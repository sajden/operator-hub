# Data Model: Personal Operator Dashboard

## Entity: PlannerBoard

- Description: A focused workspace for a mode of work such as daily execution, Parkpal outreach, or later strategy/research boards.
- Fields:
  - `id` (string, required, stable identifier)
  - `slug` (string, required, unique, human-readable route key)
  - `name` (string, required)
  - `boardType` (enum: `daily` | `specialized` | `outreach` | `research`, required)
  - `description` (string, optional)
  - `status` (enum: `active` | `archived`, required)
  - `defaultViewMode` (enum: `board` | `dashboard` | `tv`, required)
  - `linkedDomain` (enum: `planner` | `parkpal`, required)
  - `createdAt` (datetime, required)
  - `updatedAt` (datetime, required)

## Entity: BoardColumn

- Description: An ordered lane within a board for planning and progress tracking.
- Fields:
  - `id` (string, required, stable identifier)
  - `boardId` (string, required, references PlannerBoard.id)
  - `name` (string, required)
  - `columnKind` (enum: `inbox` | `planned` | `today` | `in_progress` | `waiting` | `done` | `custom`, required)
  - `position` (integer, required)
  - `wipLimit` (integer, optional)
  - `isDefault` (boolean, required)

## Entity: WorkItem

- Description: A single unit of work that can appear on a board, be promoted into today's focus, carry context links, and accumulate progress history.
- Fields:
  - `id` (string, required, stable identifier)
  - `boardId` (string, required, references PlannerBoard.id)
  - `columnId` (string, required, references BoardColumn.id)
  - `title` (string, required)
  - `details` (string, optional)
  - `status` (enum: `planned` | `in_progress` | `done` | `archived`, required)
  - `focusDate` (date, optional; drives "today" visibility without duplicating the item)
  - `dueDate` (date, optional)
  - `importance` (enum: `low` | `normal` | `high` | `critical`, required)
  - `frictionType` (enum: `neutral` | `follow_up` | `avoidance` | `admin`, required)
  - `goalId` (string, optional, references Goal.id)
  - `createdAt` (datetime, required)
  - `updatedAt` (datetime, required)
  - `startedAt` (datetime, optional)
  - `completedAt` (datetime, optional)

## Entity: Goal

- Description: A higher-level outcome that helps the operator connect daily tasks to larger direction.
- Fields:
  - `id` (string, required, stable identifier)
  - `name` (string, required)
  - `description` (string, optional)
  - `horizon` (enum: `day` | `week` | `month` | `open`, required)
  - `status` (enum: `active` | `paused` | `done`, required)
  - `targetDate` (date, optional)
  - `createdAt` (datetime, required)
  - `updatedAt` (datetime, required)

## Entity: DashboardView

- Description: A saved presentation surface for either desktop dashboard mode or TV wallboard mode.
- Fields:
  - `id` (string, required, stable identifier)
  - `name` (string, required)
  - `viewMode` (enum: `desktop` | `tv`, required)
  - `themePreference` (enum: `light` | `dark` | `system`, required)
  - `isDefault` (boolean, required)
  - `createdAt` (datetime, required)
  - `updatedAt` (datetime, required)

## Entity: WidgetInstance

- Description: A concrete widget placed in a specific dashboard or TV view.
- Fields:
  - `id` (string, required, stable identifier)
  - `viewId` (string, required, references DashboardView.id)
  - `widgetType` (enum: `today` | `in_progress` | `follow_ups` | `goals` | `weekly_progress` | `quick_actions` | `parkpal_projection` | `board_summary`, required)
  - `title` (string, required)
  - `positionX` (integer, required)
  - `positionY` (integer, required)
  - `width` (integer, required)
  - `height` (integer, required)
  - `configJson` (object, optional, widget-specific)
  - `isVisible` (boolean, required)

## Entity: ContextLink

- Description: A link from a work item to related planning or external context.
- Fields:
  - `id` (string, required, stable identifier)
  - `workItemId` (string, required, references WorkItem.id)
  - `linkType` (enum: `project` | `note` | `contact` | `file` | `url` | `calendar` | `board`, required)
  - `label` (string, required)
  - `reference` (string, required)
  - `provider` (string, optional)
  - `createdAt` (datetime, required)

## Entity: ActionDefinition

- Description: A reusable product-level action exposed to widgets or work items.
- Fields:
  - `id` (string, required, stable identifier)
  - `actionType` (enum: `draft_message` | `prepare_follow_up` | `summarize_context` | `run_research` | `open_tv_view`, required)
  - `capabilityKey` (string, required)
  - `scope` (enum: `dashboard` | `widget` | `board` | `work_item`, required)
  - `displayLabel` (string, required)
  - `isEnabled` (boolean, required)

## Entity: ActionRun

- Description: A record of a user-triggered action execution and its outcome.
- Fields:
  - `id` (string, required, stable identifier)
  - `actionId` (string, required, references ActionDefinition.id)
  - `sourceType` (enum: `widget` | `board` | `work_item`, required)
  - `sourceId` (string, required)
  - `status` (enum: `queued` | `running` | `succeeded` | `failed`, required)
  - `resultSummary` (string, optional)
  - `errorMessage` (string, optional)
  - `createdAt` (datetime, required)
  - `completedAt` (datetime, optional)

## Entity: ActivityEvent

- Description: An append-only event record used to power completion statistics, carry-over visibility, and momentum signals.
- Fields:
  - `id` (string, required, stable identifier)
  - `entityType` (enum: `work_item` | `board` | `action_run`, required)
  - `entityId` (string, required)
  - `eventType` (enum: `created` | `moved` | `focused_for_day` | `started` | `completed` | `reopened` | `action_triggered` | `action_failed`, required)
  - `occurredAt` (datetime, required)
  - `payloadJson` (object, optional)

## Relationships

- A `PlannerBoard` has many `BoardColumn` entries.
- A `PlannerBoard` has many `WorkItem` entries.
- A `Goal` may be linked to many `WorkItem` entries.
- A `DashboardView` has many `WidgetInstance` entries.
- A `WorkItem` may have many `ContextLink` entries.
- An `ActionDefinition` may be triggered by many `ActionRun` entries.
- `ActivityEvent` records can reference work items, boards, and action runs for history and metrics.

## Validation Rules

- Board slugs must be unique and route-safe.
- Column positions must be unique within a board.
- A work item belongs to exactly one canonical board and one current column at any time.
- A work item can appear in "today" widgets through `focusDate` without being duplicated into a second board record.
- A completed work item must set `completedAt`; a non-completed work item must not.
- A widget instance must reference a supported widget type from the widget registry.
- An action run must retain source context so results can be shown from the originating widget, board, or work item.
- Context links must preserve both human-readable label and machine-usable reference.

## State Transitions

### WorkItem lifecycle

1. `planned` when created or placed in inbox/planned columns.
2. `planned` -> `in_progress` when the operator starts work.
3. `planned` or `in_progress` -> `done` when completed.
4. `done` -> `planned` when reopened.
5. A work item becomes carry-over when `focusDate` is in the past and `status != done`.

### ActionRun lifecycle

1. `queued` when the user triggers an action.
2. `queued` -> `running` when execution begins.
3. `running` -> `succeeded` when a result is produced.
4. `running` -> `failed` when a provider or validation error occurs.

### DashboardView lifecycle

1. A default desktop view is created for the operator.
2. Widget instances can be added, reordered, resized, hidden, or removed.
3. A TV view may share the same underlying planner data but use a different widget mix and layout.
