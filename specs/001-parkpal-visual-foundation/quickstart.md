# Quickstart: Parkpal Visual Outreach Discovery MVP

## Prerequisites

- Node.js 20+
- Python 3.11+
- pip package: `openpyxl`

## 1. Frontend setup (React + React Flow)

1. Open `app/` and install dependencies.
2. Run the Vite dev server.

```bash
cd app
npm install
npm run dev
```

3. Open the local URL shown by Vite.

## 2. Verify the initial Parkpal graph

Data source:
- `projects/parkpal/data/graph.json`

Expected graph in UI:
- 1 project node: `Parkpal`
- 1 audience node: `Elbilister`
- 3 problem nodes:
  - `Hitta laddning`
  - `För många appar / splittrad information`
  - `Förstå regler / vad som gäller`
- 4 edges total:
  - project -> audience
  - audience -> each problem

## 3. Local JSON editing workflow

1. Edit a node value in `projects/parkpal/data/graph.json`.
2. Reload the frontend.
3. Confirm the updated value appears.

## 4. Export to Excel

Install dependency:

```bash
pip install openpyxl
```

Run exporter:

```bash
python scripts/export_to_excel.py
```

Expected output:
- `projects/parkpal/exports/Parkpal_Outreach.xlsx`
- Sheets:
  - `Audiences`
  - `Outreach`
  - `Content`
  - `Links`

## 5. Validation Record (2026-03-10)

- `python scripts/export_to_excel.py`: **blocked** in this environment (`openpyxl` missing, network restricted prevented `pip install openpyxl`).
- `pip install openpyxl`: **failed** due network DNS resolution restrictions.
- Frontend runtime validation: **pending local dependency install** (`npm install` not executed here due restricted network).
