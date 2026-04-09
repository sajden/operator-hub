# Using The Hub From Other Repos

The local `operator-hub` mini-hub is intended to be reusable from any repo where you run Codex.

The intended model is:
- Codex is the AI engine
- `operator-hub` is the local capability layer
- tools and skills live in the hub so they can be reused across repos
- external auth and integrations should also terminate in the hub, not in each repo

## Start the hub

```bash
cd /home/sajden/github/operator-hub
docker compose up -d hub
```

## Check it

```bash
curl http://127.0.0.1:8787/api/health
curl http://127.0.0.1:8787/api/mcp/tools
curl http://127.0.0.1:8787/api/skills
```

Or use the shared helper:

```bash
python /home/sajden/github/operator-hub/scripts/hub_client.py health
python /home/sajden/github/operator-hub/scripts/hub_client.py projects
```

Microsoft auth status:

```bash
python /home/sajden/github/operator-hub/scripts/hub_client.py ms-status
```

Excel files through the shared hub:

```bash
python /home/sajden/github/operator-hub/scripts/hub_client.py ms-excel-files --limit 10
python /home/sajden/github/operator-hub/scripts/hub_client.py ms-excel-files --query parkpal
python /home/sajden/github/operator-hub/scripts/hub_client.py project-excel-files parkpal --limit 10
python /home/sajden/github/operator-hub/scripts/hub_client.py create-project-excel-file parkpal Parkpal_Leads_Test.xlsx
python /home/sajden/github/operator-hub/scripts/hub_client.py project-workbook-metadata parkpal <file-id>
python /home/sajden/github/operator-hub/scripts/hub_client.py project-workbook-range parkpal <file-id> Audiences A1:G5
python /home/sajden/github/operator-hub/scripts/hub_client.py write-project-workbook-range parkpal <file-id> Outreach A2:G2 '[["lead-1","parkpal","audience-elbilister","linkedin","EV-angle","draft","note"]]'
curl -X POST http://127.0.0.1:8787/api/skills/run -H "Content-Type: application/json" -d '{"skill":"sync_audiences_to_excel","arguments":{"projectId":"parkpal","fileId":"<file-id>"}}'
curl -X POST http://127.0.0.1:8787/api/skills/run -H "Content-Type: application/json" -d '{"skill":"sync_project_workbook","arguments":{"projectId":"parkpal","fileId":"<file-id>"}}'
```

## Example tool call

```bash
curl -X POST http://127.0.0.1:8787/api/mcp/call \
  -H "Content-Type: application/json" \
  -d '{"tool":"get_project_summary","arguments":{"projectId":"parkpal"}}'
```

Helper version:

```bash
python /home/sajden/github/operator-hub/scripts/hub_client.py \
  call-tool get_project_summary --args '{"projectId":"parkpal"}'
```

## Example skill call

```bash
curl -X POST http://127.0.0.1:8787/api/skills/run \
  -H "Content-Type: application/json" \
  -d '{"skill":"suggest_next_outreach_steps","arguments":{"projectId":"parkpal"}}'
```

Helper version:

```bash
python /home/sajden/github/operator-hub/scripts/hub_client.py \
  run-skill suggest_next_outreach_steps --args '{"projectId":"parkpal"}'
```

## Intended usage model

- Codex in any repo can call the hub over `http://127.0.0.1:8787`
- the hub owns project graph and projection access
- skills/workflows sit above tools and produce more useful outputs for AI-assisted work
- future MCP integrations should be added to the hub, not duplicated in each repo
- a second repo should treat the hub as shared local infrastructure, not reimplement the same tools

## Practical pattern for other repos

From another repo, Codex can:
- inspect available tools with `python /home/sajden/github/operator-hub/scripts/hub_client.py tools`
- inspect available skills with `python /home/sajden/github/operator-hub/scripts/hub_client.py skills`
- inspect Microsoft auth readiness with `python /home/sajden/github/operator-hub/scripts/hub_client.py ms-status`
- list available Excel files through the same signed-in Microsoft session
- ask the hub for Excel files in the folder bound to a specific project
- create a project workbook directly in the folder bound to a specific project
- inspect workbook metadata and worksheets for a specific project file
- read concrete worksheet ranges from a project workbook
- write concrete worksheet ranges to a project workbook
- run higher-level sync skills that project graph data into Excel
- rely on graph save to auto-sync the default workbook for a project
- fetch a project summary before making suggestions
- run a skill and use the result as context for edits or planning in that repo

## Microsoft OAuth foundation

The hub now owns the first local Microsoft OAuth flow.

Register a Microsoft Entra app for local use with:
- redirect URI: `http://localhost:8787/api/auth/microsoft/callback`
- delegated Graph permissions for the capabilities you actually need
- one shared app registration for the whole `operator-hub`, not separate per feature

Then provide environment values before starting the hub:

```bash
export OPERATOR_HUB_MS_CLIENT_ID="your-client-id"
export OPERATOR_HUB_MS_TENANT_ID="common"
export OPERATOR_HUB_PUBLIC_URL="http://localhost:8787"
docker compose up -d hub
```

Start sign-in in a browser:

```text
http://localhost:8787/api/auth/microsoft/start
```

After sign-in, verify the live Graph connection:

```bash
python /home/sajden/github/operator-hub/scripts/hub_client.py ms-me
```
