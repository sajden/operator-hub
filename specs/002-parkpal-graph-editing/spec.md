# Feature Specification: Parkpal Graph Editing MVP

**Feature Branch**: `002-parkpal-graph-editing`  
**Created**: 2026-03-10  
**Status**: Draft  
**Input**: User description: "Focus on edit mode in UI, create new audience node, create child nodes, change confidence/status, and save changes locally."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit Existing Graph Nodes (Priority: P1)

As the operator, I can enter an edit mode, select a node, and update its fields so the graph becomes a practical workspace instead of a read-only map.

**Why this priority**: Editing existing nodes is the minimum step that makes the MVP useful day-to-day.

**Independent Test**: Start the frontend, enable edit mode, select an existing node, change its fields, save, and confirm the updated data appears in both the UI and `projects/parkpal/data/graph.json`.

**Acceptance Scenarios**:

1. **Given** the graph page is loaded, **When** I enable edit mode and select a node, **Then** I see an inspector with editable fields for that node type.
2. **Given** I update a node field and save, **When** the save completes, **Then** the graph reflects the changes and the JSON file is updated locally.

---

### User Story 2 - Add Audience And Child Problem Nodes (Priority: P2)

As the operator, I can visually add a new audience and child problem nodes so I can expand the outreach map without editing JSON by hand.

**Why this priority**: Creating new nodes is the next practical step after editing existing data.

**Independent Test**: Add a new audience from the UI, add a child problem beneath it, save, and confirm new nodes and edges appear in the graph and JSON file.

**Acceptance Scenarios**:

1. **Given** edit mode is active, **When** I click "Add audience", **Then** a new audience node is created and connected to the project node.
2. **Given** an audience node is selected, **When** I click "Add child problem", **Then** a new problem node is created and connected to that audience node.

---

### User Story 3 - Update Confidence And Export Updated Structure (Priority: P3)

As the operator, I can change confidence/status fields and export the updated graph so the Excel view stays aligned with the working graph.

**Why this priority**: Export remains useful only if it reflects the edited structure.

**Independent Test**: Update confidence values in the UI, save, run the export script, and confirm the workbook contains the saved values for audience rows.

**Acceptance Scenarios**:

1. **Given** edit mode is active, **When** I change an audience or problem confidence value, **Then** the node UI updates immediately and the new value is persisted on save.
2. **Given** the graph has been edited and saved, **When** I run the export script, **Then** the workbook is generated from the updated JSON file.

### Edge Cases

- Saving must fail with a clear error if the graph document is missing required top-level fields.
- "Add child problem" must be unavailable unless an audience node is selected.
- Save should not remove existing nodes or edges that were not changed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The graph page MUST support toggling between read mode and edit mode.
- **FR-002**: The UI MUST show an inspector panel for the selected node in edit mode.
- **FR-003**: The inspector MUST support editing `project`, `audience`, and `problem` node fields.
- **FR-004**: The UI MUST support creating a new `audience` node connected to the project node.
- **FR-005**: The UI MUST support creating a new `problem` node connected to the selected `audience` node.
- **FR-006**: The UI MUST support editing `confidenceLevel` values for `audience` and `problem` nodes.
- **FR-007**: The UI MUST persist the full graph document back to `projects/parkpal/data/graph.json`.
- **FR-008**: Local persistence MUST happen through a minimal local save mechanism and MUST NOT require a full backend service.
- **FR-009**: The Excel export script MUST continue to read the saved graph structure from `projects/parkpal/data/graph.json`.

### Key Entities *(include if feature involves data)*

- **EditableGraphDocument**: Full graph document held in UI state and written back to disk.
- **SelectedNode**: The currently inspected node, including editable fields by type.
- **SaveResult**: Outcome of the local save action, including success/error messaging.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can update an existing node and persist the change to `graph.json` in one edit flow.
- **SC-002**: An operator can add a new audience and a child problem node without manually editing JSON.
- **SC-003**: The local save action completes successfully in under 2 seconds on a development machine.
- **SC-004**: Running `python scripts/export_to_excel.py` after a save exports the updated graph data.
