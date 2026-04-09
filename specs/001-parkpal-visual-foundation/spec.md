# Feature Specification: Parkpal Visual Outreach Discovery MVP

**Feature Branch**: `001-parkpal-visual-foundation`  
**Created**: 2026-03-10  
**Status**: Draft  
**Input**: User description: "I want to start building the first version of a local project called operator-hub..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visualize Parkpal Outreach Graph (Priority: P1)

As the operator, I can open a frontend page and see a React Flow graph for Parkpal so I can visually understand the current audience hypothesis and related problem hypotheses.

**Why this priority**: This is the core MVP value: a visual discovery workspace for outreach mapping.

**Independent Test**: Can be fully tested by launching the app and verifying nodes/edges render from `projects/parkpal/data/graph.json`.

**Acceptance Scenarios**:

1. **Given** the app is running and the JSON file is valid, **When** I open the Parkpal graph page, **Then** I see one `project` node named Parkpal, one `audience` node named Elbilister, and three `problem` nodes.
2. **Given** the graph is rendered, **When** I inspect the connections, **Then** Elbilister is connected to Parkpal and each problem node is connected to Elbilister.

---

### User Story 2 - Store Discovery Data in Local JSON (Priority: P2)

As the operator, I can maintain project graph data in a local JSON file so the MVP remains simple, versionable, and easy to extend.

**Why this priority**: The JSON model is the internal source of truth and enables iterative expansion without backend complexity.

**Independent Test**: Can be tested by editing JSON values and confirming the frontend reflects changes after reload.

**Acceptance Scenarios**:

1. **Given** `projects/parkpal/data/graph.json` exists, **When** I update node labels or metadata, **Then** the frontend reflects the updated values.
2. **Given** required graph fields are present, **When** the app loads, **Then** it can parse and render graph data without additional services.

---

### User Story 3 - Export Outreach Data to Excel (Priority: P3)

As the operator, I can run a local Python script to export Parkpal outreach data to Excel so I can share and manage data outside the app.

**Why this priority**: Export allows practical workflow integration while keeping implementation simple.

**Independent Test**: Can be tested by running the export script and verifying `projects/parkpal/exports/Parkpal_Outreach.xlsx` contains the required sheets and columns.

**Acceptance Scenarios**:

1. **Given** valid Parkpal graph JSON, **When** I run `scripts/export_to_excel.py`, **Then** an Excel workbook is generated at the required path.
2. **Given** the workbook is generated, **When** I open it, **Then** the Audiences sheet is populated from audience nodes and Outreach/Content/Links sheets contain headers.

### Edge Cases

- If `graph.json` is missing required top-level keys (`project`, `nodes`, `edges`), the export script must fail with a clear error.
- If there are no audience nodes, the Audiences sheet should still be created with headers only.
- If a node has unknown `type`, the exporter should ignore it for audience population and continue.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a React frontend with a first page that renders a React Flow graph for Parkpal using local JSON data.
- **FR-002**: System MUST load graph data from `projects/parkpal/data/graph.json` as the internal source of truth.
- **FR-003**: System MUST support node types `project`, `audience`, and `problem` in the initial data model.
- **FR-004**: System MUST include a Parkpal `project` node containing `name`, `summary`, and `strengths`.
- **FR-005**: System MUST include an Elbilister `audience` node containing `name`, `relevanceWhy`, and `confidenceLevel`.
- **FR-006**: System MUST include three `problem` nodes containing `name` and `confidenceLevel`: `Hitta laddning`, `För många appar / splittrad information`, and `Förstå regler / vad som gäller`.
- **FR-007**: System MUST initialize all `confidenceLevel` values as `hypotes`.
- **FR-008**: System MUST include a Python script at `scripts/export_to_excel.py` that reads Parkpal graph JSON and writes `projects/parkpal/exports/Parkpal_Outreach.xlsx`.
- **FR-009**: Excel export MUST generate sheets named `Audiences`, `Outreach`, `Content`, and `Links`.
- **FR-010**: Audiences sheet MUST include columns `id`, `project`, `name`, `parent_id`, `relevance_why`, `confidence_level`, and `notes`, populated from audience nodes.
- **FR-011**: Outreach, Content, and Links sheets MUST be created with required headers and no mandatory row data in MVP.
- **FR-012**: Repository MUST follow the requested minimal structure and remain easy to extend for more projects and future integrations.

### Key Entities *(include if feature involves data)*

- **ProjectMetadata**: Top-level project identity and context (`id`, `name`, `summary`, `strengths`).
- **GraphNode**: Typed node (`project`, `audience`, `problem`) with per-type metadata.
- **GraphEdge**: Directed connection between nodes (`source`, `target`) used for relationship mapping.
- **ExcelExportRow**: Flattened row representation for workbook sheets (initially audience rows + header-only rows for other sheets).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Frontend renders the Parkpal graph from local JSON within 2 seconds on a local development machine.
- **SC-002**: The initial graph displays exactly 5 nodes and 4 edges matching the MVP definitions.
- **SC-003**: Running the export script produces `Parkpal_Outreach.xlsx` with all 4 required sheets in a single command.
- **SC-004**: At least one audience row (Elbilister) is present in Audiences sheet with `confidence_level = hypotes` and matching relevance text.
