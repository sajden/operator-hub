import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const researchRoot = path.resolve(repoRoot, '.local/research/search-demand')
const sessionRoot = path.resolve(repoRoot, '.local/browser-sessions')
const workerDir = path.resolve(repoRoot, 'workers/search-demand-capture')

const DEFAULT_SOURCES = ['google_keyword_planner', 'google_trends']
const ALLOWED_SOURCES = new Set(DEFAULT_SOURCES)
const MAX_SEED_QUERIES = 20
const MAX_QUERY_LENGTH = 120
const KEYWORD_PLANNER_BATCH_SIZE = 8
const DEFAULT_WIDTH = 1440
const DEFAULT_HEIGHT = 1600
const DEFAULT_WAIT_MS = 8000
const DEFAULT_HELPER_HEALTH_TIMEOUT_MS = 2500
const DEFAULT_HELPER_CAPTURE_TIMEOUT_MS = 600000
const sessionQueues = new Map()

function nowIso() {
  return new Date().toISOString()
}

function sha(input) {
  return createHash('sha256').update(input).digest('hex')
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function relativeLocalPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/')
}

function conciseErrorMessage(error) {
  const raw = error instanceof Error ? error.message : String(error)
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean)
  const explicit = lines.find(
    (line) =>
      !line.startsWith('at ') &&
      !line.startsWith('file:') &&
      !line.startsWith('Node.js') &&
      line !== 'Error:' &&
      !line.startsWith('throw new Error')
  )
  const fallback = lines.find((line) => line.includes('Error: ')) ?? lines[0] ?? ''
  return (
    fallback.replace(/^Error:\s*/, '').replace(/^.*Error:\s*/, '') ||
    explicit?.replace(/^Error:\s*/, '') ||
    'Unknown error'
  )
}

async function writeJson(filePath, payload) {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}

function readJsonSafe(raw, fallback) {
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function ensureHttpUrl(value) {
  try {
    const url = new URL(String(value))
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url
  } catch {
    return null
  }
}

async function fetchJsonWithTimeout(url, init = {}, timeoutMs = 4000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    })
    const raw = await response.text()
    return {
      ok: response.ok,
      status: response.status,
      payload: readJsonSafe(raw, null),
      raw
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function withSessionQueue(queueKey, work) {
  const previous = sessionQueues.get(queueKey) ?? Promise.resolve()
  let releaseCurrent
  const current = new Promise((resolve) => {
    releaseCurrent = resolve
  })
  const tail = previous.then(() => current)

  sessionQueues.set(queueKey, tail)

  await previous

  try {
    return await work()
  } finally {
    releaseCurrent()
    if (sessionQueues.get(queueKey) === tail) {
      sessionQueues.delete(queueKey)
    }
  }
}

function normalizeInput(input) {
  const project_slug = slugify(input?.project_slug ?? input?.projectSlug)
  if (!project_slug) {
    throw new Error('capture_search_demand_insights requires project_slug')
  }

  const rawSeedQueries = Array.isArray(input?.seed_queries ?? input?.seedQueries)
    ? input.seed_queries ?? input.seedQueries
    : []
  const seed_queries = rawSeedQueries
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .slice(0, MAX_SEED_QUERIES)
    .map((value) => value.slice(0, MAX_QUERY_LENGTH))

  if (seed_queries.length === 0) {
    throw new Error('capture_search_demand_insights requires seed_queries[]')
  }

  const rawSources = Array.isArray(input?.sources) && input.sources.length > 0 ? input.sources : DEFAULT_SOURCES
  const sources = rawSources.map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean)
  const invalidSources = sources.filter((value) => !ALLOWED_SOURCES.has(value))
  if (invalidSources.length > 0) {
    throw new Error(`capture_search_demand_insights received unsupported sources: ${invalidSources.join(', ')}`)
  }

  return {
    project_slug,
    seed_queries,
    market: String(input?.market ?? '').trim() || 'SE',
    language: String(input?.language ?? '').trim() || 'en',
    sources,
    mode: String(input?.mode ?? '').trim().toLowerCase() === 'manual' ? 'manual' : 'background',
    session_hint: String(input?.session_hint ?? input?.sessionHint ?? '').trim() || null,
    notes: String(input?.notes ?? '').trim() || null
  }
}

async function ensureRunDirs(projectSlug, runId) {
  const projectDir = path.resolve(researchRoot, projectSlug)
  const runDir = path.resolve(projectDir, runId)
  const screenshotsDir = path.resolve(runDir, 'screenshots')
  const rawDir = path.resolve(runDir, 'raw')

  await mkdir(screenshotsDir, { recursive: true })
  await mkdir(rawDir, { recursive: true })

  return {
    projectDir,
    runDir,
    screenshotsDir,
    rawDir
  }
}

async function appendManifest(projectDir, manifestEntry) {
  const manifestPath = path.resolve(projectDir, 'manifest.json')
  let manifest = { generatedAt: nowIso(), runs: [] }
  if (existsSync(manifestPath)) {
    manifest = readJsonSafe(await readFile(manifestPath, 'utf-8'), manifest)
  }

  const nextRuns = Array.isArray(manifest.runs)
    ? manifest.runs.filter((entry) => entry.run_id !== manifestEntry.run_id)
    : []
  nextRuns.push(manifestEntry)
  manifest.generatedAt = nowIso()
  manifest.runs = nextRuns

  await writeJson(manifestPath, manifest)
}

async function resolveSession(sessionHint) {
  if (!sessionHint) {
    return {
      ok: false,
      hint: null,
      available: false,
      reason: 'No session_hint provided',
      dedicatedResearchProfile: false,
      browserCommand: process.env.OPERATOR_HUB_RESEARCH_BROWSER?.trim() || null,
      remoteDebuggingUrl: process.env.OPERATOR_HUB_RESEARCH_REMOTE_DEBUGGING_URL?.trim() || null,
      userDataDir: null,
      profileDirectory: null,
      sources: {}
    }
  }

  const sessionId = slugify(sessionHint)
  const sessionPath = path.resolve(sessionRoot, sessionId, 'session.json')
  if (!existsSync(sessionPath)) {
    return {
      ok: false,
      hint: sessionId,
      available: false,
      reason: `Session manifest not found at ${relativeLocalPath(sessionPath)}`,
      dedicatedResearchProfile: false,
      browserCommand: process.env.OPERATOR_HUB_RESEARCH_BROWSER?.trim() || null,
      remoteDebuggingUrl: process.env.OPERATOR_HUB_RESEARCH_REMOTE_DEBUGGING_URL?.trim() || null,
      userDataDir: null,
      profileDirectory: null,
      sources: {}
    }
  }

  const raw = readJsonSafe(await readFile(sessionPath, 'utf-8'), {})
  const browserCommand = String(raw.browserCommand ?? process.env.OPERATOR_HUB_RESEARCH_BROWSER ?? '').trim() || null
  const remoteDebuggingUrl = String(
    raw.remoteDebuggingUrl ?? process.env.OPERATOR_HUB_RESEARCH_REMOTE_DEBUGGING_URL ?? ''
  ).trim() || null
  const helperUrl = String(raw.helperUrl ?? process.env.OPERATOR_HUB_RESEARCH_HELPER_URL ?? '').trim() || null
  const userDataDir = String(raw.userDataDir ?? '').trim() || null
  const profileDirectory = String(raw.profileDirectory ?? '').trim() || null
  const preferredAccountText = String(raw.preferredAccountText ?? '').trim() || null
  const dedicatedResearchProfile = raw.dedicatedResearchProfile === true
  const sources = raw.sources && typeof raw.sources === 'object' ? raw.sources : {}

  return {
    ok: Boolean(helperUrl || remoteDebuggingUrl || browserCommand || userDataDir),
    hint: sessionId,
    available: true,
    browserCommand,
    remoteDebuggingUrl,
    helperUrl,
    userDataDir,
    profileDirectory,
    preferredAccountText,
    dedicatedResearchProfile,
    sources,
    manifestPath: relativeLocalPath(sessionPath)
  }
}

function buildSourceUrl(source, query, market, language, session) {
  const sourceConfig = session?.sources?.[source] ?? {}
  const queryEncoded = encodeURIComponent(query)
  const marketEncoded = encodeURIComponent(market)
  const languageEncoded = encodeURIComponent(language)
  const template = String(sourceConfig.seedUrlTemplate ?? '').trim()

  if (template) {
    return template
      .replaceAll('{query}', queryEncoded)
      .replaceAll('{market}', marketEncoded)
      .replaceAll('{language}', languageEncoded)
  }

  if (source === 'google_trends') {
    return `https://trends.google.com/trends/explore?geo=${marketEncoded}&hl=${languageEncoded}&q=${queryEncoded}`
  }

  if (source === 'google_keyword_planner') {
    return 'https://ads.google.com/aw/keywordplanner/home'
  }

  throw new Error(`Unsupported research source: ${source}`)
}

function stripHtmlToLines(html) {
  const withoutScripts = String(html ?? '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gis, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gis, ' ')
  const withoutTags = withoutScripts
    .replace(/<\/(div|section|article|li|tr|h\d|p|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  const lines = withoutTags
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const unique = []
  const seen = new Set()
  for (const line of lines) {
    if (seen.has(line)) continue
    seen.add(line)
    unique.push(line)
  }
  return unique
}

function collectNearbyLines(lines, needle, radius = 3) {
  const loweredNeedle = String(needle).toLowerCase()
  const matches = []
  lines.forEach((line, index) => {
    if (!line.toLowerCase().includes(loweredNeedle)) return
    const start = Math.max(0, index - radius)
    const end = Math.min(lines.length, index + radius + 1)
    matches.push(...lines.slice(start, end))
  })
  return [...new Set(matches)]
}

function chunkArray(values, size) {
  const chunks = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

function buildSourceSeedInputs(source, seedQueries) {
  if (source === 'google_keyword_planner') {
    return chunkArray(seedQueries, KEYWORD_PLANNER_BATCH_SIZE).map((batch) => ({
      label: batch.join(' | '),
      input: batch.join('\n'),
      representativeSeed: batch[0] ?? ''
    }))
  }

  return seedQueries.map((seed) => ({
    label: seed,
    input: seed,
    representativeSeed: seed
  }))
}

function extractHtmlBetween(html, startMarker, endMarker) {
  const raw = String(html ?? '')
  const startIndex = raw.indexOf(startMarker)
  if (startIndex === -1) return ''
  const fromStart = raw.slice(startIndex)
  const endIndex = endMarker ? fromStart.indexOf(endMarker) : -1
  return endIndex === -1 ? fromStart : fromStart.slice(0, endIndex)
}

const GENERIC_TRENDS_NOISE = new Set([
  'clear',
  'edit',
  'explore',
  'feedback',
  'help',
  'home',
  'remove',
  'search it',
  'search term',
  'share',
  'trending now',
  'trends',
  'google trends',
  'related topics',
  'related queries',
  'interest over time'
])

function isLikelyGenericTrendsUiLine(line, seedQuery) {
  const normalized = String(line ?? '').trim()
  const lowered = normalized.toLowerCase()
  if (!normalized) return true
  if (lowered === String(seedQuery ?? '').trim().toLowerCase()) return true
  if (GENERIC_TRENDS_NOISE.has(lowered)) return true
  if (/^(help|share|feedback|clear|edit|remove)$/i.test(normalized)) return true
  if (/^(past \d+ (hours|days|months|years)|worldwide|web search|all categories)$/i.test(normalized)) return true
  if (/^(google|maps|news|images|shopping|youtube)$/i.test(normalized)) return true
  if (/^(sign in|settings|privacy|terms)$/i.test(normalized)) return true
  return false
}

function isLikelyTrendsMetricLine(line) {
  return /breakout|\+\d{1,3}%/i.test(String(line ?? '').trim())
}

function bucketDemandFromText(text) {
  const value = String(text ?? '').toLowerCase()
  if (value.includes('breakout')) return 'breakout'
  const pctMatch = value.match(/(\d{1,3})%/)
  if (pctMatch) {
    const pct = Number(pctMatch[1])
    if (pct >= 80) return 'very_high'
    if (pct >= 50) return 'high'
    if (pct >= 20) return 'medium'
    return 'low'
  }
  if (value.includes('high')) return 'high'
  if (value.includes('medium')) return 'medium'
  if (value.includes('low')) return 'low'
  return 'unknown'
}

function competitionFromText(text) {
  const value = String(text ?? '').toLowerCase()
  if (value.includes('high')) return 'high'
  if (value.includes('medium')) return 'medium'
  if (value.includes('low')) return 'low'
  return null
}

function isLikelyKeywordPlannerMetricLine(line) {
  const value = String(line ?? '').trim()
  if (!value) return false
  if (/^(low|medium|high)$/i.test(value)) return true
  if (/^(<\s*)?\d+(\.\d+)?\s*([kmb])?(\s*[-–]\s*(<\s*)?\d+(\.\d+)?\s*([kmb])?)?$/i.test(value)) return true
  if (/^\$?\d+([.,]\d+)?(\s*[-–]\s*\$?\d+([.,]\d+)?)?$/.test(value)) return true
  return false
}

function isLikelyKeywordPlannerNoiseLine(line, seedQuery) {
  const cleaned = String(line ?? '').trim()
  const lowered = cleaned.toLowerCase()
  if (!cleaned) return true
  if (lowered === String(seedQuery ?? '').trim().toLowerCase()) return true
  if (cleaned.length < 2 || cleaned.length > 140) return true
  if (!/[a-zåäö]/i.test(cleaned)) return true
  if (/^(translate|location_on|filter_alt|arrow_forward|link|cancel|save)$/i.test(cleaned)) return true
  if (/avg\.?\s+monthly\s+searches|average monthly searches|competition|top of page bid|keyword ideas/i.test(cleaned)) return true
  const noisePatterns = [
    /^keyword planner$/i,
    /^discover new keywords$/i,
    /^get search volume and forecasts$/i,
    /^get keyword ideas that can help you reach people interested in your product or service$/i,
    /^get search volume and other historical metrics.*$/i,
    /^how to use keyword planner$/i,
    /^keyword planner can be used to generate keyword ideas.*$/i,
    /^updates to keyword planner$/i,
    /^got it$/i,
    /^location$/i,
    /^enter a location to include$/i,
    /^add locations to define your audience.*$/i,
    /^highlighted areas are locations.*$/i,
    /^start with keywords$/i,
    /^start with a website$/i,
    /^plans created by you$/i,
    /^plans shared with you$/i,
    /^add filter$/i,
    /^close$/i,
    /^get results$/i,
    /^google ads$/i,
    /^keyword ideas$/i
  ]
  return noisePatterns.some((pattern) => pattern.test(cleaned))
}

function inferIntent(query) {
  const value = String(query).toLowerCase()
  if (/(price|pricing|cost|quote|service|agency|company|tool|software|platform)/.test(value)) return 'commercial'
  if (/(how|what|why|guide|tips|examples|best)/.test(value)) return 'informational'
  if (/(near me|in stockholm|in gothenburg|hire|book|demo)/.test(value)) return 'transactional'
  return 'mixed'
}

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function normalizeVisibleText(value) {
  return String(value ?? '')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeKeywordPlannerMetric(value) {
  return decodeHtmlEntities(String(value ?? '').replace(/<!---->/g, ' ').replace(/\s+/g, ' ')).trim()
}

function extractKeywordPlannerStructuredRows(html) {
  const raw = String(html ?? '')
  const rows = []
  const rowRegex = /aria-label="Select row &quot;([^"]+?)&quot;"[\s\S]{0,5000}?essfield="search_volume"[\s\S]{0,1200}?(?:<span class="value-text[^"]*">|<text-field>\s*)([\s\S]{0,80}?)(?:<\/span>|<\/text-field>)[\s\S]{0,1200}?essfield="competition"[\s\S]{0,600}?<text-field>\s*([\s\S]{0,40}?)<\/text-field>[\s\S]{0,800}?essfield="bid_min"[\s\S]{0,600}?<text-field>\s*([\s\S]{0,60}?)<\/text-field>[\s\S]{0,800}?essfield="bid_max"[\s\S]{0,600}?<text-field>\s*([\s\S]{0,60}?)<\/text-field>/gi

  for (const match of raw.matchAll(rowRegex)) {
    const query = decodeHtmlEntities(match[1])
    const searchVolume = normalizeKeywordPlannerMetric(match[2])
    const competition = normalizeKeywordPlannerMetric(match[3])
    const bidMin = normalizeKeywordPlannerMetric(match[4])
    const bidMax = normalizeKeywordPlannerMetric(match[5])
    if (!query) continue
    rows.push({
      query,
      searchVolume,
      competition,
      bidMin,
      bidMax
    })
  }

  return rows
}

function parseTrendsCapture(capture, seedQuery) {
  const renderedText = String(capture.rendered_text ?? '').trim()
  const normalizedRenderedText = normalizeVisibleText(renderedText)
  const renderedLines = renderedText
    ? renderedText.split(/\r?\n/).map((line) => normalizeVisibleText(line)).filter(Boolean)
    : []
  const rawCombinedSection = [
    extractHtmlBetween(capture.html, '<div id="RELATED_TOPICS"', '<div id="RELATED_QUERIES"'),
    extractHtmlBetween(capture.html, '<div id="RELATED_QUERIES"', '<script type="text/javascript"')
  ].join('\n')
  const sectionLines = renderedLines.length > 0 ? renderedLines : stripHtmlToLines(rawCombinedSection)
  const rateLimited =
    /too many requests/i.test(normalizedRenderedText) ||
    /error 429/i.test(normalizedRenderedText)
  const visibleQueryMetrics =
    /breakout/i.test(normalizedRenderedText) ||
    /\+\d{1,3}%/.test(normalizedRenderedText)
  const noData =
    rateLimited ||
    (!visibleQueryMetrics && (
      /your search doesn't have enough data to show here/i.test(normalizedRenderedText) ||
      /oops! something went wrong/i.test(normalizedRenderedText)
    ))
  const keywordMap = new Map()

  if (noData) {
    return {
      keywords: [],
      demand_signals: rateLimited
        ? [
            {
              source: 'google_trends',
              signal: 'Google Trends rate-limited the capture',
              evidence: 'Rendered page contained 429 / Too Many Requests messaging.',
              inferred: false
            }
          ]
        : [],
      notes: ['Google Trends rendered, but related topics/queries had insufficient data for this seed query.']
    }
  }

  const extractSectionLines = (heading) => {
    const headingIndex = sectionLines.findIndex((line) => line.toLowerCase() === heading)
    if (headingIndex === -1) return []
    const stopMatchers = [
      /^interest over time$/i,
      /^interest by region$/i,
      /^related topics$/i,
      /^related queries$/i,
      /^explore more$/i,
      /^compared breakdown by/i
    ]
    const rows = []
    for (let index = headingIndex + 1; index < sectionLines.length; index += 1) {
      const line = sectionLines[index]
      if (stopMatchers.some((pattern) => pattern.test(line)) && line.toLowerCase() !== heading) break
      rows.push(line)
    }
    return rows
  }

  const focusedLines = [
    ...extractSectionLines('related topics'),
    ...extractSectionLines('related queries')
  ]
  const candidateLines = focusedLines.length > 0 ? focusedLines : sectionLines
  const structuredKeywords = []

  for (let index = 0; index < candidateLines.length - 2; index += 1) {
    const rank = normalizeVisibleText(candidateLines[index])
    const maybeQuery = normalizeVisibleText(candidateLines[index + 1])
    const maybeMetric = normalizeVisibleText(candidateLines[index + 2])
    if (!/^\d+$/.test(rank)) continue
    if (!isLikelyTrendsMetricLine(maybeMetric)) continue
    if (isLikelyGenericTrendsUiLine(maybeQuery, seedQuery)) continue
    if (!/[a-zåäö]/i.test(maybeQuery)) continue
    structuredKeywords.push({
      source: 'google_trends',
      query: maybeQuery.trim(),
      demand_bucket: bucketDemandFromText(maybeMetric),
      competition: null,
      intent: inferIntent(maybeQuery),
      notes: `Extracted from rendered Google Trends related query row near seed query "${seedQuery}" with visible growth metric "${maybeMetric}".`
    })
  }

  if (structuredKeywords.length > 0) {
    const deduped = dedupeKeywords(structuredKeywords)
    const demand_signals = []
    if (candidateLines.join(' ').toLowerCase().includes('breakout')) {
      demand_signals.push({
        source: 'google_trends',
        signal: 'Rising search interest detected',
        evidence: 'Rendered Google Trends related queries include Breakout growth labels.',
        inferred: false
      })
    }
    return {
      keywords: deduped,
      demand_signals,
      notes: deduped.slice(0, 12).map((entry) => `${entry.query} :: ${entry.demand_bucket}`)
    }
  }

  for (let index = 0; index < candidateLines.length; index += 1) {
    const line = candidateLines[index]
    const previousLine = candidateLines[index - 1] ?? ''
    const nextLine = candidateLines[index + 1] ?? ''

    if (!isLikelyTrendsMetricLine(line) && !isLikelyTrendsMetricLine(nextLine)) continue

    const candidate = isLikelyTrendsMetricLine(line) ? previousLine : line
    const metricLine = isLikelyTrendsMetricLine(line) ? line : nextLine
    if (candidate.length < 3 || candidate.length > 120) continue
    if (isLikelyGenericTrendsUiLine(candidate, seedQuery)) continue
    if (!/[a-zåäö]/i.test(candidate)) continue
    if (!/\s/.test(candidate) && candidate.length < 5) continue

    const cleaned = candidate.trim()
    if (!cleaned || cleaned.length < 3) continue
    if (!keywordMap.has(cleaned.toLowerCase())) {
      keywordMap.set(cleaned.toLowerCase(), {
        source: 'google_trends',
        query: cleaned,
        demand_bucket: bucketDemandFromText(metricLine),
        competition: null,
        intent: inferIntent(cleaned),
        notes: `Extracted from rendered Google Trends page near seed query "${seedQuery}" with visible growth metric "${metricLine}".`
      })
    }
  }

  const demand_signals = []
  const pageText = candidateLines.join(' ').toLowerCase()
  if (pageText.includes('breakout')) {
    demand_signals.push({
      source: 'google_trends',
      signal: 'Rising search interest detected',
      evidence: 'Page text includes "Breakout".',
      inferred: false
    })
  }
  if (pageText.includes('related queries')) {
    demand_signals.push({
      source: 'google_trends',
      signal: 'Related-query expansion available',
      evidence: 'Rendered page includes related query section.',
      inferred: false
    })
  }

  return {
    keywords: [...keywordMap.values()],
    demand_signals,
    notes:
      keywordMap.size > 0
        ? candidateLines.filter((line) => isLikelyTrendsMetricLine(line)).slice(0, 12)
        : ['Google Trends rendered, but no trustworthy related-query rows with visible growth metrics were found in the captured HTML.']
  }
}

function parseKeywordPlannerCapture(capture, seedQuery) {
  const lines = stripHtmlToLines(capture.html)
  const pageText = lines.join(' ')
  const resultsViewVisible = /add filter|columns|0 selected/i.test(pageText)
  const noSuggestionsMatch = pageText.match(/No suggestions for\s+([^\n]+)/i)

  if (noSuggestionsMatch) {
    return {
      keywords: [],
      demand_signals: [
        {
          source: 'google_keyword_planner',
          signal: 'No keyword suggestions returned',
          evidence: `Rendered page states "${noSuggestionsMatch[0].trim()}".`,
          inferred: false
        }
      ],
      notes: [`Keyword Planner returned no suggestions for "${noSuggestionsMatch[1]?.trim() || seedQuery}".`]
    }
  }

  const structuredRows = extractKeywordPlannerStructuredRows(capture.html)
  if (structuredRows.length > 0) {
    const keywords = structuredRows.map((row) => ({
      source: 'google_keyword_planner',
      query: row.query,
      demand_bucket: bucketDemandFromText(row.searchVolume),
      competition: competitionFromText(row.competition),
      intent: inferIntent(row.query),
      notes: `Extracted from structured Keyword Planner result row for seed "${seedQuery}" with avg monthly searches "${row.searchVolume}", competition "${row.competition}", low bid "${row.bidMin}", high bid "${row.bidMax}".`
    }))

    return {
      keywords,
      demand_signals: [
        {
          source: 'google_keyword_planner',
          signal: 'Keyword Planner result rows extracted',
          evidence: `Structured result table rows were parsed from the rendered Keyword ideas table (${structuredRows.length} rows).`,
          inferred: false
        }
      ],
      notes: structuredRows.slice(0, 8).map((row) => `${row.query} :: ${row.searchVolume} :: ${row.competition} :: ${row.bidMin} :: ${row.bidMax}`)
    }
  }

  const metricHeaderIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /avg\.?\s+monthly\s+searches|average monthly searches|competition|top of page bid/i.test(line))
    .map(({ index }) => index)

  const hasVisibleMetricsHeaders = metricHeaderIndexes.length >= 2
  if (!hasVisibleMetricsHeaders) {
    return {
      keywords: [],
      demand_signals: resultsViewVisible
        ? [
            {
              source: 'google_keyword_planner',
              signal: 'Keyword Planner results view loaded',
              evidence: 'Rendered page contains result-toolbar UI such as Add filter / Columns / selected count, but visible metric headers were not reliably captured.',
              inferred: false
            }
          ]
        : [],
      notes: [
        resultsViewVisible
          ? 'Keyword Planner reached the results workspace, but no trustworthy visible metric headers were found in the captured HTML.'
          : 'Keyword Planner rendered the discover flow, but no trustworthy visible result table headers were found in the captured HTML.'
      ]
    }
  }

  const keywordMap = new Map()
  const rowEvidence = []
  const relevant = [
    ...new Set(
      metricHeaderIndexes.flatMap((index) =>
        lines.slice(Math.max(0, index - 6), Math.min(lines.length, index + 40))
      )
    )
  ]

  for (let index = 0; index < relevant.length; index += 1) {
    const cleaned = relevant[index].trim()
    if (isLikelyKeywordPlannerNoiseLine(cleaned, seedQuery)) continue
    const lowered = cleaned.toLowerCase()
    const window = relevant.slice(Math.max(0, index - 2), Math.min(relevant.length, index + 5))
    const nearbyMetricLines = window.filter((line) => isLikelyKeywordPlannerMetricLine(line))
    if (nearbyMetricLines.length === 0) continue
    rowEvidence.push(`${cleaned} :: ${nearbyMetricLines.join(' | ')}`)
    if (!keywordMap.has(lowered)) {
      keywordMap.set(lowered, {
        source: 'google_keyword_planner',
        query: cleaned,
        demand_bucket: bucketDemandFromText(nearbyMetricLines.join(' ')),
        competition: competitionFromText(nearbyMetricLines.join(' ')),
        intent: inferIntent(cleaned),
        notes: `Extracted from rendered Google Keyword Planner result row near seed query "${seedQuery}" with nearby metrics "${nearbyMetricLines.join(', ')}".`
      })
    }
  }

  if (keywordMap.size === 0) {
    return {
      keywords: [],
      demand_signals: resultsViewVisible
        ? [
            {
              source: 'google_keyword_planner',
              signal: 'Keyword Planner result workspace visible',
              evidence: 'Rendered page reached the result workspace, but no trustworthy keyword rows with nearby metrics were extractable.',
              inferred: false
            }
          ]
        : [],
      notes: ['Keyword Planner rendered, but no trustworthy keyword result rows with nearby visible metrics were found in the captured HTML.']
    }
  }

  const demand_signals = []
  if (metricHeaderIndexes.some((index) => /avg\.?\s+monthly\s+searches|average monthly searches/i.test(lines[index] ?? ''))) {
    demand_signals.push({
      source: 'google_keyword_planner',
      signal: 'Keyword Planner demand metrics visible',
      evidence: 'Rendered page contains visible average monthly searches headers near extracted rows.',
      inferred: false
    })
  }
  if (metricHeaderIndexes.some((index) => /competition/i.test(lines[index] ?? ''))) {
    demand_signals.push({
      source: 'google_keyword_planner',
      signal: 'Keyword Planner competition metrics visible',
      evidence: 'Rendered page contains visible competition headers near extracted rows.',
      inferred: false
    })
  }

  return {
    keywords: [...keywordMap.values()],
    demand_signals,
    notes: rowEvidence.slice(0, 8)
  }
}

function parseCaptureBySource(source, capture, seedQuery) {
  if (source === 'google_trends') return parseTrendsCapture(capture, seedQuery)
  if (source === 'google_keyword_planner') return parseKeywordPlannerCapture(capture, seedQuery)
  return { keywords: [], demand_signals: [], notes: [] }
}

function dedupeKeywords(entries) {
  const map = new Map()
  for (const entry of entries) {
    const key = `${entry.source}:${entry.query.toLowerCase()}`
    if (!map.has(key)) {
      map.set(key, entry)
      continue
    }

    const current = map.get(key)
    map.set(key, {
      ...current,
      demand_bucket: current.demand_bucket === 'unknown' ? entry.demand_bucket : current.demand_bucket,
      competition: current.competition ?? entry.competition,
      notes: current.notes
    })
  }
  return [...map.values()].sort((a, b) => a.query.localeCompare(b.query))
}

function buildThemes(seedQueries, keywords) {
  const buckets = new Map()

  for (const seed of seedQueries) {
    buckets.set(seed, {
      name: seed,
      opportunity: 'seed',
      seed_queries: [seed],
      keyword_count: 0,
      example_keywords: []
    })
  }

  for (const keyword of keywords) {
    const token = keyword.query.split(/\s+/).slice(0, 2).join(' ').toLowerCase()
    if (!token) continue
    if (!buckets.has(token)) {
      buckets.set(token, {
        name: token,
        opportunity: keyword.intent,
        seed_queries: [],
        keyword_count: 0,
        example_keywords: []
      })
    }
    const theme = buckets.get(token)
    theme.keyword_count += 1
    if (theme.example_keywords.length < 4) {
      theme.example_keywords.push(keyword.query)
    }
  }

  return [...buckets.values()]
    .filter((theme) => theme.keyword_count > 0 || theme.seed_queries.length > 0)
    .sort((a, b) => b.keyword_count - a.keyword_count || a.name.localeCompare(b.name))
}

function buildServiceAngles(themes, demandSignals, seedQueries) {
  const angles = []
  for (const theme of themes.slice(0, 6)) {
    angles.push({
      angle: `Own the "${theme.name}" demand narrative`,
      rationale: theme.opportunity === 'commercial'
        ? 'Commercial-intent phrasing suggests this theme can support offer framing and CTA copy.'
        : 'Theme appears repeatedly in captured demand data and can support homepage messaging or supporting SEO pages.',
      based_on: theme.example_keywords.slice(0, 3)
    })
  }

  if (angles.length === 0) {
    for (const seed of seedQueries.slice(0, 3)) {
      angles.push({
        angle: `Build a focused landing angle around "${seed}"`,
        rationale: 'Seed query was provided but structured demand expansion was limited; keep messaging narrow until more research is captured.',
        based_on: [seed]
      })
    }
  }

  if (demandSignals.some((entry) => /rising/i.test(entry.signal))) {
    angles.push({
      angle: 'Lean into trend-led messaging',
      rationale: 'At least one source reported rising interest or breakout-style growth language.',
      based_on: demandSignals.filter((entry) => /rising|breakout/i.test(entry.signal)).map((entry) => entry.source)
    })
  }

  return angles.slice(0, 8)
}

function summarizeFindings(seedQueries, coverage, keywords, demandSignals) {
  const successfulSources = coverage.filter((entry) => entry.ok).map((entry) => entry.source)
  const partialSources = coverage.filter((entry) => !entry.ok).map((entry) => entry.source)
  const summary = []

  if (successfulSources.length > 0) {
    summary.push(`Captured demand data from ${successfulSources.join(', ')}.`)
  }
  if (keywords.length > 0) {
    summary.push(`Normalized ${keywords.length} keyword opportunities around ${seedQueries.join(', ')}.`)
  } else {
    summary.push('Structured keyword extraction was limited; inspect screenshots and raw captures for manual follow-up.')
  }
  if (demandSignals.length > 0) {
    summary.push(`Detected ${demandSignals.length} demand signals across the captured sources.`)
  }
  if (partialSources.length > 0) {
    summary.push(`Partial coverage only: ${partialSources.join(', ')} need session or parser follow-up.`)
  }

  return summary.join(' ')
}

function toMarkdown(result) {
  const lines = [
    `# Search Demand Insights: ${result.project_slug}`,
    '',
    `Generated: ${result.generated_at}`,
    '',
    `## Summary`,
    '',
    result.summary || 'No summary available.',
    '',
    `## Source coverage`,
    ''
  ]

  for (const source of result.source_coverage) {
    lines.push(`- ${source.source}: ${source.ok ? 'ok' : 'partial'}${source.message ? ` - ${source.message}` : ''}`)
  }

  lines.push('', '## Themes', '')
  for (const theme of result.themes) {
    lines.push(`- ${theme.name}: ${theme.keyword_count} keywords${theme.example_keywords.length > 0 ? ` (${theme.example_keywords.join(', ')})` : ''}`)
  }

  lines.push('', '## Keywords', '')
  for (const keyword of result.keywords.slice(0, 40)) {
    lines.push(`- [${keyword.source}] ${keyword.query} | demand=${keyword.demand_bucket ?? 'unknown'} | competition=${keyword.competition ?? 'n/a'} | intent=${keyword.intent ?? 'mixed'}`)
  }

  lines.push('', '## Demand signals', '')
  for (const signal of result.demand_signals) {
    lines.push(`- [${signal.source}] ${signal.signal}${signal.inferred ? ' (inferred)' : ''}: ${signal.evidence}`)
  }

  lines.push('', '## Service angles', '')
  for (const angle of result.service_angles) {
    lines.push(`- ${angle.angle}: ${angle.rationale}`)
  }

  return `${lines.join('\n')}\n`
}

async function runWorkerCapture({ source, seedQuery, url, screenshotPath, htmlPath, session, width, height, waitMs, mode }) {
  if (session?.helperUrl) {
    const helperBaseUrl = String(session.helperUrl).replace(/\/+$/, '')
    let health
    try {
      health = await fetchJsonWithTimeout(`${helperBaseUrl}/health`, {}, DEFAULT_HELPER_HEALTH_TIMEOUT_MS)
    } catch (error) {
      throw new Error(
        `Research helper unavailable at ${helperBaseUrl}. Start the helper service and retry. ${conciseErrorMessage(error)}`
      )
    }

    if (!health.ok || health.payload?.ok !== true) {
      throw new Error(`Research helper unavailable at ${helperBaseUrl}. Start the helper service and retry.`)
    }

    let captureResponse
    try {
      const captureTimeoutMs = Math.max(
        source === 'google_keyword_planner'
          ? DEFAULT_HELPER_CAPTURE_TIMEOUT_MS
          : waitMs + 15000,
        30000
      )
      captureResponse = await fetchJsonWithTimeout(
        `${helperBaseUrl}/capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            source,
            seedQuery,
            url,
            width,
            height,
            waitMs,
            browser: session.browserCommand,
            userDataDir: session.userDataDir,
            profileDirectory: session.profileDirectory,
            preferredAccountText: session.preferredAccountText,
            mode
          })
        },
        captureTimeoutMs
      )
    } catch (error) {
      throw new Error(
        `Research helper capture request failed at ${helperBaseUrl}. ${conciseErrorMessage(error)}`
      )
    }

    if (!captureResponse.ok) {
      throw new Error(
        captureResponse.payload?.message ||
          `Research helper returned ${captureResponse.status} from ${helperBaseUrl}/capture`
      )
    }

    const payload = captureResponse.payload
    if (!payload || payload.ok !== true) {
      throw new Error(payload?.message || 'Research helper returned invalid capture payload')
    }

    await writeFile(htmlPath, String(payload.html ?? ''), 'utf-8')
    if (payload.screenshotBase64) {
      await writeFile(screenshotPath, Buffer.from(String(payload.screenshotBase64), 'base64'))
    }

    return {
      ok: true,
      browser: payload.browser ?? `helper:${session.helperUrl}`,
      pageTitle: payload.pageTitle ?? null,
      screenshotCreated: Boolean(payload.screenshotBase64),
      htmlBytes: Number(payload.htmlBytes ?? Buffer.byteLength(String(payload.html ?? ''), 'utf-8')),
      renderedText: payload.renderedText ?? null,
      actionSummary: payload.actionSummary ?? null
    }
  }

  const args = [
    'src/capture-source.mjs',
    '--source', source,
    '--seed-query', seedQuery,
    '--url', url,
    '--html-output', htmlPath,
    '--screenshot-output', screenshotPath,
    '--width', String(width),
    '--height', String(height),
    '--wait-ms', String(waitMs),
    '--mode', mode
  ]

  if (session?.browserCommand) {
    args.push('--browser', session.browserCommand)
  }
  if (session?.remoteDebuggingUrl) {
    args.push('--remote-debugging-url', session.remoteDebuggingUrl)
  }
  if (session?.userDataDir) {
    args.push('--user-data-dir', session.userDataDir)
  }
  if (session?.profileDirectory) {
    args.push('--profile-directory', session.profileDirectory)
  }
  if (session?.preferredAccountText) {
    args.push('--preferred-account-text', session.preferredAccountText)
  }

  const output = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, {
    cwd: workerDir,
    stdio: ['ignore', 'pipe', 'pipe']
  })

    const stdout = []
    const stderr = []
    child.stdout.on('data', (chunk) => stdout.push(String(chunk)))
    child.stderr.on('data', (chunk) => stderr.push(String(chunk)))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.join('').trim() || stdout.join('').trim() || `Worker exited with code ${code}`))
        return
      }
      resolve({
        stdout: stdout.join(''),
        stderr: stderr.join('')
      })
    })
  })

  return readJsonSafe(output.stdout, {
    ok: false,
    message: 'Worker returned non-JSON output',
    rawOutput: output.stdout
  })
}

async function captureSearchDemandInsightsInner(input) {
  const normalized = normalizeInput(input)
  const run_id = `${normalized.project_slug}-${sha(JSON.stringify({
    seed_queries: normalized.seed_queries,
    market: normalized.market,
    language: normalized.language,
    sources: normalized.sources,
    notes: normalized.notes
  })).slice(0, 12)}`
  const dirs = await ensureRunDirs(normalized.project_slug, run_id)
  const session = await resolveSession(normalized.session_hint)
  if (!session?.dedicatedResearchProfile) {
    throw new Error(
      'capture_search_demand_insights requires a dedicated research session profile. Mark the session manifest with "dedicatedResearchProfile": true and do not reuse an active work browser profile.'
    )
  }
  const captures = []
  const sourceCoverage = []
  const keywords = []
  const demandSignals = []
  const artifacts = []
  const errors = []

  for (const source of normalized.sources) {
    let sourceOk = false
    let sourceMessage = ''
    const sourceArtifacts = []
    const sourceSeedInputs = buildSourceSeedInputs(source, normalized.seed_queries)

    for (const seedEntry of sourceSeedInputs) {
      const captureId = `${source}-${slugify(seedEntry.label).slice(0, 40) || 'query'}-${sha(`${source}:${seedEntry.input}`).slice(0, 8)}`
      const screenshotPath = path.resolve(dirs.screenshotsDir, `${captureId}.png`)
      const htmlPath = path.resolve(dirs.rawDir, `${captureId}.html`)
      const sourceUrl = buildSourceUrl(source, seedEntry.representativeSeed, normalized.market, normalized.language, session)

      try {
        const workerResult = await runWorkerCapture({
          source,
          seedQuery: seedEntry.input,
          url: sourceUrl,
          screenshotPath,
          htmlPath,
          session,
          width: DEFAULT_WIDTH,
          height: DEFAULT_HEIGHT,
          waitMs: DEFAULT_WAIT_MS,
          mode: normalized.mode
        })

        const html = existsSync(htmlPath) ? await readFile(htmlPath, 'utf-8') : ''
        if (!html.trim() || Number(workerResult.htmlBytes ?? 0) === 0) {
          throw new Error('Browser session returned an empty HTML capture for this source.')
        }
        const capture = {
          source,
          seed_query: seedEntry.label,
          source_url: sourceUrl,
          screenshot_path:
            workerResult.screenshotCreated && existsSync(screenshotPath)
              ? relativeLocalPath(screenshotPath)
              : null,
          html_path: existsSync(htmlPath) ? relativeLocalPath(htmlPath) : null,
          page_title: workerResult.pageTitle ?? null,
          browser: workerResult.browser ?? null,
          action_summary: workerResult.actionSummary ?? null,
          rendered_text: workerResult.renderedText ?? null,
          html
        }
        captures.push(capture)

        const parsed = parseCaptureBySource(source, capture, seedEntry.representativeSeed)
        keywords.push(...parsed.keywords)
        demandSignals.push(...parsed.demand_signals)

        if (capture.screenshot_path) {
          sourceArtifacts.push({
            type: 'screenshot',
            source,
            seed_query: seedEntry.label,
            local_path: capture.screenshot_path
          })
        }
        if (capture.html_path) {
          sourceArtifacts.push({
            type: 'raw_html',
            source,
            seed_query: seedEntry.label,
            local_path: capture.html_path
          })
        }

        sourceOk = true
        sourceMessage = workerResult.screenshotCreated === false
          ? 'Capture completed without screenshot artifact'
          : workerResult.message ?? 'Capture completed'
        if (workerResult.screenshotCreated === false) {
          errors.push({
            source,
            seed_query: seedEntry.label,
            message: 'Browser session rendered HTML successfully but did not produce a screenshot artifact.'
          })
        }
      } catch (error) {
        sourceMessage = conciseErrorMessage(error)
        errors.push({
          source,
          seed_query: seedEntry.label,
          message: sourceMessage
        })
      }
    }

    artifacts.push(...sourceArtifacts)
    sourceCoverage.push({
      source,
      ok: sourceOk,
      message: sourceMessage || (sourceOk ? 'Captured at least one query' : 'No successful captures'),
      session_hint: normalized.session_hint,
      artifacts: sourceArtifacts
    })
  }

  const normalizedKeywords = dedupeKeywords(keywords)
  const themes = buildThemes(normalized.seed_queries, normalizedKeywords)
  const serviceAngles = buildServiceAngles(themes, demandSignals, normalized.seed_queries)
  const summary = summarizeFindings(normalized.seed_queries, sourceCoverage, normalizedKeywords, demandSignals)

  const result = {
    ok: sourceCoverage.some((entry) => entry.ok),
    project_slug: normalized.project_slug,
    run_id,
    generated_at: nowIso(),
    inputs: normalized,
    summary,
    themes,
    keywords: normalizedKeywords,
    demand_signals: demandSignals,
    service_angles: serviceAngles,
    source_coverage: sourceCoverage,
    artifacts,
    errors,
    notes: {
      extracted_directly_from_sources: [
        'Rendered page HTML text',
        'Visible labels and nearby keyword text',
        'Captured screenshots'
      ],
      inferred_by_operator_hub: [
        'Intent classification',
        'Demand buckets when derived from visible growth language',
        'Theme grouping',
        'Service angles'
      ]
    }
  }

  const rawCapturePath = path.resolve(dirs.runDir, 'raw-captures.json')
  const normalizedPath = path.resolve(dirs.runDir, 'normalized-result.json')
  const summaryPath = path.resolve(dirs.runDir, 'summary.md')

  await writeJson(rawCapturePath, {
    project_slug: normalized.project_slug,
    run_id,
    session,
    captures: captures.map((capture) => ({
      ...capture,
      html: undefined
    }))
  })
  await writeJson(normalizedPath, result)
  await writeFile(summaryPath, toMarkdown(result), 'utf-8')

  const artifactSet = [
    ...artifacts,
    { type: 'raw_capture_dump', local_path: relativeLocalPath(rawCapturePath) },
    { type: 'normalized_result', local_path: relativeLocalPath(normalizedPath) },
    { type: 'summary_markdown', local_path: relativeLocalPath(summaryPath) }
  ]

  const finalResult = {
    ...result,
    artifacts: artifactSet
  }

  await appendManifest(dirs.projectDir, {
    run_id,
    created_at: finalResult.generated_at,
    summary,
    source_coverage: sourceCoverage,
    artifacts: artifactSet
  })

  return finalResult
}

export async function captureSearchDemandInsights(input) {
  const normalized = normalizeInput(input)
  const shouldQueueKeywordPlanner =
    normalized.sources.includes('google_keyword_planner') && Boolean(normalized.session_hint)

  if (!shouldQueueKeywordPlanner) {
    return captureSearchDemandInsightsInner(input)
  }

  const queueKey = `search-demand:${slugify(normalized.session_hint)}:google_keyword_planner`
  return withSessionQueue(queueKey, () => captureSearchDemandInsightsInner(input))
}
