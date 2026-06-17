import { useState, useEffect } from 'react'
import PlannerSidebar from '../components/shell/PlannerSidebar'
import PlannerTopbar from '../components/shell/PlannerTopbar'
import type { SearchDemandInsightsResult } from '../types/planner'

interface SeoCheckerPageProps {
  onNavigate: (path: string) => void
  theme: string
  onSetTheme: (t: string) => void
}

type Severity = 'critical' | 'warning' | 'info'

interface Finding {
  id: string
  severity: Severity
  category: string
  title: string
  summary: string
  evidence: string[]
  filePaths?: string[]
  url?: string
}

interface CrawledPage {
  url: string
  title?: string
  description?: string
  canonical?: string
  h1Count: number
  h1Text?: string
  h2Texts?: string[]
  robotsMeta?: string
  lang?: string
  internalLinks?: string[]
}

interface AnalyzeResult {
  sourceReport?: { findings: Finding[] }
  crawlReport?: { pages: CrawledPage[]; findings: Finding[] }
}

interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

const SV_STOP = new Set([
  'för','och','i','med','att','av','på','en','ett','som','är','det','de','den',
  'till','från','om','vi','du','kan','har','inte','men','eller','så','sig','var',
  'han','hon','dem','sin','sitt','sina','vid','mot','utan','över','under','efter',
  'innan','samt','dock','via','hos','ur','fram','bak','upp','ner',
])

function volBucket(v: string): number {
  if (v.includes('100K') || v.includes('1M')) return 6
  if (v.includes('10K')) return 5
  if (v === '1K – 10K' || v.includes('1K')) return 4
  if (v === '100 – 1K') return 3
  if (v === '10 – 100') return 2
  if (v === '0 – 10') return 1
  return 0
}

interface KwGap {
  query: string
  volume: string
  volScore: number
  competition: string | null
  action: 'create_page' | 'improve_title'
  targetPage: string | null
  currentTitle: string | null
  suggestedTitle: string | null
}

interface KwCannibal {
  query: string
  volume: string
  pages: string[]
}

function pagePathLower(page: CrawledPage): string {
  try { return new URL(page.url).pathname.toLowerCase() } catch { return page.url.toLowerCase() }
}

function scorePageForKeyword(page: CrawledPage, words: string[]) {
  const urlPath = pagePathLower(page)
  const title = (page.title ?? '').toLowerCase()
  const desc = (page.description ?? '').toLowerCase()
  return {
    urlMatches: words.filter(w => urlPath.includes(w)).length,
    titleMatches: words.filter(w => title.includes(w)).length,
    anyMatches: words.filter(w => urlPath.includes(w) || title.includes(w) || desc.includes(w)).length,
  }
}

function coversKeyword(score: ReturnType<typeof scorePageForKeyword>, words: string[]): boolean {
  // Full coverage: every topic word found somewhere on the page
  if (score.anyMatches >= words.length) return true
  // Strong URL signal + partial content match
  if (score.urlMatches >= 1 && score.anyMatches >= Math.ceil(words.length * 0.6)) return true
  return false
}

function buildSuggestedTitle(currentTitle: string | undefined, keyword: string): string {
  const brand = currentTitle?.match(/\|\s*(.+)$/)?.[1]?.trim() ?? 'Seb Castwall'
  const cap = keyword.charAt(0).toUpperCase() + keyword.slice(1)
  return `${cap} | ${brand}`
}

interface PageAction {
  priority: number // higher = more important
  label: string
  detail?: string
  suggested?: string
}

interface PriorityPage {
  url: string
  path: string
  title: string | null
  score: number
  actions: PageAction[]
  linkFrom: string[]   // paths that should link to this page
  linkTo: string[]     // paths this page should link to
}

function computePriorityPages(
  pages: CrawledPage[],
  keywords: { query: string; competition: string | null; demand_bucket: string; notes?: string }[],
  gaps: KwGap[],
  h1h2Issues: H1H2Issue[],
  orphans: OrphanPage[],
): PriorityPage[] {
  const indexedPages = pages.filter(p => { try { return new URL(p.url).pathname !== '/' } catch { return true } })
  const orphanPaths = new Set(orphans.map(o => o.path))

  // Build keyword topic words per page for link suggestion
  function pageTopicWords(page: CrawledPage): string[] {
    const text = [pagePathLower(page), (page.title ?? '').toLowerCase()].join(' ')
    return text.split(/[\s\-_/]+/).filter(w => w.length > 3 && !SV_STOP.has(w))
  }

  // Find best page to link FROM to a given path (shares most topic words)
  function bestLinkSource(targetPage: CrawledPage, allPages: CrawledPage[]): string[] {
    const targetWords = new Set(pageTopicWords(targetPage))
    return allPages
      .filter(p => p.url !== targetPage.url)
      .map(p => {
        const shared = pageTopicWords(p).filter(w => targetWords.has(w)).length
        return { path: (() => { try { return new URL(p.url).pathname } catch { return p.url } })(), shared }
      })
      .filter(x => x.shared >= 1)
      .sort((a, b) => b.shared - a.shared)
      .slice(0, 2)
      .map(x => x.path)
  }

  // Find pages this page should link TO (shares topic words but no existing link)
  function suggestLinksTo(page: CrawledPage, allPages: CrawledPage[]): string[] {
    const existing = new Set((page.internalLinks ?? []).map(l => l.replace(/\/$/, '')))
    const targetWords = new Set(pageTopicWords(page))
    return allPages
      .filter(p => p.url !== page.url)
      .map(p => {
        const pNorm = p.url.replace(/\/$/, '')
        if (existing.has(pNorm)) return null
        const shared = pageTopicWords(p).filter(w => targetWords.has(w)).length
        const path = (() => { try { return new URL(p.url).pathname } catch { return p.url } })()
        return shared >= 2 ? { path, shared } : null
      })
      .filter((x): x is { path: string; shared: number } => x !== null)
      .sort((a, b) => b.shared - a.shared)
      .slice(0, 2)
      .map(x => x.path)
  }

  const result: PriorityPage[] = []

  for (const page of indexedPages) {
    const path = (() => { try { return new URL(page.url).pathname } catch { return page.url } })()
    const actions: PageAction[] = []
    let score = 0

    // Missing description
    if (!page.description || page.description.trim().length < 50) {
      const len = page.description?.trim().length ?? 0
      actions.push({ priority: 3, label: 'Saknar meta description', detail: len ? `Bara ${len} tecken — sikt på 120–155` : 'Ingen description — Google genererar en automatiskt, sänker CTR' })
      score += 3
    }

    // H1/H2 issues for this page
    const pageH1H2 = h1h2Issues.filter(i => i.path === path)
    for (const iss of pageH1H2) {
      if (iss.type === 'missing_keyword_h1') {
        actions.push({ priority: 4, label: `H1 saknar "${iss.keyword}"`, detail: iss.currentH1 ? `Nu: "${iss.currentH1}"` : undefined, suggested: iss.suggestedH1 ?? undefined })
        score += 4
      } else if (iss.type === 'missing_h2') {
        actions.push({ priority: 2, label: `Inga H2-rubriker`, detail: `Lägg till H2 med "${iss.keyword}"` })
        score += 2
      } else {
        actions.push({ priority: 2, label: `H2:or saknar "${iss.keyword}"`, detail: `Befintliga: ${iss.h2Texts.slice(0, 2).join(' · ')}` })
        score += 2
      }
    }

    // Title gaps for this page
    const titleGaps = gaps.filter(g => g.action === 'improve_title' && g.targetPage === path)
    for (const g of titleGaps) {
      actions.push({ priority: 5, label: `Title saknar "${g.query}" (${g.volume})`, detail: g.currentTitle ? `Nu: "${g.currentTitle}"` : undefined, suggested: g.suggestedTitle ?? undefined })
      score += 5 + (g.volScore ?? 0)
    }

    // Orphan
    if (orphanPaths.has(path)) {
      actions.push({ priority: 3, label: 'Orphan-sida', detail: 'Ingen annan sida på sajten länkar hit' })
      score += 3
    }

    if (!actions.length) continue

    // Link suggestions
    const linkFrom = orphanPaths.has(path) ? bestLinkSource(page, indexedPages) : []
    const linkTo = suggestLinksTo(page, indexedPages)

    actions.sort((a, b) => b.priority - a.priority)
    result.push({ url: page.url, path, title: page.title ?? null, score, actions, linkFrom, linkTo })
  }

  return result.sort((a, b) => b.score - a.score).slice(0, 8)
}

interface H1H2Issue {
  url: string
  path: string
  type: 'missing_keyword_h1' | 'missing_keyword_h2' | 'missing_h2'
  keyword: string
  currentH1: string | null
  suggestedH1: string | null
  h2Texts: string[]
}

interface OrphanPage {
  url: string
  path: string
  title: string | null
}

function computeH1H2Issues(
  pages: CrawledPage[],
  keywords: { query: string; competition: string | null; demand_bucket: string; notes?: string }[]
): H1H2Issue[] {
  const issues: H1H2Issue[] = []
  const indexedPages = pages.filter(p => { try { return new URL(p.url).pathname !== '/' } catch { return true } })

  for (const kw of keywords) {
    const words = kw.query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !SV_STOP.has(w))
    if (!words.length) continue

    const scores = indexedPages.map(p => ({ page: p, ...scorePageForKeyword(p, words) }))
    const covering = scores.filter(s => coversKeyword(s, words))
    if (!covering.length) continue // handled by gap analysis

    const best = covering[0]
    const path = (() => { try { return new URL(best.page.url).pathname } catch { return best.page.url } })()
    const h1Lower = (best.page.h1Text ?? '').toLowerCase()
    const h2Lower = (best.page.h2Texts ?? []).map(h => h.toLowerCase())
    const h1HasKw = words.some(w => h1Lower.includes(w))
    const h2HasKw = h2Lower.some(h => words.some(w => h.includes(w)))

    if (!h1HasKw) {
      const cap = kw.query.charAt(0).toUpperCase() + kw.query.slice(1)
      issues.push({
        url: best.page.url, path, type: 'missing_keyword_h1',
        keyword: kw.query,
        currentH1: best.page.h1Text ?? null,
        suggestedH1: cap,
        h2Texts: best.page.h2Texts ?? [],
      })
    } else if (!h2HasKw && (best.page.h2Texts ?? []).length === 0) {
      issues.push({
        url: best.page.url, path, type: 'missing_h2',
        keyword: kw.query,
        currentH1: best.page.h1Text ?? null,
        suggestedH1: null,
        h2Texts: [],
      })
    } else if (!h2HasKw) {
      issues.push({
        url: best.page.url, path, type: 'missing_keyword_h2',
        keyword: kw.query,
        currentH1: best.page.h1Text ?? null,
        suggestedH1: null,
        h2Texts: best.page.h2Texts ?? [],
      })
    }
  }

  return issues
}

function computeOrphanPages(pages: CrawledPage[]): OrphanPage[] {
  const allInternalLinks = new Set(pages.flatMap(p => p.internalLinks ?? []).map(l => l.replace(/\/$/, '')))
  return pages
    .filter(p => {
      try {
        const path = new URL(p.url).pathname
        if (path === '/') return false // homepage is never orphan
      } catch { /**/ }
      const normalized = p.url.replace(/\/$/, '')
      return !allInternalLinks.has(normalized)
    })
    .map(p => ({
      url: p.url,
      path: (() => { try { return new URL(p.url).pathname } catch { return p.url } })(),
      title: p.title ?? null,
    }))
}

function computeKeywordGaps(
  pages: CrawledPage[],
  keywords: { query: string; competition: string | null; demand_bucket: string; notes?: string }[]
): { gaps: KwGap[]; cannibals: KwCannibal[] } {
  const gaps: KwGap[] = []
  const cannibals: KwCannibal[] = []

  // Exclude homepage duplicates
  const indexedPages = pages.filter(p => {
    try { return new URL(p.url).pathname !== '/' } catch { return true }
  })

  for (const kw of keywords) {
    const words = kw.query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !SV_STOP.has(w))
    if (!words.length) continue

    const volMatch = kw.notes?.match(/avg monthly searches "([^"]+)"/)
    const volume = volMatch ? volMatch[1] : kw.demand_bucket
    const volScore = volBucket(volume)

    const scores = indexedPages.map(p => ({ page: p, ...scorePageForKeyword(p, words) }))
    const covering = scores.filter(s => coversKeyword(s, words))

    if (covering.length >= 2) {
      cannibals.push({
        query: kw.query,
        volume,
        pages: covering.map(s => { try { return new URL(s.page.url).pathname } catch { return s.page.url } }),
      })
      continue
    }

    if (covering.length === 0) {
      gaps.push({ query: kw.query, volume, volScore, competition: kw.competition, action: 'create_page', targetPage: null, currentTitle: null, suggestedTitle: null })
    } else {
      const best = covering[0]
      if (best.titleMatches < words.length) {
        const path = (() => { try { return new URL(best.page.url).pathname } catch { return best.page.url } })()
        gaps.push({
          query: kw.query, volume, volScore, competition: kw.competition,
          action: 'improve_title',
          targetPage: path,
          currentTitle: best.page.title ?? null,
          suggestedTitle: buildSuggestedTitle(best.page.title, kw.query),
        })
      }
    }
  }

  gaps.sort((a, b) => b.volScore - a.volScore)
  return { gaps, cannibals }
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }
const SEV_COLOR: Record<Severity, string> = {
  critical: '#e05252',
  warning: '#d48a2a',
  info: '#4a90d9',
}
const SEV_BG: Record<Severity, string> = {
  critical: 'rgba(224,82,82,0.08)',
  warning: 'rgba(212,138,42,0.08)',
  info: 'rgba(74,144,217,0.08)',
}

function SeverityDot({ severity }: { severity: Severity }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 20, height: 20, borderRadius: '50%',
      background: SEV_BG[severity], flexShrink: 0,
      fontSize: 9, fontWeight: 800, color: SEV_COLOR[severity],
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {severity[0].toUpperCase()}
    </span>
  )
}

function FindingList({ title, findings }: { title: string; findings: Finding[] }) {
  if (!findings.length) return null
  const sorted = [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const critCount = findings.filter(f => f.severity === 'critical').length
  const warnCount = findings.filter(f => f.severity === 'warning').length

  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--planner-text)' }}>{title}</h3>
        <span style={{ fontSize: 11, color: 'var(--planner-text-muted)' }}>
          {critCount > 0 && <span style={{ color: SEV_COLOR.critical, fontWeight: 600 }}>{critCount} kritiska</span>}
          {critCount > 0 && warnCount > 0 && ' · '}
          {warnCount > 0 && <span style={{ color: SEV_COLOR.warning }}>{warnCount} varningar</span>}
          {critCount === 0 && warnCount === 0 && `${findings.length} info`}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map(f => (
          <div key={f.id} style={{
            display: 'grid', gridTemplateColumns: '20px 1fr', gap: '8px 10px',
            padding: '10px 12px', borderRadius: 8,
            background: 'var(--planner-surface-strong)', border: `1px solid var(--planner-border)`,
            borderLeft: `3px solid ${SEV_COLOR[f.severity]}`,
          }}>
            <SeverityDot severity={f.severity} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--planner-text)' }}>{f.title}</span>
                <span style={{ fontSize: 11, color: 'var(--planner-text-muted)', opacity: 0.7 }}>{f.category}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--planner-text-muted)', lineHeight: 1.5 }}>{f.summary}</div>
              {f.evidence.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {f.evidence.map((e, i) => (
                    <code key={i} style={{ fontSize: 11, color: 'var(--planner-text-muted)', background: 'var(--planner-surface)', padding: '1px 6px', borderRadius: 4, display: 'inline-block' }}>{e}</code>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  borderRadius: 6,
  border: '1px solid var(--planner-border)',
  background: 'var(--planner-surface)',
  color: 'var(--planner-text)',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--planner-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  display: 'block',
  marginBottom: 4,
}

export default function SeoCheckerPage({ onNavigate }: SeoCheckerPageProps) {
  const [signal, setSignal] = useState<'all' | 'follow_up' | 'avoidance' | 'high_priority'>('all')

  const [siteUrl, setSiteUrl] = useState('https://sebcastwall.se')
  const [repoName, setRepoName] = useState('sebcastwall')
  const [gscProperty, setGscProperty] = useState('sc-domain:sebcastwall.se')
  const [gscProperties, setGscProperties] = useState<{ siteUrl: string; permissionLevel: string }[]>([])
  const [keywords, setKeywords] = useState(
    () => localStorage.getItem('seo-checker:keywords') ?? 'ChatGPT för företag\nAI för småföretag\nbusiness-AI\nAI-kurs företag\nAI-workshop\nsystemintegration verktyg\nautomatisera arbetsflöden\ninterna verktyg företag\ndigitalisering småföretag\nkoppla ihop system'
  )

  const [runSource, setRunSource] = useState(true)
  const [runCrawl, setRunCrawl] = useState(true)
  const [runGsc, setRunGsc] = useState(true)

  const [gscConnected, setGscConnected] = useState<boolean | null>(null)

  function refreshGscStatus() {
    setGscConnected(null)
    fetch('/operatorhub-app/api/seo-checker/gsc/status')
      .then(r => r.json())
      .then(d => setGscConnected(d.connected === true))
      .catch(() => setGscConnected(false))
  }

  function gscPropertyToSiteUrl(prop: string): string {
    if (prop.startsWith('sc-domain:')) {
      return 'https://' + prop.replace('sc-domain:', '')
    }
    // URL-prefix property — strip trailing path if needed
    try { return new URL(prop).origin + '/' } catch { return prop }
  }

  function gscPropertyToRepo(prop: string): string {
    const domain = prop.startsWith('sc-domain:')
      ? prop.replace('sc-domain:', '')
      : (() => { try { return new URL(prop).hostname } catch { return prop } })()
    // Strip www. and TLD, return base name
    const base = domain.replace(/^www\./, '').split('.')[0]
    return base
  }

  function handleGscPropertySelect(prop: string) {
    setGscProperty(prop)
    setSiteUrl(gscPropertyToSiteUrl(prop))
    setRepoName(gscPropertyToRepo(prop))
  }

  useEffect(() => {
    refreshGscStatus()
    fetch('/operatorhub-app/api/seo-checker/gsc/properties')
      .then(r => r.json())
      .then(d => setGscProperties(d.properties ?? []))
      .catch(() => {})
    // Auto-load saved keyword results
    fetch(`/operatorhub-app/api/research/latest-result/${encodeURIComponent(repoName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setKeywordsResult(d) })
      .catch(() => {})
  }, [])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [gscRows, setGscRows] = useState<GscRow[] | null>(null)
  const [keywordsResult, setKeywordsResult] = useState<SearchDemandInsightsResult | null>(null)
  const [hasRun, setHasRun] = useState(false)
  const [readmeContent, setReadmeContent] = useState<string | null>(null)
  const [loadingReadme, setLoadingReadme] = useState(false)
  const [keywordRunStatus, setKeywordRunStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [keywordRunError, setKeywordRunError] = useState<string | null>(null)

  function handleWorkspaceChange(workspace: string) {
    const map: Record<string, string> = {
      dashboard: '/', daily: '/boards/daily', week: '/week', research: '/research',
      'bg-remover': '/bg-remover', articles: '/articles', 'seo-checker': '/seo-checker',
    }
    if (map[workspace]) onNavigate(map[workspace])
  }

  async function runKeywordAnalysis() {
    const kwList = keywords.split('\n').map(s => s.trim()).filter(Boolean)
    if (!kwList.length) { alert('Inga seed-sökord angivna'); return }
    setKeywordRunStatus('running')
    setKeywordRunError(null)
    setKeywordsResult(null)

    try {
      const res = await fetch('/operatorhub-app/api/research/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: repoName, keywords: kwList.join('\n') }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`)

      // Poll for completion
      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch(`/operatorhub-app/api/research/run-status/${encodeURIComponent(repoName)}`)
          const statusData = await statusRes.json()
          if (statusData.status === 'done') {
            clearInterval(poll)
            setKeywordRunStatus('done')
            const resultRes = await fetch(`/operatorhub-app/api/research/latest-result/${encodeURIComponent(repoName)}`)
            if (resultRes.ok) setKeywordsResult(await resultRes.json())
          } else if (statusData.status === 'error') {
            clearInterval(poll)
            setKeywordRunStatus('error')
            setKeywordRunError(statusData.error ?? 'Okänt fel')
          }
        } catch { /* continue polling */ }
      }, 4000)
    } catch (e) {
      setKeywordRunStatus('error')
      setKeywordRunError(e instanceof Error ? e.message : 'Okänt fel')
    }
  }

  async function runChecks() {
    if (!runSource && !runCrawl && !runGsc) return
    setBusy(true)
    setError(null)
    setAnalyzeResult(null)
    setGscRows(null)
    setHasRun(true)

    try {
      if (runSource || runCrawl) {
        const body: Record<string, unknown> = {
          runSourceAnalysis: runSource,
          runCrawlAnalysis: runCrawl,
        }
        if (runSource) {
          body.sourceTargetType = 'local'
          body.repoPath = `/workspace/${repoName}`
        }
        if (runCrawl) body.siteUrl = siteUrl
        const res = await fetch('/operatorhub-app/api/seo-checker/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(`Analyze failed: ${res.status}`)
        setAnalyzeResult(await res.json())
      }

      if (runGsc && gscProperty) {
        const res = await fetch('/operatorhub-app/api/seo-checker/gsc/search-analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl: gscProperty,
            startDate: new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10),
            endDate: new Date().toISOString().slice(0, 10),
            dimensions: ['page', 'query'],
            rowLimit: 50,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setGscRows(data.rows ?? [])
        }
      }

} catch (err) {
      setError(err instanceof Error ? err.message : 'Okänt fel')
    } finally {
      setBusy(false)
    }
  }

  const sourceFindings = analyzeResult?.sourceReport?.findings ?? []
  const crawlFindings = analyzeResult?.crawlReport?.findings ?? []
  const crawledPages = analyzeResult?.crawlReport?.pages ?? []
  const allFindings = [...sourceFindings, ...crawlFindings]
  const criticalCount = allFindings.filter(f => f.severity === 'critical').length

  const syncLabel = busy
    ? 'Analyserar...'
    : hasRun && allFindings.length > 0
      ? `${criticalCount > 0 ? `${criticalCount} kritiska · ` : ''}${allFindings.length} fynd`
      : hasRun ? 'Inga fynd' : null

  const modules = [
    { key: 'source', label: 'Källkod', checked: runSource, set: setRunSource },
    { key: 'crawl', label: 'Crawl', checked: runCrawl, set: setRunCrawl },
    { key: 'gsc', label: 'GSC', checked: runGsc, set: setRunGsc },
  ]

  return (
    <div className="planner-app-shell">
      <PlannerSidebar current="seo-checker" onNavigate={onNavigate} />
      <main className="planner-workspace">
        <PlannerTopbar
          title="SEO Checker"
          subtitle="Källkod · Crawl · GSC · Sökord"
          workspace="seo-checker"
          signal={signal}
          onWorkspaceChange={handleWorkspaceChange}
          onSignalChange={setSignal}
          syncStatusLabel={syncLabel}
        />

        <div style={{ padding: '24px', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Setup card */}
          <div style={{ borderRadius: 10, border: '1px solid var(--planner-border)', background: 'var(--planner-surface-strong)', overflow: 'hidden' }}>

            {/* Config row */}
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 16, borderBottom: '1px solid var(--planner-border)' }}>
              <div>
                <label style={labelStyle}>Sajt-URL</label>
                <input style={inputStyle} value={siteUrl} onChange={e => setSiteUrl(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Repo</label>
                <input style={inputStyle} value={repoName} onChange={e => setRepoName(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>GSC-egenskap</label>
                {gscProperties.filter(p => p.permissionLevel === 'siteOwner' || p.permissionLevel === 'siteFullUser').length > 0 ? (
                  <select
                    value={gscProperty}
                    onChange={e => handleGscPropertySelect(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">— välj egenskap —</option>
                    {gscProperties
                      .filter(p => p.permissionLevel === 'siteOwner' || p.permissionLevel === 'siteFullUser')
                      .map(p => (
                        <option key={p.siteUrl} value={p.siteUrl}>
                          {p.siteUrl.replace('sc-domain:', '')}
                        </option>
                      ))}
                  </select>
                ) : (
                  <input style={inputStyle} value={gscProperty} onChange={e => setGscProperty(e.target.value)} />
                )}
              </div>
            </div>

            {/* Module toggles + GSC status + run button */}
            <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {/* Modules */}
              <div style={{ display: 'flex', gap: 6 }}>
                {modules.map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => m.set(!m.checked)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      border: `1px solid ${m.checked ? 'var(--planner-accent)' : 'var(--planner-border)'}`,
                      background: m.checked ? 'var(--planner-accent)' : 'transparent',
                      color: m.checked ? '#fff' : 'var(--planner-text-muted)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.1s',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* GSC status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4, padding: '0 12px', borderLeft: '1px solid var(--planner-border)' }}>
                {gscConnected === null && <span style={{ fontSize: 12, color: 'var(--planner-text-muted)' }}>GSC…</span>}
                {gscConnected === true && <span style={{ fontSize: 12, color: '#52a05e', fontWeight: 600 }}>● GSC kopplat</span>}
                {gscConnected === false && (
                  <>
                    <span style={{ fontSize: 12, color: '#e05252', fontWeight: 600 }}>● GSC ej kopplat</span>
                    <a
                      href="http://127.0.0.1:3010/api/gsc/connect"
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: 'var(--planner-accent)', fontWeight: 600, textDecoration: 'none' }}
                    >
                      Koppla →
                    </a>
                  </>
                )}
                {gscConnected !== null && (
                  <button
                    type="button"
                    onClick={refreshGscStatus}
                    style={{ fontSize: 11, color: 'var(--planner-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                    title="Uppdatera GSC-status"
                  >
                    ↺
                  </button>
                )}
              </div>

              {/* Run button */}
              <button
                type="button"
                onClick={runChecks}
                disabled={busy || (!runSource && !runCrawl && !runGsc)}
                style={{
                  marginLeft: 'auto',
                  padding: '7px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: busy ? 'var(--planner-border)' : 'var(--planner-accent)',
                  color: busy ? 'var(--planner-text-muted)' : '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  transition: 'background 0.1s',
                }}
              >
                {busy ? 'Analyserar…' : 'Kör analys'}
              </button>
            </div>

            {/* Keywords section — always visible */}
            <div style={{ padding: '0 20px 16px', borderTop: '1px solid var(--planner-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 4 }}>
                <label style={{ ...labelStyle, margin: 0 }}>Seed-sökord (ett per rad)</label>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={async () => {
                      if (readmeContent !== null) { setReadmeContent(null); return }
                      setLoadingReadme(true)
                      try {
                        const res = await fetch(`/operatorhub-app/api/research/readme/${encodeURIComponent(repoName)}`)
                        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`)
                        const data = await res.json()
                        setReadmeContent(data.content ?? '')
                      } catch (e) {
                        alert(e instanceof Error ? e.message : 'Kunde inte hämta README')
                      } finally {
                        setLoadingReadme(false)
                      }
                    }}
                    disabled={loadingReadme}
                    style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--planner-border)', background: 'transparent', color: 'var(--planner-text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {loadingReadme ? 'Hämtar…' : readmeContent !== null ? 'Dölj README' : 'Visa README'}
                  </button>
                  <button
                    type="button"
                    onClick={runKeywordAnalysis}
                    disabled={keywordRunStatus === 'running'}
                    style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--planner-border)', background: 'transparent', color: 'var(--planner-accent)', fontSize: 11, fontWeight: 600, cursor: keywordRunStatus === 'running' ? 'not-allowed' : 'pointer' }}
                  >
                    {keywordRunStatus === 'running' ? 'Kör analys…' : 'Kör ny analys →'}
                  </button>
                </div>
              </div>
              <textarea
                value={keywords}
                onChange={e => { setKeywords(e.target.value); localStorage.setItem('seo-checker:keywords', e.target.value) }}
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
              {keywordRunStatus === 'running' && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--planner-text-muted)' }}>
                  Analyserar sökord via Google Keyword Planner… kan ta några minuter.
                </div>
              )}
              {keywordRunStatus === 'error' && keywordRunError && (
                <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: 'rgba(224,82,82,0.1)', border: '1px solid #e05252', color: '#e05252', fontSize: 12 }}>
                  {keywordRunError}
                </div>
              )}
              {readmeContent !== null && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--planner-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>README — {repoName}</div>
                  <textarea
                    readOnly
                    value={readmeContent}
                    rows={12}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 11, opacity: 0.85 }}
                    onFocus={e => e.target.select()}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(224,82,82,0.1)', border: '1px solid #e05252', color: '#e05252', fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Priority action list */}
          {analyzeResult && keywordsResult && crawledPages.length > 0 && (() => {
            const { gaps, cannibals: _c } = computeKeywordGaps(crawledPages, keywordsResult.keywords ?? [])
            const h1h2 = computeH1H2Issues(crawledPages, keywordsResult.keywords ?? [])
            const orphans = computeOrphanPages(crawledPages)
            const priorities = computePriorityPages(crawledPages, keywordsResult.keywords ?? [], gaps, h1h2, orphans)
            if (!priorities.length) return null
            return (
              <div style={{ borderRadius: 10, border: `1px solid var(--planner-border)`, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: 'var(--planner-surface-strong)', borderBottom: `1px solid var(--planner-border)`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--planner-text)' }}>Prioriterade åtgärder</span>
                  <span style={{ fontSize: 11, color: 'var(--planner-text-muted)' }}>{priorities.length} sidor · mest arbete först</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {priorities.map((pp, i) => (
                    <div key={pp.url} style={{ padding: '14px 16px', borderTop: i > 0 ? `1px solid var(--planner-border)` : undefined }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--planner-text-muted)', minWidth: 18 }}>{i + 1}.</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--planner-text)' }}>{pp.path}</span>
                        {pp.title && <span style={{ fontSize: 11, color: 'var(--planner-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pp.title}</span>}
                      </div>
                      <div style={{ paddingLeft: 28, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {pp.actions.map((a, j) => (
                          <div key={j} style={{ fontSize: 12 }}>
                            <span style={{ color: a.priority >= 4 ? SEV_COLOR.critical : SEV_COLOR.warning, fontWeight: 600, marginRight: 6 }}>→</span>
                            <span style={{ color: 'var(--planner-text)', fontWeight: 600 }}>{a.label}</span>
                            {a.detail && <span style={{ color: 'var(--planner-text-muted)', marginLeft: 6 }}>{a.detail}</span>}
                            {a.suggested && <span style={{ color: '#52a05e', fontWeight: 600, marginLeft: 6 }}>Förslag: {a.suggested}</span>}
                          </div>
                        ))}
                        {pp.linkFrom.length > 0 && (
                          <div style={{ fontSize: 12, marginTop: 2 }}>
                            <span style={{ color: SEV_COLOR.info, fontWeight: 600, marginRight: 6 }}>→</span>
                            <span style={{ color: 'var(--planner-text-muted)' }}>Länka hit från: </span>
                            {pp.linkFrom.map((lf, k) => <code key={k} style={{ fontSize: 11, background: 'var(--planner-surface)', padding: '1px 5px', borderRadius: 3, marginLeft: 4, color: 'var(--planner-text)' }}>{lf}</code>)}
                          </div>
                        )}
                        {pp.linkTo.length > 0 && (
                          <div style={{ fontSize: 12 }}>
                            <span style={{ color: SEV_COLOR.info, fontWeight: 600, marginRight: 6 }}>→</span>
                            <span style={{ color: 'var(--planner-text-muted)' }}>Länka till: </span>
                            {pp.linkTo.map((lt, k) => <code key={k} style={{ fontSize: 11, background: 'var(--planner-surface)', padding: '1px 5px', borderRadius: 3, marginLeft: 4, color: 'var(--planner-text)' }}>{lt}</code>)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Results */}
          {(analyzeResult || gscRows !== null || keywordsResult) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

              {analyzeResult && (
                <>
                  <FindingList title="Källkodsfynd" findings={sourceFindings} />
                  <FindingList title="Crawl-fynd" findings={crawlFindings} />

                  {crawledPages.length > 0 && (() => {
                    const orphans = computeOrphanPages(crawledPages)
                    return orphans.length > 0 ? (
                      <section style={{ marginBottom: 28 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--planner-text)' }}>Orphan-sidor</h3>
                          <span style={{ fontSize: 11, color: SEV_COLOR.warning, fontWeight: 600 }}>{orphans.length} sidor utan inkommande interna länkar</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {orphans.map(p => (
                            <div key={p.url} style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--planner-surface-strong)', border: `1px solid var(--planner-border)`, borderLeft: `3px solid ${SEV_COLOR.warning}`, fontSize: 12 }}>
                              <div style={{ fontWeight: 600, color: 'var(--planner-text)' }}>{p.path}</div>
                              {p.title && <div style={{ color: 'var(--planner-text-muted)', marginTop: 2 }}>{p.title}</div>}
                              <div style={{ color: 'var(--planner-text-muted)', marginTop: 2 }}>Ingen annan sida på sajten länkar hit — lägg till intern länk från en relevant sida</div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null
                  })()}

                  {crawledPages.length > 0 && (
                    <section>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--planner-text)' }}>Crawlade sidor</h3>
                        <span style={{ fontSize: 11, color: 'var(--planner-text-muted)' }}>{crawledPages.length} st</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {crawledPages.map(p => (
                          <div key={p.url} style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--planner-surface-strong)', border: '1px solid var(--planner-border)', fontSize: 12, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--planner-text)', marginBottom: 2, wordBreak: 'break-all' }}>{p.url}</div>
                              {p.title && <div style={{ color: 'var(--planner-text-muted)' }}>{p.title.slice(0, 80)}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
                              {p.h1Count !== 1 && <span style={{ color: SEV_COLOR.warning, fontWeight: 600 }}>H1:{p.h1Count}</span>}
                              {!p.canonical && <span style={{ color: SEV_COLOR.warning }}>no canonical</span>}
                              {p.robotsMeta && p.robotsMeta !== 'index,follow' && <span style={{ color: SEV_COLOR.warning }}>{p.robotsMeta}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}

              {gscRows !== null && (
                <section>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--planner-text)' }}>Google Search Console</h3>
                    <span style={{ fontSize: 11, color: 'var(--planner-text-muted)' }}>senaste 28 dagarna</span>
                  </div>
                  {gscRows.length === 0 ? (
                    <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--planner-surface-strong)', border: '1px solid var(--planner-border)', fontSize: 13, color: 'var(--planner-text-muted)' }}>
                      Inga rader — kontrollera att GSC-egenskapen stämmer.
                    </div>
                  ) : (
                    <div style={{ borderRadius: 8, border: '1px solid var(--planner-border)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'var(--planner-surface-strong)', color: 'var(--planner-text-muted)', textAlign: 'left' }}>
                            <th style={{ padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--planner-border)' }}>Sida</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--planner-border)' }}>Sökord</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid var(--planner-border)' }}>Klick</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid var(--planner-border)' }}>Visn.</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid var(--planner-border)' }}>Pos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gscRows.slice(0, 30).map((row, i) => (
                            <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--planner-border)' : undefined }}>
                              <td style={{ padding: '7px 12px', color: 'var(--planner-text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{row.keys[0]}</td>
                              <td style={{ padding: '7px 12px', color: 'var(--planner-text)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.keys[1]}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--planner-text)' }}>{row.clicks}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--planner-text-muted)' }}>{row.impressions}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, color: row.position <= 10 ? '#52a05e' : row.position <= 20 ? SEV_COLOR.warning : 'var(--planner-text-muted)' }}>
                                {row.position.toFixed(1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {keywordsResult && (
                <section>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--planner-text)' }}>Sökordanalys</h3>
                    <span style={{ fontSize: 11, color: 'var(--planner-text-muted)' }}>
                      {keywordsResult.generated_at ? new Date(keywordsResult.generated_at).toLocaleDateString('sv-SE') : ''}
                    </span>
                  </div>

                  {/* Keywords table */}
                  {keywordsResult.keywords?.length > 0 && (
                    <div style={{ borderRadius: 8, border: '1px solid var(--planner-border)', overflow: 'hidden', marginBottom: 16 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'var(--planner-surface-strong)', color: 'var(--planner-text-muted)', textAlign: 'left' }}>
                            <th style={{ padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--planner-border)' }}>Sökord</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--planner-border)' }}>Källa</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--planner-border)' }}>Konkurrens</th>
                            <th style={{ padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--planner-border)' }}>Volym</th>
                          </tr>
                        </thead>
                        <tbody>
                          {keywordsResult.keywords.map((kw: { query: string; source: string; competition: string | null; demand_bucket: string; notes?: string }, i: number) => {
                            const volMatch = kw.notes?.match(/avg monthly searches "([^"]+)"/)
                            const vol = volMatch ? volMatch[1] : kw.demand_bucket
                            return (
                              <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--planner-border)' : undefined }}>
                                <td style={{ padding: '7px 12px', fontWeight: 600, color: 'var(--planner-text)' }}>{kw.query}</td>
                                <td style={{ padding: '7px 12px', color: 'var(--planner-text-muted)', fontSize: 11 }}>{kw.source.replace('google_', '')}</td>
                                <td style={{ padding: '7px 12px', color: kw.competition === 'low' ? '#52a05e' : kw.competition === 'high' ? '#e05252' : 'var(--planner-text-muted)' }}>
                                  {kw.competition ?? '—'}
                                </td>
                                <td style={{ padding: '7px 12px', color: 'var(--planner-text-muted)' }}>{vol}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Keyword gap analysis */}
                  {crawledPages.length > 0 && keywordsResult.keywords?.length > 0 && (() => {
                    const { gaps, cannibals } = computeKeywordGaps(crawledPages, keywordsResult.keywords)
                    const creates = gaps.filter(g => g.action === 'create_page')
                    const improves = gaps.filter(g => g.action === 'improve_title')
                    const missingDesc = crawledPages.filter(p => {
                      try { if (new URL(p.url).pathname === '/') return false } catch { /**/ }
                      return !p.description || p.description.trim().length < 50
                    })
                    if (!gaps.length && !cannibals.length && !missingDesc.length) return null

                    const GapRow = ({ g }: { g: KwGap }) => (
                      <div style={{ padding: '10px 12px', borderRadius: 6, background: 'var(--planner-surface-strong)', border: `1px solid var(--planner-border)`, borderLeft: `3px solid ${g.action === 'create_page' ? SEV_COLOR.critical : SEV_COLOR.warning}`, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ fontWeight: 700, color: 'var(--planner-text)' }}>{g.query}</div>
                          <span style={{ fontSize: 11, color: 'var(--planner-text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{g.volume}{g.competition === 'low' ? ' · low comp' : g.competition === 'medium' ? ' · mid comp' : ''}</span>
                        </div>
                        {g.action === 'create_page' && (
                          <div style={{ marginTop: 3, color: 'var(--planner-text-muted)' }}>Ingen sida targetas mot detta sökord — skapa en dedikerad sida</div>
                        )}
                        {g.action === 'improve_title' && g.targetPage && (
                          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ color: 'var(--planner-text-muted)' }}>Sida: <code style={{ fontSize: 11, background: 'var(--planner-surface)', padding: '1px 5px', borderRadius: 3 }}>{g.targetPage}</code></div>
                            {g.currentTitle && <div style={{ color: 'var(--planner-text-muted)' }}>Nu: <span style={{ color: SEV_COLOR.warning }}>{g.currentTitle}</span></div>}
                            {g.suggestedTitle && <div style={{ color: 'var(--planner-text-muted)' }}>Förslag: <span style={{ color: '#52a05e', fontWeight: 600 }}>{g.suggestedTitle}</span></div>}
                          </div>
                        )}
                      </div>
                    )

                    return (
                      <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {creates.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: SEV_COLOR.critical, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saknade sidor ({creates.length}) — sorterat efter volym</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {creates.map((g, i) => <GapRow key={i} g={g} />)}
                            </div>
                          </div>
                        )}
                        {improves.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: SEV_COLOR.warning, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Förbättra titlar ({improves.length})</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {improves.map((g, i) => <GapRow key={i} g={g} />)}
                            </div>
                          </div>
                        )}
                        {missingDesc.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: SEV_COLOR.warning, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saknar meta-description ({missingDesc.length})</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {missingDesc.map((p, i) => {
                                const path = (() => { try { return new URL(p.url).pathname } catch { return p.url } })()
                                return (
                                  <div key={i} style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--planner-surface-strong)', border: `1px solid var(--planner-border)`, borderLeft: `3px solid ${SEV_COLOR.warning}`, fontSize: 12 }}>
                                    <div style={{ fontWeight: 600, color: 'var(--planner-text)' }}>{path}</div>
                                    <div style={{ color: 'var(--planner-text-muted)', marginTop: 2 }}>{p.description ? `För kort (${p.description.length} tecken) — sikt på 120–155` : 'Ingen description satt — Google genererar en automatiskt vilket sänker CTR'}</div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {cannibals.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: SEV_COLOR.info, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kannibalisering ({cannibals.length})</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {cannibals.map((c, i) => (
                                <div key={i} style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--planner-surface-strong)', border: `1px solid var(--planner-border)`, borderLeft: `3px solid ${SEV_COLOR.info}`, fontSize: 12 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--planner-text)' }}>{c.query}</span>
                                    <span style={{ fontSize: 11, color: 'var(--planner-text-muted)' }}>{c.volume}</span>
                                  </div>
                                  <div style={{ marginTop: 3, color: 'var(--planner-text-muted)' }}>Flera sidor konkurrerar: {c.pages.join(' · ')}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* H1/H2 issues */}
                  {crawledPages.length > 0 && keywordsResult.keywords?.length > 0 && (() => {
                    const issues = computeH1H2Issues(crawledPages, keywordsResult.keywords)
                    if (!issues.length) return null
                    return (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: SEV_COLOR.warning, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>H1/H2-struktur ({issues.length})</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {issues.map((iss, i) => (
                            <div key={i} style={{ padding: '10px 12px', borderRadius: 6, background: 'var(--planner-surface-strong)', border: `1px solid var(--planner-border)`, borderLeft: `3px solid ${SEV_COLOR.warning}`, fontSize: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontWeight: 700, color: 'var(--planner-text)' }}>{iss.path}</span>
                                <span style={{ fontSize: 11, color: 'var(--planner-text-muted)' }}>keyword: {iss.keyword}</span>
                              </div>
                              {iss.type === 'missing_keyword_h1' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ color: 'var(--planner-text-muted)' }}>H1 saknar keyword</span>
                                  {iss.currentH1 && <span style={{ color: 'var(--planner-text-muted)' }}>Nu: <span style={{ color: SEV_COLOR.warning }}>{iss.currentH1}</span></span>}
                                  {iss.suggestedH1 && <span style={{ color: 'var(--planner-text-muted)' }}>Förslag: <span style={{ color: '#52a05e', fontWeight: 600 }}>{iss.suggestedH1}</span></span>}
                                </div>
                              )}
                              {iss.type === 'missing_h2' && (
                                <span style={{ color: 'var(--planner-text-muted)' }}>Sidan har inga H2-rubriker — lägg till minst en H2 som innehåller "{iss.keyword}"</span>
                              )}
                              {iss.type === 'missing_keyword_h2' && (
                                <div>
                                  <span style={{ color: 'var(--planner-text-muted)' }}>Ingen H2 innehåller keyword. Befintliga H2:or: </span>
                                  <span style={{ color: 'var(--planner-text-muted)', fontStyle: 'italic' }}>{iss.h2Texts.slice(0, 3).join(' · ')}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Service angles */}
                  {keywordsResult.service_angles?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--planner-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Innehållsvinklar</div>
                      {keywordsResult.service_angles.map((a: { angle: string; rationale: string }, i: number) => (
                        <div key={i} style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--planner-surface-strong)', border: '1px solid var(--planner-border)', fontSize: 12 }}>
                          <div style={{ fontWeight: 600, color: 'var(--planner-text)', marginBottom: 2 }}>{a.angle}</div>
                          <div style={{ color: 'var(--planner-text-muted)' }}>{a.rationale}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

            </div>
          )}

          {busy && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--planner-text-muted)', fontSize: 13 }}>
              Kör analys…
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
