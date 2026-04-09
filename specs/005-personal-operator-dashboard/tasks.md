# Tasks: Personal Operator Dashboard

**Input**: Design documents from `/specs/005-personal-operator-dashboard/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Automated tests are not explicitly requested in the specification. Tasks include manual validation checkpoints and quickstart verification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. `[US1]`, `[US2]`, `[US3]`)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the app shell and local hub for a planner domain beside the existing Parkpal workspace.

- [ ] T001 Add planner feature dependencies and scripts in `/home/sajden/github/operator-hub/app/package.json`
- [ ] T002 [P] Create planner frontend type and client scaffolds in `/home/sajden/github/operator-hub/app/src/types/planner.ts` and `/home/sajden/github/operator-hub/app/src/data/plannerClient.ts`
- [ ] T003 [P] Add theme token and app-shell stylesheet scaffolding in `/home/sajden/github/operator-hub/app/src/styles/theme.css` and `/home/sajden/github/operator-hub/app/src/main.tsx`
- [ ] T004 [P] Create planner hub module scaffolds in `/home/sajden/github/operator-hub/hub/plannerStore.mjs`, `/home/sajden/github/operator-hub/hub/plannerQueries.mjs`, and `/home/sajden/github/operator-hub/hub/plannerActions.mjs`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish planner persistence, shared contracts, and app routing that every story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 Implement SQLite planner schema creation and seed bootstrapping in `/home/sajden/github/operator-hub/hub/plannerStore.mjs`
- [ ] T006 [P] Implement planner query helpers for dashboards, boards, widgets, goals, and momentum summaries in `/home/sajden/github/operator-hub/hub/plannerQueries.mjs`
- [ ] T007 [P] Implement planner action registry and action-run persistence primitives in `/home/sajden/github/operator-hub/hub/plannerActions.mjs`
- [ ] T008 Extend `/home/sajden/github/operator-hub/hub/server.mjs` with planner API routes from `planner-api-contract.md` and `planner-action-contract.md`
- [ ] T009 Extend `/home/sajden/github/operator-hub/hub/mcpTools.mjs` with planner-oriented tool descriptors for future shared capability access
- [ ] T010 Add app-level route shell and navigation handoff between planner pages and Parkpal pages in `/home/sajden/github/operator-hub/app/src/App.tsx`

**Checkpoint**: Foundation ready. User story implementation can begin.

---

## Phase 3: User Story 1 - Run The Day From One Dashboard (Priority: P1) 🎯 MVP

**Goal**: Deliver a day-first operator dashboard where the user can see today, in-progress work, carry-over, goals, and progress from one main view.

**Independent Test**: Create several work items, promote one into today, move one to in progress, complete one item, and confirm the dashboard updates progress and carry-over without leaving the main dashboard route.

### Implementation for User Story 1

- [ ] T011 [P] [US1] Create reusable dashboard widget shell components in `/home/sajden/github/operator-hub/app/src/components/dashboard/WidgetFrame.tsx` and `/home/sajden/github/operator-hub/app/src/components/dashboard/WidgetGrid.tsx`
- [ ] T012 [P] [US1] Create `Today`, `In Progress`, `Current Goals`, `Weekly Progress`, and `Quick Actions` widget components in `/home/sajden/github/operator-hub/app/src/components/dashboard/TodayWidget.tsx`, `/home/sajden/github/operator-hub/app/src/components/dashboard/InProgressWidget.tsx`, `/home/sajden/github/operator-hub/app/src/components/dashboard/GoalsWidget.tsx`, `/home/sajden/github/operator-hub/app/src/components/dashboard/WeeklyProgressWidget.tsx`, and `/home/sajden/github/operator-hub/app/src/components/dashboard/QuickActionsWidget.tsx`
- [ ] T013 [P] [US1] Create shared planner work item UI primitives in `/home/sajden/github/operator-hub/app/src/components/planner/WorkItemCard.tsx` and `/home/sajden/github/operator-hub/app/src/components/planner/WorkItemComposer.tsx`
- [ ] T014 [US1] Implement dashboard data loading and widget composition in `/home/sajden/github/operator-hub/app/src/pages/OperatorDashboardPage.tsx`
- [ ] T015 [US1] Implement create, focus-for-today, start, and complete interactions through `/home/sajden/github/operator-hub/app/src/data/plannerClient.ts` and `/home/sajden/github/operator-hub/app/src/pages/OperatorDashboardPage.tsx`
- [ ] T016 [US1] Add premium light-mode dashboard styling, hierarchy, and momentum visuals in `/home/sajden/github/operator-hub/app/src/styles/theme.css`
- [ ] T017 [US1] Set the operator dashboard as the default landing route while preserving Parkpal access in `/home/sajden/github/operator-hub/app/src/App.tsx`
- [ ] T018 [US1] Document the MVP dashboard flow in `/home/sajden/github/operator-hub/README.md` and `/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/quickstart.md`

**Checkpoint**: User Story 1 should now be fully functional and demoable as the MVP.

---

## Phase 4: User Story 2 - Work Across Multiple Boards Without Losing Context (Priority: P2)

**Goal**: Add multiple planner boards, a specialized Parkpal board entry, and a TV wallboard mode without breaking the shared dashboard model.

**Independent Test**: Open the daily board and Parkpal board, move an item from a specialized board into today's focus, return to the dashboard to see shared progress, then open the TV route and confirm the same context is readable at distance.

### Implementation for User Story 2

- [ ] T019 [P] [US2] Create reusable board layout components in `/home/sajden/github/operator-hub/app/src/components/planner/BoardColumn.tsx` and `/home/sajden/github/operator-hub/app/src/components/planner/BoardHeader.tsx`
- [ ] T020 [US2] Implement board page loading and column-based interaction flow in `/home/sajden/github/operator-hub/app/src/pages/PlannerBoardPage.tsx`
- [ ] T021 [US2] Add board creation, board listing, and work-item move support in `/home/sajden/github/operator-hub/hub/plannerStore.mjs`, `/home/sajden/github/operator-hub/hub/plannerQueries.mjs`, and `/home/sajden/github/operator-hub/hub/server.mjs`
- [ ] T022 [US2] Seed default `Daily Execution` and `Parkpal Outreach` board records and shared board metadata in `/home/sajden/github/operator-hub/hub/plannerStore.mjs`
- [ ] T023 [US2] Integrate board navigation into the application shell in `/home/sajden/github/operator-hub/app/src/App.tsx` and `/home/sajden/github/operator-hub/app/src/pages/OperatorDashboardPage.tsx`
- [ ] T024 [US2] Implement TV wallboard route and simplified display widgets in `/home/sajden/github/operator-hub/app/src/pages/PlannerTvPage.tsx` and `/home/sajden/github/operator-hub/app/src/components/dashboard/TvWallboard.tsx`
- [ ] T025 [US2] Add TV-mode dashboard payload shaping in `/home/sajden/github/operator-hub/hub/plannerQueries.mjs` and `/home/sajden/github/operator-hub/hub/server.mjs`
- [ ] T026 [US2] Connect the existing Parkpal workspace into the new shell in `/home/sajden/github/operator-hub/app/src/pages/ParkpalGraphPage.tsx` and `/home/sajden/github/operator-hub/app/src/App.tsx`
- [ ] T027 [US2] Update multi-board and TV-view usage notes in `/home/sajden/github/operator-hub/README.md` and `/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/quickstart.md`

**Checkpoint**: User Stories 1 and 2 should both work independently, with shared progress across boards and TV mode.

---

## Phase 5: User Story 3 - Use Actions To Reduce Friction On Avoided Work (Priority: P3)

**Goal**: Let widgets and work items trigger direct actions that stay connected to the same planning context and fail gracefully when no provider exists.

**Independent Test**: Trigger a work-item or widget action such as follow-up drafting, verify the result is rendered back into the same context, then simulate an unavailable provider and verify the failure is shown without breaking the dashboard flow.

### Implementation for User Story 3

- [ ] T028 [P] [US3] Create action UI components in `/home/sajden/github/operator-hub/app/src/components/planner/ActionMenu.tsx` and `/home/sajden/github/operator-hub/app/src/components/planner/ActionResultPanel.tsx`
- [ ] T029 [US3] Implement action catalog and action-run endpoints in `/home/sajden/github/operator-hub/hub/plannerActions.mjs` and `/home/sajden/github/operator-hub/hub/server.mjs`
- [ ] T030 [US3] Seed default dashboard and work-item actions such as `Draft follow-up`, `Prepare next step`, and `Open TV view` in `/home/sajden/github/operator-hub/hub/plannerStore.mjs`
- [ ] T031 [US3] Wire widget-scoped and work-item-scoped action execution through `/home/sajden/github/operator-hub/app/src/data/plannerClient.ts`, `/home/sajden/github/operator-hub/app/src/components/dashboard/QuickActionsWidget.tsx`, and `/home/sajden/github/operator-hub/app/src/components/planner/WorkItemCard.tsx`
- [ ] T032 [US3] Implement action result rendering and recoverable failure states in `/home/sajden/github/operator-hub/app/src/components/planner/ActionResultPanel.tsx` and `/home/sajden/github/operator-hub/app/src/pages/OperatorDashboardPage.tsx`
- [ ] T033 [US3] Add action usage and failure-behavior notes to `/home/sajden/github/operator-hub/README.md` and `/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/quickstart.md`

**Checkpoint**: All three user stories should now be independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Tighten visual consistency, dark-mode parity, and end-to-end validation across the whole feature.

- [ ] T034 [P] Add dark-mode tokens, theme switching support, and cross-view parity in `/home/sajden/github/operator-hub/app/src/styles/theme.css`, `/home/sajden/github/operator-hub/app/src/main.tsx`, and `/home/sajden/github/operator-hub/app/src/App.tsx`
- [ ] T035 [P] Refine premium copy, momentum wording, and empty-state content across `/home/sajden/github/operator-hub/app/src/components/dashboard/` and `/home/sajden/github/operator-hub/app/src/components/planner/`
- [ ] T036 Align planner documentation across `/home/sajden/github/operator-hub/README.md`, `/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/spec.md`, and `/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/quickstart.md`
- [ ] T037 Run end-to-end manual validation for dashboard, boards, actions, and TV mode, then record outcomes in `/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **User Story Phases (Phase 3-5)**: Depend on Foundational completion.
- **Polish (Phase 6)**: Depends on completion of the desired user stories.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational. No dependency on US2 or US3.
- **US2 (P2)**: Starts after Foundational. Builds on planner routes and shared dashboard data, but should remain independently testable once board support exists.
- **US3 (P3)**: Starts after Foundational. Depends on planner persistence and UI contexts from US1, and benefits from board contexts from US2 but should still be testable from a single dashboard/work-item flow.

### Dependency Graph

- Setup -> Foundational -> US1
- Setup -> Foundational -> US2
- Setup -> Foundational -> US3
- US1 + US2 + US3 -> Polish

### Within Each User Story

- Shared UI primitives before page composition.
- Hub contracts and persistence updates before frontend interactions that consume them.
- Core interactions before documentation updates.
- Story checkpoint validation after implementation tasks complete.

---

## Parallel Opportunities

- **Setup**: T002, T003, and T004 can run in parallel after T001.
- **Foundational**: T006 and T007 can run in parallel after T005.
- **US1**: T011, T012, and T013 can run in parallel before T014.
- **US2**: T019 and T022 can run in parallel once foundational planner data is available.
- **US3**: T028 and T030 can run in parallel before T031.
- **Polish**: T034 and T035 can run in parallel before final validation.

## Parallel Example: User Story 1

```bash
Task: "T011 [US1] Create dashboard widget shell components in /home/sajden/github/operator-hub/app/src/components/dashboard/WidgetFrame.tsx and /home/sajden/github/operator-hub/app/src/components/dashboard/WidgetGrid.tsx"
Task: "T012 [US1] Create Today/In Progress/Goals/Weekly Progress/Quick Actions widgets in /home/sajden/github/operator-hub/app/src/components/dashboard/"
Task: "T013 [US1] Create shared planner work item UI primitives in /home/sajden/github/operator-hub/app/src/components/planner/WorkItemCard.tsx and /home/sajden/github/operator-hub/app/src/components/planner/WorkItemComposer.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T019 [US2] Create reusable board layout components in /home/sajden/github/operator-hub/app/src/components/planner/BoardColumn.tsx and /home/sajden/github/operator-hub/app/src/components/planner/BoardHeader.tsx"
Task: "T022 [US2] Seed default Daily Execution and Parkpal Outreach board records in /home/sajden/github/operator-hub/hub/plannerStore.mjs"
Task: "T024 [US2] Implement TV wallboard route in /home/sajden/github/operator-hub/app/src/pages/PlannerTvPage.tsx and /home/sajden/github/operator-hub/app/src/components/dashboard/TvWallboard.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T028 [US3] Create action UI components in /home/sajden/github/operator-hub/app/src/components/planner/ActionMenu.tsx and /home/sajden/github/operator-hub/app/src/components/planner/ActionResultPanel.tsx"
Task: "T030 [US3] Seed default planner actions in /home/sajden/github/operator-hub/hub/plannerStore.mjs"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate the dashboard independently using the US1 checkpoint.
4. Demo the product as a real day-first planning tool before adding more boards and actions.

### Incremental Delivery

1. Deliver US1 as the core operator dashboard.
2. Add US2 for multiple boards, Parkpal integration, and TV mode.
3. Add US3 for direct actions and reduced friction on follow-up work.
4. Finish Polish for theme parity, copy consistency, and manual validation.

### Suggested MVP Scope

- **Recommended MVP**: Phase 1 + Phase 2 + Phase 3 (US1 only)
- This delivers the main promise of the product: one dashboard to run the day from.
