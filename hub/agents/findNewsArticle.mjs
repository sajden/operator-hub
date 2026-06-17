/**
 * Agent: findNewsArticle
 * Uses OpenAI to generate a search query, then fetches Bing News RSS to find a real article URL.
 * Collects top candidates and uses OpenAI to rank them against the transcript for best fit.
 */
export const meta = {
  id: 'findNewsArticle',
  name: 'Find News Article',
  description: 'Generates a search query via OpenAI then searches Bing News RSS for a relevant article URL.',
  inputSchema: {
    text: { type: 'string', description: 'Transcript or topic to search for' }
  },
  outputSchema: {
    url: { type: 'string', nullable: true, description: 'Found article URL, or null' },
    query: { type: 'string', description: 'Search query used' }
  }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ''
const OPENAI_MODEL = process.env.SOCIAL_COPY_MODEL ?? 'gpt-5.4-mini'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

const SKIP_DOMAINS = ['bing.com', 'microsoft.com', 'google.com', 'youtube.com', 'facebook.com', 'twitter.com', 'x.com']
const SWEDISH_DOMAINS = /\.(se|nu)(?:\/|$)/i

async function askOpenAI(prompt, maxTokens = 100) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set')
  const resp = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: maxTokens
    }),
    signal: AbortSignal.timeout(30000)
  })
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`)
  const data = await resp.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

async function buildQueries(text) {
  const stopWords = new Set(['och','att','det','är','en','ett','på','av','för','med','som','den','de','i','till','har','inte','men','också','detta','sina','deras','dess'])
  const fallback = text.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w.toLowerCase())).slice(0, 4).join(' ')

  try {
    const raw = await askOpenAI(`Du är en nyhetsredaktör. Extrahera sökord från detta transkript.
Svara ENDAST med JSON, inga förklaringar:
{ "sv": "<2-4 nyckelord på svenska, t.ex. ämnesord och namn>", "en": "<3-5 keywords in English>" }

Transkript: "${text.slice(0, 400)}"`, 120)

    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
    const sv = String(json.sv ?? '').replace(/^["']|["']$/g, '').trim()
    const en = String(json.en ?? '').replace(/^["']|["']$/g, '').trim()
    if (sv && en) return { sv, en }
    throw new Error('incomplete')
  } catch {
    return { sv: fallback, en: fallback }
  }
}

function extractItemsFromRss(xml) {
  const items = []
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
  for (const m of itemMatches) {
    const block = m[1]
    const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)
    const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : ''

    let url = null
    const apickMatch = block.match(/apiclick\.aspx[^<]*?(?:&amp;|[?&])url=([^&"<>\s]+)/i)
    if (apickMatch) {
      try {
        const decoded = decodeURIComponent(apickMatch[1])
        if (decoded.startsWith('http') && !SKIP_DOMAINS.some(d => decoded.includes(d))) url = decoded
      } catch { /* skip */ }
    }
    if (!url) {
      const linkMatch = block.match(/<link>(https?:\/\/(?!(?:www\.)?bing\.com)[^<]+)<\/link>/i)
      if (linkMatch) url = linkMatch[1].trim()
    }

    if (url && title) items.push({ url, title })
    else if (url) items.push({ url, title: url })
  }
  return items
}

async function searchBingRss(query, mkt = 'sv-SE') {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=RSS&mkt=${mkt}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)', 'Accept': 'application/rss+xml,text/xml' },
    signal: AbortSignal.timeout(15000)
  })
  if (!res.ok) throw new Error(`Bing RSS ${res.status}`)
  return extractItemsFromRss(await res.text())
}

async function rankCandidates(text, candidates) {
  if (candidates.length === 1) return candidates[0]
  try {
    const list = candidates.map((c, i) => `${i + 1}. ${c.title}`).join('\n')
    const raw = await askOpenAI(`Du är redaktör för sociala medier. Välj den artikel som bäst matchar detta videoinnehåll som visuell bakgrund.
Svara ENDAST med numret (t.ex. "2"), inga förklaringar.

Videoinnehåll: "${text.slice(0, 300)}"

Artiklar:
${list}`, 10)

    const num = parseInt(raw.match(/\d+/)?.[0] ?? '1', 10)
    const idx = Math.min(Math.max(num - 1, 0), candidates.length - 1)
    return candidates[idx]
  } catch {
    return candidates[0]
  }
}

function shortenQuery(q) {
  if (!q) return null
  const words = q.trim().split(/\s+/)
  return words.length > 2 ? words.slice(0, -1).join(' ') : null
}

async function collectSwedishCandidates(queries, maxCandidates = 5) {
  const seen = new Set()
  const swedish = []
  const fallback = []

  for (const q of queries) {
    if (!q || q.length < 3) continue
    try {
      const items = await searchBingRss(q, 'sv-SE')
      for (const item of items) {
        if (seen.has(item.url)) continue
        seen.add(item.url)
        if (SWEDISH_DOMAINS.test(item.url)) swedish.push(item)
        else fallback.push(item)
        if (swedish.length >= maxCandidates) break
      }
    } catch { /* continue */ }
    if (swedish.length >= maxCandidates) break
  }

  return { swedish: swedish.slice(0, maxCandidates), fallback: fallback.slice(0, maxCandidates) }
}

export async function run({ text, topN = 3 }) {
  if (!text || text.trim().length < 10) return { url: null, candidates: [], query: '', reason: 'Text too short' }

  const { sv: svQuery, en: enQuery } = await buildQueries(text)
  if (!svQuery || svQuery.length < 3) return { url: null, candidates: [], query: svQuery, reason: 'Could not generate query' }

  const svVariants = [svQuery, shortenQuery(svQuery), shortenQuery(shortenQuery(svQuery))].filter(Boolean)

  const { swedish, fallback } = await collectSwedishCandidates(svVariants, Math.max(topN + 2, 5))

  if (swedish.length > 0) {
    const best = await rankCandidates(text, swedish)
    console.log(`[findNewsArticle] ranked ${swedish.length} Swedish candidates → "${best.title}"`)
    const others = swedish.filter(c => c.url !== best.url).slice(0, topN - 1)
    return { url: best.url, candidates: [best, ...others].slice(0, topN), query: svQuery, reason: `Ranked best of ${swedish.length} Swedish articles via OpenAI` }
  }

  try {
    const items = await searchBingRss(enQuery, 'sv-SE')
    const swedishEn = items.filter(i => SWEDISH_DOMAINS.test(i.url))
    if (swedishEn.length > 0) {
      const best = await rankCandidates(text, swedishEn)
      const others = swedishEn.filter(c => c.url !== best.url).slice(0, topN - 1)
      return { url: best.url, candidates: [best, ...others].slice(0, topN), query: enQuery, reason: `Ranked best of ${swedishEn.length} Swedish articles (en query)` }
    }
    const allFallback = [...fallback, ...items].filter((v, i, a) => a.findIndex(x => x.url === v.url) === i).slice(0, Math.max(topN + 2, 5))
    if (allFallback.length > 0) {
      const best = await rankCandidates(text, allFallback)
      const others = allFallback.filter(c => c.url !== best.url).slice(0, topN - 1)
      return { url: best.url, candidates: [best, ...others].slice(0, topN), query: enQuery, reason: `Ranked best of ${allFallback.length} articles (no Swedish available)` }
    }
  } catch (err) {
    console.warn('[findNewsArticle] Bing RSS en failed:', err.message)
  }

  return { url: null, candidates: [], query: svQuery, reason: 'No results found' }
}
