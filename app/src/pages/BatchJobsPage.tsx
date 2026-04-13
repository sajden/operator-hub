import { useEffect, useState } from 'react'
import PlannerSidebar from '../components/shell/PlannerSidebar'

interface RecentJob {
  fileName?: string
  status: string
  message?: string
  progress?: number
  detectedAt?: number
  completedAt?: number
}

interface BatchJob {
  id: string
  name: string
  description: string
  type: 'watcher' | 'scheduler'
  schedule: string
  // watcher fields
  inputDir?: string
  outputDir?: string
  inputPath?: string
  outputPath?: string
  queueLength?: number
  recentJobs?: RecentJob[]
  // scheduler fields
  nextRunAt?: string
  lastRunAt?: string
  lastRunStatus?: 'ok' | 'error' | null
  lastRunSlug?: string
  lastRunError?: string
  running?: boolean
}

interface BatchJobsPageProps {
  onNavigate: (path: string) => void
  theme: string
  onSetTheme: (t: string) => void
}

function fmt(iso: string | null | undefined) {
  if (!iso) return '–'
  return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtTs(ms: number | undefined) {
  if (!ms) return '–'
  return new Date(ms).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

function statusDot(color: string) {
  return (
    <span style={{
      display: 'inline-block',
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: color,
      marginRight: 6,
      flexShrink: 0,
    }} />
  )
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Ingen körning</span>
  if (status === 'ok') return <span style={{ color: '#1a7a3c', fontWeight: 600, fontSize: 12 }}>✓ OK</span>
  if (status === 'error') return <span style={{ color: '#a03030', fontWeight: 600, fontSize: 12 }}>✗ Fel</span>
  if (status === 'processing') return <span style={{ color: '#b07d00', fontWeight: 600, fontSize: 12 }}>⟳ Kör</span>
  if (status === 'done') return <span style={{ color: '#1a7a3c', fontWeight: 600, fontSize: 12 }}>✓ Klar</span>
  return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{status}</span>
}

function WatcherCard({ job, onNavigate }: { job: BatchJob; onNavigate: (p: string) => void }) {
  const active = (job.recentJobs ?? []).filter(j => j.status === 'processing')
  const done = (job.recentJobs ?? []).filter(j => j.status === 'done')
  const failed = (job.recentJobs ?? []).filter(j => j.status === 'error' || j.status === 'failed')

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{job.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{job.description}</div>
        </div>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          background: active.length > 0 ? '#b07d0020' : 'var(--surface-raised)',
          color: active.length > 0 ? '#b07d00' : 'var(--text-muted)',
          border: `1px solid ${active.length > 0 ? '#b07d0060' : 'var(--border)'}`,
          borderRadius: 6,
          padding: '3px 9px',
          whiteSpace: 'nowrap',
        }}>
          {active.length > 0 ? `${active.length} kör` : 'Väntar'}
        </div>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Schema</span>
        <span style={valueStyle}>{job.schedule}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>{job.inputDir ? 'Input' : 'OneDrive in'}</span>
        <span style={{ ...valueStyle, fontFamily: 'monospace', fontSize: 11 }}>{job.inputDir ?? job.inputPath ?? '–'}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>{job.outputDir ? 'Output' : 'OneDrive ut'}</span>
        <span style={{ ...valueStyle, fontFamily: 'monospace', fontSize: 11 }}>{job.outputDir ?? job.outputPath ?? '–'}</span>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
          <div style={statBox('#1a7a3c20', '#1a7a3c')}>{done.length} klara</div>
          <div style={statBox('#b07d0020', '#b07d00')}>{active.length} aktiva</div>
          <div style={statBox('#a0303020', '#a03030')}>{failed.length} fel</div>
        </div>

        {job.recentJobs && job.recentJobs.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Senaste filer
            </div>
            {job.recentJobs.slice(0, 5).map((j, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                {statusDot(j.status === 'done' ? '#1a7a3c' : j.status === 'processing' ? '#b07d00' : j.status === 'error' ? '#a03030' : '#888')}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.fileName ?? '–'}</span>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{fmtTs(j.completedAt ?? j.detectedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {job.id === 'bg-remover-cloud' && (
        <button
          type="button"
          onClick={() => onNavigate('/bg-remover')}
          style={linkBtnStyle}
        >
          Öppna BG Remover →
        </button>
      )}
    </div>
  )
}

function SchedulerCard({ job, onTrigger, triggering }: { job: BatchJob; onTrigger: () => void; triggering: boolean }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{job.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{job.description}</div>
        </div>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          background: job.running ? '#b07d0020' : 'var(--surface-raised)',
          color: job.running ? '#b07d00' : 'var(--text-muted)',
          border: `1px solid ${job.running ? '#b07d0060' : 'var(--border)'}`,
          borderRadius: 6,
          padding: '3px 9px',
        }}>
          {job.running ? 'Kör nu' : 'Schemalagd'}
        </div>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Schema</span>
        <span style={valueStyle}>{job.schedule}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Nästa körning</span>
        <span style={valueStyle}>{fmt(job.nextRunAt)}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Senast körde</span>
        <span style={valueStyle}>{fmt(job.lastRunAt)}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Status</span>
        <span style={valueStyle}><StatusBadge status={job.lastRunStatus} /></span>
      </div>
      {job.lastRunSlug && (
        <div style={rowStyle}>
          <span style={labelStyle}>Senaste artikel</span>
          <span style={{ ...valueStyle, fontFamily: 'monospace', fontSize: 11 }}>{job.lastRunSlug}</span>
        </div>
      )}
      {job.lastRunError && (
        <div style={{ marginTop: 8, background: '#a0303015', border: '1px solid #a0303040', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#a03030' }}>
          {job.lastRunError}
        </div>
      )}

      <button
        type="button"
        onClick={onTrigger}
        disabled={triggering || job.running}
        style={{
          marginTop: 16,
          background: (triggering || job.running) ? '#888' : '#1a4fa8',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '7px 16px',
          fontSize: 13,
          fontWeight: 600,
          cursor: (triggering || job.running) ? 'not-allowed' : 'pointer',
        }}
      >
        {triggering ? 'Genererar…' : '▶ Kör nu'}
      </button>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 5,
  fontSize: 13,
  alignItems: 'flex-start',
}

const labelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  minWidth: 110,
  flexShrink: 0,
}

const valueStyle: React.CSSProperties = {
  color: 'var(--text)',
  wordBreak: 'break-all',
}

const linkBtnStyle: React.CSSProperties = {
  marginTop: 14,
  background: 'none',
  border: 'none',
  color: 'var(--accent)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0,
  textAlign: 'left',
}

function statBox(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    border: `1px solid ${color}40`,
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
  }
}

export default function BatchJobsPage({ onNavigate, theme, onSetTheme }: BatchJobsPageProps) {
  const [jobs, setJobs] = useState<BatchJob[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  async function load() {
    try {
      const res = await fetch('/api/jobs')
      const data = await res.json()
      setJobs(data.jobs ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const iv = setInterval(load, 10_000)
    return () => clearInterval(iv)
  }, [])

  async function triggerSeo() {
    setTriggering('seo-generator')
    setMsg('')
    try {
      const res = await fetch('/api/articles/generate', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setMsg(`✓ Artikel skapad: ${data.title ?? data.slug}`)
        await load()
      } else {
        setMsg(`✗ ${data.error ?? 'Okänt fel'}`)
      }
    } catch {
      setMsg('✗ Nätverksfel')
    } finally {
      setTriggering(null)
      setTimeout(() => setMsg(''), 6000)
    }
  }

  const watchers = jobs.filter(j => j.type === 'watcher')
  const schedulers = jobs.filter(j => j.type === 'scheduler')

  return (
    <div className="planner-app-shell" data-theme={theme}>
      <PlannerSidebar current="jobs" onNavigate={onNavigate} />
      <main className="planner-workspace">
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: 56, borderBottom: '1px solid var(--border)', gap: 16, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Batch Jobs</h2>
          {msg && <span style={{ fontSize: 13, fontWeight: 600 }}>{msg}</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => load()} style={{ fontSize: 13 }}>↻ Uppdatera</button>
            <button type="button" className={theme === 'light' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('light')}>Light</button>
            <button type="button" className={theme === 'dark' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('dark')}>Dark</button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: 24, flex: 1 }}>
          {loading && <p style={{ color: 'var(--text-muted)' }}>Laddar…</p>}

          {!loading && (
            <>
              {watchers.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 12 }}>
                    Kontinuerliga bevakare
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16, marginBottom: 28 }}>
                    {watchers.map(j => (
                      <WatcherCard key={j.id} job={j} onNavigate={onNavigate} />
                    ))}
                  </div>
                </>
              )}

              {schedulers.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 12 }}>
                    Schemalagda jobb
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                    {schedulers.map(j => (
                      <SchedulerCard
                        key={j.id}
                        job={j}
                        onTrigger={j.id === 'seo-generator' ? triggerSeo : () => {}}
                        triggering={triggering === j.id}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
