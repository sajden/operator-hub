# Data Model: Parkpal Visual Outreach Discovery MVP

## Entity: ProjectMetadata

- Description: Top-level metadata for a project graph.
- Fields:
  - `id` (string, required, stable identifier; example: `parkpal`)
  - `name` (string, required)
  - `summary` (string, required)
  - `strengths` (string[], required, non-empty allowed)

## Entity: GraphNode

- Description: A graph node representing project, audience, or problem.
- Common Fields:
  - `id` (string, required, unique within graph)
  - `type` (enum: `project` | `audience` | `problem`, required)
  - `position` (object, required for frontend layout; `x:number`, `y:number`)
  - `data` (object, required, shape depends on `type`)

### `project` Node Data

- `name` (string, required)
- `summary` (string, required)
- `strengths` (string[], required)

### `audience` Node Data

- `name` (string, required)
- `relevanceWhy` (string, required)
- `confidenceLevel` (string, required; MVP value: `hypotes`)

### `problem` Node Data

- `name` (string, required)
- `confidenceLevel` (string, required; MVP value: `hypotes`)

## Entity: GraphEdge

- Description: Directed relationship between nodes.
- Fields:
  - `id` (string, required, unique)
  - `source` (string, required, references GraphNode.id)
  - `target` (string, required, references GraphNode.id)

## Entity: GraphDocument

- Description: Complete project graph JSON document.
- Fields:
  - `project` (ProjectMetadata, required)
  - `nodes` (GraphNode[], required)
  - `edges` (GraphEdge[], required)

## Entity: ExcelWorkbookOutput

- Description: Exported workbook at `projects/parkpal/exports/Parkpal_Outreach.xlsx`.
- Sheets:
  - `Audiences` (rows populated from audience nodes)
  - `Outreach` (headers only)
  - `Content` (headers only)
  - `Links` (headers only)

## Relationships

- `GraphDocument.project.id` equals workbook `project` column values.
- `GraphEdge` links define conceptual hierarchy:
  - project -> audience
  - audience -> problem
- `Audiences.parent_id` is derived from inbound edge source for audience node (expected: project node id).

## Validation Rules

- Graph document must include top-level `project`, `nodes`, and `edges`.
- Node ids and edge ids must be unique.
- Every edge `source` and `target` must reference existing node ids.
- Audience export includes only nodes with `type = audience`.
- Audience row requires `name`, `relevanceWhy`, and `confidenceLevel`.

## State Transitions

- Graph lifecycle for MVP:
  1. Author/edit JSON graph.
  2. Frontend reads and renders graph.
  3. Export script reads same graph and produces Excel workbook.
- No persisted workflow states beyond static field values (for example `confidenceLevel = hypotes`).
