import { createServer } from 'http'

const PORT = parseInt(process.env.PORT ?? '3410', 10)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ''
const OPENAI_MODEL = process.env.SOCIAL_COPY_MODEL ?? 'gpt-5.4-mini'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

async function askOpenAI(prompt) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set')
  const resp = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1500
    }),
    signal: AbortSignal.timeout(60000)
  })
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`)
  const data = await resp.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

async function generate({ transcript, topic = '' }) {
  if (!transcript || transcript.trim().length < 20) {
    return { platforms: {}, commonComment: '', markdown: '', reason: 'Transcript too short' }
  }

  const topicHint = topic ? ` (ämne: ${topic})` : ''
  const prompt = `Du är en social media-expert som hjälper svenska kreatörer att posta videoklipp om nyheter och samhällsfrågor.

Här är transkriptet från ett kort videoklipp${topicHint}:
"${transcript.slice(0, 1200)}"

Skriv social media-copy för varje plattform. Texterna ska INTE bara vara en kort teaser — de ska ge läsaren förståelse för ämnet: förklara bakgrund, kontext och varför det är viktigt. Folk ska kunna läsa captionen och faktiskt förstå och lära sig något, även om de inte tittar på videon.

KRITISKA REGLER — bryt dem inte:

TIKTOK: 150–400 tecken. Börja med en hook (fråga eller påstående). Hashtag-array EXAKT 3, 4 eller 5 element.
INSTAGRAM_REELS: 500–1000 tecken. Struktur: 1) Hook-mening (fråga eller överraskande påstående, detta syns INNAN "visa mer"), 2) Förklara vad det handlar om + bakgrund + varför det spelar roll (2–4 rader), 3) Avsluta med en konkret fråga till följaren. Använd radbrytningar för läsbarhet. Hashtag-array EXAKT 3, 4 eller 5 element.
FACEBOOK_REELS: max 150 tecken. Hashtag-array EXAKT 3 element. Inte 4, inte 2, exakt 3.
YOUTUBE_SHORTS: title max 70 tecken, description 150–300 tecken med förklaring av ämnet. Hashtag-array EXAKT 3, 4 eller 5 element.
THREADS: 200–500 tecken med förklaring och åsikt/vinkel. Hashtag-array EXAKT 1 element.
LINKEDIN: 500–900 tecken. Stark inledning, förklara ämnet professionellt, lyft implikationer. Hashtag-array EXAKT 3, 4 eller 5 element.

Räkna hashtags noga innan du svarar. Svara exakt i detta JSON-format utan markdown-kodblock:

{
  "tiktok": { "caption": "...", "hashtags": ["#tag1", "#tag2", "#tag3"] },
  "instagram_reels": { "caption": "...", "hashtags": ["#tag1", "#tag2", "#tag3"] },
  "facebook_reels": { "caption": "...", "hashtags": ["#tag1", "#tag2", "#tag3"] },
  "youtube_shorts": { "title": "...", "description": "...", "hashtags": ["#tag1", "#tag2", "#tag3"] },
  "threads": { "caption": "...", "hashtags": ["#tag1"] },
  "linkedin": { "caption": "...", "hashtags": ["#tag1", "#tag2", "#tag3"] },
  "common_comment": "En kort engagerande fråga eller uppmaning som passar på alla plattformar och får tittarna att kommentera"
}`

  let platforms = {}
  let commonComment = ''

  try {
    const raw = await askOpenAI(prompt)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const parsed = JSON.parse(jsonMatch[0])
    commonComment = parsed.common_comment ?? ''
    delete parsed.common_comment

    const hashtagLimits = { tiktok: 5, instagram_reels: 5, facebook_reels: 3, youtube_shorts: 5, threads: 1, linkedin: 5 }
    for (const [key, max] of Object.entries(hashtagLimits)) {
      if (parsed[key]?.hashtags?.length > max) parsed[key].hashtags = parsed[key].hashtags.slice(0, max)
    }
    platforms = parsed
  } catch (err) {
    return { platforms: {}, commonComment: '', markdown: '', reason: `OpenAI error: ${err.message.slice(0, 200)}` }
  }

  const markdown = buildMarkdown(platforms, commonComment, transcript)
  return { platforms, commonComment, markdown, reason: 'Generated via OpenAI' }
}

function buildMarkdown(platforms, commonComment, transcript) {
  const now = new Date().toISOString().slice(0, 10)
  const lines = [`# Social Copy — ${now}`, '']
  const order = [
    ['tiktok', 'TikTok'],
    ['instagram_reels', 'Instagram Reels'],
    ['facebook_reels', 'Facebook Reels'],
    ['youtube_shorts', 'YouTube Shorts'],
    ['threads', 'Threads'],
    ['linkedin', 'LinkedIn'],
  ]
  for (const [key, label] of order) {
    const p = platforms[key]
    if (!p) continue
    lines.push(`## ${label}`)
    if (p.title) lines.push(`**Titel:** ${p.title}`, '')
    if (p.caption) lines.push(p.caption, '')
    if (p.description) lines.push(`**Beskrivning:** ${p.description}`, '')
    if (Array.isArray(p.hashtags) && p.hashtags.length) lines.push(p.hashtags.join(' '), '')
    lines.push('')
  }
  if (commonComment) lines.push('## Gemensam kommentar (alla plattformar)', '', commonComment, '')
  lines.push('---', `*Baserat på transkript: "${transcript.slice(0, 120)}…"*`)
  return lines.join('\n')
}

function json(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) })
  res.end(data)
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { ok: true, model: OPENAI_MODEL })
  }

  if (req.method === 'POST' && req.url === '/generate') {
    try {
      const body = JSON.parse(await readBody(req))
      const result = await generate({ transcript: body.transcript ?? '', topic: body.topic ?? '' })
      return json(res, 200, result)
    } catch (err) {
      return json(res, 400, { error: err.message })
    }
  }

  json(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => console.log(`[social-copy-api] listening on :${PORT} model=${OPENAI_MODEL}`))
