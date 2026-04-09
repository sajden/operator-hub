# Implementation Plan: Personal Operator Dashboard

**Branch**: `005-personal-operator-dashboard` | **Date**: 2026-03-17 | **Spec**: [/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/spec.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/spec.md)
**Input**: Feature specification from `/specs/005-personal-operator-dashboard/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Extend `operator-hub` from a Parkpal-specific visual workspace into a broader single-user planning product: add a widget-first operator dashboard, multiple boards, local planner persistence, direct user-triggered actions, momentum tracking, and a dedicated TV wallboard view while preserving Parkpal outreach as one specialized workspace inside the same shell.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Node.js 22+ (local hub/service)  
**Primary Dependencies**: React 18, Vite, React Router, react-grid-layout, existing local hub, SQLite via built-in Node runtime support  
**Storage**: Local SQLite database for planner domain data, existing local JSON project files for Parkpal graph data, browser local storage only for non-critical UI preferences if still needed  
**Testing**: Manual smoke validation for dashboard flows and board interactions, targeted local validation for planner data and hub contracts  
**Target Platform**: Local desktop browser on macOS/Linux/WSL with optional TV display route on the same local network  
**Project Type**: Web application with local hub-backed API  
**Performance Goals**: Dashboard and board views render in under 2 seconds locally for up to 200 work items; common drag, move, and quick-action interactions feel instant; TV view remains readable on a 1080p display from across a room  
**Constraints**: Local-first, single-user, useful without any external service configured, preserve existing Parkpal graph workflows, no cross-repo device-launch implementation required in this feature  
**Scale/Scope**: One primary user, 4-8 default widgets, 2-4 initial board types, dozens to a few hundred work items, a small starter catalog of direct actions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Constitution file (`.specify/memory/constitution.md`) remains a placeholder template with no concrete enforceable principles.
- Gate result (pre-research): **PASS**.
- Planning intent: keep the feature local-first, incremental, and structurally compatible with the current `app/` plus `hub/` split.

**Post-Design Re-check (after Phase 1)**

- Phase 1 artifacts keep scope focused on dashboard, boards, actions, and TV mode without forcing a full CRM or automation engine in v1.
- Gate result (post-design): **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/005-personal-operator-dashboard/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── planner-api-contract.md
│   └── planner-action-contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
operator-hub/
├── app/
│   └── src/
│       ├── components/
│       │   ├── dashboard/
│       │   ├── planner/
│       │   └── parkpal/
│       ├── data/
│       │   ├── plannerClient.ts
│       │   └── loadGraph.ts
│       ├── pages/
│       │   ├── OperatorDashboardPage.tsx
│       │   ├── PlannerBoardPage.tsx
│       │   ├── PlannerTvPage.tsx
│       │   └── ParkpalGraphPage.tsx
│       ├── styles/
│       │   └── theme.css
│       ├── types/
│       │   ├── planner.ts
│       │   └── graph.ts
│       ├── App.tsx
│       └── main.tsx
├── hub/
│   ├── server.mjs
│   ├── plannerStore.mjs
│   ├── plannerActions.mjs
│   ├── plannerQueries.mjs
│   └── mcpTools.mjs
├── .local/
│   └── planner.db
├── projects/
│   └── parkpal/
└── specs/
    └── 005-personal-operator-dashboard/
```

**Structure Decision**: Keep the existing two-part repository structure: React app for the main UX and the local hub as the single capability and persistence layer. Add a planner domain beside the existing Parkpal graph domain instead of replacing or forking the current app.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitutional violations identified.
