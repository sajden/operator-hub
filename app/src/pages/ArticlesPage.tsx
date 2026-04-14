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
  pushedAt?: string | null
  mdxOnDisk?: boolean
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

function wordCount(body: string) {
  return body.trim().split(/\s+/).filter(Boolean).length
}

function readingTime(body: string) {
  return Math.max(1, Math.round(wordCount(body) / 200))
}

function statusBadge(draft: Draft) {
  const { status, mdxOnDisk, pushedAt } = draft
  const colors: Record<Draft['status'], string> = {
    pending: '#b07d00',
    approved: '#1a7a3c',
    rejected: '#a03030',
    published: mdxOnDisk ? (pushedAt ? '#1a4fa8' : '#6a5acd') : '#888',
  }
  const labels: Record<Draft['status'], string> = {
    pending: 'Väntar',
    approved: 'Godkänd',
    rejected: 'Avvisad',
    published: mdxOnDisk ? (pushedAt ? '🟢 Live' : '📄 Fil klar') : 'Publicerad',
  }
  return (
    <span style={{ background: colors[status], color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {labels[status]}
    </span>
  )
}

// ── Markdown renderer ──────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} style={{ background: 'var(--surface-raised)', borderRadius: 3, padding: '1px 5px', fontSize: '0.9em', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>
    return part
  })
}

function MarkdownBody({ body }: { body: string }) {
  const blocks = body.split(/\n\n+/)
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {blocks.map((block, i) => {
        if (block.startsWith('# ')) {
          return <h1 key={i} style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1.3 }}>{renderInline(block.slice(2))}</h1>
        }
        if (block.startsWith('## ')) {
          return <h2 key={i} style={{ margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.3, paddingTop: 8, borderTop: '1px solid var(--border)' }}>{renderInline(block.slice(3))}</h2>
        }
        if (block.startsWith('### ')) {
          return <h3 key={i} style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{renderInline(block.slice(4))}</h3>
        }
        const lines = block.split('\n')
        if (lines.every(l => l.startsWith('- '))) {
          return (
            <ul key={i} style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
              {lines.map((l, j) => <li key={j} style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text)' }}>{renderInline(l.slice(2))}</li>)}
            </ul>
          )
        }
        if (lines.every(l => /^\d+\.\s/.test(l))) {
          return (
            <ol key={i} style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
              {lines.map((l, j) => <li key={j} style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text)' }}>{renderInline(l.replace(/^\d+\.\s/, ''))}</li>)}
            </ol>
          )
        }
        if (block.startsWith('> ')) {
          return (
            <blockquote key={i} style={{ margin: 0, borderLeft: '3px solid var(--accent)', paddingLeft: 16, color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 15, lineHeight: 1.7 }}>
              {renderInline(block.slice(2))}
            </blockquote>
          )
        }
        return (
          <p key={i} style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: 'var(--text)' }}>
            {renderInline(block)}
          </p>
        )
      })}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }
const inputStyle: React.CSSProperties = { background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 14, color: 'var(--text)', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit' }

function btnStyle(bg: string, small = false): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 7, padding: small ? '6px 14px' : '9px 20px', fontSize: small ? 12 : 13, fontWeight: 600, cursor: bg === '#888' ? 'not-allowed' : 'pointer' }
}

// ── Page ───────────────────────────────────────────────────────────────────────

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
    setEditState({ title: draft.title, metaDescription: draft.metaDescription ?? '', category: draft.category ?? '', tags: (draft.tags ?? []).join(', '), body: draft.body })
    setEditing(true)
  }

  function cancelEdit() { setEditing(false); setEditState(null) }

  async function doSave() {
    if (!selected || !editState) return
    setSaving(true); setActionMsg('')
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(selected.slug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editState.title, metaDescription: editState.metaDescription, category: editState.category, tags: editState.tags.split(',').map(t => t.trim()).filter(Boolean), body: editState.body }),
      })
      const data = await res.json()
      if (res.ok) {
        setActionMsg(selected.status === 'published' ? '✓ Sparad + uppdaterad live' : '✓ Sparad')
        setSelected(data.draft); setEditing(false); setEditState(null)
        await loadDrafts()
      } else {
        setActionMsg(`✗ ${data.error ?? 'Okänt fel'}`)
      }
    } catch { setActionMsg('✗ Nätverksfel') }
    finally { setSaving(false); setTimeout(() => setActionMsg(''), 5000) }
  }

  async function doGenerate() {
    setGenerating(true); setActionMsg('Genererar artikel… (tar ~60s)')
    try {
      const res = await fetch('/api/articles/generate', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        setActionMsg(`✗ ${err.error ?? 'Okänt fel'}`); setGenerating(false); return
      }
      const beforeCount = drafts.length
      const poll = setInterval(async () => {
        const fresh: Draft[] = await fetch('/api/articles').then(r => r.json())
        if (fresh.length > beforeCount) {
          clearInterval(poll); setDrafts(fresh)
          const newest = fresh.find(d => !drafts.some(x => x.slug === d.slug))
          setActionMsg(`✓ Artikel skapad: ${newest?.title ?? 'Klar'}`)
          setGenerating(false); setTimeout(() => setActionMsg(''), 6000)
        }
      }, 4000)
      setTimeout(() => { clearInterval(poll); setGenerating(false); setActionMsg('') }, 180_000)
    } catch { setActionMsg('✗ Nätverksfel'); setGenerating(false) }
  }

  async function doPublish(slug: string) {
    setPublishing(true); setActionMsg('')
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(slug)}/publish`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setActionMsg(data.pushed ? '✓ Publicerad + pushad till GitHub' : '✓ MDX sparad lokalt (push manuellt)')
        await loadDrafts()
        setSelected(prev => prev ? { ...prev, status: 'published', publishedAt: data.publishedAt, mdxOnDisk: true, pushedAt: data.pushed ? data.publishedAt : null } : prev)
      } else { setActionMsg(`✗ ${data.error ?? 'Okänt fel'}`) }
    } catch { setActionMsg('✗ Nätverksfel') }
    finally { setPublishing(false); setTimeout(() => setActionMsg(''), 7000) }
  }

  async function doUnpublish(slug: string) {
    if (!confirm('Ta bort MDX-filen och avpublicera? Utkastet behålls som Godkänd.')) return
    setUnpublishing(true); setActionMsg('')
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(slug)}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        setActionMsg('✓ Avpublicerad')
        await loadDrafts()
        setSelected(prev => prev ? { ...prev, status: 'approved', publishedAt: undefined, mdxOnDisk: false, pushedAt: null } : prev)
      } else { setActionMsg(`✗ ${data.error ?? 'Okänt fel'}`) }
    } catch { setActionMsg('✗ Nätverksfel') }
    finally { setUnpublishing(false); setTimeout(() => setActionMsg(''), 5000) }
  }

  async function doAction(slug: string, action: 'approve' | 'reject') {
    const res = await fetch(`/api/articles/${encodeURIComponent(slug)}/${action}`, { method: 'POST' })
    if (res.ok) {
      setActionMsg(action === 'approve' ? '✓ Godkänd' : '✗ Avvisad')
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

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: 56, borderBottom: '1px solid var(--border)', gap: 12, flexShrink: 0 }}>
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
            {actionMsg && <span style={{ fontSize: 13, fontWeight: 600, maxWidth: 360 }}>{actionMsg}</span>}
            <button type="button" onClick={doGenerate} disabled={generating} style={{ background: generating ? '#888' : '#1a4fa8', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer' }}>
              {generating ? '⏳ Genererar…' : '+ Generera artikel'}
            </button>
            <button type="button" className={theme === 'light' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('light')}>Light</button>
            <button type="button" className={theme === 'dark' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('dark')}>Dark</button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left: article list */}
          <div style={{ width: 290, minWidth: 240, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '12px 8px' }}>
            {loading && <p style={{ color: 'var(--text-muted)', padding: 8, fontSize: 13 }}>Laddar…</p>}
            {!loading && drafts.length === 0 && (
              <p style={{ color: 'var(--text-muted)', padding: '8px 12px', fontSize: 13 }}>Inga artikelutkast ännu.</p>
            )}
            {pending.length > 0 && (
              <ArticleGroup label={`Väntar (${pending.length})`} first>
                {pending.map(d => <DraftRow key={d.slug} draft={d} selected={selected?.slug === d.slug} onClick={() => { setSelected(d); cancelEdit() }} />)}
              </ArticleGroup>
            )}
            {reviewed.length > 0 && (
              <ArticleGroup label={`Granskade (${reviewed.length})`}>
                {reviewed.map(d => <DraftRow key={d.slug} draft={d} selected={selected?.slug === d.slug} onClick={() => { setSelected(d); cancelEdit() }} />)}
              </ArticleGroup>
            )}
          </div>

          {/* Right: article view / editor */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {!selected && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                Välj ett utkast till vänster.
              </div>
            )}

            {selected && !editing && (
              <>
                {/* Sticky action bar */}
                <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 24px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {statusBadge(selected)}
                  {selected.status === 'pending' && <>
                    <button onClick={() => doAction(selected.slug, 'approve')} style={btnStyle('#1a7a3c', true)}>✓ Godkänn</button>
                    <button onClick={() => doAction(selected.slug, 'reject')} style={btnStyle('#a03030', true)}>✗ Avvisa</button>
                  </>}
                  {selected.status === 'approved' && (
                    <button onClick={() => doPublish(selected.slug)} disabled={publishing} style={btnStyle(publishing ? '#888' : '#1a4fa8', true)}>
                      {publishing ? 'Publicerar…' : '↑ Publicera på sebcastwall'}
                    </button>
                  )}
                  {selected.status === 'published' && selected.mdxOnDisk && (
                    <button onClick={() => doUnpublish(selected.slug)} disabled={unpublishing} style={btnStyle(unpublishing ? '#888' : '#a03030', true)}>
                      {unpublishing ? 'Avpublicerar…' : '✕ Ta bort + avpublicera'}
                    </button>
                  )}
                  {selected.status === 'published' && !selected.mdxOnDisk && (
                    <button onClick={() => doAction(selected.slug, 'approve')} style={btnStyle('#b07d00', true)}>↩ Återställ till Godkänd</button>
                  )}
                  {selected.pushedAt && (
                    <a href={`https://sebcastwall.se/artiklar/${selected.slug}`} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#1a4fa8', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
                      🔗 Öppna live →
                    </a>
                  )}
                  <button type="button" onClick={() => startEdit(selected)} style={{ marginLeft: 'auto', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text)' }}>
                    ✎ Redigera
                  </button>
                  {actionMsg && <span style={{ fontSize: 13, fontWeight: 600 }}>{actionMsg}</span>}
                </div>

                {/* Article content */}
                <div style={{ flex: 1, padding: '28px 32px', maxWidth: 820 }}>
                  <h1 style={{ margin: '0 0 12px', fontSize: 26, fontWeight: 800, lineHeight: 1.3 }}>{selected.title}</h1>

                  {/* Meta row */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(selected.generatedAt)}</span>
                    {selected.publishedAt && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· publicerad {fmt(selected.publishedAt)}</span>}
                    {selected.pushedAt
                      ? <span style={{ fontSize: 12, color: '#1a7a3c', fontWeight: 600 }}>· ✓ pushad</span>
                      : selected.status === 'published' && selected.mdxOnDisk
                        ? <span style={{ fontSize: 12, color: '#6a5acd', fontWeight: 600 }}>· 📄 lokalt — ej pushad</span>
                        : null}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {wordCount(selected.body)} ord · {readingTime(selected.body)} min</span>
                    {selected.category && <Chip>{selected.category}</Chip>}
                    {selected.tags?.map(t => <Chip key={t} muted>{t}</Chip>)}
                  </div>

                  {selected.metaDescription && (
                    <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 24, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      <strong style={{ color: 'var(--text)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Meta · </strong>
                      {selected.metaDescription}
                    </div>
                  )}

                  <MarkdownBody body={selected.body} />
                </div>
              </>
            )}

            {/* Editor */}
            {selected && editing && editState && (
              <div style={{ flex: 1, padding: '24px 32px', maxWidth: 820 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, position: 'sticky', top: 0, background: 'var(--surface)', paddingBottom: 12, borderBottom: '1px solid var(--border)', zIndex: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, flex: 1 }}>Redigera</h2>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{editState.body.trim().split(/\s+/).length} ord</span>
                  <button type="button" onClick={cancelEdit} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}>Avbryt</button>
                  <button type="button" onClick={doSave} disabled={saving} style={btnStyle(saving ? '#888' : '#1a4fa8', true)}>
                    {saving ? 'Sparar…' : selected.status === 'published' ? '↑ Spara + uppdatera live' : '✓ Spara'}
                  </button>
                  {actionMsg && <span style={{ fontSize: 13, fontWeight: 600 }}>{actionMsg}</span>}
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Titel</label>
                  <input style={inputStyle} value={editState.title} onChange={e => setEditState(s => s ? { ...s, title: e.target.value } : s)} />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Meta description</label>
                  <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={editState.metaDescription} onChange={e => setEditState(s => s ? { ...s, metaDescription: e.target.value } : s)} />
                </div>

                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ ...fieldStyle, flex: 1 }}>
                    <label style={labelStyle}>Kategori</label>
                    <input style={inputStyle} value={editState.category} onChange={e => setEditState(s => s ? { ...s, category: e.target.value } : s)} />
                  </div>
                  <div style={{ ...fieldStyle, flex: 1 }}>
                    <label style={labelStyle}>Taggar (kommaseparerade)</label>
                    <input style={inputStyle} value={editState.tags} onChange={e => setEditState(s => s ? { ...s, tags: e.target.value } : s)} />
                  </div>
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Body (Markdown)</label>
                  <textarea
                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13, resize: 'vertical', minHeight: 420, lineHeight: 1.6 }}
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

function ArticleGroup({ label, children, first }: { label: string; children: React.ReactNode; first?: boolean }) {
  return (
    <>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--text-muted)', padding: first ? '4px 10px 6px' : '16px 10px 6px' }}>
        {label}
      </div>
      {children}
    </>
  )
}

function Chip({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span style={{ background: muted ? 'var(--surface-raised)' : 'var(--accent-subtle)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600, color: muted ? 'var(--text-muted)' : 'var(--text)' }}>
      {children}
    </span>
  )
}

function DraftRow({ draft, selected, onClick }: { draft: Draft; selected: boolean; onClick: () => void }) {
  const wc = wordCount(draft.body)
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
        background: selected ? 'var(--accent-subtle)' : 'transparent',
        border: selected ? '1px solid var(--accent)' : '1px solid transparent',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 5, lineHeight: 1.35 }}>{draft.title}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(draft.generatedAt)}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{wc} ord{draft.category ? ` · ${draft.category}` : ''}</span>
        </div>
        {statusBadge(draft)}
      </div>
    </div>
  )
}
