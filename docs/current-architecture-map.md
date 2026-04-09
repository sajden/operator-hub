# Current Architecture Map

This document describes how `operator-hub` is wired today for the planner, calendar sync, boards, and integrations.

It is not a target-state vision doc.
It is a debugging and orientation map for the current system.

## 1. Main Layers

### App layer

Location:
- `app/src/`

Main responsibilities:
- render planner routes
- render dashboard, daily board, week view, connections, TV
- call hub APIs
- maintain local UI state such as selection, auto-sync timestamps, signal filters

Main routes:
- `/` -> dashboard
- `/boards/daily` -> daily execution board
- `/week` -> weekly planning surface
- `/parkpal` -> Parkpal workspace
- `/connections` -> OAuth/API/MCP visibility and M365 import
- `/tv` -> TV wallboard

Key files:
- [App.tsx](/home/sajden/github/operator-hub/app/src/App.tsx)
- [OperatorDashboardPage.tsx](/home/sajden/github/operator-hub/app/src/pages/OperatorDashboardPage.tsx)
- [PlannerBoardPage.tsx](/home/sajden/github/operator-hub/app/src/pages/PlannerBoardPage.tsx)
- [PlannerWeekPage.tsx](/home/sajden/github/operator-hub/app/src/pages/PlannerWeekPage.tsx)
- [ConnectionsPage.tsx](/home/sajden/github/operator-hub/app/src/pages/ConnectionsPage.tsx)

### Hub layer

Location:
- `hub/`

Main responsibilities:
- OAuth for Microsoft
- planner persistence and mutations
- planner payload shaping
- action execution
- project graph access
- integration endpoints

Key files:
- [server.mjs](/home/sajden/github/operator-hub/hub/server.mjs)
- [plannerStore.mjs](/home/sajden/github/operator-hub/hub/plannerStore.mjs)
- [plannerQueries.mjs](/home/sajden/github/operator-hub/hub/plannerQueries.mjs)
- [plannerActions.mjs](/home/sajden/github/operator-hub/hub/plannerActions.mjs)
- [microsoftAuth.mjs](/home/sajden/github/operator-hub/hub/microsoftAuth.mjs)
- [mcpTools.mjs](/home/sajden/github/operator-hub/hub/mcpTools.mjs)

### Runtime path

Normal runtime today:
- `operator-hub` runs as a Docker service in the `ai-cam` stack
- service/container name:
  - `operator-hub`
  - `ai-cam-operator-hub`
- `aihub` reverse-proxies it internally from:
  - `http://operator-hub:8787`

Important:
- manual `npm run dev` in `hub/` is now a local development path
- it is not the normal always-on runtime anymore

### Local persistence

Location:
- `.local/planner.db`
- `.local/microsoft-auth.json`

Main responsibilities:
- planner boards, columns, work items, events, action runs
- Microsoft delegated token session

## 2. Planner Domain Model

The current planner runs on these effective objects:

- `Board`
- `Column`
- `WorkItem`
- `Series`
- `ActionRun`
- `PlannerEvent`

Important distinction:
- a `WorkItem` can be a concrete planned task
- a `WorkItem` can also be a `calendar series summary`

That distinction matters for recurring Microsoft calendar imports.

### Daily board model

The daily board currently behaves like:

- `Inbox` = today-only intake bucket for daily
- `Today` = what should get done today
- `In Progress` = active execution
- `Done` = items completed today

Important:
- future scheduled items should not sit in daily inbox
- daily hides older done items

### Week model

The week view behaves like:

- `Inbox` = broader unscheduled backlog
- day columns = dated work for each day
- drag from backlog to a day -> item gets a date
- drag from a day back to backlog -> date/time is cleared

Important:
- week and daily use the same underlying `board-daily` data
- they are different projections of the same work items

## 3. Current Calendar Sync Model

### Source of truth

For calendar-backed items:
- Microsoft Graph is the source for event existence and timing
- planner adds status, notes, board movement, and context

### Current import flow

1. App calls:
   - `GET /api/auth/microsoft/calendar/events`
   - or `POST /api/planner/import/microsoft-calendar`

2. Hub asks Microsoft Graph for:
   - `/me/calendarView`

3. Hub maps returned events into planner work items.

4. App loads board/dashboard payloads and renders planner views.

### Important current behavior

- `calendarView` is now paginated correctly via `@odata.nextLink`
- recurring events may create:
  - a summary row for the series
  - concrete occurrences for specific days

### Important current limitation

Recurring series can still be confusing because there are two representations:

- summary work item
- concrete occurrence work items

When debugging recurring bugs, always check both.

## 4. Microsoft Integration Flow

### Auth

Current auth model:
- delegated OAuth
- one shared Microsoft app registration for the repo
- env loaded from:
  - `hub/.env`
  - `hub/.env.local`

Important envs:
- `OPERATOR_HUB_PUBLIC_URL`
- `OPERATOR_HUB_APP_URL`
- `OPERATOR_HUB_MS_TENANT_ID`
- `OPERATOR_HUB_MS_CLIENT_ID`
- `OPERATOR_HUB_MS_CLIENT_SECRET`
- `OPERATOR_HUB_MS_SCOPES`

### Current Microsoft capabilities

Implemented today:
- auth status
- `me` profile test
- calendar preview
- calendar import into planner
- sync planner work item -> M365 calendar
- Excel/workbook operations for project flows

Not yet fully built:
- Google provider
- mail flows
- robust background sync scheduler
- first-class resource bindings

## 5. Current UI Structure

### Sidebar

Purpose:
- workspace switching

Current main destinations:
- Home
- Daily
- Week
- Parkpal
- Connections
- TV

### Topbar

Purpose:
- workspace selector
- signal filter
- utility status such as sync label

### Inspector

Purpose today:
- edit selected item
- save execution note
- run direct actions
- sync to M365
- delete item
- view series history

Important:
- many planner mutations are now intended to happen from the inspector

## 6. Known Representation Types

This is the most important debugging section.

### A. Manual work item

Characteristics:
- created in planner UI
- `recurrenceSource = manual`
- no external event id unless synced outward later

### B. Imported concrete calendar occurrence

Characteristics:
- has `externalEventId`
- has `focusDate` / `dueDate`
- often has `scheduledStartAt`
- appears as a real dated item in daily or week

### C. Calendar series summary

Characteristics:
- `recurrenceSource = calendar`
- `externalEventId` starts with `series-summary:`
- often no date/time on the row itself
- used as a series-level placeholder/context object

This type is the source of many current UX confusions.

## 7. Current Mutation Paths

### Item move

App:
- `movePlannerWorkItem(...)`

Hub:
- `movePlannerWorkItem(...)` in [plannerStore.mjs](/home/sajden/github/operator-hub/hub/plannerStore.mjs)

Effects:
- column changes
- status changes
- completion timestamps
- planner event log entry

### Item edit

App:
- `updatePlannerWorkItem(...)`

Hub:
- `updatePlannerWorkItem(...)`

Effects:
- title, details, dates, time, note, importance, friction type

### Item delete

App:
- `deletePlannerWorkItem(...)`

Hub:
- `DELETE /api/planner/work-items/:id`
- `deletePlannerWorkItem(...)`

Effects:
- row removed from `planner_work_items`
- related `planner_events` for that work item removed

### Calendar import

App:
- `importMicrosoftCalendarToPlanner(...)`

Hub:
- `listCalendarEvents(...)`
- `importCalendarEventsToPlanner(...)`

Effects:
- create/update summary rows
- create/update concrete calendar-backed work items

## 8. Current Debugging Checklist

When something looks wrong, check in this order.

### Missing item in daily or week

1. Does it appear in `/connections` preview?
2. Does it appear in raw preview JSON?
3. Does it exist in `planner.db` as:
   - concrete occurrence
   - summary row
4. Is it hidden by the current view projection?

### Wrong day

Check:
- `focusDate`
- `dueDate`
- `scheduledStartAt`
- UTC vs local time

The app now uses local `YYYY-MM-DD` day keys for planner projections.

### Recurring item confusion

Check whether you are looking at:
- a summary row
- or a dated occurrence

Do not assume they are the same thing.

### Sync says OK but item is missing

That usually means one of:
- item is not in Graph preview
- item exists only as a series summary
- item is imported but filtered out by the current view

## 9. Current Pain Points

These are not hypothetical. They are active complexity areas.

- recurring M365 series are still conceptually messy
- summary rows vs concrete occurrences are easy to confuse
- daily and week are projections over the same board, which is powerful but easy to misunderstand
- auto-sync makes debugging nicer when it works, but harder when import behavior is wrong
- inspector is becoming the main control surface and needs continued UI cleanup

## 10. Recommended Next Architecture Steps

Not implementation detail, just direction.

1. Make `series summary` explicit in UI everywhere.
2. Add richer recurring debug tools in `Connections`.
3. Formalize `provider -> connection -> binding -> capability -> action`.
4. Separate current-state docs from target-state docs consistently.
5. Add a review/habits layer for recurring rehab/promenad tracking.
