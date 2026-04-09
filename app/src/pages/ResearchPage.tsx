import { useEffect, useMemo, useState } from 'react'
import PlannerSidebar from '../components/shell/PlannerSidebar'
import PlannerTopbar from '../components/shell/PlannerTopbar'
import { captureSearchDemandInsights, loadHubTools } from '../data/plannerClient'
import type { HubToolDefinition, HubToolsPayload, SearchDemandInsightsResult } from '../types/planner'

type ResearchSignal = 'all' | 'follow_up' | 'avoidance' | 'high_priority'

interface ResearchPageProps {
  onNavigate: (path: string) => void
  theme: 'light' | 'dark' | string
  onSetTheme: (theme: 'light' | 'dark') => void
}

function usageExample(definition: HubToolDefinition | null) {
  const required = definition?.inputSchema.required ?? []
  const properties = definition?.inputSchema.properties ?? {}
  const body = required.reduce<Record<string, unknown>>((acc, key) => {
    if (key === 'project_slug') acc[key] = 'new-business-research'
    else if (key === 'seed_queries') acc[key] = ['ai automation consultant', 'business automation services']
    else acc[key] = `<${key}>`
    return acc
  }, {})

  return `{\n  "tool": "capture_search_demand_insights",\n  "arguments": ${JSON.stringify(body, null, 2).replace(/\n/g, '\n  ')}\n}\n\n// optional fields\n${Object.keys(properties)
    .filter((key) => !required.includes(key))
    .map((key) => `// ${key}`)
    .join('\n')}`
}

function schemaFields(definition: HubToolDefinition | null) {
  return Object.entries(definition?.inputSchema.properties ?? {})
}

export default function ResearchPage({ onNavigate }: ResearchPageProps) {
  const [signal, setSignal] = useState<ResearchSignal>('all')
  const [toolsPayload, setToolsPayload] = useState<HubToolsPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectSlug, setProjectSlug] = useState('new-business-research')
  const [seedQueriesText, setSeedQueriesText] = useState('ai automation consultant\nbusiness automation services')
  const [market, setMarket] = useState('SE')
  const [language, setLanguage] = useState('en')
  const [sessionHint, setSessionHint] = useState('google-ads-main')
  const [notes, setNotes] = useState('Homepage messaging and SEO research')
  const [useKeywordPlanner, setUseKeywordPlanner] = useState(true)
  const [useGoogleTrends, setUseGoogleTrends] = useState(true)
  const [runPending, setRunPending] = useState(false)
  const [result, setResult] = useState<SearchDemandInsightsResult | null>(null)

  useEffect(() => {
    async function load() {
      setBusy(true)
      try {
        setError(null)
        setToolsPayload(await loadHubTools())
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load research tools')
      } finally {
        setBusy(false)
      }
    }

    void load()
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

  const demandTool = useMemo(
    () => toolsPayload?.tools.find((tool) => tool.name === 'capture_search_demand_insights') ?? null,
    [toolsPayload]
  )

  async function runResearch() {
    const seed_queries = seedQueriesText
      .split(/\r?\n|,/)
      .map((value) => value.trim())
      .filter(Boolean)

    if (seed_queries.length === 0) {
      setError('Add at least one seed query')
      return
    }

    const sources: Array<'google_keyword_planner' | 'google_trends'> = []
    if (useKeywordPlanner) sources.push('google_keyword_planner')
    if (useGoogleTrends) sources.push('google_trends')

    if (sources.length === 0) {
      setError('Select at least one source')
      return
    }

    setRunPending(true)
    setError(null)

    try {
      const response = await captureSearchDemandInsights({
        project_slug: projectSlug.trim(),
        seed_queries,
        market: market.trim() || undefined,
        language: language.trim() || undefined,
        session_hint: sessionHint.trim() || undefined,
        notes: notes.trim() || undefined,
        sources
      })
      setResult(response.result)
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Research run failed')
    } finally {
      setRunPending(false)
    }
  }

  return (
    <div className="planner-app-shell">
      <PlannerSidebar current="research" onNavigate={onNavigate} />

      <main className="planner-workspace">
        <PlannerTopbar
          title="Research capabilities"
          subtitle="Browser-assisted search-demand research for Trends and Keyword Planner, exposed as a reusable operator-hub tool with stable artifacts and structured output."
          workspace="research"
          signal={signal}
          utilityActionLabel="Refresh"
          utilityActionBusyLabel="Refreshing..."
          utilityActionPending={busy}
          onWorkspaceChange={handleWorkspaceChange}
          onSignalChange={setSignal}
          onUtilityAction={() => window.location.reload()}
        />

        {error ? <div className="planner-inline-notice">{error}</div> : null}

        <section className="planner-research-spotlight">
          <div>
            <span className="planner-widget-eyebrow">Browser-assisted research</span>
            <h2>capture_search_demand_insights</h2>
            <p>
              Reuses an authenticated browser session, navigates Google Trends and Google Ads Keyword Planner, saves
              screenshots and raw captures, and returns normalized demand insights for positioning, SEO, messaging, and
              offer design.
            </p>
          </div>
          <div className="planner-research-copy">
            <strong>What it can do</strong>
            <ul>
              <li>Reuse an authenticated session via `session_hint`.</li>
              <li>Search around your `seed_queries` across selected research sources.</li>
              <li>Save screenshots, raw HTML captures, normalized JSON, and markdown summaries under `.local/`.</li>
              <li>Return partial success if one source fails while another succeeds.</li>
            </ul>
          </div>
        </section>

        <section className="planner-research-layout">
          <article className="planner-research-panel">
            <div className="planner-skills-section-head">
              <strong>Run it here</strong>
              <span>Uses the same tool/API</span>
            </div>

            <div className="planner-research-form">
              <label className="planner-topbar-control">
                <span>Project slug</span>
                <input value={projectSlug} onChange={(event) => setProjectSlug(event.target.value)} />
              </label>

              <label className="planner-topbar-control">
                <span>Session hint</span>
                <input value={sessionHint} onChange={(event) => setSessionHint(event.target.value)} />
              </label>

              <label className="planner-topbar-control">
                <span>Market</span>
                <input value={market} onChange={(event) => setMarket(event.target.value)} />
              </label>

              <label className="planner-topbar-control">
                <span>Language</span>
                <input value={language} onChange={(event) => setLanguage(event.target.value)} />
              </label>

              <label className="planner-topbar-control planner-research-form-wide">
                <span>Seed queries</span>
                <textarea rows={6} value={seedQueriesText} onChange={(event) => setSeedQueriesText(event.target.value)} />
              </label>

              <label className="planner-topbar-control planner-research-form-wide">
                <span>Notes</span>
                <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>

              <div className="planner-research-source-picks planner-research-form-wide">
                <label>
                  <input type="checkbox" checked={useKeywordPlanner} onChange={(event) => setUseKeywordPlanner(event.target.checked)} />
                  <span>Google Keyword Planner</span>
                </label>
                <label>
                  <input type="checkbox" checked={useGoogleTrends} onChange={(event) => setUseGoogleTrends(event.target.checked)} />
                  <span>Google Trends</span>
                </label>
              </div>

              <div className="planner-research-actions planner-research-form-wide">
                <button type="button" onClick={() => void runResearch()} disabled={runPending}>
                  {runPending ? 'Running research...' : 'Run research'}
                </button>
              </div>
            </div>
          </article>

          <article className="planner-research-panel">
            <div className="planner-skills-section-head">
              <strong>How to call it</strong>
              <span>{demandTool?.inputSchema.required?.length ?? 0} required</span>
            </div>
            <pre className="planner-skills-code">{usageExample(demandTool)}</pre>
          </article>

          <article className="planner-research-panel">
            <div className="planner-skills-section-head">
              <strong>Input contract</strong>
              <span>{schemaFields(demandTool).length} fields</span>
            </div>
            <div className="planner-research-code-list">
              {schemaFields(demandTool).map(([name]) => (
                <div key={name}>
                  <strong>{name}</strong>
                  <span>{(demandTool?.inputSchema.required ?? []).includes(name) ? 'required' : 'optional'}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        {result ? (
          <section className="planner-research-results">
            <article className="planner-research-panel">
              <div className="planner-skills-section-head">
                <strong>Latest result</strong>
                <span>{result.ok ? 'ok' : 'partial'}</span>
              </div>
              <div className="planner-skill-tags">
                <span>{result.project_slug}</span>
                <span>{result.run_id}</span>
                <span>{result.generated_at}</span>
              </div>
              <div className="planner-research-bullets">
                {result.summary.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </article>

            <div className="planner-breakout-grid">
              <article className="planner-widget-frame">
                <div className="planner-skills-section-head">
                  <strong>Source coverage</strong>
                  <span>{result.source_coverage.length}</span>
                </div>
                <div className="planner-research-code-list">
                  {result.source_coverage.map((entry) => (
                    <div key={entry.source}>
                      <strong>{entry.source}</strong>
                      <span>{entry.ok ? 'ok' : 'partial'}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="planner-widget-frame">
                <div className="planner-skills-section-head">
                  <strong>Demand signals</strong>
                  <span>{result.demand_signals.length}</span>
                </div>
                <div className="planner-research-bullets">
                  {result.demand_signals.length > 0 ? (
                    result.demand_signals.slice(0, 8).map((entry, index) => (
                      <p key={`${entry.source}-${entry.signal}-${index}`}>
                        <strong>{entry.signal}</strong> · {entry.source}
                      </p>
                    ))
                  ) : (
                    <p>No explicit demand signals yet.</p>
                  )}
                </div>
              </article>

              <article className="planner-widget-frame">
                <div className="planner-skills-section-head">
                  <strong>Service angles</strong>
                  <span>{result.service_angles.length}</span>
                </div>
                <div className="planner-research-bullets">
                  {result.service_angles.map((entry) => (
                    <p key={entry.angle}>
                      <strong>{entry.angle}</strong>
                    </p>
                  ))}
                </div>
              </article>
            </div>

            <section className="planner-research-layout">
              <article className="planner-research-panel">
                <div className="planner-skills-section-head">
                  <strong>Keywords</strong>
                  <span>{result.keywords.length}</span>
                </div>
                <div className="planner-research-table">
                  {result.keywords.length > 0 ? (
                    result.keywords.slice(0, 20).map((keyword) => (
                      <div key={`${keyword.source}:${keyword.query}`} className="planner-research-table-row">
                        <strong>{keyword.query}</strong>
                        <span>{keyword.source}</span>
                        <span>{keyword.demand_bucket}</span>
                        <span>{keyword.competition ?? 'n/a'}</span>
                      </div>
                    ))
                  ) : (
                    <p>No normalized keyword rows yet.</p>
                  )}
                </div>
              </article>

              <article className="planner-research-panel">
                <div className="planner-skills-section-head">
                  <strong>Artifacts</strong>
                  <span>{result.artifacts.length}</span>
                </div>
                <div className="planner-research-bullets">
                  {result.artifacts.map((artifact, index) => (
                    <p key={`${artifact.type}-${artifact.local_path}-${index}`}>
                      <strong>{artifact.type}</strong> · {artifact.local_path}
                    </p>
                  ))}
                </div>
              </article>
            </section>
          </section>
        ) : null}

        <section className="planner-breakout-grid">
          <article className="planner-widget-frame">
            <div className="planner-skills-section-head">
              <strong>Structured output</strong>
              <span>Deterministic schema</span>
            </div>
            <div className="planner-skill-tags">
              {['summary', 'themes', 'keywords', 'demand_signals', 'service_angles', 'source_coverage', 'artifacts'].map((field) => (
                <span key={field}>{field}</span>
              ))}
            </div>
            <p>
              Direct extraction is kept separate from inference. The raw captures are saved alongside normalized output,
              so another system can trust the structure and a human can inspect the evidence.
            </p>
          </article>

          <article className="planner-widget-frame">
            <div className="planner-skills-section-head">
              <strong>Artifact storage</strong>
              <span>Local-first</span>
            </div>
            <pre className="planner-skills-code">{`.local/research/search-demand/<project_slug>/<run_id>/\n- normalized-result.json\n- raw-captures.json\n- summary.md\n- screenshots/*.png`}</pre>
          </article>

          <article className="planner-widget-frame">
            <div className="planner-skills-section-head">
              <strong>Current sources</strong>
              <span>Extensible</span>
            </div>
            <div className="planner-skill-tags">
              <span>google_keyword_planner</span>
              <span>google_trends</span>
            </div>
            <p>
              The tool is built so more browser research sources can be added later without changing the normalized
              output contract.
            </p>
          </article>
        </section>
      </main>
    </div>
  )
}
