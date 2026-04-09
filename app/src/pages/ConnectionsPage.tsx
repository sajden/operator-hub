import { useEffect, useState } from 'react'
import PlannerSidebar from '../components/shell/PlannerSidebar'
import PlannerTopbar from '../components/shell/PlannerTopbar'
import { plannerSyncWindow } from '../data/calendarSyncWindow'
import {
  importMicrosoftCalendarToPlanner,
  listMicrosoftCalendarEvents,
  listPlannerBoards,
  loadHubHealth,
  loadHubTools,
  loadMicrosoftAuthStatus,
  loadMicrosoftProfile,
  logoutMicrosoft
} from '../data/plannerClient'
import { readAutoImportPreference, writeAutoImportPreference } from '../data/plannerPreferences'
import { apiPath } from '../data/runtimePaths'
import type {
  HubHealthStatus,
  HubToolsPayload,
  MicrosoftAuthStatus,
  MicrosoftCalendarEvent,
  MicrosoftProfile,
  PlannerBoardSummary
} from '../types/planner'

interface ConnectionsPageProps {
  onNavigate: (path: string) => void
  theme: 'light' | 'dark' | string
  onSetTheme: (theme: 'light' | 'dark') => void
}

function localDayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ConnectionsPage({ onNavigate, theme, onSetTheme }: ConnectionsPageProps) {
  const [health, setHealth] = useState<HubHealthStatus | null>(null)
  const [tools, setTools] = useState<HubToolsPayload | null>(null)
  const [microsoftStatus, setMicrosoftStatus] = useState<MicrosoftAuthStatus | null>(null)
  const [profile, setProfile] = useState<MicrosoftProfile | null>(null)
  const [boards, setBoards] = useState<PlannerBoardSummary[]>([])
  const [targetBoardId, setTargetBoardId] = useState('board-daily')
  const [rangeDays, setRangeDays] = useState('14')
  const [previewEvents, setPreviewEvents] = useState<MicrosoftCalendarEvent[]>([])
  const [showRawPreview, setShowRawPreview] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [autoImportEnabled, setAutoImportEnabled] = useState(readAutoImportPreference)
  const [signal, setSignal] = useState<'all' | 'follow_up' | 'avoidance' | 'high_priority'>('all')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)

  async function refresh() {
    try {
      setError(null)
      const [nextHealth, nextTools, nextMicrosoftStatus, nextBoards] = await Promise.all([
        loadHubHealth(),
        loadHubTools(),
        loadMicrosoftAuthStatus(),
        listPlannerBoards()
      ])
      setHealth(nextHealth)
      setTools(nextTools)
      setMicrosoftStatus(nextMicrosoftStatus)
      setBoards(nextBoards.boards)
      setTargetBoardId((current) => current || nextBoards.boards[0]?.id || 'board-daily')
      setProfile(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load connections')
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  function handleWorkspaceChange(workspace: string) {
    if (workspace === 'dashboard') onNavigate('/')
    if (workspace === 'daily') onNavigate('/boards/daily')
    if (workspace === 'week') onNavigate('/week')
    if (workspace === 'parkpal') onNavigate('/parkpal')
    if (workspace === 'connections') onNavigate('/connections')
    if (workspace === 'skills') onNavigate('/skills')
    if (workspace === 'research') onNavigate('/research')
    if (workspace === 'media') onNavigate('/media')
    if (workspace === 'service-explainer') onNavigate('/service-explainer')
    if (workspace === 'ha') onNavigate('/ha')
    if (workspace === 'tv') onNavigate('/tv')
    if (workspace === 'bg-remover') onNavigate('/bg-remover')
  }

  function handleConnectMicrosoft() {
    window.open('http://localhost:8787/operatorhub-app/api/auth/microsoft/start', '_blank')
  }

  async function handleDisconnectMicrosoft() {
    setBusy(true)
    try {
      await logoutMicrosoft()
      await refresh()
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : 'Failed to disconnect Microsoft')
    } finally {
      setBusy(false)
    }
  }

  async function handleTestMicrosoft() {
    setBusy(true)
    try {
      const nextProfile = await loadMicrosoftProfile()
      setProfile(nextProfile)
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'Microsoft connection test failed')
    } finally {
      setBusy(false)
    }
  }

  async function handlePreviewCalendarImport() {
    setSyncBusy(true)
    setSyncMessage(null)
    setError(null)
    try {
      const { startDateTime, endDateTime } = plannerSyncWindow(Number(rangeDays || 14))
      const preview = await listMicrosoftCalendarEvents({
        startDateTime,
        endDateTime
      })
      setPreviewEvents(preview.events)
      setSyncMessage(`Fetched ${preview.events.length} calendar events for preview.`)
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Calendar preview failed')
    } finally {
      setSyncBusy(false)
    }
  }

  async function handleImportCalendarToPlanner() {
    setSyncBusy(true)
    setSyncMessage(null)
    setError(null)
    try {
      const { startDateTime, endDateTime } = plannerSyncWindow(Number(rangeDays || 14))
      const result = await importMicrosoftCalendarToPlanner({
        boardId: targetBoardId,
        startDateTime,
        endDateTime
      })
      setSyncMessage(`Imported ${result.imported.length} and updated ${result.updated.length} calendar items.`)
      await refresh()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Calendar import failed')
    } finally {
      setSyncBusy(false)
    }
  }

  function handleAutoImportChange(enabled: boolean) {
    setAutoImportEnabled(enabled)
    writeAutoImportPreference(enabled)
  }

  const microsoftCapabilities = (tools?.tools ?? []).filter((tool) => tool.name.includes('calendar') || tool.name.includes('excel'))
  const plannerCapabilities = (tools?.tools ?? []).filter((tool) => tool.name.includes('planner'))
  const todayKey = localDayKey(new Date())
  const sortedPreviewEvents = [...previewEvents].sort((left, right) => {
    const leftTime = left.start ?? '9999-99-99T99:99:99'
    const rightTime = right.start ?? '9999-99-99T99:99:99'
    if (leftTime !== rightTime) return leftTime.localeCompare(rightTime)
    return String(left.subject ?? '').localeCompare(String(right.subject ?? ''))
  })

  return (
    <div className="planner-app-shell">
      <PlannerSidebar current="connections" onNavigate={onNavigate} />

      <main className="planner-workspace">
        <PlannerTopbar
          title="Connections and capabilities"
          subtitle="Keep OAuth, API and MCP status visible so the hub does not become a black box."
          workspace="connections"
          signal={signal}
          utilityActionLabel="Refresh"
          utilityActionBusyLabel="Refreshing..."
          utilityActionPending={busy}
          onWorkspaceChange={handleWorkspaceChange}
          onSignalChange={setSignal}
          onUtilityAction={() => void refresh()}
        />

        {error ? <div className="planner-inline-notice">{error}</div> : null}
        {syncMessage ? <div className="planner-inline-notice">{syncMessage}</div> : null}

        <section className="planner-connections-grid">
          <section className="planner-connection-card">
            <div className="planner-connection-head">
              <div>
                <span className="planner-widget-eyebrow">OAuth Provider</span>
                <h2>Microsoft 365</h2>
              </div>
              <span
                className={`planner-connection-status ${
                  microsoftStatus?.usable ? 'planner-connection-status-ok' : 'planner-connection-status-idle'
                }`}
              >
                {microsoftStatus?.usable ? 'Connected' : microsoftStatus?.tokenAvailable ? 'Token only' : 'Not connected'}
              </span>
            </div>

            <div className="planner-connection-meta">
              <span>Configured: {microsoftStatus?.configured ? 'Yes' : 'No'}</span>
              <span>Usable: {microsoftStatus?.usable ? 'Yes' : 'No'}</span>
              <span>Refresh token: {microsoftStatus?.hasRefreshToken ? 'Yes' : 'No'}</span>
              <span>Expires: {microsoftStatus?.expiresAt ? new Date(microsoftStatus.expiresAt).toLocaleString('sv-SE') : 'Unknown'}</span>
            </div>

            <div className="planner-connection-copy">
              <p>Use Microsoft as the first auth-backed provider for calendar, Excel and future Outlook-connected planner flows.</p>
              {!microsoftStatus?.configured ? <p>Hubben saknar `OPERATOR_HUB_MS_CLIENT_ID` i aktuell process. Sourced env + restart krävs.</p> : null}
              {microsoftStatus?.tokenAvailable && !microsoftStatus?.usable ? <p>Det finns en lagrad token, men den är inte användbar förrän hubben är korrekt konfigurerad.</p> : null}
              {microsoftStatus?.scope ? <p>Granted scopes: {microsoftStatus.scope}</p> : null}
              {profile?.displayName || profile?.userPrincipalName ? (
                <p>
                  Test profile: <strong>{profile.displayName ?? profile.userPrincipalName}</strong>
                </p>
              ) : null}
            </div>

            <div className="planner-connection-actions">
              <button type="button" onClick={handleConnectMicrosoft}>
                {microsoftStatus?.usable ? 'Reconnect' : 'Connect'}
              </button>
              <button type="button" onClick={() => void handleTestMicrosoft()} disabled={!microsoftStatus?.usable || busy}>
                Test
              </button>
              <button type="button" onClick={() => void handleDisconnectMicrosoft()} disabled={!microsoftStatus?.tokenAvailable || busy}>
                Disconnect
              </button>
            </div>
          </section>

          <section className="planner-connection-card">
            <div className="planner-connection-head">
              <div>
                <span className="planner-widget-eyebrow">Hub status</span>
                <h2>Operator hub</h2>
              </div>
              <span className={`planner-connection-status ${health?.ok ? 'planner-connection-status-ok' : 'planner-connection-status-idle'}`}>
                {health?.ok ? 'Healthy' : 'Unknown'}
              </span>
            </div>

            <div className="planner-connection-meta">
              <span>Service: {health?.service ?? 'Unavailable'}</span>
              <span>Version: {tools?.version ?? 'Unknown'}</span>
              <span>Projects: {tools?.supportedProjects?.length ?? 0}</span>
            </div>

            <div className="planner-connection-copy">
              <p>The hub is the capability layer behind planner actions, Microsoft integrations and future MCP-backed providers.</p>
            </div>
          </section>
        </section>

        <section className="planner-capability-grid">
          <section className="planner-capability-card">
            <div className="planner-connection-head">
              <div>
                <span className="planner-widget-eyebrow">Planner sync</span>
                <h2>Calendar to planner</h2>
              </div>
              <span className="planner-kpi">{previewEvents.length}</span>
            </div>

            <div className="planner-sync-controls">
              <label className="planner-topbar-control">
                <span>Target board</span>
                <select value={targetBoardId} onChange={(event) => setTargetBoardId(event.target.value)}>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="planner-topbar-control">
                <span>Import range</span>
                <select value={rangeDays} onChange={(event) => setRangeDays(event.target.value)}>
                  <option value="7">Next 7 days</option>
                  <option value="14">Next 14 days</option>
                  <option value="30">Next 30 days</option>
                </select>
              </label>
            </div>

            <div className="planner-connection-actions">
              <button type="button" onClick={() => void handlePreviewCalendarImport()} disabled={!microsoftStatus?.usable || syncBusy}>
                Preview events
              </button>
              <button type="button" onClick={() => void handleImportCalendarToPlanner()} disabled={!microsoftStatus?.usable || syncBusy}>
                Import to planner
              </button>
            </div>

            <div className="planner-connection-copy">
              <p>Import upcoming M365 calendar items into a selected board. Events happening today will land in `Today`; future events go to `Inbox`.</p>
            </div>

            <label className="planner-toggle-row">
              <input type="checkbox" checked={autoImportEnabled} onChange={(event) => handleAutoImportChange(event.target.checked)} />
              <span>Auto-import M365 events into the Daily board when the planner opens.</span>
            </label>
          </section>

          <section className="planner-capability-card">
            <div className="planner-connection-head">
              <div>
                <span className="planner-widget-eyebrow">Preview</span>
                <h2>Upcoming calendar events</h2>
              </div>
              <span className="planner-kpi">{previewEvents.length}</span>
            </div>

            <div className="planner-capability-list">
              {previewEvents.length === 0 ? <p className="planner-empty">Run `Preview events` to inspect upcoming M365 calendar items before import.</p> : null}
              {sortedPreviewEvents.map((event) => (
                <article
                  key={event.id}
                  className={
                    event.start?.slice(0, 10) === todayKey
                      ? 'planner-capability-item planner-capability-item-today'
                      : 'planner-capability-item'
                  }
                >
                  <strong>{event.subject ?? 'Untitled event'}</strong>
                  <p>
                    {event.start ? new Date(event.start).toLocaleString('sv-SE') : 'No start time'}
                    {event.end ? ` -> ${new Date(event.end).toLocaleString('sv-SE')}` : ''}
                  </p>
                  <p className="planner-capability-debug">
                    {event.start?.slice(0, 10) === todayKey ? 'Today' : event.start?.slice(0, 10) ?? 'No date'}
                    {event.seriesMasterId ? ' · recurring series' : ''}
                  </p>
                </article>
              ))}
            </div>

            {previewEvents.length > 0 ? (
              <>
                <div className="planner-connection-actions">
                  <button type="button" onClick={() => setShowRawPreview((current) => !current)}>
                    {showRawPreview ? 'Hide raw preview' : 'Show raw preview'}
                  </button>
                </div>
                {showRawPreview ? (
                  <pre className="planner-raw-preview">{JSON.stringify(sortedPreviewEvents, null, 2)}</pre>
                ) : null}
              </>
            ) : null}
          </section>
        </section>

        <section className="planner-capability-grid">
          <section className="planner-capability-card">
            <div className="planner-connection-head">
              <div>
                <span className="planner-widget-eyebrow">Capabilities</span>
                <h2>Microsoft-facing tools</h2>
              </div>
              <span className="planner-kpi">{microsoftCapabilities.length}</span>
            </div>

            <div className="planner-capability-list">
              {microsoftCapabilities.map((tool) => (
                <article key={tool.name} className="planner-capability-item">
                  <strong>{tool.name}</strong>
                  <p>{tool.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="planner-capability-card">
            <div className="planner-connection-head">
              <div>
                <span className="planner-widget-eyebrow">Capabilities</span>
                <h2>Planner-facing tools</h2>
              </div>
              <span className="planner-kpi">{plannerCapabilities.length}</span>
            </div>

            <div className="planner-capability-list">
              {plannerCapabilities.map((tool) => (
                <article key={tool.name} className="planner-capability-item">
                  <strong>{tool.name}</strong>
                  <p>{tool.description}</p>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  )
}
