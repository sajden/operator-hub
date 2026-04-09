# Tasks: Parkpal Graph Editing MVP

**Input**: Design documents from `/specs/002-parkpal-graph-editing/`
**Prerequisites**: plan.md, spec.md

## Phase 1: Setup

- [X] T001 Add graph editing spec artifacts in `specs/002-parkpal-graph-editing/`

## Phase 2: Foundations

- [X] T002 Extend graph types for editable workflows in `app/src/types/graph.ts`
- [X] T003 Add local graph save helpers in `app/src/data/loadGraph.ts`
- [X] T004 Add development save endpoint in `app/vite.config.ts`

## Phase 3: User Story 1 - Edit Existing Graph Nodes (P1)

- [X] T005 [US1] Add edit mode state and selected node handling in `app/src/pages/ParkpalGraphPage.tsx`
- [X] T006 [US1] Create node inspector UI in `app/src/components/NodeInspector.tsx`
- [X] T007 [US1] Add editable project/audience/problem field updates in `app/src/pages/ParkpalGraphPage.tsx`
- [X] T008 [US1] Add save action and save status messaging in `app/src/pages/ParkpalGraphPage.tsx`

## Phase 4: User Story 2 - Add Audience And Child Problem Nodes (P2)

- [X] T009 [US2] Add create-audience action in `app/src/pages/ParkpalGraphPage.tsx`
- [X] T010 [US2] Add create-child-problem action in `app/src/pages/ParkpalGraphPage.tsx`
- [X] T011 [US2] Update layout and inspector controls in `app/src/App.css`

## Phase 5: User Story 3 - Update Confidence And Export Updated Structure (P3)

- [X] T012 [US3] Verify save flow keeps export-compatible graph structure in `projects/parkpal/data/graph.json`
- [X] T013 [US3] Update export guidance in `README.md`
- [X] T014 [US3] Re-run Excel export verification in `scripts/export_to_excel.py`

## Phase 6: Polish

- [X] T015 Refresh quickstart and manual validation notes in `specs/002-parkpal-graph-editing/plan.md`
