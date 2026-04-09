# Feature Specification: Parkpal Outreach Projection

**Feature Branch**: `003-parkpal-outreach-projection`  
**Created**: 2026-03-10  
**Status**: Draft  
**Input**: User description: "Excel should be directly coupled with the same model that future MCP can read, and easy to inspect in the UI."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect Outreach Projection In The UI (Priority: P1)

As the operator, I can inspect a derived outreach view in the UI so I can understand how the graph turns into operational tables without leaving the app.

**Independent Test**: Start the app and verify a projection panel shows audience/problem rows derived from the current graph.

### User Story 2 - Export The Same Projection To Excel (Priority: P2)

As the operator, I can export Excel from the same projection model so the workbook mirrors what I see in the UI.

**Independent Test**: Run the export and verify the workbook contains audience/problem sheets with the same status/confidence values shown in the UI projection.

## Requirements *(mandatory)*

- **FR-001**: The graph remains the source of truth.
- **FR-002**: A derived outreach projection MUST be built from the graph for both UI inspection and Excel export.
- **FR-003**: The projection MUST include audience and problem records with parent relationships, confidence, and status.
- **FR-004**: Excel export MUST use the projection rather than re-deriving rows ad hoc in the exporter.
- **FR-005**: The UI MUST show a readable preview of the current projection.
