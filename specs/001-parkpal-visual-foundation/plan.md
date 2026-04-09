# Implementation Plan: Parkpal Visual Outreach Discovery MVP

**Branch**: `001-parkpal-visual-foundation` | **Date**: 2026-03-10 | **Spec**: [/home/sajden/github/operator-hub/specs/001-parkpal-visual-foundation/spec.md](/home/sajden/github/operator-hub/specs/001-parkpal-visual-foundation/spec.md)
**Input**: Feature specification from `/specs/001-parkpal-visual-foundation/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Build a minimal local-first foundation for Operator Hub focused on Parkpal outreach discovery: a React + React Flow page renders a typed graph from `projects/parkpal/data/graph.json`, and a Python script exports audience-focused data into an Excel workbook for operational tracking.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Python 3.11+ (export script)  
**Primary Dependencies**: React 18, React Flow, Vite, openpyxl  
**Storage**: Local JSON files (`projects/<project>/data/graph.json`) and generated `.xlsx` files  
**Testing**: Manual smoke validation for UI render + Python script execution validation  
**Target Platform**: Local development on macOS/Linux via VS Code terminal  
**Project Type**: Web frontend + local scripting utility  
**Performance Goals**: Initial Parkpal graph should render in <2s locally for <=100 nodes  
**Constraints**: No backend/database, minimal MVP scope, easy extensibility for more node types/projects  
**Scale/Scope**: First project only (Parkpal), 3 node types, 1 export workflow

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Constitution file (`.specify/memory/constitution.md`) is currently a placeholder template with no concrete enforceable principles.
- Gate result (pre-research): **PASS** (no active constitutional constraints to violate).
- Design intent alignment: maintain simplicity, explicit data model, and incremental extensibility.

**Post-Design Re-check (after Phase 1)**

- Phase 1 artifacts remain consistent with minimal scope and avoid premature abstraction.
- Gate result (post-design): **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/001-parkpal-visual-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── graph-json-contract.md
│   └── export-cli-contract.md
└── tasks.md  # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
operator-hub/
├── app/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── data/
│       └── types/
├── projects/
│   └── parkpal/
│       ├── data/
│       │   └── graph.json
│       └── exports/
├── scripts/
│   └── export_to_excel.py
└── README.md
```

**Structure Decision**: Use a single local repository with a React app, per-project data folders, and a lightweight Python export script to keep the MVP simple while preserving an obvious growth path for more projects and future integrations.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitutional violations identified.
