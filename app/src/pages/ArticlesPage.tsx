import { useEffect, useState } from 'react'
import PlannerSidebar from '../components/shell/PlannerSidebar'

interface Draft {
  slug: string
  title: string
  metaDescription?: string
  category?: string
  body: string
  tags?: string[]
  trendScore?: number
  trendTopic?: string
  generatedAt: string
  reviewedAt?: string
  updatedAt?: string
  status: 'pending' | 'approved' | 'rejected' | 'published'
  publishedAt?: string
  site?: string
  siteName?: string
}

interface EditState {
  title: string
  metaDescription: string
  category: string
  tags: string
  body: string
}

interface ArticlesPageProps {
  onNavigate: (path: string) => void
  theme: string
  onSetTheme: (t: string) => void
}

function fmt(iso: string | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
}

function statusBadge(status: Draft['status']) {
  const colors: Record<Draft['status'], string> = {
    pending: '#b07d00',
    approved: '#1a7a3c',
    rejected: '#a03030',
    published: '#1a4fa8',
  }
  const labels: Record<Draft['status'], string> = {
    pending: 'Väntar',
    approved: 'Godkänd',
    rejected: 'Avvisad',
    published: 'Publicerad',
  }
  return (
    <span style={{ background: colors[status], color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
      {labels[status]}
    </span>
  )
}

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 14,
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 14,
  color: 'var(--text)',
  width: '100%',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
}

export default function ArticlesPage({ onNavigate, theme, onSetTheme }: ArticlesPageProps) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [selected, setSelected] = useState<Draft | null>(null)
  const [siteFilter, setSiteFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [unpublishing, setUnpublishing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editState, setEditState] = useState<EditState | null>(null)

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

  function startEdit(draft: Draft) {
    setEditState({
      title: draft.title,
      metaDescription: draft.metaDescription ?? '',
      category: draft.category ?? '',
      tags: (draft.tags ?? []).join(', '),
      body: draft.body,
    })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setEditState(null)
  }

  async function doSave() {
    if (!selected || !editState) return
    setSaving(true)
    setActionMsg('')
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(selected.slug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editState.title,
          metaDescription: editState.metaDescription,
          category: editState.category,
          tags: editState.tags.split(',').map(t => t.trim()).filter(Boolean),
          body: editState.body,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setActionMsg(selected.status === 'published' ? '✓ Sparad + publicerad på sebcastwall' : '✓ Sparad')
        setSelected(data.draft)
        setEditing(false)
        setEditState(null)
        await loadDrafts()
      } else {
        setActionMsg(`✗ ${data.error ?? 'Okänt fel'}`)
      }
    } catch {
      setActionMsg('✗ Nätverksfel')
    } finally {
      setSaving(false)
      setTimeout(() => setActionMsg(''), 5000)
    }
  }

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
    } catch {
      setActionMsg('✗ Nätverksfel')
    } finally {
      setGenerating(false)
      setTimeout(() => setActionMsg(''), 6000)
    }
  }

  async function doPublish(slug: string) {
    setPublishing(true)
    setActionMsg('')
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(slug)}/publish`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setActionMsg('✓ Publicerad på sebcastwall')
        await loadDrafts()
        setSelected(prev => prev ? { ...prev, status: 'published', publishedAt: data.publishedAt } : prev)
      } else {
        setActionMsg(`✗ ${data.error ?? 'Okänt fel'}`)
      }
    } catch {
      setActionMsg('✗ Nätverksfel')
    } finally {
      setPublishing(false)
      setTimeout(() => setActionMsg(''), 6000)
    }
  }

  async function doUnpublish(slug: string) {
    if (!confirm('Ta bort artikeln från sebcastwall? Utkastet behålls som Godkänd.')) return
    setUnpublishing(true)
    setActionMsg('')
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(slug)}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        setActionMsg('✓ Avpublicerad')
        await loadDrafts()
        setSelected(prev => prev ? { ...prev, status: 'approved', publishedAt: undefined } : prev)
      } else {
        setActionMsg(`✗ ${data.error ?? 'Okänt fel'}`)
      }
    } catch {
      setActionMsg('✗ Nätverksfel')
    } finally {
      setUnpublishing(false)
      setTimeout(() => setActionMsg(''), 5000)
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

  const sites = Array.from(new Set(drafts.map(d => d.site ?? 'okänd'))).sort()
  const filtered = siteFilter === 'all' ? drafts : drafts.filter(d => (d.site ?? 'okänd') === siteFilter)
  const pending = filtered.filter(d => d.status === 'pending')
  const reviewed = filtered.filter(d => d.status !== 'pending')

  return (
    <div className="planner-app-shell" data-theme={theme}>
      <PlannerSidebar current="articles" onNavigate={onNavigate} />
      <main className="planner-workspace">
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: 56, borderBottom: '1px solid var(--border)', gap: 16, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>SEO Artiklar</h2>
          {sites.length > 1 && (
            <select
              value={siteFilter}
              onChange={e => { setSiteFilter(e.target.value); setSelected(null); cancelEdit() }}
              style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-raised)', color: 'var(--text)', cursor: 'pointer' }}
            >
              <option value="all">Alla siter ({drafts.length})</option>
              {sites.map(s => (
                <option key={s} value={s}>{s} ({drafts.filter(d => (d.site ?? 'okänd') === s).length})</option>
              ))}
            </select>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {actionMsg && <span style={{ fontSize: 13, fontWeight: 600 }}>{actionMsg}</span>}
            <button
              type="button"
              onClick={doGenerate}
              disabled={generating}
              style={{ background: generating ? '#888' : '#1a4fa8', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer' }}
            >
              {generating ? 'Genererar…' : '+ Generera artikel'}
            </button>
            <button type="button" className={theme === 'light' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('light')}>Light</button>
            <button type="button" className={theme === 'dark' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('dark')}>Dark</button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: draft list */}
          <div style={{ width: 300, minWidth: 260, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '16px 12px' }}>
            {loading && <p style={{ color: 'var(--text-muted)', padding: 8 }}>Laddar…</p>}
            {!loading && drafts.length === 0 && (
              <div style={{ color: 'var(--text-muted)', padding: 8, fontSize: 14 }}>
                <p>Inga artikelutkast ännu.</p>
              </div>
            )}
            {pending.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', padding: '4px 8px 8px' }}>
                  Väntar ({pending.length})
                </div>
                {pending.map(d => (
                  <DraftRow key={d.slug} draft={d} selected={selected?.slug === d.slug} onClick={() => { setSelected(d); cancelEdit() }} />
                ))}
              </>
            )}
            {reviewed.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', padding: '16px 8px 8px' }}>
                  Granskade ({reviewed.length})
                </div>
                {reviewed.map(d => (
                  <DraftRow key={d.slug} draft={d} selected={selected?.slug === d.slug} onClick={() => { setSelected(d); cancelEdit() }} />
                ))}
              </>
            )}
          </div>

          {/* Right: article view / editor */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {!selected && (
              <div style={{ color: 'var(--text-muted)', marginTop: 40, textAlign: 'center' }}>
                Välj ett utkast till vänster för att läsa och granska det.
              </div>
            )}

            {selected && !editing && (
              <div style={{ maxWidth: 760 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <h1 style={{ margin: 0, fontSize: 22, flex: 1, lineHeight: 1.3 }}>{selected.title}</h1>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {statusBadge(selected.status)}
                    <button
                      type="button"
                      onClick={() => startEdit(selected)}
                      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text)' }}
                    >
                      ✎ Redigera
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span>Genererad {fmt(selected.generatedAt)}</span>
                  {selected.publishedAt && <span>Publicerad {fmt(selected.publishedAt)}</span>}
                  {selected.siteName && <span style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>{selected.siteName}</span>}
                  {selected.trendTopic && <span>Trend: <strong>{selected.trendTopic}</strong></span>}
                  {selected.trendScore != null && <span>Score: <strong>{selected.trendScore}</strong></span>}
                  {selected.category && <span>Kategori: <strong>{selected.category}</strong></span>}
                  {selected.tags && selected.tags.length > 0 && <span>Taggar: {selected.tags.join(', ')}</span>}
                </div>

                {selected.metaDescription && (
                  <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
                    <strong>Meta:</strong> {selected.metaDescription}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>
                  {selected.status === 'pending' && <>
                    <button onClick={() => doAction(selected.slug, 'approve')} style={btnStyle('#1a7a3c')}>✓ Godkänn</button>
                    <button onClick={() => doAction(selected.slug, 'reject')} style={btnStyle('#a03030')}>✗ Avvisa</button>
                  </>}
                  {selected.status === 'approved' && (
                    <button onClick={() => doPublish(selected.slug)} disabled={publishing} style={btnStyle(publishing ? '#888' : '#1a4fa8')}>
                      {publishing ? 'Publicerar…' : '↑ Publicera på sebcastwall'}
                    </button>
                  )}
                  {selected.status === 'published' && (
                    <button onClick={() => doUnpublish(selected.slug)} disabled={unpublishing} style={btnStyle(unpublishing ? '#888' : '#a03030')}>
                      {unpublishing ? 'Avpublicerar…' : '✕ Ta bort från sebcastwall'}
                    </button>
                  )}
                  {actionMsg && <span style={{ fontSize: 13, fontWeight: 600 }}>{actionMsg}</span>}
                </div>

                <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.7, color: 'var(--text)' }}>
                  {selected.body}
                </div>
              </div>
            )}

            {/* Editor */}
            {selected && editing && editState && (
              <div style={{ maxWidth: 760 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, flex: 1 }}>Redigera artikel</h2>
                  <button type="button" onClick={cancelEdit} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}>
                    Avbryt
                  </button>
                  <button type="button" onClick={doSave} disabled={saving} style={btnStyle(saving ? '#888' : '#1a4fa8')}>
                    {saving ? 'Sparar…' : selected.status === 'published' ? '↑ Spara + uppdatera live' : '✓ Spara'}
                  </button>
                  {actionMsg && <span style={{ fontSize: 13, fontWeight: 600 }}>{actionMsg}</span>}
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Titel</label>
                  <input
                    style={inputStyle}
                    value={editState.title}
                    onChange={e => setEditState(s => s ? { ...s, title: e.target.value } : s)}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Meta description</label>
                  <textarea
                    style={{ ...inputStyle, resize: 'vertical' }}
                    rows={3}
                    value={editState.metaDescription}
                    onChange={e => setEditState(s => s ? { ...s, metaDescription: e.target.value } : s)}
                  />
                </div>

                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ ...fieldStyle, flex: 1 }}>
                    <label style={labelStyle}>Kategori</label>
                    <input
                      style={inputStyle}
                      value={editState.category}
                      onChange={e => setEditState(s => s ? { ...s, category: e.target.value } : s)}
                    />
                  </div>
                  <div style={{ ...fieldStyle, flex: 1 }}>
                    <label style={labelStyle}>Taggar (kommaseparerade)</label>
                    <input
                      style={inputStyle}
                      value={editState.tags}
                      onChange={e => setEditState(s => s ? { ...s, tags: e.target.value } : s)}
                    />
                  </div>
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Body (Markdown)</label>
                  <textarea
                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13, resize: 'vertical', minHeight: 400 }}
                    value={editState.body}
                    onChange={e => setEditState(s => s ? { ...s, body: e.target.value } : s)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: bg === '#888' ? 'not-allowed' : 'pointer' }
}

function DraftRow({ draft, selected, onClick }: { draft: Draft; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4, background: selected ? 'var(--accent-subtle)' : 'transparent', border: selected ? '1px solid var(--accent)' : '1px solid transparent' }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, lineHeight: 1.3 }}>{draft.title}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(draft.generatedAt)}{draft.siteName ? ` · ${draft.siteName}` : ''}</span>
        {statusBadge(draft.status)}
      </div>
    </div>
  )
}
