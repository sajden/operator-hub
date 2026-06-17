import { useMemo, useState, type CSSProperties } from 'react'
import PlannerSidebar from '../components/shell/PlannerSidebar'

interface ArticlesPageProps {
  onNavigate: (path: string) => void
  theme: string
  onSetTheme: (t: string) => void
}

const SEO_HUB_PATH = '/api/seo-hub/ui/'

export default function ArticlesPage({ onNavigate, theme, onSetTheme }: ArticlesPageProps) {
  const [frameKey, setFrameKey] = useState(0)
  const frameUrl = useMemo(() => `${SEO_HUB_PATH}${SEO_HUB_PATH.includes('?') ? '&' : '?'}refresh=${frameKey}`, [frameKey])

  return (
    <div className="planner-app-shell" data-theme={theme}>
      <PlannerSidebar current="articles" onNavigate={onNavigate} />
      <main className="planner-workspace">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px 14px',
            borderBottom: '1px solid var(--border)',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'grid', gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>SEO Artiklar</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
              Den här vyn går nu via <code>seo-hub</code> genom <code>operator-hub</code>, på samma sätt som
              andra separata verktyg i stacken. Utkast, granskning, publicering och schemaläggning kommer
              från <code>seo-hub</code>, inte från gamla <code>operator-hub/.local/seo-drafts</code>.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={theme === 'light' ? 'planner-nav-active' : ''}
              onClick={() => onSetTheme('light')}
            >
              Light
            </button>
            <button
              type="button"
              className={theme === 'dark' ? 'planner-nav-active' : ''}
              onClick={() => onSetTheme('dark')}
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => setFrameKey((value) => value + 1)}
              style={secondaryButtonStyle}
            >
              Ladda om
            </button>
            <a
              href={SEO_HUB_PATH}
              rel="noreferrer"
              target="_blank"
              style={primaryLinkStyle}
            >
              Öppna seo-hub
            </a>
          </div>
        </div>

        <div style={{ padding: '16px 24px', display: 'grid', gap: 12 }}>
          <div
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'grid',
              gap: 6,
            }}
          >
            <strong style={{ fontSize: 13 }}>Om sidan är tom</strong>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
              Starta stacken med <code>docker compose up --build</code> i <code>operator-hub</code>. Då ska
              <code> seo-hub</code> starta som service i samma stack och proxas in via
              <code> /api/seo-hub/ui</code>.
            </p>
          </div>

          <div
            style={{
              minHeight: 'calc(100vh - 220px)',
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              background: '#fff',
              boxShadow: '0 12px 28px rgba(16, 32, 39, 0.06)',
            }}
          >
            <iframe
              key={frameKey}
              src={frameUrl}
              title="SEO Hub"
              style={{ width: '100%', height: 'calc(100vh - 220px)', border: 0, background: '#fff' }}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

const secondaryButtonStyle: CSSProperties = {
  background: 'var(--surface-raised)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const primaryLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 36,
  padding: '0 14px',
  borderRadius: 8,
  background: '#1a4fa8',
  color: '#fff',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 600,
}
