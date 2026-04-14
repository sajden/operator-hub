import { useEffect, useState } from 'react'
import PlannerSidebar from '../components/shell/PlannerSidebar'

type Interaction = {
  interaction_id: string
  created_at: string
  session_id: string | null
  page_path: string | null
  visitor_input: string
  answer_text: string
  answer_type: string | null
  confidence_level: string | null
  recommended_service: string | null
  recommendedPages: Array<{ href: string; label: string }>
}

type Lead = {
  lead_id: string
  created_at: string
  session_id: string | null
  name: string
  email: string
  phone: string | null
  company: string | null
  follow_up_preference: string | null
  problem_summary: string
}

type ChatsSnapshot = {
  available: boolean
  interactions: Interaction[]
  leads: Lead[]
}

interface AdvisorChatsPageProps {
  onNavigate: (path: string) => void
  theme: string
  onSetTheme: (t: string) => void
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('sv-SE')
}

function confidenceBadge(level: string | null) {
  const colors: Record<string, string> = { high: '#1a7a3c', medium: '#c07a10', low: '#a03030' }
  const bg = level ? (colors[level] ?? '#555') : '#555'
  return (
    <span style={{ background: bg + '22', color: bg, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
      {level ?? '—'}
    </span>
  )
}

export default function AdvisorChatsPage({ onNavigate, theme, onSetTheme }: AdvisorChatsPageProps) {
  const [data, setData] = useState<ChatsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [tab, setTab] = useState<'chats' | 'leads'>('chats')
  const [limit, setLimit] = useState(100)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/advisor-chats?limit=${limit}`)
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Kunde inte läsa chattdata')
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Okänt fel')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [limit])

  const tabBtn = (id: 'chats' | 'leads', label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{
        background: tab === id ? 'var(--accent, #1a4fa8)' : 'transparent',
        color: tab === id ? '#fff' : 'var(--text-muted)',
        border: 'none',
        borderRadius: 6,
        padding: '5px 14px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer'
      }}
    >
      {label}
      {data && (
        <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>
          ({id === 'chats' ? data.interactions.length : data.leads.length})
        </span>
      )}
    </button>
  )

  return (
    <div className="planner-app-shell" data-theme={theme}>
      <PlannerSidebar current="advisor-chats" onNavigate={onNavigate} />
      <main className="planner-workspace">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: 56, borderBottom: '1px solid var(--border)', gap: 12, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Advisor Chattar</h2>
          <div style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
            {tabBtn('chats', 'Konversationer')}
            {tabBtn('leads', 'Leads')}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
            >
              <option value={50}>Senaste 50</option>
              <option value={100}>Senaste 100</option>
              <option value={250}>Senaste 250</option>
              <option value={500}>Senaste 500</option>
            </select>
            <button
              type="button"
              onClick={load}
              style={{ background: '#1a4fa8', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Uppdatera
            </button>
            <button type="button" className={theme === 'light' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('light')}>Light</button>
            <button type="button" className={theme === 'dark' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('dark')}>Dark</button>
          </div>
        </div>

        <div style={{ padding: 24, display: 'grid', gap: 16, overflowY: 'auto' }}>
          {loading && <div style={{ color: 'var(--text-muted)' }}>Laddar chattdata…</div>}
          {error && <div style={{ color: '#a03030', fontWeight: 600 }}>{error}</div>}

          {!loading && !error && data && !data.available && (
            <div style={{ color: 'var(--text-muted)' }}>
              Ingen data tillgänglig. Kontrollera att <code>AI_ADVISOR_DB</code> och <code>AI_ADVISOR_ADMIN_SECRET</code> finns i körmiljön.
            </div>
          )}

          {/* Konversationer */}
          {!loading && !error && data?.available && tab === 'chats' && (
            <>
              {data.interactions.length === 0 && (
                <div style={{ color: 'var(--text-muted)' }}>
                  Inga konversationer sparade ännu. Kräver att besökaren godkänt cookie-bannern.
                </div>
              )}
              <div style={{ display: 'grid', gap: 10 }}>
                {data.interactions.map((row) => (
                  <article
                    key={row.interaction_id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      background: 'var(--surface-raised)',
                      overflow: 'hidden'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === row.interaction_id ? null : row.interaction_id)}
                      style={{
                        width: '100%',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto auto',
                        gap: 12,
                        alignItems: 'center',
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: 'var(--text)'
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.visitor_input}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {row.page_path ?? '—'}
                      </span>
                      {confidenceBadge(row.confidence_level)}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {fmt(row.created_at)}
                      </span>
                    </button>

                    {expanded === row.interaction_id && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: 16, display: 'grid', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>Besökarens fråga</div>
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{row.visitor_input}</p>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>Rådgivarens svar</div>
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{row.answer_text}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          <span>Typ: <strong style={{ color: 'var(--text)' }}>{row.answer_type ?? '—'}</strong></span>
                          <span>Tjänst: <strong style={{ color: 'var(--text)' }}>{row.recommended_service ?? '—'}</strong></span>
                          <span>Session: <code style={{ fontSize: 11 }}>{row.session_id ?? '—'}</code></span>
                          <span>ID: <code style={{ fontSize: 11 }}>{row.interaction_id}</code></span>
                        </div>
                        {row.recommendedPages.length > 0 && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {row.recommendedPages.map((p) => (
                              <span key={p.href} style={{ fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>
                                {p.label} → {p.href}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}

          {/* Leads */}
          {!loading && !error && data?.available && tab === 'leads' && (
            <>
              {data.leads.length === 0 && (
                <div style={{ color: 'var(--text-muted)' }}>Inga leads ännu.</div>
              )}
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-raised)', overflow: 'hidden' }}>
                {data.leads.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface)' }}>
                          {['Tid', 'Namn', 'E-post', 'Telefon', 'Företag', 'Uppföljning', 'Problem'].map((h) => (
                            <th key={h} style={{ textAlign: 'left', padding: 12, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.leads.map((lead) => (
                          <tr key={lead.lead_id} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: 12, fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(lead.created_at)}</td>
                            <td style={{ padding: 12, fontSize: 13, fontWeight: 600 }}>{lead.name}</td>
                            <td style={{ padding: 12, fontSize: 12 }}><a href={`mailto:${lead.email}`} style={{ color: 'inherit' }}>{lead.email}</a></td>
                            <td style={{ padding: 12, fontSize: 12 }}>{lead.phone ?? '—'}</td>
                            <td style={{ padding: 12, fontSize: 12 }}>{lead.company ?? '—'}</td>
                            <td style={{ padding: 12, fontSize: 12 }}>{lead.follow_up_preference ?? '—'}</td>
                            <td style={{ padding: 12, fontSize: 12, maxWidth: 320 }}>{lead.problem_summary}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
