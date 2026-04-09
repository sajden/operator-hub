# Phase 0 Research: Parkpal Visual Outreach Discovery MVP

## Decision 1: Frontend stack uses React + Vite + React Flow

- Decision: Use React (TypeScript) with Vite for local development and React Flow for graph rendering.
- Rationale: Matches stated requirements directly, minimizes setup complexity, and gives immediate visual graph manipulation/extension capability.
- Alternatives considered: Next.js (heavier than needed for local MVP), vanilla SVG/D3 (more custom code for graph behavior).

## Decision 2: Local JSON as source of truth under `projects/<project>/data/graph.json`

- Decision: Use project-scoped JSON files with top-level `project`, `nodes`, and `edges` keys.
- Rationale: Local-first, easy to version in git, and straightforward to parse in both frontend and Python exporter.
- Alternatives considered: SQLite (extra schema/runtime complexity), YAML (less standardized for typed frontends/scripts).

## Decision 3: Typed node model with minimal required metadata

- Decision: Define node types `project`, `audience`, `problem` and require per-type fields from the feature spec.
- Rationale: Supports immediate use case while preserving a stable contract for adding future node types.
- Alternatives considered: Free-form node payloads only (faster initially but weak validation and more fragile exports).

## Decision 4: Python Excel export implemented with `openpyxl`

- Decision: Use Python + `openpyxl` for writing multi-sheet `.xlsx` files.
- Rationale: Stable library, no external service needed, supports explicit sheet/header control required by MVP.
- Alternatives considered: pandas (heavier dependency than needed), CSV-only export (does not satisfy multi-sheet Excel requirement).

## Decision 5: Export behavior for MVP scope

- Decision: Populate only `Audiences` rows from `audience` nodes; create `Outreach`, `Content`, and `Links` with headers only.
- Rationale: Meets current requirements while leaving clear extension points for future workflows.
- Alternatives considered: Synthesizing empty placeholder rows (adds noise), deriving outreach/content automatically (premature inference).

## Decision 6: Validation/error handling level

- Decision: Add lightweight validation for required JSON structure and required fields per audience export path.
- Rationale: Prevents silent corruption while keeping script readable and minimal.
- Alternatives considered: Full JSON Schema engine (overengineering for MVP), no validation (high risk of silent bad exports).

## Clarification Resolution Summary

All previously potential clarifications are resolved:
- Language/runtime: TypeScript + Python 3.11+
- Dependency choices: React Flow and openpyxl
- Storage/integration model: local JSON + local Excel outputs
- Testing approach: manual smoke checks for MVP workflows
