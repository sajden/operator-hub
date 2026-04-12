import { useEffect, useState } from 'react'
import PlannerSidebar from '../components/shell/PlannerSidebar'

interface Draft {
  slug: string
  title: string
  metaDescription?: string
  body: string
  tags?: string[]
  trendScore?: number
  trendTopic?: string
  generatedAt: string
  reviewedAt?: string
  status: 'pending' | 'approved' | 'rejected'
}

interface ArticlesPageProps {
  onNavigate: (path: string) => void
  theme: string
  onSetTheme: (t: string) => void
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
}

function statusBadge(status: Draft['status']) {
  const colors: Record<Draft['status'], string> = {
    pending: '#b07d00',
    approved: '#1a7a3c',
    rejected: '#a03030',
  }
  const labels: Record<Draft['status'], string> = {
    pending: 'Väntar',
    approved: 'Godkänd',
    rejected: 'Avvisad',
  }
  return (
    <span style={{
      background: colors[status],
      color: '#fff',
      borderRadius: 6,
      padding: '2px 10px',
      fontSize: 12,
      fontWeight: 600,
    }}>
      {labels[status]}
    </span>
  )
}

export default function ArticlesPage({ onNavigate, theme, onSetTheme }: ArticlesPageProps) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [selected, setSelected] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')
  const [generating, setGenerating] = useState(false)

  async function loadDrafts() {
    setLoading(true)
    try {
      const res = await fetch('/api/articles')
      setDrafts(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDrafts() }, [])

  async function doGenerate() {
    setGenerating(true)
    setActionMsg('')
    try {
      const res = await fetch('/api/articles/generate', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setActionMsg(`✓ Artikel skapad: ${data.title ?? data.slug}`)
        await loadDrafts()
      } else {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        setActionMsg(`✗ Fel: ${err.error ?? 'Okänt fel'}`)
      }
    } catch (e) {
      setActionMsg(`✗ Nätverksfel`)
    } finally {
      setGenerating(false)
      setTimeout(() => setActionMsg(''), 6000)
    }
  }

  async function doAction(slug: string, action: 'approve' | 'reject') {
    const res = await fetch(`/api/articles/${encodeURIComponent(slug)}/${action}`, { method: 'POST' })
    if (res.ok) {
      setActionMsg(action === 'approve' ? '✓ Artikel godkänd' : '✗ Artikel avvisad')
      await loadDrafts()
      setSelected(prev => prev ? { ...prev, status: action === 'approve' ? 'approved' : 'rejected' } : prev)
      setTimeout(() => setActionMsg(''), 3000)
    }
  }

  const pending = drafts.filter(d => d.status === 'pending')
  const reviewed = drafts.filter(d => d.status !== 'pending')

  return (
    <div className="planner-app-shell" data-theme={theme}>
      <PlannerSidebar current="articles" onNavigate={onNavigate} />
      <main className="planner-workspace">
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: 56, borderBottom: '1px solid var(--border)', gap: 16, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>SEO Artiklar</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {actionMsg && !selected && (
              <span style={{ fontSize: 13, fontWeight: 600 }}>{actionMsg}</span>
            )}
            <button
              type="button"
              onClick={doGenerate}
              disabled={generating}
              style={{
                background: generating ? '#888' : '#1a4fa8',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: generating ? 'not-allowed' : 'pointer',
              }}
            >
              {generating ? 'Genererar…' : '+ Generera artikel'}
            </button>
            <button type="button" className={theme === 'light' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('light')}>Light</button>
            <button type="button" className={theme === 'dark' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('dark')}>Dark</button>
          </div>
        </div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left: draft list */}
          <div style={{ width: 320, minWidth: 280, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '16px 12px' }}>
            {loading && <p style={{ color: 'var(--text-muted)', padding: 8 }}>Laddar…</p>}

            {!loading && drafts.length === 0 && (
              <div style={{ color: 'var(--text-muted)', padding: 8, fontSize: 14 }}>
                <p>Inga artikelutkast ännu.</p>
                <p style={{ marginTop: 8 }}>Utkast skapas av generatorn och sparas i <code>.local/seo-drafts/</code>.</p>
              </div>
            )}

            {pending.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', padding: '4px 8px 8px' }}>
                  Väntar på granskning ({pending.length})
                </div>
                {pending.map(d => (
                  <DraftRow key={d.slug} draft={d} selected={selected?.slug === d.slug} onClick={() => setSelected(d)} />
                ))}
              </>
            )}

            {reviewed.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', padding: '16px 8px 8px' }}>
                  Granskade ({reviewed.length})
                </div>
                {reviewed.map(d => (
                  <DraftRow key={d.slug} draft={d} selected={selected?.slug === d.slug} onClick={() => setSelected(d)} />
                ))}
              </>
            )}
          </div>

          {/* Right: article view */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {!selected && (
              <div style={{ color: 'var(--text-muted)', marginTop: 40, textAlign: 'center' }}>
                Välj ett utkast till vänster för att läsa och granska det.
              </div>
            )}
            {selected && (
              <div style={{ maxWidth: 760 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <h1 style={{ margin: 0, fontSize: 24, flex: 1 }}>{selected.title}</h1>
                  {statusBadge(selected.status)}
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
                  <span>Genererad {fmt(selected.generatedAt)}</span>
                  {selected.trendTopic && <span>Trend: <strong>{selected.trendTopic}</strong></span>}
                  {selected.trendScore != null && <span>Score: <strong>{selected.trendScore}</strong></span>}
                  {selected.tags && selected.tags.length > 0 && (
                    <span>Taggar: {selected.tags.join(', ')}</span>
                  )}
                </div>

                {selected.metaDescription && (
                  <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
                    <strong>Meta description:</strong> {selected.metaDescription}
                  </div>
                )}

                {selected.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                    <button
                      onClick={() => doAction(selected.slug, 'approve')}
                      style={{ background: '#1a7a3c', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                    >
                      ✓ Godkänn &amp; publicera
                    </button>
                    <button
                      onClick={() => doAction(selected.slug, 'reject')}
                      style={{ background: '#a03030', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                    >
                      ✗ Avvisa
                    </button>
                    {actionMsg && <span style={{ alignSelf: 'center', fontSize: 14, fontWeight: 600 }}>{actionMsg}</span>}
                  </div>
                )}

                <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.7, color: 'var(--text)' }}>
                  {selected.body}
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}

function DraftRow({ draft, selected, onClick }: { draft: Draft; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        cursor: 'pointer',
        marginBottom: 4,
        background: selected ? 'var(--accent-subtle)' : 'transparent',
        border: selected ? '1px solid var(--accent)' : '1px solid transparent',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, lineHeight: 1.3 }}>{draft.title}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(draft.generatedAt)}</span>
        {statusBadge(draft.status)}
      </div>
    </div>
  )
}
