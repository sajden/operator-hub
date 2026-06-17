import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import PlannerSidebar from '../components/shell/PlannerSidebar'
import type { ShortFormJob, ShortFormJobStep, ShortFormJobSummary, ShortFormWatchersStatus } from '../types/shortForm'
import {
  approveShortFormArticle,
  createShortFormJob,
  findMoreShortFormArticles,
  listShortFormJobs,
  loadShortFormJob,
  loadShortFormWatchers,
  prepareShortFormJob,
  renderShortFormJob,
  rerunShortFormArticleCapture,
  screenshotUrlPreview,
  updateShortFormArticle
} from '../data/shortFormClient'

interface ShortFormVideoPageProps {
  onNavigate: (path: string) => void
  theme: string
  onSetTheme: (t: string) => void
}

function fmt(iso: string | null | undefined) {
  if (!iso) return '–'
  return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtTs(value: number | undefined) {
  if (!value) return '–'
  return new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

function badgeTone(status: string) {
  if (status === 'prepared' || status === 'done') return { bg: '#1a7a3c20', color: '#1a7a3c' }
  if (status === 'pending_article_review') return { bg: '#7c3aed20', color: '#7c3aed' }
  if (status === 'prepared_without_article' || status === 'review_required' || status === 'warning') return { bg: '#b07d0020', color: '#b07d00' }
  if (status === 'failed') return { bg: '#a0303020', color: '#a03030' }
  if (status === 'preparing' || status === 'rendering' || status === 'running') return { bg: '#1a4fa820', color: '#1a4fa8' }
  return { bg: 'var(--surface-raised)', color: 'var(--text-muted)' }
}

function StatusBadge({ status }: { status: string }) {
  const tone = badgeTone(status)
  return (
    <span style={{
      background: tone.bg,
      color: tone.color,
      border: `1px solid ${tone.color}30`,
      borderRadius: 999,
      padding: '4px 10px',
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'capitalize'
    }}>
      {status.split('_').join(' ')}
    </span>
  )
}

function StepRow({ step }: { step: ShortFormJobStep }) {
  return (
    <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-raised)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <strong style={{ fontSize: 13 }}>{step.key}</strong>
        <StatusBadge status={step.status} />
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)' }}>{step.message || '–'}</div>
      {step.warning && <div style={{ fontSize: 12, color: '#b07d00', marginTop: 6 }}>{step.warning}</div>}
      {step.error && <div style={{ fontSize: 12, color: '#a03030', marginTop: 6 }}>{step.error}</div>}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        <span>Start: {fmt(step.startedAt)}</span>
        <span>Klar: {fmt(step.finishedAt)}</span>
      </div>
    </div>
  )
}

export default function ShortFormVideoPage({ onNavigate, theme, onSetTheme }: ShortFormVideoPageProps) {
  const [jobs, setJobs] = useState<ShortFormJobSummary[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [job, setJob] = useState<ShortFormJob | null>(null)
  const [watchers, setWatchers] = useState<ShortFormWatchersStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [title, setTitle] = useState('')
  const [sourcePath, setSourcePath] = useState('')
  const [articleUrlDraft, setArticleUrlDraft] = useState('')
  const [reviewCandidates, setReviewCandidates] = useState<Array<{ url: string; title: string }>>([])
  const [customArticleUrl, setCustomArticleUrl] = useState('')
  const [urlPreviewImg, setUrlPreviewImg] = useState<string | null>(null)
  const [busyPreview, setBusyPreview] = useState(false)

  async function refreshJobs(preferredJobId?: string | null) {
    const list = await listShortFormJobs()
    setJobs(list.jobs)
    const nextSelected = preferredJobId ?? selectedJobId ?? list.jobs[0]?.id ?? null
    setSelectedJobId(nextSelected)
    if (nextSelected) {
      const detail = await loadShortFormJob(nextSelected)
      setJob(detail.job)
      setArticleUrlDraft(detail.job.config.manualArticleUrl ?? '')
    } else {
      setJob(null)
      setArticleUrlDraft('')
    }
  }

  async function refreshWatchers() {
    const next = await loadShortFormWatchers()
    setWatchers(next)
  }

  useEffect(() => {
    void Promise.all([refreshJobs(), refreshWatchers()]).finally(() => setLoading(false))
    const timer = setInterval(() => {
      void refreshJobs()
      void refreshWatchers()
    }, 8000)
    return () => clearInterval(timer)
  }, [])

  async function selectJob(jobId: string) {
    setSelectedJobId(jobId)
    const detail = await loadShortFormJob(jobId)
    setJob(detail.job)
    setArticleUrlDraft(detail.job.config.manualArticleUrl ?? '')
    setReviewCandidates(detail.job.articleSelection?.candidates ?? [])
    setCustomArticleUrl('')
  }

  async function handleApproveArticle(articleUrl: string) {
    if (!job) return
    setBusyAction('approve')
    setMessage('')
    try {
      await approveShortFormArticle(job.id, articleUrl)
      setMessage('Artikel godkänd, render startar…')
      await renderShortFormJob(job.id)
      await refreshJobs(job.id)
      setMessage('Render startad!')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kunde inte godkänna artikel')
    } finally {
      setBusyAction(null)
    }
  }

  async function handlePreviewUrl(url: string) {
    if (!url.trim()) return
    setBusyPreview(true)
    setUrlPreviewImg(null)
    setMessage('')
    try {
      const result = await screenshotUrlPreview(url.trim())
      setUrlPreviewImg(`data:${result.mimeType};base64,${result.base64}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Preview misslyckades')
    } finally {
      setBusyPreview(false)
    }
  }

  async function handleFindMoreArticles() {
    if (!job) return
    setBusyAction('findMore')
    setMessage('')
    try {
      const result = await findMoreShortFormArticles(job.id)
      setReviewCandidates(result.candidates)
      setMessage(`Hittade ${result.candidates.length} nya kandidater`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kunde inte hitta artiklar')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleCreateJob(event: FormEvent) {
    event.preventDefault()
    if (!sourcePath.trim()) {
      setMessage('Källmapp krävs')
      return
    }

    setBusyAction('create')
    setMessage('')
    try {
      const created = await createShortFormJob({
        title: title.trim() || undefined,
        sourcePath: sourcePath.trim(),
        manualArticleUrl: articleUrlDraft.trim() || null
      })
      setTitle('')
      setSourcePath('')
      setMessage('Jobb skapat')
      await refreshJobs(created.jobId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kunde inte skapa jobb')
    } finally {
      setBusyAction(null)
    }
  }

  async function runAction(action: 'prepare' | 'render' | 'article') {
    if (!job) return
    setBusyAction(action)
    setMessage('')
    try {
      if (action === 'prepare') {
        await prepareShortFormJob(job.id)
      } else if (action === 'render') {
        await renderShortFormJob(job.id)
      } else {
        await updateShortFormArticle(job.id, articleUrlDraft.trim() || null)
        await rerunShortFormArticleCapture(job.id)
      }
      await refreshJobs(job.id)
      setMessage(action === 'article' ? 'Artikelkälla uppdaterad' : 'Jobb uppdaterat')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Åtgärden misslyckades')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="planner-app-shell" data-theme={theme}>
      <PlannerSidebar current="short-form" onNavigate={onNavigate} />
      <main className="planner-workspace">
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: 56, borderBottom: '1px solid var(--border)', gap: 16, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Short-Form Video Builder</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Första vertikala slice: jobb, stegstatus, manuell prepare/render och watcher-registrering
          </span>
          {message && <span style={{ fontSize: 13, fontWeight: 600 }}>{message}</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => void Promise.all([refreshJobs(), refreshWatchers()])} style={{ fontSize: 13 }}>↻ Uppdatera</button>
            <button type="button" className={theme === 'light' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('light')}>Light</button>
            <button type="button" className={theme === 'dark' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('dark')}>Dark</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 18, padding: 20, overflow: 'hidden', flex: 1 }}>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
            <form onSubmit={handleCreateJob} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Skapa manuellt jobb</div>
              <label style={labelStyle}>
                Titel
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="test1" style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Källmapp
                <input value={sourcePath} onChange={(event) => setSourcePath(event.target.value)} placeholder="/workspace/short-form-input/test1" style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Artikel-override
                <input value={articleUrlDraft} onChange={(event) => setArticleUrlDraft(event.target.value)} placeholder="https://example.com/article" style={inputStyle} />
              </label>
              <button type="submit" disabled={busyAction === 'create'} style={primaryButtonStyle}>
                {busyAction === 'create' ? 'Skapar…' : 'Skapa jobb'}
              </button>
            </form>

            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, minHeight: 0, overflow: 'auto' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Jobb</div>
              {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Laddar…</div>}
              {!loading && jobs.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Inga jobb ännu.</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {jobs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void selectJob(item.id)}
                    style={{
                      textAlign: 'left',
                      background: item.id === selectedJobId ? 'var(--surface)' : 'transparent',
                      border: `1px solid ${item.id === selectedJobId ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 10,
                      padding: 12,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <strong style={{ fontSize: 13 }}>{item.title}</strong>
                      <StatusBadge status={item.status} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.id}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                      {item.summary.clipCount} klipp · {item.sourceKind}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                      Uppdaterad {fmt(item.updatedAt)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section style={{ minWidth: 0, overflow: 'auto' }}>
            {!job && (
              <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, color: 'var(--text-muted)' }}>
                Välj eller skapa ett jobb för att se detaljer.
              </div>
            )}

            {job && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 18 }}>{job.title}</h3>
                    <StatusBadge status={job.status} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{job.id}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 14, fontSize: 13 }}>
                    <div><strong>Källa:</strong> {job.source.kind}</div>
                    <div><strong>Source path:</strong> <code>{job.source.sourcePath}</code></div>
                    <div><strong>Skapad:</strong> {fmt(job.createdAt)}</div>
                    <div><strong>Uppdaterad:</strong> {fmt(job.updatedAt)}</div>
                    <div><strong>Klipp:</strong> {job.summary.clipCount}</div>
                    <div><strong>Användbara:</strong> {job.summary.usableClipCount}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => void runAction('prepare')} disabled={busyAction !== null} style={primaryButtonStyle}>
                      {busyAction === 'prepare' ? 'Förbereder…' : 'Prepare'}
                    </button>
                    <button type="button" onClick={() => void runAction('render')} disabled={busyAction !== null} style={secondaryButtonStyle}>
                      {busyAction === 'render' ? 'Renderar…' : 'Render'}
                    </button>
                  </div>
                </div>

                <div style={{ background: job.status === 'pending_article_review' ? '#7c3aed10' : 'var(--surface-raised)', border: job.status === 'pending_article_review' ? '2px solid #7c3aed40' : '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: job.status === 'pending_article_review' ? '#7c3aed' : 'var(--text)' }}>Artikel</div>
                    {job.articleSelection?.selectedUrl
                      ? <span style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{job.articleSelection.selectedUrl}</span>
                      : <span style={{ fontSize: 12, color: '#b07d00' }}>Ingen artikel vald</span>
                    }
                    <button
                      type="button"
                      onClick={() => void handleFindMoreArticles()}
                      disabled={busyAction !== null}
                      style={{ ...secondaryButtonStyle, marginLeft: 'auto', padding: '6px 12px', fontSize: 12 }}
                    >
                      {busyAction === 'findMore' ? 'Söker…' : 'Hitta nya artiklar'}
                    </button>
                  </div>

                  {job.articleSelection?.screenshotPath && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Nuvarande screenshot</div>
                      <img
                        src={`/api/short-form/jobs/${job.id}/asset/article-mobile.png`}
                        alt="Article screenshot"
                        style={{ width: 120, borderRadius: 8, border: '1px solid var(--border)', display: 'block' }}
                      />
                    </div>
                  )}

                  {(reviewCandidates.length > 0 ? reviewCandidates : job.articleSelection?.candidates ?? []).map((candidate) => (
                    <div key={candidate.url} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10, background: 'var(--surface)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{candidate.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, wordBreak: 'break-all' }}>{candidate.url}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => void handlePreviewUrl(candidate.url)}
                            disabled={busyPreview}
                            style={{ ...secondaryButtonStyle, padding: '5px 10px', fontSize: 11 }}
                          >
                            {busyPreview ? 'Laddar…' : 'Förhandsgranska'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleApproveArticle(candidate.url)}
                            disabled={busyAction !== null}
                            style={{ ...primaryButtonStyle, padding: '5px 10px', fontSize: 11 }}
                          >
                            {busyAction === 'approve' ? 'Godkänner…' : 'Godkänn och rendera om'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <input
                      value={customArticleUrl}
                      onChange={(e) => { setCustomArticleUrl(e.target.value); setUrlPreviewImg(null) }}
                      placeholder="Klistra in egen URL och rendera om…"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => void handlePreviewUrl(customArticleUrl)}
                      disabled={busyPreview || !customArticleUrl.trim()}
                      style={secondaryButtonStyle}
                    >
                      {busyPreview ? 'Laddar…' : 'Förhandsgranska'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (customArticleUrl.trim()) void handleApproveArticle(customArticleUrl.trim()) }}
                      disabled={busyAction !== null || !customArticleUrl.trim()}
                      style={primaryButtonStyle}
                    >
                      Använd och rendera om
                    </button>
                  </div>
                  {urlPreviewImg && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Förhandsgranskning</div>
                      <img
                        src={urlPreviewImg}
                        alt="Article preview"
                        style={{ width: 180, borderRadius: 8, border: '1px solid var(--border)', display: 'block' }}
                      />
                    </div>
                  )}
                </div>


                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
                  <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Stegstatus</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {job.steps.map((step) => <StepRow key={step.key} step={step} />)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Artefakter</div>
                      <div style={{ fontSize: 13, display: 'grid', gap: 8 }}>
                        <div><strong>Workspace:</strong> <code>{job.paths.workspaceDir}</code></div>
                        <div><strong>Manifest:</strong> <code>{job.paths.manifestPath}</code></div>
                        <div><strong>Render-manifest:</strong> <code>{job.paths.renderManifestPath ?? '–'}</code></div>
                        <div><strong>Review cut:</strong> <code>{job.paths.reviewCutPath ?? '–'}</code></div>
                      </div>
                    </div>

                    <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Klipp</div>
                      {job.clips.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Inga clip records ännu.</div>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {job.clips.map((clip) => (
                          <div key={clip.index} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{clip.sourceFileName}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{clip.sourcePath}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {watchers && (
                  <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Watcher status</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Lokal watcher · <code>{watchers.localWatcher.inputDir}</code></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {watchers.localWatcher.jobs.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Inga lokala watcher-jobb ännu.</div>}
                          {watchers.localWatcher.jobs.slice(0, 5).map((watcherJob, index) => (
                            <div key={`${watcherJob.fileName}-${index}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, fontSize: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <strong>{watcherJob.fileName}</strong>
                                <StatusBadge status={watcherJob.status} />
                              </div>
                              <div style={{ color: 'var(--text-muted)', marginTop: 6 }}>{watcherJob.message}</div>
                              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Detekterad {fmtTs(watcherJob.detectedAt)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                          Cloud watcher · <code>{watchers.cloudWatcher.inputPath}</code>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {watchers.cloudWatcher.jobs.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cloud watcher är ännu bara initierad.</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginBottom: 10,
  fontSize: 13,
  fontWeight: 600
}

const inputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface)',
  color: 'var(--text)',
  padding: '10px 12px',
  fontSize: 13
}

const primaryButtonStyle: CSSProperties = {
  background: '#1a4fa8',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '9px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer'
}

const secondaryButtonStyle: CSSProperties = {
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '9px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer'
}
