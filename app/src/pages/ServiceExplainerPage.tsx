import { useEffect, useMemo, useState } from 'react'
import PlannerSidebar from '../components/shell/PlannerSidebar'
import PlannerTopbar from '../components/shell/PlannerTopbar'
import {
  loadServiceExplainerRenders,
  renderServiceExplainerMotion
} from '../data/plannerClient'
import { withAppBase } from '../data/runtimePaths'
import type { ServiceExplainerMotionResult, ServiceExplainerRendersPayload } from '../types/planner'

type ServiceExplainerSignal = 'all' | 'follow_up' | 'avoidance' | 'high_priority'

interface ServiceExplainerPageProps {
  onNavigate: (path: string) => void
  theme: 'light' | 'dark' | string
  onSetTheme: (theme: 'light' | 'dark') => void
}

const DEFAULT_PROJECT = 'seb-castwall-site'

export default function ServiceExplainerPage({ onNavigate }: ServiceExplainerPageProps) {
  const [signal, setSignal] = useState<ServiceExplainerSignal>('all')
  const [projectSlug, setProjectSlug] = useState(DEFAULT_PROJECT)
  const [title, setTitle] = useState('AI och automatisering')
  const [serviceType, setServiceType] = useState<'automation' | 'integration' | 'internal_tools' | 'generic'>('automation')
  const [tone, setTone] = useState<'clean_premium' | 'operator_tech' | 'bold_editorial' | 'calm_trust'>('clean_premium')
  const [pace, setPace] = useState<'slow' | 'medium' | 'fast'>('medium')
  const [aspectRatio, setAspectRatio] = useState<'landscape' | 'square' | 'portrait'>('landscape')
  const [durationInSeconds, setDurationInSeconds] = useState(8)
  const [problem, setProblem] = useState('För många manuella steg och otydlig uppföljning')
  const [decision, setDecision] = useState('Vi väljer automation som första steg')
  const [outcome, setOutcome] = useState('Mindre manuellt arbete och tydligare status')
  const [busy, setBusy] = useState(false)
  const [loadingRenders, setLoadingRenders] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [result, setResult] = useState<ServiceExplainerMotionResult | null>(null)
  const [renders, setRenders] = useState<ServiceExplainerRendersPayload | null>(null)

  async function refreshRenders(nextProjectSlug = projectSlug) {
    setLoadingRenders(true)
    try {
      setRenders(await loadServiceExplainerRenders(nextProjectSlug))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load renders')
    } finally {
      setLoadingRenders(false)
    }
  }

  useEffect(() => {
    void refreshRenders()
  }, [projectSlug])

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

  async function handleRender() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await renderServiceExplainerMotion({
        projectSlug: projectSlug.trim(),
        title: title.trim(),
        mode: 'three_step_process',
        serviceType,
        tone,
        pace,
        aspectRatio,
        durationInSeconds,
        fps: 24,
        brief: {
          problem: problem.trim(),
          decision: decision.trim(),
          outcome: outcome.trim()
        }
      })

      setResult(response.result)
      setNotice(response.result.renderExecution.ok ? 'Rendered new explainer video.' : 'Created render job plan.')
      await refreshRenders(projectSlug.trim())
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : 'Render failed')
    } finally {
      setBusy(false)
    }
  }

  const latestVideo = useMemo(() => renders?.videos[0] ?? null, [renders])

  return (
    <div className="planner-app-shell">
      <PlannerSidebar current="service-explainer" onNavigate={onNavigate} />

      <main className="planner-workspace">
        <PlannerTopbar
          title="Service explainer motion"
          subtitle="A dedicated render surface for process storytelling and `/tjanster` videos, separate from hero-motion and separate from raw media management."
          workspace="service-explainer"
          signal={signal}
          utilityActionLabel="Refresh renders"
          utilityActionBusyLabel="Refreshing..."
          utilityActionPending={loadingRenders}
          onWorkspaceChange={handleWorkspaceChange}
          onSignalChange={setSignal}
          onUtilityAction={() => void refreshRenders()}
        />

        {error ? <div className="planner-inline-notice">{error}</div> : null}
        {notice ? <div className="planner-inline-notice">{notice}</div> : null}

        <section className="planner-research-spotlight">
          <div>
            <span className="planner-widget-eyebrow">New render capability</span>
            <h2>render_service_explainer_motion</h2>
            <p>
              Builds service and process explainer videos with a bounded three-step structure: problem, decision, and
              outcome. Assets come from local owner media or already collected stock media.
            </p>
          </div>
          <div className="planner-research-copy">
            <strong>Best for</strong>
            <ul>
              <li>Service pages like `/tjanster`.</li>
              <li>Explaining how a delivery path works in three clear beats.</li>
              <li>Keeping hero loops and explainer videos as separate capabilities.</li>
            </ul>
          </div>
        </section>

        <section className="planner-research-layout">
          <article className="planner-research-panel">
            <div className="planner-skills-section-head">
              <strong>Run it here</strong>
              <span>three_step_process v1</span>
            </div>

            <div className="planner-research-form">
              <label className="planner-topbar-control">
                <span>Project slug</span>
                <input value={projectSlug} onChange={(event) => setProjectSlug(event.target.value)} />
              </label>

              <label className="planner-topbar-control">
                <span>Title</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>

              <label className="planner-topbar-control">
                <span>Service type</span>
                <select value={serviceType} onChange={(event) => setServiceType(event.target.value as typeof serviceType)}>
                  <option value="automation">automation</option>
                  <option value="integration">integration</option>
                  <option value="internal_tools">internal_tools</option>
                  <option value="generic">generic</option>
                </select>
              </label>

              <label className="planner-topbar-control">
                <span>Tone</span>
                <select value={tone} onChange={(event) => setTone(event.target.value as typeof tone)}>
                  <option value="clean_premium">clean_premium</option>
                  <option value="operator_tech">operator_tech</option>
                  <option value="bold_editorial">bold_editorial</option>
                  <option value="calm_trust">calm_trust</option>
                </select>
              </label>

              <label className="planner-topbar-control">
                <span>Pace</span>
                <select value={pace} onChange={(event) => setPace(event.target.value as typeof pace)}>
                  <option value="slow">slow</option>
                  <option value="medium">medium</option>
                  <option value="fast">fast</option>
                </select>
              </label>

              <label className="planner-topbar-control">
                <span>Aspect</span>
                <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as typeof aspectRatio)}>
                  <option value="landscape">landscape</option>
                  <option value="square">square</option>
                  <option value="portrait">portrait</option>
                </select>
              </label>

              <label className="planner-topbar-control">
                <span>Duration</span>
                <input
                  type="number"
                  min={6}
                  max={20}
                  value={durationInSeconds}
                  onChange={(event) => setDurationInSeconds(Number(event.target.value || 8))}
                />
              </label>

              <label className="planner-topbar-control planner-research-form-wide">
                <span>Problem</span>
                <textarea rows={3} value={problem} onChange={(event) => setProblem(event.target.value)} />
              </label>

              <label className="planner-topbar-control planner-research-form-wide">
                <span>Decision</span>
                <textarea rows={3} value={decision} onChange={(event) => setDecision(event.target.value)} />
              </label>

              <label className="planner-topbar-control planner-research-form-wide">
                <span>Outcome</span>
                <textarea rows={3} value={outcome} onChange={(event) => setOutcome(event.target.value)} />
              </label>

              <div className="planner-research-actions planner-research-form-wide">
                <button type="button" onClick={() => void handleRender()} disabled={busy}>
                  {busy ? 'Rendering...' : 'Render explainer'}
                </button>
              </div>
            </div>
          </article>

          <article className="planner-research-panel">
            <div className="planner-skills-section-head">
              <strong>What it returns</strong>
              <span>Job + MP4</span>
            </div>
            <pre className="planner-skills-code">{`{
  "tool": "render_service_explainer_motion",
  "arguments": {
    "projectSlug": "${projectSlug}",
    "title": "${title}",
    "mode": "three_step_process",
    "serviceType": "${serviceType}",
    "tone": "${tone}",
    "pace": "${pace}",
    "aspectRatio": "${aspectRatio}",
    "durationInSeconds": ${durationInSeconds},
    "brief": {
      "problem": "${problem}",
      "decision": "${decision}",
      "outcome": "${outcome}"
    }
  }
}`}</pre>
          </article>

          <article className="planner-research-panel">
            <div className="planner-skills-section-head">
              <strong>Latest run</strong>
              <span>{result?.renderExecution.ok ? 'rendered' : result ? 'planned' : 'none yet'}</span>
            </div>
            {result ? (
              <div className="planner-research-code-list">
                <div><strong>jobId</strong><span>{result.renderJob.jobId}</span></div>
                <div><strong>mode</strong><span>{result.composition.mode}</span></div>
                <div><strong>serviceType</strong><span>{result.composition.serviceType}</span></div>
                <div><strong>output</strong><span>{result.renderExecution.outputPath ?? 'no mp4 yet'}</span></div>
              </div>
            ) : (
              <div className="planner-media-empty">No render result yet.</div>
            )}
          </article>
        </section>

        <section className="planner-research-results">
          <article className="planner-research-panel">
            <div className="planner-skills-section-head">
              <strong>Rendered videos</strong>
              <span>{renders?.videos.length ?? 0}</span>
            </div>

            {latestVideo ? (
              <div className="planner-media-render-card">
                <video controls preload="metadata" className="planner-media-video" src={withAppBase(latestVideo.streamUrl)} />
              </div>
            ) : null}

            <div className="planner-media-asset-list">
              {(renders?.videos ?? []).map((video) => (
                <div key={video.fileName} className="planner-media-render-card">
                  <video controls preload="metadata" className="planner-media-video" src={withAppBase(video.streamUrl)} />
                  <div className="planner-media-asset-row">
                    <div>
                      <strong>{video.fileName}</strong>
                      <span>{video.path}</span>
                    </div>
                    <span>{Math.max(1, Math.round(video.sizeBytes / 1024 / 1024))} MB</span>
                  </div>
                </div>
              ))}
              {(renders?.videos.length ?? 0) === 0 ? <div className="planner-media-empty">No explainer renders yet.</div> : null}
            </div>
          </article>
        </section>
      </main>
    </div>
  )
}
