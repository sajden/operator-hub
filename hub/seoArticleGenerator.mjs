/**
 * seoArticleGenerator.mjs
 *
 * Generates SEO article drafts by:
 *   1. Fetching Google Trends data via captureSearchDemandInsights
 *   2. Calling Codex Gateway (http://codex-gateway:8090/v1/ask) to write the article
 *   3. Saving the draft JSON to .local/seo-drafts/<slug>.json
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { captureSearchDemandInsights } from './researchTools.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const draftsDir = path.resolve(repoRoot, '.local/seo-drafts')
const configPath = path.resolve(__dirname, 'seo-config.json')

const CODEX_URL = process.env.SEO_CODEX_URL ?? 'http://codex-gateway:8090/v1/ask'
const CODEX_TOKEN = process.env.SEO_CODEX_TOKEN ?? process.env.AIHUB_CODEX_TOKEN ?? ''
const CODEX_TIMEOUT_MS = Number(process.env.SEO_CODEX_TIMEOUT_SEC ?? '120') * 1000

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[åä]/g, 'a')
    .replace(/[ö]/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function nowIso() {
  return new Date().toISOString()
}

async function loadConfig() {
  try {
    return JSON.parse(await readFile(configPath, 'utf-8'))
  } catch {
    return {
      niche: 'AI-verktyg',
      siteDescription: 'AI-verktyg för innehållsskapare',
      targetLanguage: 'sv',
      targetAudience: 'svenska användare',
      seedKeywords: ['AI verktyg', 'videoredigering'],
      articleLengthWords: 900,
      generateCount: 1,
      avoidTopics: [],
    }
  }
}

async function getExistingSlugs() {
  await mkdir(draftsDir, { recursive: true })
  const files = await readdir(draftsDir)
  return new Set(files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')))
}

const DEMAND_BUCKET_SCORE = { high: 90, medium: 60, low: 30 }

async function fetchTrendTopics(config) {
  // Use captureSearchDemandInsights (browser-based, no API key needed)
  // Falls back to seed keywords if browser session is unavailable
  try {
    console.log('[seo-generator] Fetching trends via captureSearchDemandInsights…')
    const result = await captureSearchDemandInsights({
      project_slug: 'seo-generator',
      seed_queries: config.seedKeywords.slice(0, 8),
      sources: ['google_trends'],  // skip keyword_planner (needs authenticated browser session)
      market: config.market ?? 'SE',
      language: config.targetLanguage ?? 'sv',
      mode: 'background',
    })

    if (result.keywords && result.keywords.length > 0) {
      const topics = result.keywords.map((kw) => ({
        keyword: kw.query,
        score: DEMAND_BUCKET_SCORE[kw.demand_bucket] ?? 50,
      }))
      // Deduplicate by keyword, sort by score desc
      const seen = new Set()
      const unique = topics.filter((t) => {
        const k = t.keyword.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      console.log(`[seo-generator] Got ${unique.length} trend topics from research tool`)
      return unique.sort((a, b) => b.score - a.score)
    }

    console.log('[seo-generator] Research returned no keywords — using seed keywords')
  } catch (e) {
    console.warn(`[seo-generator] captureSearchDemandInsights failed: ${e.message} — falling back to seed keywords`)
  }

  // Fallback: use seed keywords with descending synthetic scores
  return config.seedKeywords.map((kw, i) => ({
    keyword: kw,
    score: 100 - i * 10,
  }))
}

async function callCodex(prompt) {
  const headers = { 'Content-Type': 'application/json' }
  if (CODEX_TOKEN) headers['Authorization'] = `Bearer ${CODEX_TOKEN}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CODEX_TIMEOUT_MS)

  try {
    const res = await fetch(CODEX_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: prompt }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Codex gateway returned ${res.status}: ${text.slice(0, 200)}`)
    }

    const data = await res.json()
    // codex-gateway returns { reply: "..." }
    return data.reply ?? data.text ?? data.content ?? String(data)
  } finally {
    clearTimeout(timer)
  }
}

function parseArticleJson(raw) {
  // Try to extract a JSON object from the response
  const jsonMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]) } catch {}
  }

  // Try raw JSON
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1) {
    try { return JSON.parse(raw.slice(firstBrace, lastBrace + 1)) } catch {}
  }

  return null
}

function buildPrompt(config, topic, existingSlugs) {
  const avoidList = [...config.avoidTopics, ...Array.from(existingSlugs)].slice(0, 20).join(', ')
  const lang = config.targetLanguage === 'sv' ? 'svenska' : 'English'

  return `Du är en SEO-expert och skribent. Skriv en SEO-optimerad artikel på ${lang}.

ÄMNE: ${topic.keyword}
NISCH: ${config.niche}
MÅLGRUPP: ${config.targetAudience}
WEBBPLATSBESKRIVNING: ${config.siteDescription}
MÅLORDLÄNGD: ungefär ${config.articleLengthWords} ord
UNDVIK DESSA ÄMNEN/SLUGAR: ${avoidList || 'inga'}

Returnera ENDAST ett JSON-objekt med exakt dessa fält (ingen text utanför JSON):

{
  "slug": "url-vanlig-slug-max-60-tecken",
  "title": "Artikelrubrik (H1)",
  "metaDescription": "Max 160 tecken SEO-beskrivning",
  "body": "# Rubrik\\n\\nMarkdown-artikel...",
  "tags": ["tag1", "tag2", "tag3"],
  "trendTopic": "${topic.keyword}",
  "trendScore": ${topic.score}
}

Artikeln ska:
- Ha en tydlig H1, minst 2 H2-rubriker
- Innehålla naturligt sökordsanvändning
- Ha en kort intro och en slutsats
- Vara informativ och engagerande
- Vara på ${lang}`
}

export async function generateArticle(options = {}) {
  const config = await loadConfig()
  const existingSlugs = await getExistingSlugs()

  const topics = await fetchTrendTopics(config)
  if (topics.length === 0) {
    throw new Error('No trend topics available')
  }

  // Pick first topic not already drafted
  const topic = topics.find((t) => !existingSlugs.has(slugify(t.keyword))) ?? topics[0]

  console.log(`[seo-generator] Generating article for topic: "${topic.keyword}" (score: ${topic.score})`)

  const prompt = buildPrompt(config, topic, existingSlugs)
  const raw = await callCodex(prompt)

  const parsed = parseArticleJson(raw)
  if (!parsed || !parsed.slug || !parsed.title || !parsed.body) {
    // Fallback: treat the whole response as body
    console.warn('[seo-generator] Could not parse JSON from Codex — saving raw response as body')
    const fallbackSlug = slugify(topic.keyword) || `article-${Date.now()}`
    const draft = {
      slug: fallbackSlug,
      title: topic.keyword,
      metaDescription: '',
      body: raw,
      tags: [],
      trendTopic: topic.keyword,
      trendScore: topic.score,
      generatedAt: nowIso(),
      status: 'pending',
    }
    await saveDraft(draft)
    return draft
  }

  const draft = {
    slug: parsed.slug || slugify(topic.keyword),
    title: parsed.title,
    metaDescription: parsed.metaDescription ?? '',
    body: parsed.body,
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    trendTopic: parsed.trendTopic ?? topic.keyword,
    trendScore: parsed.trendScore ?? topic.score,
    generatedAt: nowIso(),
    status: 'pending',
  }

  // Deduplicate slug
  let finalSlug = draft.slug
  if (existingSlugs.has(finalSlug)) {
    finalSlug = `${finalSlug}-${Date.now()}`
    draft.slug = finalSlug
  }

  await saveDraft(draft)
  console.log(`[seo-generator] Draft saved: ${draft.slug}`)
  return draft
}

async function saveDraft(draft) {
  await mkdir(draftsDir, { recursive: true })
  const filePath = path.join(draftsDir, `${draft.slug}.json`)
  await writeFile(filePath, JSON.stringify(draft, null, 2), 'utf-8')
}

// Weekly scheduler: runs every Monday at 08:00 (local time)
export function startWeeklyScheduler(onGenerate) {
  function msUntilNextMonday0800() {
    const now = new Date()
    const next = new Date(now)
    // Advance to next Monday
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ...
    const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7
    next.setDate(now.getDate() + daysUntilMonday)
    next.setHours(8, 0, 0, 0)
    return next.getTime() - now.getTime()
  }

  function scheduleNext() {
    const delay = msUntilNextMonday0800()
    const nextRunAt = new Date(Date.now() + delay).toISOString()
    console.log(`[seo-scheduler] Next generation scheduled at ${nextRunAt}`)

    setTimeout(async () => {
      try {
        console.log('[seo-scheduler] Running weekly article generation…')
        const draft = await generateArticle()
        onGenerate?.(null, draft)
      } catch (err) {
        console.error('[seo-scheduler] Generation failed:', err.message)
        onGenerate?.(err, null)
      }
      scheduleNext()
    }, delay)
  }

  scheduleNext()
}
