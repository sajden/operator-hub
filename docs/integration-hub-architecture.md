# Integration Hub Architecture

`operator-hub` should own all shared external connectivity for the local system.

The goal is:
- one OAuth/API/MCP hub for the whole repo
- one provider registration per external platform and environment
- one connection model reused by planner, Parkpal, CRM, and future features
- one capability layer exposed both to the app and to MCP-style tool consumers

This avoids:
- duplicated Microsoft app registrations per feature
- duplicated token handling in different parts of the repo
- feature-specific auth logic for planner, Parkpal, CRM, or future assistants

## Core Model

The hub should be structured around six concepts.

### 1. Providers

A provider is the external platform or system.

Examples:
- `microsoft_graph`
- `google_workspace`
- `mailchimp`
- `home_assistant`
- `remotion_mcp`
- future local or remote MCP servers

Providers define:
- auth type
- supported capabilities
- resource types
- implementation details hidden behind stable hub contracts

### 2. Connections

A connection is a configured and authenticated provider instance.

Examples:
- your Microsoft 365 account
- your future Google Workspace account
- a Mailchimp account
- a local Home Assistant instance

Each connection should track:
- provider key
- environment key, e.g. `local`, `prod`
- auth type, e.g. `delegated_oauth`, `api_key`, `local_mcp`
- config status
- usable status
- granted scopes or permissions
- token presence and expiry
- last health check

Important distinction:
- `configured` means the hub has the env/config it needs
- `tokenAvailable` means a stored session/token exists
- `usable` means the connection can actually perform work now

## 3. Resource Bindings

A binding maps an internal object or workspace to a concrete external resource.

Examples:
- Parkpal Excel folder
- Parkpal default workbook
- primary calendar
- future CRM mailbox
- future TV/display target

Bindings should be first-class hub objects, rather than buried inside feature data.

Example binding types:
- `calendar`
- `mailbox`
- `sharepoint_folder`
- `workbook`
- `drive_folder`
- `display_target`

Each binding should reference:
- provider
- connection
- external resource identifiers
- optional owning feature or project
- optional default capability use

## 4. Capabilities

Capabilities are the stable verbs that the rest of the system depends on.

Examples:
- `identity.read`
- `calendar.read`
- `calendar.write`
- `calendar.delete`
- `mail.read`
- `mail.write`
- `mail.send`
- `file.read`
- `file.write`
- `workbook.read`
- `workbook.write`
- `display.open`

Features should depend on capabilities, not directly on provider APIs.

That means:
- planner talks to `calendar.read` / `calendar.write`
- Parkpal talks to `workbook.read` / `workbook.write`
- future CRM talks to `mail.send`, `calendar.read`, `file.read`
- MCP tools expose the same capability layer outward

## 5. Actions

Actions are product-level workflows built on capabilities.

Examples:
- `import_calendar_to_board`
- `sync_work_item_to_calendar`
- `sync_project_workbook`
- `draft_follow_up`
- `open_wallboard_on_tv`

Actions may use one or more capabilities internally, but they should present a feature-level interface to the UI.

## 6. MCP Exposure

The same hub should expose tools for external AI clients or local automation.

That means:
- providers and connections remain internal
- capabilities and actions are exposed through MCP-like tools
- planner, Parkpal, and future repos can all call the same hub instead of reimplementing integrations

## Microsoft Strategy

Microsoft should be treated as a single provider package inside the hub.

### Recommended provider key
- `microsoft_graph`

### Auth model
- use `delegated_oauth` first

This matches the current local login flow:
- user signs in via browser
- hub acts on behalf of that user
- planner and Parkpal reuse the same session

Use `application permissions` only later if true background automation without user presence becomes necessary.

### Shared Microsoft app registration

Use one shared Microsoft Entra app registration for `operator-hub` local development.

This app registration should support:
- planner calendar import/export
- Parkpal workbook read/write
- future Outlook mail flows
- future SharePoint/OneDrive file access

Do not create separate app registrations for:
- planner
- Parkpal
- CRM
- future dashboard modules

One provider registration should serve all Microsoft-backed capabilities for the repo.

### Permission strategy

Use delegated permissions and grow them in groups as the product needs expand.

Base:
- `User.Read`
- `offline_access`

Calendar:
- `Calendars.ReadWrite`

Files / SharePoint / Excel:
- `Files.ReadWrite.All`
- `Sites.ReadWrite.All`

Mail, later:
- `Mail.ReadWrite`
- `Mail.Send`

The hub UI should always show which capabilities are actually usable under the current granted scopes.

## Current Mapping

Today, Parkpal stores Microsoft-specific folder metadata directly inside:
- [graph.json](/home/sajden/github/operator-hub/projects/parkpal/data/graph.json)

That works for the current MVP, but the long-term model should move toward:
- project data references a binding id
- binding ids live in the hub integration layer
- provider-specific resource metadata lives in the binding, not the feature document

Transitional pattern:
- keep existing embedded metadata working
- add binding records beside it
- later migrate feature data to binding references

## Recommended Data Shape

These records do not need to be fully implemented immediately, but they define the target.

### Connection

```json
{
  "id": "conn-microsoft-local",
  "provider": "microsoft_graph",
  "environment": "local",
  "authType": "delegated_oauth",
  "configured": true,
  "tokenAvailable": true,
  "usable": true,
  "scopes": [
    "User.Read",
    "offline_access",
    "Calendars.ReadWrite"
  ],
  "expiresAt": "2026-03-19T10:00:00Z"
}
```

### Resource Binding

```json
{
  "id": "binding-parkpal-workbook-folder",
  "provider": "microsoft_graph",
  "connectionId": "conn-microsoft-local",
  "resourceType": "sharepoint_folder",
  "ownerType": "project",
  "ownerId": "parkpal",
  "resource": {
    "driveId": "...",
    "path": "ParkPal/Leads",
    "siteUrl": "https://...sharepoint.com/sites/..."
  }
}
```

### Capability Registration

```json
{
  "provider": "microsoft_graph",
  "capability": "calendar.write",
  "connectionId": "conn-microsoft-local",
  "usable": true
}
```

## UI Implications

The `Connections` workspace should evolve into the visible control plane for this layer.

It should show:
- providers
- connection status
- granted scopes
- bindings
- last sync/test
- available capabilities

It should also support:
- connect / reconnect / disconnect
- test connection
- preview sync input
- select target bindings

## Immediate Implementation Direction

The next platform steps should be:

1. Keep one shared Microsoft app registration for `operator-hub`.
2. Keep auth in the hub only.
3. Continue using `Connections` as the visible connection/status surface.
4. Introduce explicit binding records for calendar and Parkpal workbook resources.
5. Let planner and Parkpal use capabilities through the same provider/connection layer.
6. Add Google later as a second provider under the same architecture.

## Non-Goals

Not the goal right now:
- separate app registrations per feature
- multiple token stores for the same provider
- feature-specific Graph auth logic
- exposing provider-specific API details directly to UI components

## Decision

`operator-hub` is the shared OAuth/API/MCP hub for the system.

Microsoft, Google, Mailchimp, Home Assistant, and future MCP providers should all plug into the same model:

- `provider`
- `connection`
- `resource binding`
- `capability`
- `action`
- `MCP exposure`

That is the platform direction going forward.
