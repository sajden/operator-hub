# Tasks: Parkpal Visual Outreach Discovery MVP

**Input**: Design documents from `/specs/001-parkpal-visual-foundation/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Automated tests are not explicitly requested in the specification. Tasks include manual validation checkpoints.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize project structure and base tooling for frontend + export workflow.

- [X] T001 Create base directories `app/src/components`, `app/src/pages`, `app/src/data`, `app/src/types`, `projects/parkpal/data`, `projects/parkpal/exports`, and `scripts/`
- [X] T002 Initialize React + TypeScript app scaffold in `app/` with Vite config in `app/package.json`, `app/tsconfig.json`, and `app/vite.config.ts`
- [X] T003 [P] Add frontend entry files in `app/index.html`, `app/src/main.tsx`, and `app/src/App.tsx`
- [X] T004 [P] Add root project documentation skeleton in `README.md` with sections for frontend run and Excel export

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared contracts and base types required by all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Add React Flow dependency and scripts in `app/package.json`
- [X] T006 Create shared graph TypeScript types in `app/src/types/graph.ts` for `project`, `audience`, `problem`, `nodes`, and `edges`
- [X] T007 [P] Implement JSON loader utility in `app/src/data/loadGraph.ts` for reading `projects/parkpal/data/graph.json`
- [X] T008 [P] Create React Flow node card components in `app/src/components/ProjectNodeCard.tsx`, `app/src/components/AudienceNodeCard.tsx`, and `app/src/components/ProblemNodeCard.tsx`
- [X] T009 Create Python export script scaffold with workbook/sheet helpers in `scripts/export_to_excel.py`

**Checkpoint**: Foundation ready. User story implementation can begin.

---

## Phase 3: User Story 1 - Visualize Parkpal Outreach Graph (Priority: P1) 🎯 MVP

**Goal**: Render Parkpal graph in a React Flow page from local JSON data.

**Independent Test**: Run frontend from `app/` and verify Parkpal + Elbilister + 3 problem nodes and expected connections render from `projects/parkpal/data/graph.json`.

### Implementation for User Story 1

- [X] T010 [US1] Create Parkpal graph page container in `app/src/pages/ParkpalGraphPage.tsx`
- [X] T011 [P] [US1] Implement React Flow mapping logic (node/edge transforms) in `app/src/pages/ParkpalGraphPage.tsx`
- [X] T012 [P] [US1] Add node type rendering bindings in `app/src/pages/ParkpalGraphPage.tsx` using components from `app/src/components/`
- [X] T013 [US1] Wire app routing/root render to graph page in `app/src/App.tsx`
- [X] T014 [US1] Add React Flow base styles and page layout styles in `app/src/App.css`
- [X] T015 [US1] Add manual smoke-check instructions for US1 in `README.md`

**Checkpoint**: User Story 1 is independently functional and demoable.

---

## Phase 4: User Story 2 - Store Discovery Data in Local JSON (Priority: P2)

**Goal**: Define and use a local JSON source of truth that can be edited and reloaded.

**Independent Test**: Edit `projects/parkpal/data/graph.json` node text values, reload app, and confirm updated values are shown.

### Implementation for User Story 2

- [X] T016 [US2] Create initial Parkpal graph dataset in `projects/parkpal/data/graph.json` with project metadata, 5 nodes, and 4 edges
- [X] T017 [US2] Enforce required graph document validation in `app/src/data/loadGraph.ts` for `project`, `nodes`, and `edges`
- [X] T018 [P] [US2] Add lightweight type guards for node data by node type in `app/src/types/graph.ts`
- [X] T019 [US2] Add JSON editing and reload workflow instructions in `README.md`

**Checkpoint**: User Story 2 is independently functional and supports iterative local data updates.

---

## Phase 5: User Story 3 - Export Outreach Data to Excel (Priority: P3)

**Goal**: Export Parkpal graph data to Excel with populated Audiences sheet and header-only supporting sheets.

**Independent Test**: Run `python scripts/export_to_excel.py` and verify `projects/parkpal/exports/Parkpal_Outreach.xlsx` has required sheets/headers and audience row(s).

### Implementation for User Story 3

- [X] T020 [US3] Implement graph JSON read and required-key validation in `scripts/export_to_excel.py`
- [X] T021 [P] [US3] Implement Audiences sheet headers and row mapping from `audience` nodes in `scripts/export_to_excel.py`
- [X] T022 [P] [US3] Implement `Outreach`, `Content`, and `Links` header-only sheets in `scripts/export_to_excel.py`
- [X] T023 [US3] Implement workbook write path and directory creation for `projects/parkpal/exports/Parkpal_Outreach.xlsx` in `scripts/export_to_excel.py`
- [X] T024 [US3] Add export run instructions and expected workbook structure in `README.md`

**Checkpoint**: User Story 3 is independently functional and produces the required workbook.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and end-to-end validation across stories.

- [X] T025 [P] Refine copy, labels, and consistency across `app/src/pages/ParkpalGraphPage.tsx` and node components in `app/src/components/`
- [X] T026 Validate quickstart flow and align commands in `README.md` and `specs/001-parkpal-visual-foundation/quickstart.md`
- [X] T027 Run end-to-end MVP smoke validation and record outcomes in `specs/001-parkpal-visual-foundation/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies, starts immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 completion and blocks user stories.
- **User Story Phases (Phase 3-5)**: Depend on Phase 2 completion.
- **Polish (Phase 6)**: Depends on completion of selected user stories.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational; no dependency on US2/US3.
- **US2 (P2)**: Starts after Foundational; can proceed in parallel with US1 but integrates into same rendering flow.
- **US3 (P3)**: Starts after Foundational and depends on `projects/parkpal/data/graph.json` shape from US2.

### Dependency Graph

- Setup -> Foundational -> US1
- Setup -> Foundational -> US2
- Setup -> Foundational -> US3 (after US2 graph contract is in place)
- US1 + US2 + US3 -> Polish

### Within Each User Story

- Data/contracts before implementation that consumes them.
- Core implementation before documentation/update tasks.
- Story checkpoint validation after implementation tasks complete.

---

## Parallel Opportunities

- **Setup**: T003 and T004 can run in parallel after T002 starts.
- **Foundational**: T007 and T008 can run in parallel after T006.
- **US1**: T011 and T012 can run in parallel after T010.
- **US2**: T018 can run in parallel with T017 after T016.
- **US3**: T021 and T022 can run in parallel after T020.

## Parallel Example: User Story 1

```bash
Task: "T011 [US1] Implement React Flow mapping logic in app/src/pages/ParkpalGraphPage.tsx"
Task: "T012 [US1] Add node type rendering bindings in app/src/pages/ParkpalGraphPage.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T017 [US2] Enforce graph document validation in app/src/data/loadGraph.ts"
Task: "T018 [US2] Add lightweight type guards in app/src/types/graph.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T021 [US3] Implement Audiences sheet mapping in scripts/export_to_excel.py"
Task: "T022 [US3] Implement Outreach/Content/Links header-only sheets in scripts/export_to_excel.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate US1 independently using its checkpoint.
4. Demo visual graph foundation.

### Incremental Delivery

1. Deliver US1 visual foundation.
2. Add US2 local JSON authoring workflow.
3. Add US3 Excel export workflow.
4. Finish polish phase for cohesive MVP handoff.
