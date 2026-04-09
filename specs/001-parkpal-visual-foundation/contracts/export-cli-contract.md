# Contract: Excel Export CLI

## Command

`python scripts/export_to_excel.py`

## Inputs

- Reads JSON from `projects/parkpal/data/graph.json`.

## Output

- Writes workbook to `projects/parkpal/exports/Parkpal_Outreach.xlsx`.

## Workbook Contract

- Required sheets:
  - `Audiences`
  - `Outreach`
  - `Content`
  - `Links`

### `Audiences` headers

- `id`
- `project`
- `name`
- `parent_id`
- `relevance_why`
- `confidence_level`
- `notes`

### `Outreach` headers

- `id`
- `project`
- `audience_id`
- `channel`
- `community`
- `angle`
- `status`
- `notes`

### `Content` headers

- `id`
- `project`
- `audience_id`
- `platform`
- `title`
- `doc_link`
- `status`

### `Links` headers

- `id`
- `project`
- `type`
- `label`
- `url`
- `related_id`

## Error Contract

- On missing/invalid required JSON structure, script exits non-zero and prints a clear error message.
