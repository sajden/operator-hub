import PlannerSidebar from '../components/shell/PlannerSidebar'
import PlannerTopbar from '../components/shell/PlannerTopbar'

type MapSignal = 'all' | 'follow_up' | 'avoidance' | 'high_priority'

interface HomeAssistantMapPageProps {
  onNavigate: (path: string) => void
}

const dashboardEntries = [
  {
    name: 'Operator Hub',
    purpose: 'Embeds the daily board inside Home Assistant.',
    path: 'dashboard-operatorhub',
    target: 'http://192.168.50.215:5173/boards/daily'
  },
  {
    name: 'Castboard',
    purpose: 'TV/presence board from ai-cam.',
    path: 'dashboard-castboard',
    target: 'http://192.168.50.215:8080/castboard'
  },
  {
    name: 'Busschema',
    purpose: 'Departure board in Home Assistant.',
    path: 'dashboard-hemkontroll',
    target: 'http://192.168.50.215:8080/departures'
  },
  {
    name: 'Jarvis',
    purpose: 'Voice/AI status surface in HA.',
    path: 'dashboard-jarvis',
    target: 'ai-cam internal status and HA cards'
  },
  {
    name: 'Skrivbord',
    purpose: 'Desk-focused HA control surface.',
    path: 'dashboard-desk',
    target: 'Home Assistant native dashboard'
  }
] as const

const connectionEdges = [
  'Home Assistant -> ai-cam: REST commands for camera events, wake events, speaker announce, Spotify, bus cast/start-stop.',
  'Home Assistant -> operator-hub: iframe dashboard for the Daily board over LAN.',
  'Home Assistant app -> Castboard/Busschema: mobile/webview access over LAN, not localhost.',
  'operator-hub -> Docker workers: screenshot capture and Remotion rendering on demand.',
  'ai-cam -> Home Assistant: custom conversation/TTS integrations and internal service flow.'
] as const

const runtimeNodes = [
  {
    name: 'Home Assistant',
    location: 'ai-cam/data/homeassistant',
    role: 'User-facing control plane for dashboards, automations, mobile access.'
  },
  {
    name: 'ai-cam / AIHub',
    location: 'ai-cam/ai-hub',
    role: 'Execution/API layer for castboard, bus casting, audio, camera events.'
  },
  {
    name: 'operator-hub',
    location: 'operator-hub/hub + app',
    role: 'Shared capability layer for planner, media, integrations, rendering jobs.'
  },
  {
    name: 'Media + Render Workers',
    location: 'operator-hub/workers/*',
    role: 'On-demand Dockerized runtimes for screenshots and Remotion.'
  }
] as const

export default function HomeAssistantMapPage({ onNavigate }: HomeAssistantMapPageProps) {
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

  return (
    <div className="planner-app-shell">
      <PlannerSidebar current="ha" onNavigate={onNavigate} />

      <main className="planner-workspace">
        <PlannerTopbar
          title="Home Assistant map"
          subtitle="Current topology for HA, ai-cam, operator-hub, dashboards, and runtime workers."
          workspace="ha"
          signal="all"
          onWorkspaceChange={handleWorkspaceChange}
          onSignalChange={(_signal: MapSignal) => undefined}
        />

        <section className="planner-architecture-grid">
          <section className="planner-architecture-panel">
            <div className="planner-skills-section-head">
              <strong>Runtime nodes</strong>
              <span>{runtimeNodes.length}</span>
            </div>
            <div className="planner-architecture-list">
              {runtimeNodes.map((node) => (
                <article key={node.name} className="planner-architecture-card">
                  <div className="planner-skill-head">
                    <strong>{node.name}</strong>
                    <span>{node.location}</span>
                  </div>
                  <p>{node.role}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="planner-architecture-panel">
            <div className="planner-skills-section-head">
              <strong>HA dashboards</strong>
              <span>{dashboardEntries.length}</span>
            </div>
            <div className="planner-architecture-list">
              {dashboardEntries.map((entry) => (
                <article key={entry.name} className="planner-architecture-card">
                  <div className="planner-skill-head">
                    <strong>{entry.name}</strong>
                    <span>{entry.path}</span>
                  </div>
                  <p>{entry.purpose}</p>
                  <code className="planner-architecture-code">{entry.target}</code>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="planner-architecture-panel">
          <div className="planner-skills-section-head">
            <strong>Connection map</strong>
            <span>{connectionEdges.length}</span>
          </div>
          <div className="planner-architecture-flow">
            {connectionEdges.map((edge) => (
              <article key={edge} className="planner-architecture-flow-row">
                <span className="planner-architecture-flow-dot" />
                <p>{edge}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="planner-architecture-grid">
          <section className="planner-architecture-panel">
            <div className="planner-skills-section-head">
              <strong>Current mobile-safe URLs</strong>
              <span>LAN</span>
            </div>
            <div className="planner-architecture-list">
              <article className="planner-architecture-card">
                <div className="planner-skill-head">
                  <strong>Operator Hub panel</strong>
                  <span>HA iframe</span>
                </div>
                <code className="planner-architecture-code">http://192.168.50.215:5173/boards/daily</code>
              </article>
              <article className="planner-architecture-card">
                <div className="planner-skill-head">
                  <strong>Castboard panel</strong>
                  <span>HA iframe</span>
                </div>
                <code className="planner-architecture-code">http://192.168.50.215:8080/castboard</code>
              </article>
              <article className="planner-architecture-card">
                <div className="planner-skill-head">
                  <strong>Busschema panel</strong>
                  <span>HA webpage</span>
                </div>
                <code className="planner-architecture-code">http://192.168.50.215:8080/departures</code>
              </article>
            </div>
          </section>

          <section className="planner-architecture-panel">
            <div className="planner-skills-section-head">
              <strong>Rules that matter</strong>
              <span>4</span>
            </div>
            <div className="planner-architecture-list">
              <article className="planner-architecture-card">
                <p>Do not use <code>localhost</code> in HA mobile dashboards. Use LAN host or stable internal DNS.</p>
              </article>
              <article className="planner-architecture-card">
                <p>Use Home Assistant for dashboard exposure and device UX. Keep shared capabilities in operator-hub.</p>
              </article>
              <article className="planner-architecture-card">
                <p>Use ai-cam for castboard/audio/device execution flows that are already coupled to HA.</p>
              </article>
              <article className="planner-architecture-card">
                <p>Use Docker workers for heavier runtimes like screenshots and Remotion so agents can run them on demand.</p>
              </article>
            </div>
          </section>
        </section>
      </main>
    </div>
  )
}
