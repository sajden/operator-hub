# Quickstart: Personal Operator Dashboard

## Prerequisites

- Node.js 22+
- npm available locally
- Existing `operator-hub` repository checked out on branch `005-personal-operator-dashboard`

## 1. Start the local hub

```bash
cd /home/sajden/github/operator-hub/hub
npm run dev
```

Expected behavior:
- The local hub starts without requiring any external service configuration.
- Health and planner endpoints respond on the local hub port.

## 2. Start the frontend

```bash
cd /home/sajden/github/operator-hub/app
npm install
npm run dev
```

Open the local URL shown by Vite.

## 3. Verify the default operator dashboard

Expected default desktop dashboard:
- A light-mode-first layout with premium widget styling
- Widgets for at least:
  - `Today`
  - `In Progress`
  - `Current Goals`
  - `Weekly Progress`
  - `Quick Actions`
- One clearly visible route into the Parkpal workspace

## 4. Verify core daily planning flow

1. Create a work item such as `Skicka mail till Patrik`.
2. Put it into today's focus.
3. Move it to `In Progress`.
4. Mark it complete.

Expected result:
- The same work item is visible in both board and dashboard contexts without duplication.
- Progress widgets update after each state change.
- Completion is reflected in daily and weekly momentum feedback.

## 5. Verify multi-board workflow

1. Open the general daily board.
2. Open the Parkpal outreach board.
3. Promote one Parkpal-related work item into today's focus.
4. Return to the main dashboard.

Expected result:
- The daily dashboard surfaces the promoted item.
- The Parkpal workspace remains specialized rather than becoming the whole application.
- Shared progress remains coherent across both workspaces.

## 6. Verify direct actions

1. Find a follow-up or outreach-related work item.
2. Trigger an available direct action from the item or a related widget.

Expected result:
- The action returns a result tied to the originating item or widget.
- If a backing provider is unavailable, the UI preserves context and shows a recoverable failure state.

## 7. Verify TV wallboard mode

1. Open the dedicated TV route for the default dashboard or board.
2. Display it on a larger screen.

Expected result:
- The view is clearly readable at distance.
- The layout is simpler than desktop mode.
- Current priorities and progress remain understandable without interaction-heavy controls.

## 8. Validation Record

- `npm run build` in `app/`: passed on 2026-03-18.
- Planner dashboard payload: validated locally through direct hub-module execution on 2026-03-18.
- Planner board payload (`daily`): validated locally through direct hub-module execution on 2026-03-18.
- Planner action run (`Draft follow-up`): validated locally through direct hub-module execution on 2026-03-18.
- Full listening-server smoke test: blocked in this sandbox because binding to local ports is not permitted here (`EPERM` on port `8787`).
- External device-launch integration status: intentionally out of scope for this feature; TV verification is limited to the local wallboard route.
