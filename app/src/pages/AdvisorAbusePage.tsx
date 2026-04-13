import { useEffect, useState } from 'react'
import PlannerSidebar from '../components/shell/PlannerSidebar'

type AbuseSnapshot = {
  available: boolean
  summary: {
    blockedLast24h: number
    blockedLast7d: number
    allowedLast24h: number
    uniqueBlockedIpsLast7d: number
  } | null
  blocked: Array<{
    created_at: string
    ip_address: string
    session_id: string | null
    reason: string | null
    page_path: string | null
    input_chars: number
    user_agent: string | null
    retry_after_seconds: number | null
  }>
  topIps: Array<{
    ipAddress: string
    blockedCount: number
  }>
}

interface AdvisorAbusePageProps {
  onNavigate: (path: string) => void
  theme: string
  onSetTheme: (t: string) => void
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('sv-SE')
}

function cardStyle(accent: string): React.CSSProperties {
  return {
    border: '1px solid var(--border)',
    background: 'var(--surface-raised)',
    borderRadius: 12,
    padding: 16,
    display: 'grid',
    gap: 6,
    boxShadow: `inset 0 0 0 1px ${accent}22`,
  }
}

export default function AdvisorAbusePage({ onNavigate, theme, onSetTheme }: AdvisorAbusePageProps) {
  const [data, setData] = useState<AbuseSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadSnapshot() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/advisor-abuse')
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error ?? 'Kunde inte läsa advisor abuse-data')
      }
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Okänt fel')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSnapshot()
  }, [])

  return (
    <div className="planner-app-shell" data-theme={theme}>
      <PlannerSidebar current="advisor-abuse" onNavigate={onNavigate} />
      <main className="planner-workspace">
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: 56, borderBottom: '1px solid var(--border)', gap: 12, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Advisor Abuse</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" onClick={loadSnapshot} style={{ background: '#1a4fa8', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Uppdatera
            </button>
            <button type="button" className={theme === 'light' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('light')}>Light</button>
            <button type="button" className={theme === 'dark' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('dark')}>Dark</button>
          </div>
        </div>

        <div style={{ padding: 24, display: 'grid', gap: 20 }}>
          {loading && <div style={{ color: 'var(--text-muted)' }}>Laddar advisor abuse-data…</div>}
          {error && <div style={{ color: '#a03030', fontWeight: 600 }}>{error}</div>}

          {!loading && !error && data && !data.available && (
            <div style={{ color: 'var(--text-muted)' }}>
              Ingen advisor abuse-data tillgänglig ännu. Kontrollera att `AI_ADVISOR_DB` och `AI_ADVISOR_ADMIN_SECRET` finns i körmiljön.
            </div>
          )}

          {!loading && !error && data?.available && data.summary && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
                <div style={cardStyle('#a03030')}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Blockerade 24h</span>
                  <strong style={{ fontSize: 28 }}>{data.summary.blockedLast24h}</strong>
                </div>
                <div style={cardStyle('#7a3cff')}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Blockerade 7d</span>
                  <strong style={{ fontSize: 28 }}>{data.summary.blockedLast7d}</strong>
                </div>
                <div style={cardStyle('#1a7a3c')}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Tillåtna 24h</span>
                  <strong style={{ fontSize: 28 }}>{data.summary.allowedLast24h}</strong>
                </div>
                <div style={cardStyle('#1a4fa8')}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Unika blockerade IP 7d</span>
                  <strong style={{ fontSize: 28 }}>{data.summary.uniqueBlockedIpsLast7d}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 20 }}>
                <section style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-raised)', padding: 16, display: 'grid', gap: 12, alignSelf: 'start' }}>
                  <h3 style={{ margin: 0, fontSize: 14 }}>Värsta IP-adresser</h3>
                  {data.topIps.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Inga blockerade IP-adresser ännu.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {data.topIps.map((row) => (
                        <div key={row.ipAddress} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                          <code>{row.ipAddress}</code>
                          <strong>{row.blockedCount}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-raised)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
                    Senaste blockerade requests
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface)' }}>
                          <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Tid</th>
                          <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>IP</th>
                          <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Orsak</th>
                          <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Sida</th>
                          <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Session</th>
                          <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Tecken</th>
                          <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Retry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.blocked.map((row) => (
                          <tr key={`${row.created_at}-${row.ip_address}-${row.session_id ?? 'none'}`} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: 12, fontSize: 12 }}>{fmt(row.created_at)}</td>
                            <td style={{ padding: 12, fontSize: 12 }}><code>{row.ip_address}</code></td>
                            <td style={{ padding: 12, fontSize: 12 }}>{row.reason ?? 'okänd'}</td>
                            <td style={{ padding: 12, fontSize: 12 }}>{row.page_path ?? '-'}</td>
                            <td style={{ padding: 12, fontSize: 12 }}><code>{row.session_id ?? '-'}</code></td>
                            <td style={{ padding: 12, fontSize: 12 }}>{row.input_chars}</td>
                            <td style={{ padding: 12, fontSize: 12 }}>{row.retry_after_seconds ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
