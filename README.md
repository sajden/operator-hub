# operator-hub

Local-first operator workbench: a personal dashboard, planner boards, Parkpal outreach workspace, and a shared local hub for tools, skills, and future integrations.

Architecture references:
- [Agent Playbook](/home/sajden/github/operator-hub/docs/agent-playbook.md)
- [Agent Media Playbook](/home/sajden/github/operator-hub/docs/agent-media-playbook.md)
- [Agent Remotion Prompt Playbook](/home/sajden/github/operator-hub/docs/agent-remotion-prompt-playbook.md)
- [Agent Guide: Using operator-hub From Another Repo](/home/sajden/github/operator-hub/docs/agent-using-operator-hub.md)
- [Integration Hub Architecture](/home/sajden/github/operator-hub/docs/integration-hub-architecture.md)
- [Current Architecture Map](/home/sajden/github/operator-hub/docs/current-architecture-map.md)
- [Using The Hub From Other Repos](/home/sajden/github/operator-hub/docs/using-hub-from-other-repos.md)

## Runtime

Normal runtime is now:
- `ai-cam` Docker Compose runs `operator-hub` as the `ai-cam-operator-hub` container
- `aihub` reverse-proxies it for mobile/HA-safe access

So the normal production-like path is no longer manual `npm run dev` for the hub.

Use manual local dev only when you are actively editing or debugging `operator-hub` itself.

## Repo Structure

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
├── hub/
│   ├── server.mjs
│   ├── graphProjection.mjs
│   └── Dockerfile
├── scripts/
│   └── export_to_excel.py
├── docker-compose.yml
└── specs/
```

## Frontend

```bash
cd hub
npm run dev
```

In a second terminal:

```bash
cd app
npm install
npm run dev
```

Open the local URL from Vite.

Current app shell:
- `/` -> personal operator dashboard
- `/boards/daily` -> daily execution board
- `/parkpal` -> Parkpal graph/outreach workspace
- `/tv` -> TV wallboard view

Default dashboard includes:
- `Today`
- `In Progress`
- `Current Goals`
- `Weekly Progress`
- `Quick Actions`

Seeded planner examples include:
- `Skicka mail till Patrik`
- `Skissa erbjudande för AI/automation`
- one Parkpal carry-over item

Parkpal workspace still renders:
- Parkpal project node
- Elbilister audience node
- 3 problem nodes connected to Elbilister

### Dashboard MVP

The first planner MVP now supports:
- creating a new work item from the dashboard
- focusing work for today
- moving work into progress
- marking work done
- showing carry-over
- showing active goals
- running simple direct actions such as `Draft follow-up`
- opening a dedicated TV wallboard route

Theme support:
- `Light` and `Dark` can be toggled from the planner views
- light mode remains the primary design reference

### Parkpal Edit Mode

- Toggle `Enter edit mode` to unlock node editing and drag positioning.
- Select any node to open the inspector panel.
- Use `Add audience` to create a new audience from the project node.
- Use `Add child problem` when an audience node is selected.
- Use `Save graph` to persist changes back to `projects/parkpal/data/graph.json`.
- The UI now reads graph and projection through the local mini-hub.
- The UI also shows a derived outreach projection based on the same hub-facing model that Excel uses.

### Planner Manual Smoke Check

1. Start `hub/` with `npm run dev`.
2. Start `app/` with `npm run dev`.
3. Open the Vite URL and confirm the dashboard loads first.
4. Create a new work item from `Today`.
5. Move an item to `Done`.
6. Confirm weekly progress and carry-over update.
7. Click `Open TV view` from `Quick Actions`.
8. Confirm `/tv` renders a simplified wallboard.

### Parkpal Manual Smoke Check

1. Start app from `app/` with `npm run dev`.
2. Confirm graph renders from `projects/parkpal/data/graph.json`.
3. Confirm there are 5 nodes and 4 edges.

## Local JSON Workflow (US2)

1. Edit in the UI or directly in `projects/parkpal/data/graph.json`.
2. Save from the UI or reload the browser after file edits.
3. Confirm updated values render in the graph.

## Excel Export (Python)

Install dependency:

```bash
pip install openpyxl
```

Run export:

```bash
python scripts/export_to_excel.py
```

Expected output file:

`projects/parkpal/exports/Parkpal_Outreach.xlsx`

Workbook sheets:
- `Audiences` (projection rows from audience nodes)
- `Problems` (projection rows from problem nodes)
- `Outreach` (headers only)
- `Content` (headers only)
- `Links` (headers only)

The export reads the saved graph state from `projects/parkpal/data/graph.json` through a shared outreach projection, including status and confidence values.

## Mini-Hub

The first local hub lives in `hub/` and now normally runs through the `ai-cam` Docker stack.

Run it with:

```bash
cd hub
npm run dev
```

But treat that as a dev/debug path, not the default runtime path.

Current endpoints:
- `GET /`
- `GET /api/health`
- `GET /api/planner/dashboard`
- `GET /api/planner/boards`
- `GET /api/planner/boards/:boardId`
- `POST /api/planner/work-items`
- `PATCH /api/planner/work-items/:workItemId`
- `POST /api/planner/work-items/:workItemId/move`
- `GET /api/planner/actions`
- `POST /api/planner/actions/run`
- `GET /api/hub/tools`
- `GET /api/mcp/tools`
- `POST /api/mcp/call`
- `GET /api/skills`
- `POST /api/skills/run`
- `GET /api/projects`
- `GET /api/projects/:projectId/graph`
- `POST /api/projects/:projectId/graph`
- `GET /api/projects/:projectId/outreach-projection`
- `GET /api/projects/:projectId/microsoft-excel-files`
- `POST /api/projects/:projectId/microsoft-workbook`
- `POST /api/projects/:projectId/microsoft-range`

Projects are discovered from `projects/*/data/graph.json`, so adding a new project can be as simple as creating that folder/file structure.

First MCP-like tool surface:
- `list_projects`
- `get_project_summary`
- `get_graph`
- `save_graph`
- `get_outreach_projection`
- `get_planner_dashboard`
- `list_planner_boards`
- `get_planner_board`
- `create_planner_work_item`
- `move_planner_work_item`
- `list_excel_files`
- `list_project_excel_files`
- `create_project_excel_file`
- `get_project_workbook_metadata`
- `read_project_workbook_range`
- `write_project_workbook_range`

Example:

```bash
curl -X POST http://127.0.0.1:8787/api/mcp/call \
  -H "Content-Type: application/json" \
  -d '{"tool":"get_planner_dashboard","arguments":{"mode":"desktop"}}'
```

Planner board example:

```bash
curl -X POST http://127.0.0.1:8787/api/mcp/call \
  -H "Content-Type: application/json" \
  -d '{"tool":"get_planner_board","arguments":{"boardId":"daily"}}'
```

First skill surface:
- `summarize_project_hypotheses`
- `suggest_next_outreach_steps`
- `sync_audiences_to_excel`
- `sync_problems_to_excel`
- `sync_project_workbook`

Skill example:

```bash
curl -X POST http://127.0.0.1:8787/api/skills/run \
  -H "Content-Type: application/json" \
  -d '{"skill":"suggest_next_outreach_steps","arguments":{"projectId":"parkpal"}}'
```

Audience sync skill example:

```bash
curl -X POST http://127.0.0.1:8787/api/skills/run \
  -H "Content-Type: application/json" \
  -d '{"skill":"sync_audiences_to_excel","arguments":{"projectId":"parkpal","fileId":"013EXZMZFOFDEWLJB3ORD3GKWOPVD3YX6O"}}'
```

Full workbook sync skill example:

```bash
curl -X POST http://127.0.0.1:8787/api/skills/run \
  -H "Content-Type: application/json" \
  -d '{"skill":"sync_project_workbook","arguments":{"projectId":"parkpal","fileId":"013EXZMZFOFDEWLJB3ORD3GKWOPVD3YX6O"}}'
```

Cross-repo usage notes live in [docs/using-hub-from-other-repos.md](/home/sajden/github/operator-hub/docs/using-hub-from-other-repos.md).

Shared helper CLI:

```bash
python scripts/hub_client.py health
python scripts/hub_client.py tools
python scripts/hub_client.py call-tool get_project_summary --args '{"projectId":"parkpal"}'
python scripts/hub_client.py run-skill suggest_next_outreach_steps --args '{"projectId":"parkpal"}'
python scripts/hub_client.py ms-status
python scripts/hub_client.py ms-excel-files --limit 10
python scripts/hub_client.py project-excel-files parkpal --limit 10
python scripts/hub_client.py create-project-excel-file parkpal Parkpal_Leads_Test.xlsx
python scripts/hub_client.py project-workbook-metadata parkpal <file-id>
python scripts/hub_client.py project-workbook-range parkpal <file-id> Audiences A1:G5
python scripts/hub_client.py write-project-workbook-range parkpal <file-id> Outreach A2:G2 '[["lead-1","parkpal","audience-elbilister","linkedin","EV-angle","draft","note"]]'
```

This is the intended cross-repo pattern: Codex can run the helper from any repo and use the local hub as a shared capability layer.

## Microsoft OAuth Foundation

The hub now owns a first local Microsoft OAuth foundation instead of each repo handling auth separately.

Available endpoints:
- `GET /api/auth/microsoft/status`
- `GET /api/auth/microsoft/start`
- `GET /api/auth/microsoft/callback`
- `GET /api/auth/microsoft/me`
- `GET /api/auth/microsoft/excel-files`
- `POST /api/auth/microsoft/logout`

Setup:

1. Create a Microsoft Entra app registration for local development.
2. Use redirect URI `http://localhost:8787/api/auth/microsoft/callback`.
3. Add delegated Graph permissions such as `User.Read`, `offline_access`, and `Calendars.ReadWrite`.
4. Set `OPERATOR_HUB_MS_CLIENT_ID`.

Sample env file:
- [microsoft-auth.sample.env](/home/sajden/github/operator-hub/hub/microsoft-auth.sample.env)

Example:

```bash
export OPERATOR_HUB_PUBLIC_URL="http://localhost:8787"
export OPERATOR_HUB_MS_TENANT_ID="common"
export OPERATOR_HUB_MS_CLIENT_ID="your-client-id"
docker compose up -d --build hub
```

Then open:

```text
http://localhost:8787/api/auth/microsoft/start
```

And verify the connected account through the hub:

```bash
python scripts/hub_client.py ms-status
python scripts/hub_client.py ms-me
python scripts/hub_client.py ms-excel-files --limit 10
python scripts/hub_client.py project-excel-files parkpal --limit 10
python scripts/hub_client.py create-project-excel-file parkpal Parkpal_Leads_Test.xlsx
python scripts/hub_client.py project-workbook-metadata parkpal <file-id>
python scripts/hub_client.py project-workbook-range parkpal <file-id> Audiences A1:G5
python scripts/hub_client.py write-project-workbook-range parkpal <file-id> Outreach A2:G2 '[["lead-1","parkpal","audience-elbilister","linkedin","EV-angle","draft","note"]]'
```

`Parkpal` is now bound to the intended Microsoft location:
- Windows sync path: `C:\Users\sebas\OneDrive - Settler Technology AB\Settler Technology AB - Företag\ParkPal\Leads`
- SharePoint site: `https://settlerstechnologyab.sharepoint.com/sites/SettlersTechnologyAB`
- library: `Fretag`
- path inside library: `ParkPal/Leads`

Important: the folder binding is correct, but the current delegated scope set still returns access denied when the hub tries to read that shared library directly. To make the project-specific folder route work, the Entra app likely needs broader delegated permission such as `Files.Read.All` or `Sites.Read.All`, followed by a fresh sign-in.

The first create implementation uploads the local template workbook at `projects/parkpal/exports/Parkpal_Outreach.xlsx` into the configured Microsoft folder with the file name you provide.

`Parkpal` now also has a default workbook binding. When you save the graph through the hub, the hub will auto-sync `Audiences` and `Problems` into that workbook.

## Docker

The hub is now Docker-ready, and the repo includes a first `docker-compose.yml` for local orchestration.

Start hub + app:

```bash
docker compose up --build
```

Then open:

```text
http://127.0.0.1:8787/
http://127.0.0.1:5173/
```

The app container proxies `/api/*` to the hub container using `OPERATOR_HUB_URL=http://hub:8787`.
The hub root at `:8787/` is now a small human-readable dashboard instead of raw JSON.

## Speckit Commands

When using the local launcher (`./codex-local`), these commands are available.
The launcher now applies default runtime policy automatically (`--search`, `-s workspace-write`, `-a on-request`) so you do not need to pass flags manually.

- `/speckit.constitution`
- `/speckit.specify`
- `/speckit.plan`
- `/speckit.tasks`
- `/speckit.implement`
