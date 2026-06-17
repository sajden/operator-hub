import { appendFile, copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.m4v'])
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = process.env.OPERATOR_HUB_REPO_ROOT
  ? path.resolve(process.env.OPERATOR_HUB_REPO_ROOT)
  : path.resolve(__dirname, '..')
const SHORT_FORM_ROOT = process.env.OPERATOR_HUB_SHORT_FORM_ROOT?.trim()
  ? path.resolve(process.env.OPERATOR_HUB_SHORT_FORM_ROOT.trim())
  : path.resolve(repoRoot, '.local/short-form-video')
const JOBS_ROOT = path.resolve(SHORT_FORM_ROOT, 'jobs')
const WATCHER_STATE_PATH = path.resolve(SHORT_FORM_ROOT, 'watcher-state.json')
const WHISPER_MODEL = process.env.OPERATOR_HUB_SHORT_FORM_WHISPER_MODEL ?? 'turbo'
const WHISPER_LANGUAGE = process.env.OPERATOR_HUB_SHORT_FORM_WHISPER_LANGUAGE ?? 'sv'
const SILENCE_NOISE = process.env.OPERATOR_HUB_SHORT_FORM_SILENCE_NOISE ?? '-35dB'
const SILENCE_MIN = Number(process.env.OPERATOR_HUB_SHORT_FORM_SILENCE_MIN ?? '0.2')
const MIN_KEPT_DURATION = Number(process.env.OPERATOR_HUB_SHORT_FORM_MIN_DURATION ?? '1.2')
const MAX_LEADING_TRIM = Number(process.env.OPERATOR_HUB_SHORT_FORM_MAX_LEADING_TRIM ?? '1.5')
const MAX_TRAILING_TRIM = Number(process.env.OPERATOR_HUB_SHORT_FORM_MAX_TRAILING_TRIM ?? '1.0')
const MIN_TRAILING_SILENCE_TO_TRIM = Number(process.env.OPERATOR_HUB_SHORT_FORM_MIN_TRAILING_SILENCE_TO_TRIM ?? '1.5')
const TRAILING_TRIM_SAFETY_PADDING = Number(process.env.OPERATOR_HUB_SHORT_FORM_TRAILING_TRIM_SAFETY_PADDING ?? '0.8')
const TARGET_MAX_SECONDS = Number(process.env.OPERATOR_HUB_SHORT_FORM_TARGET_MAX_SECONDS ?? '42')
const SHORT_FORM_AUDIO_ROOT = path.resolve(SHORT_FORM_ROOT, 'audio')
const SHORT_FORM_MUSIC_PATH = process.env.OPERATOR_HUB_SHORT_FORM_MUSIC_PATH
  ?? path.resolve(SHORT_FORM_AUDIO_ROOT, 'music/Adventure.mp3')
const SHORT_FORM_SFX_DIR = process.env.OPERATOR_HUB_SHORT_FORM_SFX_DIR
  ?? SHORT_FORM_AUDIO_ROOT
const CAPTION_FONT_FILE = process.env.OPERATOR_HUB_SHORT_FORM_CAPTION_FONT
  ?? '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
const PROXY_HEIGHT = Number(process.env.OPERATOR_HUB_SHORT_FORM_PROXY_HEIGHT ?? '960')
const PROXY_VIDEO_BITRATE = process.env.OPERATOR_HUB_SHORT_FORM_PROXY_VIDEO_BITRATE ?? '1400k'
const PROXY_AUDIO_BITRATE = process.env.OPERATOR_HUB_SHORT_FORM_PROXY_AUDIO_BITRATE ?? '128k'
const FFMPEG_THREADS = Math.max(1, Number(process.env.OPERATOR_HUB_SHORT_FORM_FFMPEG_THREADS ?? '2'))
const WHISPER_THREADS = Math.max(1, Number(process.env.OPERATOR_HUB_SHORT_FORM_WHISPER_THREADS ?? '2'))
const TRANSCRIBE_MODEL = process.env.OPERATOR_HUB_SHORT_FORM_TRANSCRIBE_MODEL ?? 'whisper-1'
const NICE_LEVEL = Number(process.env.OPERATOR_HUB_SHORT_FORM_NICE_LEVEL ?? '10')
const KEEP_RECENT_JOBS = Math.max(0, Number(process.env.OPERATOR_HUB_SHORT_FORM_KEEP_RECENT_JOBS ?? '5'))
const REVIEW_OUTPUT_DIR = process.env.OPERATOR_HUB_SHORT_FORM_REVIEW_OUTPUT_DIR ?? '/workspace/short-form-review-cuts'
const ARTICLE_VIEWPORT_WIDTH = Number(process.env.OPERATOR_HUB_SHORT_FORM_ARTICLE_VIEWPORT_WIDTH ?? '430')
const ARTICLE_VIEWPORT_HEIGHT = Number(process.env.OPERATOR_HUB_SHORT_FORM_ARTICLE_VIEWPORT_HEIGHT ?? '932')
const ARTICLE_SCREENSHOT_PATH = (() => {
  const explicit = process.env.OPERATOR_HUB_SHORT_FORM_ARTICLE_SCREENSHOT_BROWSER
  if (explicit) return explicit
  for (const p of ['/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']) {
    try { if (existsSync(p)) return p } catch (_) {}
  }
  return '/usr/bin/google-chrome-stable'
})()

function nowIso() {
  return new Date().toISOString()
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function sortByUpdatedDesc(items) {
  return [...items].sort((left, right) => String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? '')))
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true })
}

async function ensureRoots() {
  await ensureDir(SHORT_FORM_ROOT)
  await ensureDir(JOBS_ROOT)
}

async function removePathIfExists(targetPath) {
  await rm(targetPath, { recursive: true, force: true }).catch(() => {})
}

function sourceOutputSlug(job) {
  const sourcePath = String(job?.source?.sourcePath ?? '').trim()
  const sourceBase = sourcePath ? path.basename(sourcePath) : ''
  return slugify(sourceBase || job?.source?.label || job?.title || job?.id || 'short-form') || 'short-form'
}

function reviewOutputFileName(job) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-')
  return `${sourceOutputSlug(job)}-${stamp}.mp4`
}

function socialPostsToMarkdown(posts, transcript = '') {
  const lines = ['# Social copy', '']
  if (posts?.tikTokInstagramCaption) lines.push('## TikTok / Instagram', '', String(posts.tikTokInstagramCaption).trim(), '')
  if (posts?.youTubeShortsTitle) lines.push('## YouTube Shorts title', '', String(posts.youTubeShortsTitle).trim(), '')
  if (posts?.youTubeShortsDescription) lines.push('## YouTube Shorts description', '', String(posts.youTubeShortsDescription).trim(), '')
  if (posts?.linkedInPost) lines.push('## LinkedIn', '', String(posts.linkedInPost).trim(), '')
  if (Array.isArray(posts?.hashtags) && posts.hashtags.length > 0) lines.push('## Hashtags', '', posts.hashtags.join(' '), '')
  if (transcript) lines.push('## Transcript', '', transcript.trim(), '')
  return `${lines.join('\n').trim()}\n`
}

async function readCombinedTranscript(job) {
  const transcriptPath = job?.paths?.combinedTranscriptPath
    ? path.resolve(jobDir(job.id), job.paths.combinedTranscriptPath)
    : path.resolve(jobDir(job.id), 'transcripts', 'full-transcript.json')
  const transcript = await readJsonIfExists(transcriptPath, null)
  return String(transcript?.fullText ?? '').trim()
}

async function publishReviewCut(job, reviewCutPath) {
  if (!REVIEW_OUTPUT_DIR || !existsSync(reviewCutPath)) return null
  const outputDir = path.resolve(REVIEW_OUTPUT_DIR, sourceOutputSlug(job))
  await ensureDir(outputDir)

  const outputPath = path.resolve(outputDir, reviewOutputFileName(job))
  await copyFile(reviewCutPath, outputPath)

  const metadataDir = path.resolve(jobDir(job.id), 'metadata')
  const socialCopyPath = path.resolve(metadataDir, 'social-copy.md')
  const outputMdPath = path.resolve(outputDir, `${path.basename(outputPath, path.extname(outputPath))}.md`)

  if (existsSync(socialCopyPath)) {
    await copyFile(socialCopyPath, outputMdPath)
  } else {
    const posts = await readJsonIfExists(path.resolve(metadataDir, 'social-posts.json'), null)
    const transcript = await readCombinedTranscript(job)
    await writeFile(outputMdPath, socialPostsToMarkdown(posts, transcript), 'utf-8')
  }

  return outputPath
}
async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8'))
  } catch {
    return fallback
  }
}

async function writeJson(filePath, payload) {
  await ensureDir(path.dirname(filePath))
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')
}

async function runCommand(command, args, { cwd = repoRoot, allowNonZero = false, env = {}, logPath = null } = {}) {
  return await new Promise((resolve, reject) => {
    const startedAt = new Date()
    if (logPath) {
      void ensureDir(path.dirname(logPath))
        .then(() => appendFile(logPath, `\n[${startedAt.toISOString()}] RUN ${command} ${args.join(' ')}\n`, 'utf-8'))
        .catch(() => {})
    }
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (logPath) {
        const finishedAt = new Date()
        const logBlock = [
          `[${finishedAt.toISOString()}] EXIT ${code ?? 'null'}`,
          stdout ? `STDOUT:\n${stdout}` : 'STDOUT: <empty>',
          stderr ? `STDERR:\n${stderr}` : 'STDERR: <empty>',
          ''
        ].join('\n')
        void appendFile(logPath, logBlock, 'utf-8').catch(() => {})
      }
      if (code === 0 || allowNonZero) {
        resolve({ code: code ?? 0, stdout, stderr })
        return
      }
      reject(new Error(`${command} exited with code ${code}\n${stderr || stdout}`))
    })
  })
}

function jobDir(jobId) {
  return path.resolve(JOBS_ROOT, jobId)
}

function jobFile(jobId) {
  return path.resolve(jobDir(jobId), 'job.json')
}

function emptyStep(key) {
  return {
    key,
    status: 'pending',
    startedAt: null,
    finishedAt: null,
    message: '',
    warning: null,
    error: null,
    outputs: {}
  }
}

function baseSteps() {
  return [
    emptyStep('discover'),
    emptyStep('trim'),
    emptyStep('filter'),
    emptyStep('transcribe'),
    emptyStep('captions'),
    emptyStep('find_article'),
    emptyStep('capture_article'),
    emptyStep('prepare_manifest'),
    emptyStep('social_copy'),
    emptyStep('render')
  ]
}

function summarizeJob(job) {
  return {
    id: job.id,
    title: job.title,
    status: job.status,
    sourceKind: job.source.kind,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    summary: job.summary ?? {
      clipCount: 0,
      usableClipCount: 0,
      articleSelected: false,
      rendered: false
    }
  }
}

function makeJobId(title) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const suffix = randomBytes(3).toString('hex')
  const slug = slugify(title) || 'job'
  return `sfv_${stamp}_${slug}_${suffix}`
}

async function listJobIds() {
  await ensureRoots()
  const entries = await readdir(JOBS_ROOT, { withFileTypes: true })
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
}

async function cleanupOldShortFormJobs({ keepLatest = KEEP_RECENT_JOBS, preserveJobIds = [] } = {}) {
  if (keepLatest <= 0) return
  const jobIds = await listJobIds()
  const jobs = await Promise.all(jobIds.map(loadJob))
  const preserved = new Set(preserveJobIds.filter(Boolean))
  const removable = sortByUpdatedDesc(jobs.filter(Boolean))
    .filter((job) => !preserved.has(job.id))
    .slice(keepLatest)

  for (const job of removable) {
    await removePathIfExists(jobDir(job.id))
  }
}

async function loadJob(jobId) {
  const job = await readJsonIfExists(jobFile(jobId), null)
  if (!job) return null
  return job
}

async function saveJob(job) {
  job.updatedAt = nowIso()
  await writeJson(jobFile(job.id), job)
  return job
}

function setStep(job, key, patch) {
  const step = job.steps.find((candidate) => candidate.key === key)
  if (!step) return
  Object.assign(step, patch)
}

function setStepRunning(job, key, message) {
  setStep(job, key, {
    status: 'running',
    startedAt: nowIso(),
    finishedAt: null,
    message,
    warning: null,
    error: null
  })
}

function setStepDone(job, key, message, outputs = {}) {
  setStep(job, key, {
    status: 'done',
    finishedAt: nowIso(),
    message,
    outputs,
    error: null
  })
}

function setStepWarning(job, key, message, warning, outputs = {}) {
  setStep(job, key, {
    status: 'warning',
    finishedAt: nowIso(),
    message,
    warning,
    outputs,
    error: null
  })
}

function setStepFailed(job, key, message, error) {
  setStep(job, key, {
    status: 'failed',
    finishedAt: nowIso(),
    message,
    error: error instanceof Error ? error.message : String(error)
  })
}

function sanitizeClipFiles(files) {
  return files
    .filter((fileName) => VIDEO_EXTS.has(path.extname(fileName).toLowerCase()))
    .sort((left, right) => left.localeCompare(right))
}

function relativeToJob(jobId, absolutePath) {
  return path.relative(jobDir(jobId), absolutePath).replaceAll(path.sep, '/')
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value) {
  return normalizeText(value).split(' ').filter(Boolean)
}

function uniqueTokens(value) {
  return [...new Set(tokenize(value))]
}

function jaccardSimilarity(left, right) {
  const leftSet = new Set(tokenize(left))
  const rightSet = new Set(tokenize(right))
  if (leftSet.size === 0 || rightSet.size === 0) return 0
  let overlap = 0
  for (const token of leftSet) {
    if (rightSet.has(token)) overlap += 1
  }
  return overlap / (leftSet.size + rightSet.size - overlap)
}

function repetitionPenalty(text) {
  const tokens = tokenize(text)
  if (tokens.length === 0) return 2
  const unique = new Set(tokens)
  const ratio = unique.size / tokens.length
  return ratio < 0.55 ? 2.5 : ratio < 0.7 ? 1.5 : 0
}

function overlapScore(left, right) {
  const leftTokens = uniqueTokens(left)
  const rightTokens = new Set(uniqueTokens(right))
  if (leftTokens.length === 0 || rightTokens.size === 0) return 0
  let overlap = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1
  }
  return overlap / leftTokens.length
}

function buildSegmentFromWords(clip, words) {
  const cleanedWords = words
    .map((word) => ({
      word: String(word.word ?? '').trim(),
      start: Number(word.start ?? 0),
      end: Number(word.end ?? word.start ?? 0)
    }))
    .filter((word) => word.word)

  if (cleanedWords.length === 0) return null

  const text = cleanedWords
    .map((word) => word.word)
    .join(' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim()

  if (!text) return null

  return {
    clipIndex: clip.index,
    sourceFileName: clip.sourceFileName,
    clipPath: clip.cleanedPath,
    start: Number(cleanedWords[0].start ?? 0),
    end: Number(cleanedWords[cleanedWords.length - 1].end ?? cleanedWords[cleanedWords.length - 1].start ?? 0),
    text,
    words: cleanedWords
  }
}

function collapseInternalRetake(clip, segment) {
  const words = Array.isArray(segment?.words) ? segment.words : []
  if (words.length < 10) return segment

  let bestCandidate = null
  for (let splitIndex = 3; splitIndex <= words.length - 3; splitIndex += 1) {
    const leftWords = words.slice(0, splitIndex)
    const rightWords = words.slice(splitIndex)
    const leftText = leftWords.map((word) => word.word).join(' ')
    const rightText = rightWords.map((word) => word.word).join(' ')
    const similarity = jaccardSimilarity(leftText, rightText)
    if (similarity < 0.72) continue
    if (rightWords.length < leftWords.length - 2) continue

    const candidate = buildSegmentFromWords(clip, rightWords)
    if (!candidate) continue
    if (!bestCandidate || similarity > bestCandidate.similarity) {
      bestCandidate = {
        similarity,
        segment: candidate
      }
    }
  }

  return bestCandidate?.segment ?? segment
}

function pruneClipRetakes(clip, segments) {
  const normalizedSegments = segments
    .map((segment) => collapseInternalRetake(clip, segment))
    .filter(Boolean)

  const pruned = []
  for (const segment of normalizedSegments) {
    const previous = pruned[pruned.length - 1]
    if (!previous) {
      pruned.push(segment)
      continue
    }

    const similarity = jaccardSimilarity(previous.text, segment.text)
    const gap = segment.start - previous.end
    if (similarity >= 0.58 && gap <= 1.2) {
      const previousComplete = !looksLikeDanglingPhrase(previous.text) && /[.?!]$/.test(previous.text)
      const currentComplete = !looksLikeDanglingPhrase(segment.text) && /[.?!]$/.test(segment.text)
      if (currentComplete && !previousComplete) {
        pruned[pruned.length - 1] = segment
        continue
      }
      if (currentComplete === previousComplete) {
        const previousTokens = tokenize(previous.text).length
        const currentTokens = tokenize(segment.text).length
        if (currentTokens >= previousTokens) {
          pruned[pruned.length - 1] = segment
          continue
        }
      }
    }

    pruned.push(segment)
  }

  return pruned
}

function looksLikeDanglingPhrase(text) {
  const tokens = tokenize(text)
  if (tokens.length <= 2) return true
  const last = tokens[tokens.length - 1] ?? ''
  return new Set([
    'att',
    'det',
    'då',
    'eller',
    'ens',
    'för',
    'genom',
    'med',
    'men',
    'och',
    'om',
    'som',
    'utan'
  ]).has(last)
}

async function listSourceClipFiles(sourcePath) {
  const entries = await readdir(sourcePath, { withFileTypes: true })
  return sanitizeClipFiles(entries.filter((entry) => entry.isFile()).map((entry) => entry.name))
}

import { run as findNewsArticleAgent } from './agents/findNewsArticle.mjs'
import { run as generateSocialCopyAgent } from './agents/generateSocialCopy.mjs'
import { startCloudWatcherUpload } from './shortFormCloudUpload.mjs'

async function findNewsArticle(transcriptText) {
  const result = await findNewsArticleAgent({ text: transcriptText, topN: 3 })
  return { url: result.url ?? null, candidates: result.candidates ?? [] }
}

async function readArticleTxtIfPresent(sourcePath) {
  const candidates = ['article.txt', 'article.txt.txt']
  for (const fileName of candidates) {
    const articleTxtPath = path.resolve(sourcePath, fileName)
    if (!existsSync(articleTxtPath)) continue
    const raw = await readFile(articleTxtPath, 'utf-8')
    const firstLine = raw.split(/\r?\n/).map((line) => line.trim()).find(Boolean)
    if (firstLine) return firstLine
  }
  return null
}

async function readScriptIfPresent(job) {
  const candidates = [
    path.resolve(jobDir(job.id), 'renders', 'script.txt'),
    path.resolve(job.source.sourcePath, 'script.txt')
  ]

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue
    const buffer = await readFile(filePath)
    let text = buffer.toString('utf-8')
    if (text.includes('\uFFFD')) {
      text = buffer.toString('latin1')
    }
    return {
      path: filePath,
      text
    }
  }

  const entries = await readdir(JOBS_ROOT, { withFileTypes: true }).catch(() => [])
  const priorJobs = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name === job.id) continue
    const manifestPath = path.resolve(JOBS_ROOT, entry.name, 'job.json')
    if (!existsSync(manifestPath)) continue
    const manifest = await readJsonIfExists(manifestPath, null)
    if (!manifest) continue
    if (manifest?.source?.sourcePath !== job.source.sourcePath) continue
    const scriptPath = path.resolve(JOBS_ROOT, entry.name, 'renders', 'script.txt')
    if (!existsSync(scriptPath)) continue
    priorJobs.push({
      updatedAt: String(manifest.updatedAt ?? manifest.createdAt ?? ''),
      scriptPath
    })
  }

  priorJobs.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const fallback = priorJobs[0]
  if (fallback) {
    const buffer = await readFile(fallback.scriptPath)
    let text = buffer.toString('utf-8')
    if (text.includes('\uFFFD')) {
      text = buffer.toString('latin1')
    }
    return {
      path: fallback.scriptPath,
      text
    }
  }

  return null
}

async function captureArticleScreenshot(articleUrl, outputPath) {
  await ensureDir(path.dirname(outputPath))
  const { chromium } = await import('playwright-core')
  const browser = await chromium.launch({
    headless: true,
    executablePath: ARTICLE_SCREENSHOT_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-notifications']
  })

  try {
    const context = await browser.newContext({
      viewport: { width: ARTICLE_VIEWPORT_WIDTH, height: ARTICLE_VIEWPORT_HEIGHT },
      deviceScaleFactor: 2,
      isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    })
    const page = await context.newPage()

    const blockedPatterns = [
      '**/*cookielaw*', '**/*onetrust*', '**/*cookiebot*', '**/*didomi*', '**/*usercentrics*',
      '**/*consentmanager*', '**/*sourcepoint*', '**/*sp-prod.net*', '**/*cmp*',
      '**/*doubleclick.net*', '**/*googlesyndication.com*', '**/*googletagservices.com*',
      '**/*pubmatic.com*', '**/*rubiconproject.com*', '**/*openx.net*', '**/*adnxs.com*',
      '**/*taboola.com*', '**/*outbrain.com*', '**/*criteo.com*', '**/*prebid.*'
    ]
    for (const pattern of blockedPatterns) {
      await page.route(pattern, (route) => route.abort()).catch(() => {})
    }

    await page.addInitScript(() => {
      try {
        for (const key of ['cookieConsent', 'gdpr_consent', 'cookie_consent', 'CookieConsent', 'consentGranted', 'euconsent-v2']) {
          localStorage.setItem(key, '1')
        }
        document.cookie = 'CookieConsent=true;path=/'
        document.cookie = 'cookieconsent_status=dismiss;path=/'
        document.cookie = 'gdpr=1;path=/'
        window.__tcfapi = (_cmd, _ver, cb) => {
          if (typeof cb === 'function') cb({ gdprApplies: false, tcString: '', cmpStatus: 'loaded', eventStatus: 'useractioncomplete' }, true)
        }
        window.__cmp = (_cmd, _arg, cb) => { if (typeof cb === 'function') cb(null, true) }
      } catch (_) {}
    })

    await page.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2500)
    await page.keyboard.press('Escape').catch(() => {})

    const labels = [
      'Acceptera', 'Godkänn', 'Godkänn alla', 'Accept', 'Accept all', 'Tillåt alla', 'Allow all',
      'Jag förstår', 'I understand', 'OK', 'Okej', 'Ja, jag accepterar', 'Acceptera alla',
      'Tillåt alla cookies', 'Godkänn alla cookies', 'Spara inställningar'
    ]
    for (const frame of page.frames()) {
      for (const label of labels) {
        const clicked = await frame.getByRole('button', { name: label, exact: false }).click({ timeout: 600, force: true }).then(() => true).catch(() => false)
        if (clicked) break
      }
    }

    const cleanupOverlays = async () => {
      await page.evaluate(() => {
        const selectors = [
          '#onetrust-banner-sdk', '#onetrust-consent-sdk', '.onetrust-pc-dark-filter',
          '.qc-cmp2-container', '.qc-cmp2-ui-container', '.fc-dialog-container', '.fc-consent-root',
          '[class*="CookieBanner"]', '[class*="cookie-banner"]', '[class*="cookiebanner"]',
          '[class*="CookieConsent"]', '[id*="cookieBanner"]', '[id*="cookieConsent"]',
          '[aria-label*="cookie" i]', '[id*="consent" i]', '[class*="consent" i]', '[id*="gdpr" i]',
          '[id^="sp_message_container"]', '[id^="sp_message"]', '.sp_message-overlay', 'iframe[src*="sourcepoint"]',
          '[class*="ad-slot" i]', '[class*="advert" i]', '[id*="advert" i]', '[class*="sponsored" i]',
          '[class*="annons" i]', '[id*="annons" i]', 'ins.adsbygoogle'
        ]
        for (const selector of selectors) {
          try { document.querySelectorAll(selector).forEach((node) => node.remove()) } catch (_) {}
        }
        const width = window.innerWidth
        const height = window.innerHeight
        for (const el of [...document.querySelectorAll('body *')]) {
          try {
            const style = window.getComputedStyle(el)
            const rect = el.getBoundingClientRect()
            const fixed = style.position === 'fixed' || style.position === 'sticky'
            if (fixed && rect.width > width * 0.4 && rect.height > 50) el.remove()
            if (fixed && rect.width > width * 0.8 && rect.height > height * 0.5) el.remove()
          } catch (_) {}
        }
        document.body.style.setProperty('overflow', 'auto', 'important')
        document.documentElement.style.setProperty('overflow', 'auto', 'important')
      }).catch(() => {})
    }

    await cleanupOverlays()
    await page.waitForTimeout(500)
    await cleanupOverlays()
    await page.evaluate(() => window.scrollTo(0, 100)).catch(() => {})
    await page.waitForTimeout(500)
    await cleanupOverlays()
    await page.screenshot({ path: outputPath, fullPage: false })
    await context.close()
  } finally {
    await browser.close().catch(() => {})
  }
}
function parseScriptBeats(scriptText) {
  const lines = String(scriptText ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())

  const beats = []
  let current = null

  for (const line of lines) {
    if (!line) continue
    if (/^[A-ZÅÄÖ][A-ZÅÄÖ\s-]{1,40}$/.test(line)) {
      if (current && current.textParts.length > 0) {
        beats.push({
          key: current.key,
          text: current.textParts.join(' ').replace(/\s+/g, ' ').trim()
        })
      }
      current = {
        key: line,
        textParts: []
      }
      continue
    }

    if (!current) continue
    current.textParts.push(line)
  }

  if (current && current.textParts.length > 0) {
    beats.push({
      key: current.key,
      text: current.textParts.join(' ').replace(/\s+/g, ' ').trim()
    })
  }

  return beats
}

async function ffprobeJson(filePath) {
  const result = await runCommand('ffprobe', [
    '-v', 'error',
    '-show_streams',
    '-show_format',
    '-of', 'json',
    filePath
  ])
  return JSON.parse(result.stdout)
}

function parseLeadingTrailingSilence(stderr, durationSeconds) {
  const starts = [...stderr.matchAll(/silence_start:\s*([0-9.]+)/g)].map((match) => Number(match[1]))
  const ends = [...stderr.matchAll(/silence_end:\s*([0-9.]+)/g)].map((match) => Number(match[1]))

  let leadingSeconds = 0
  if (starts.length > 0 && starts[0] <= 0.05 && ends.length > 0) {
    leadingSeconds = Math.min(ends[0], MAX_LEADING_TRIM)
  }

  let trailingSeconds = 0
  if (starts.length > 0) {
    const lastStart = starts[starts.length - 1]
    const matchingEnd = ends[ends.length - 1]
    const silenceTouchesEnd = (matchingEnd && Math.abs(durationSeconds - matchingEnd) <= 0.2) || lastStart >= durationSeconds - MAX_TRAILING_TRIM - 0.2
    if (silenceTouchesEnd) {
      const rawTrailingSilence = Math.max(0, durationSeconds - lastStart)
      if (rawTrailingSilence >= MIN_TRAILING_SILENCE_TO_TRIM) {
        trailingSeconds = Math.min(
          Math.max(0, rawTrailingSilence - TRAILING_TRIM_SAFETY_PADDING),
          MAX_TRAILING_TRIM
        )
      }
    }
  }

  return { leadingSeconds, trailingSeconds }
}

async function detectTrim(filePath, durationSeconds) {
  const result = await runCommand(
    'nice',
    [
      '-n',
      String(NICE_LEVEL),
      'ffmpeg',
      '-hide_banner',
      '-threads', String(FFMPEG_THREADS),
      '-i', filePath,
      '-af', `silencedetect=noise=${SILENCE_NOISE}:d=${SILENCE_MIN}`,
      '-f', 'null',
      '-'
    ],
    { allowNonZero: true }
  )
  return parseLeadingTrailingSilence(result.stderr, durationSeconds)
}

async function trimClip(sourcePath, outputPath, startSeconds, endSeconds, hasAudio) {
  const duration = Math.max(0.1, endSeconds - startSeconds)
  const args = [
    '-y',
    '-hide_banner',
    '-threads', String(FFMPEG_THREADS),
    '-ss', startSeconds.toFixed(3),
    '-i', sourcePath,
    '-t', duration.toFixed(3),
    '-c:v', 'prores_ks',
    '-profile:v', '4',
    '-pix_fmt', 'yuva444p10le'
  ]

  if (hasAudio) {
    args.push('-c:a', 'pcm_s16le')
  } else {
    args.push('-an')
  }

  args.push(outputPath)
  await runCommand('nice', ['-n', String(NICE_LEVEL), 'ffmpeg', ...args])
}

async function createProxyClip(sourcePath, outputPath, startSeconds, endSeconds, hasAudio) {
  const duration = Math.max(0.1, endSeconds - startSeconds)
  const args = [
    '-y',
    '-hide_banner',
    '-threads', String(FFMPEG_THREADS),
    '-ss', startSeconds.toFixed(3),
    '-i', sourcePath,
    '-t', duration.toFixed(3),
    '-vf', `fps=30,scale=-2:${PROXY_HEIGHT}:force_original_aspect_ratio=decrease,format=yuv420p`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '24',
    '-b:v', PROXY_VIDEO_BITRATE,
    '-x264-params', `threads=${FFMPEG_THREADS}`
  ]

  if (hasAudio) {
    args.push('-c:a', 'aac', '-b:a', PROXY_AUDIO_BITRATE)
  } else {
    args.push('-an')
  }

  args.push(outputPath)
  await runCommand('nice', ['-n', String(NICE_LEVEL), 'ffmpeg', ...args])
}

async function trimSelectedSegment(sourcePath, outputPath, startSeconds, endSeconds) {
  await trimClip(sourcePath, outputPath, startSeconds, endSeconds, true)
}

async function compositeSpeakerOverArticle(articleImagePath, speakerPath, outputPath, durationSeconds) {
  const filter = [
    '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]',
    '[1:v]scale=500:-2:force_original_aspect_ratio=decrease,fps=30[fg]',
    '[bg][fg]overlay=W-w:H-h:format=auto[v]',
    '[v]format=yuv420p[vout]'
  ].join(';')

  await runCommand('nice', [
    '-n',
    String(NICE_LEVEL),
    'ffmpeg',
    '-y',
    '-hide_banner',
    '-threads', String(FFMPEG_THREADS),
    '-loop', '1',
    '-i', articleImagePath,
    '-i', speakerPath,
    '-filter_complex', filter,
    '-map', '[vout]',
    '-map', '1:a?',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-x264-params', `threads=${FFMPEG_THREADS}`,
    '-r', '30',
    '-c:a', 'aac',
    '-b:a', '192k',
    ...(durationSeconds && durationSeconds > 0 ? ['-t', durationSeconds.toFixed(3)] : ['-shortest']),
    outputPath
  ])
}

async function synthesizeTranscriptTiming(filePath, transcript) {
  const text = String(transcript?.text ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return transcript
  const hasWords = Array.isArray(transcript?.words) && transcript.words.length > 0
  const hasSegmentWords = Array.isArray(transcript?.segments) && transcript.segments.some((segment) => Array.isArray(segment?.words) && segment.words.length > 0)
  if (hasWords || hasSegmentWords) return transcript

  const probe = await ffprobeJson(filePath).catch(() => null)
  const duration = Math.max(0.5, Number(probe?.format?.duration ?? 0))
  const tokens = text.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return transcript
  const slice = duration / tokens.length
  const words = tokens.map((word, index) => ({
    word,
    start: Number((slice * index).toFixed(3)),
    end: Number((slice * (index + 1)).toFixed(3))
  }))
  return {
    ...transcript,
    segments: [{ id: 0, start: 0, end: Number(duration.toFixed(3)), text, words }],
    words
  }
}
async function transcribeClipAudio(filePath, transcriptsDir) {
  await ensureDir(transcriptsDir)
  const jsonPath = path.resolve(transcriptsDir, `${path.basename(filePath, path.extname(filePath))}.json`)

  try {
    await runCommand('nice', [
      '-n',
      String(NICE_LEVEL),
      'python3',
      '-m',
      'whisper',
      filePath,
      '--model', WHISPER_MODEL,
      '--device', 'cpu',
      '--language', WHISPER_LANGUAGE,
      '--task', 'transcribe',
      '--output_dir', transcriptsDir,
      '--output_format', 'json',
      '--word_timestamps', 'True',
      '--verbose', 'False',
      '--fp16', 'False',
      '--condition_on_previous_text', 'False',
      '--threads', String(WHISPER_THREADS)
    ], {
      env: {
        OMP_NUM_THREADS: String(WHISPER_THREADS),
        MKL_NUM_THREADS: String(WHISPER_THREADS),
        OPENBLAS_NUM_THREADS: String(WHISPER_THREADS),
        NUMEXPR_NUM_THREADS: String(WHISPER_THREADS)
      }
    })

    return readJsonIfExists(jsonPath, null)
  } catch (whisperError) {
    if (process.env.OPERATOR_HUB_SHORT_FORM_DISABLE_TRANSCRIBE_FALLBACK === '1' || !process.env.OPENAI_API_KEY) {
      throw whisperError
    }

    const audioBuffer = await readFile(filePath)
    const form = new FormData()
    form.append('file', new Blob([audioBuffer], { type: 'video/mp4' }), path.basename(filePath))
    form.append('model', TRANSCRIBE_MODEL)
    form.append('language', WHISPER_LANGUAGE)
    form.append('response_format', 'verbose_json')
    form.append('timestamp_granularities[]', 'word')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form
    })

    if (!response.ok) {
      const message = await response.text().catch(() => '')
      throw new Error(`Local Whisper failed and OpenAI transcription failed: HTTP ${response.status}${message ? ` ${message.slice(0, 240)}` : ''}`)
    }

    const transcript = await synthesizeTranscriptTiming(filePath, await response.json())
    await writeFile(jsonPath, `${JSON.stringify(transcript, null, 2)}\n`, 'utf-8')
    return transcript
  }
}
function transcriptWordsFromWhisper(whisperJson) {
  const segments = Array.isArray(whisperJson?.segments) ? whisperJson.segments : []
  const words = []

  for (const segment of segments) {
    if (Array.isArray(segment?.words) && segment.words.length > 0) {
      for (const word of segment.words) {
        const text = String(word?.word ?? '').trim()
        if (!text) continue
        words.push({
          word: text,
          start: Number(word?.start ?? segment.start ?? 0),
          end: Number(word?.end ?? segment.end ?? word?.start ?? 0)
        })
      }
      continue
    }

    const fallbackWords = String(segment?.text ?? '').trim().split(/\s+/).filter(Boolean)
    if (fallbackWords.length === 0) continue
    const segmentStart = Number(segment?.start ?? 0)
    const segmentEnd = Number(segment?.end ?? segmentStart)
    const slice = Math.max(0.05, (segmentEnd - segmentStart) / fallbackWords.length)
    fallbackWords.forEach((word, index) => {
      words.push({
        word,
        start: segmentStart + slice * index,
        end: segmentStart + slice * (index + 1)
      })
    })
  }

  return words
}

function splitTranscriptIntoSegments(clip, transcript) {
  const words = Array.isArray(transcript?.words) ? transcript.words : []
  if (words.length === 0) return []

  const segments = []
  let current = []

  function flush() {
    if (current.length === 0) return
    const segment = buildSegmentFromWords(clip, current)
    if (!segment) {
      current = []
      return
    }
    segments.push(segment)
    current = []
  }

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]
    current.push(word)
    const next = words[index + 1]
    const token = String(word.word ?? '')
    const gap = next ? Number(next.start ?? 0) - Number(word.end ?? word.start ?? 0) : 0
    const shouldFlush = /[.!?]$/.test(token) || current.length >= 10 || gap > 0.8 || !next
    if (shouldFlush) flush()
  }

  return pruneClipRetakes(clip, segments)
}

function scoreSegment(segment, { isEarly, isLate }) {
  const text = String(segment.text ?? '').trim()
  const tokens = tokenize(text)
  if (tokens.length === 0) return { score: -10, reasons: ['empty_text'] }

  let score = 0
  const reasons = []
  const duration = Math.max(0, Number(segment.end ?? 0) - Number(segment.start ?? 0))

  if (tokens.length >= 5 && tokens.length <= 14) {
    score += 2
    reasons.push('good_length')
  } else if (tokens.length >= 3 && tokens.length <= 18) {
    score += 1
    reasons.push('usable_length')
  } else {
    score -= 1.5
    reasons.push('awkward_length')
  }

  if (duration >= 1.2 && duration <= 5.5) {
    score += 1.5
    reasons.push('good_duration')
  } else if (duration > 6.5) {
    score -= 1
    reasons.push('long_segment')
  }

  const repPenalty = repetitionPenalty(text)
  if (repPenalty > 0) {
    score -= repPenalty
    reasons.push('repetition_penalty')
  }

  if (/\d/.test(text)) {
    score += 1.4
    reasons.push('has_number_hook')
  }

  if (/[?]/.test(text)) {
    score += isLate ? 2.2 : 0.4
    reasons.push(isLate ? 'late_question_cta' : 'question')
  }

  if (/(jag|jag tycker|jag gillar|jag är inte|i personally|i think|i'm not comfortable)/i.test(text)) {
    score += 1.8
    reasons.push('personal_opinion')
  }

  if (/(meta|smart glasses|ansiktsigenk|face recognition|technology|consent|spåra|track people)/i.test(text)) {
    score += 1.5
    reasons.push('topic_specific')
  }

  if (/^(and|men|och|but)\b/i.test(text) && tokens.length < 6) {
    score -= 1
    reasons.push('weak_opening')
  }

  if (isEarly && /\d/.test(text)) {
    score += 1
    reasons.push('early_hook')
  }

  return { score, reasons }
}

function looksLikeWholeClipFlow(clips, transcriptRecords) {
  const keptClips = clips.filter((clip) => clip.kept)
  if (keptClips.length === 0 || keptClips.length > 12) return false

  const shortEnough = keptClips.filter((clip) => Number(clip.durationSeconds ?? 0) <= 8.5).length
  const transcriptBacked = keptClips.filter((clip) => {
    const transcript = transcriptRecords.find((record) => record.clipIndex === clip.index)
    return Boolean(String(transcript?.text ?? '').trim())
  }).length

  return shortEnough / keptClips.length >= 0.8 && transcriptBacked === keptClips.length
}

function buildWholeClipSegment(clip, transcript, segmentIndex) {
  const words = Array.isArray(transcript?.words) ? transcript.words : []
  const text = String(transcript?.text ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return null

  const start = 0
  const end = Number(clip.durationSeconds ?? 0)

  return {
    clipIndex: clip.index,
    sourceFileName: clip.sourceFileName,
    clipPath: clip.cleanedPath,
    start,
    end: Math.max(start + 0.01, end),
    text,
    words,
    segmentIndex,
    score: 5,
    reasons: ['whole_clip'],
    keep: true,
    dropReason: null
  }
}

function selectTranscriptSegments(clips, transcriptRecords) {
  const keptSegments = clips
    .filter((clip) => clip.kept)
    .map((clip, index) => {
      const transcript = transcriptRecords.find((record) => record.clipIndex === clip.index)
      return buildWholeClipSegment(clip, transcript, index)
    })
    .filter(Boolean)

  return {
    mode: 'whole_clips',
    allSegments: keptSegments,
    keptSegments
  }
}

function selectSegmentsFromScript(clips, transcriptRecords, beats) {
  const allSegments = []
  for (const clip of clips) {
    if (!clip.kept) continue
    const transcript = transcriptRecords.find((record) => record.clipIndex === clip.index)
    const segments = splitTranscriptIntoSegments(clip, transcript)
    segments.forEach((segment, index) => {
      const { score, reasons } = scoreSegment(segment, {
        isEarly: clip.index <= 1 && index === 0,
        isLate: clip.index >= Math.max(0, clips.length - 2)
      })
      allSegments.push({
        ...segment,
        segmentIndex: index,
        score,
        reasons,
        keep: false,
        dropReason: 'not_selected_by_script',
        scriptBeat: null
      })
    })
  }

  const timelineSegments = [...allSegments].sort((left, right) => left.clipIndex - right.clipIndex || left.start - right.start)
  const keptSegments = []
  const usedKeys = new Set()

  function scoreAgainstBeat(target, segments) {
    const ordered = [...segments].sort((left, right) => left.clipIndex - right.clipIndex || left.start - right.start)
    const text = ordered.map((segment) => segment.text).join(' ').replace(/\s+/g, ' ').trim()
    const lexical = overlapScore(target, text)
    const semantic = jaccardSimilarity(target, text)
    const avgSegmentScore = ordered.reduce((sum, segment) => sum + Math.max(0, segment.score), 0) / Math.max(1, ordered.length)
    let combined = lexical * 0.76 + semantic * 0.18 + avgSegmentScore * 0.03

    if (/[.?!]$/.test(text)) combined += 0.06
    if (looksLikeDanglingPhrase(text)) combined -= 0.18
    if (/^(och|men)\b/i.test(text) && ordered.length === 1) combined -= 0.08
    if ((text.match(/[?]/g) ?? []).length > 1) combined -= 0.16

    for (let index = 1; index < ordered.length; index += 1) {
      const similarity = jaccardSimilarity(ordered[index - 1].text, ordered[index].text)
      if (similarity > 0.82) combined -= 0.18
    }

    return {
      score: combined,
      text,
      start: ordered[0]?.start ?? 0,
      end: ordered[ordered.length - 1]?.end ?? 0,
      words: ordered.flatMap((segment) => segment.words).sort((left, right) => left.start - right.start),
      ordered
    }
  }

  for (const beat of beats) {
    const target = beat.text
    let best = null
    let bestScore = 0

    for (let startIndex = 0; startIndex < timelineSegments.length; startIndex += 1) {
      const first = timelineSegments[startIndex]
      const firstKey = `${first.clipIndex}:${first.segmentIndex}`
      if (usedKeys.has(firstKey)) continue

      const combo = []
      let totalDuration = 0
      for (let endIndex = startIndex; endIndex < timelineSegments.length && endIndex < startIndex + 3; endIndex += 1) {
        const candidate = timelineSegments[endIndex]
        const candidateKey = `${candidate.clipIndex}:${candidate.segmentIndex}`
        if (usedKeys.has(candidateKey)) break
        if (endIndex > startIndex) {
          const previous = timelineSegments[endIndex - 1]
          const gap = candidate.start - previous.end
          const clipJump = candidate.clipIndex - previous.clipIndex
          if (clipJump !== 0) break
          if (gap > 1.1) break
        }

        combo.push(candidate)
        totalDuration += candidate.end - candidate.start
        if (totalDuration > 10.5) break

        const scored = scoreAgainstBeat(target, combo)
        if (scored.score > bestScore) {
          bestScore = scored.score
          best = scored
        }
      }
    }

    if (!best || bestScore < 0.22) continue

    const primary = best.ordered[0]
    const selected = {
      ...primary,
      start: best.start,
      end: best.end,
      text: best.text,
      words: best.words,
      keep: true,
      dropReason: null,
      scriptBeat: beat.key,
      matchScore: Number(bestScore.toFixed(3)),
      combinedSegmentCount: best.ordered.length
    }

    for (const segment of best.ordered) {
      const uniqueKey = `${segment.clipIndex}:${segment.segmentIndex}`
      usedKeys.add(uniqueKey)
      segment.keep = true
      segment.dropReason = null
      segment.scriptBeat = beat.key
    }
    keptSegments.push(selected)
  }

  return {
    mode: 'script_guided',
    beats,
    allSegments,
    scriptPath: null,
    keptSegments: keptSegments.sort((left, right) => left.clipIndex - right.clipIndex || left.start - right.start)
  }
}

function buildCaptionPages(clips, transcriptRecords, preset) {
  const pages = []
  let globalOffset = 0

  for (const clip of clips) {
    if (!clip.kept) continue
    const transcript = transcriptRecords.find((record) => record.clipIndex === clip.index)
    const words = Array.isArray(transcript?.words) ? transcript.words : []
    if (words.length === 0) {
      globalOffset += Number(clip.durationSeconds ?? 0)
      continue
    }

    for (let index = 0; index < words.length; index += 4) {
      const chunk = words.slice(index, index + 4)
      if (chunk.length === 0) continue
      pages.push({
        start: Number((globalOffset + chunk[0].start).toFixed(3)),
        end: Number((globalOffset + chunk[chunk.length - 1].end).toFixed(3)),
        text: chunk.map((word) => String(word.word).toUpperCase()).join(' '),
        highlighted: [String(chunk[chunk.length - 1].word).toUpperCase()],
        words: chunk.map((word) => ({
          word: String(word.word).toUpperCase(),
          start: Number((globalOffset + word.start).toFixed(3)),
          end: Number((globalOffset + word.end).toFixed(3))
        }))
      })
    }

    globalOffset += Number(clip.durationSeconds ?? 0)
  }

  return { preset, pages }
}

function formatSrtTimestamp(seconds) {
  const totalMs = Math.max(0, Math.round(seconds * 1000))
  const hours = Math.floor(totalMs / 3_600_000)
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000)
  const secs = Math.floor((totalMs % 60_000) / 1000)
  const ms = totalMs % 1000
  return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':') + `,${String(ms).padStart(3, '0')}`
}

function captionPagesToSrt(pages) {
  return pages.map((page, index) => {
    return [
      String(index + 1),
      `${formatSrtTimestamp(page.start)} --> ${formatSrtTimestamp(page.end)}`,
      page.text,
      ''
    ].join('\n')
  }).join('\n')
}

function assTimestamp(seconds) {
  const totalCs = Math.max(0, Math.round(seconds * 100))
  const hours = Math.floor(totalCs / 360000)
  const minutes = Math.floor((totalCs % 360000) / 6000)
  const secs = Math.floor((totalCs % 6000) / 100)
  const cs = totalCs % 100
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function escapeAssText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\n/g, '\\N')
}

function buildWordHighlightEvents(page) {
  const words = Array.isArray(page.words) ? page.words : []
  if (words.length === 0) {
    return [`Dialogue: 0,${assTimestamp(page.start)},${assTimestamp(page.end)},ShortForm,,0,0,0,,{\\an5}${escapeAssText(page.text)}`]
  }

  const events = []
  for (let activeIdx = 0; activeIdx < words.length; activeIdx += 1) {
    const activeWord = words[activeIdx]
    const nextWord = words[activeIdx + 1]
    const evStart = activeWord.start
    const evEnd = nextWord ? nextWord.start : page.end
    if (evEnd <= evStart) continue

    const lineParts = words.map((w, i) => {
      const escaped = escapeAssText(w.word)
      if (i === activeIdx) {
        return `{\\c&H0000A5FF&\\fscx118\\fscy118}${escaped}{\\r}`
      }
      return escaped
    })

    events.push(
      `Dialogue: 0,${assTimestamp(evStart)},${assTimestamp(evEnd)},ShortForm,,0,0,0,,{\\an5}${lineParts.join(' ')}`
    )
  }

  return events
}

function captionPagesToAss(pages) {
  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
    'Style: ShortForm,Arial,72,&H00FFFFFF,&H00FFFFFF,&H00101010,&H88000000,1,0,0,0,100,100,1.5,0,1,6,3,5,58,58,0,1',
    '',
    '[Events]',
    'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text'
  ]

  const events = pages.flatMap(buildWordHighlightEvents)

  return `${header.join('\n')}\n${events.join('\n')}\n`
}

function buildRenderAlignedCaptionPages(renderSegments, preset) {
  const pages = []
  let globalOffset = 0

  for (const segment of renderSegments) {
    const words = Array.isArray(segment.words) ? segment.words : []
    const sourceDuration = Math.max(0.01, Number(segment.sourceDurationSeconds ?? 0.01))
    const actualDuration = Math.max(0.01, Number(segment.renderDurationSeconds ?? segment.sourceDurationSeconds ?? 0.01))
    const scale = actualDuration / sourceDuration

    if (words.length === 0) {
      globalOffset += actualDuration
      continue
    }

    for (let index = 0; index < words.length; index += 4) {
      const chunk = words.slice(index, index + 4)
      if (chunk.length === 0) continue
      const rebasedWords = chunk.map((word) => ({
        word: String(word.word).toUpperCase(),
        start: Number((globalOffset + Math.max(0, word.start) * scale).toFixed(3)),
        end: Number((globalOffset + Math.max(0, word.end) * scale).toFixed(3))
      }))
      pages.push({
        start: rebasedWords[0].start,
        end: rebasedWords[rebasedWords.length - 1].end,
        text: rebasedWords.map((word) => word.word).join(' '),
        highlighted: [rebasedWords[rebasedWords.length - 1].word],
        words: rebasedWords
      })
    }

    globalOffset += actualDuration
  }

  return { preset, pages }
}

async function createPrepareOutputs(job, clips, transcriptRecords, selection) {
  const currentJobDir = jobDir(job.id)
  const transcriptsDir = path.resolve(currentJobDir, 'transcripts')
  const captionsDir = path.resolve(currentJobDir, 'captions')
  const metadataDir = path.resolve(currentJobDir, 'metadata')
  const logsDir = path.resolve(currentJobDir, 'logs')
  const assetsDir = path.resolve(currentJobDir, 'assets')

  await Promise.all([transcriptsDir, captionsDir, metadataDir, logsDir, assetsDir].map(ensureDir))

  for (const transcriptRecord of transcriptRecords) {
    const transcriptPath = path.resolve(currentJobDir, clips[transcriptRecord.clipIndex].transcriptPath)
    await writeJson(transcriptPath, transcriptRecord)
  }

  const selectedSegments = selection.keptSegments
  const selectionManifestPath = path.resolve(metadataDir, 'selection.json')
  await writeJson(selectionManifestPath, selection)

  const combinedTranscript = {
    fullText: selectedSegments.map((segment) => segment.text).filter(Boolean).join(' ').trim(),
    clips: clips.filter((clip) => clip.kept && clip.transcriptPath).map((clip) => clip.transcriptPath)
  }
  const combinedTranscriptPath = path.resolve(transcriptsDir, 'full-transcript.json')
  await writeJson(combinedTranscriptPath, combinedTranscript)

  const selectedTranscriptRecords = selectedSegments.map((segment, index) => ({
    clipIndex: index,
    text: segment.text,
    words: segment.words
      .filter((word) => Number.isFinite(word?.start) && Number.isFinite(word?.end))
      .map((word) => ({
        ...word,
        start: Number(Math.max(0, word.start - segment.start).toFixed(3)),
        end: Number(Math.max(0, word.end - segment.start).toFixed(3))
      }))
      .filter((word) => word.end > word.start)
  }))
  const selectedClips = selectedSegments.map((segment, index) => ({
    index,
    kept: true,
    durationSeconds: Number((segment.end - segment.start).toFixed(3))
  }))
  const captions = buildCaptionPages(selectedClips, selectedTranscriptRecords, job.config.captionPreset ?? 'clean-news')
  const captionsPath = path.resolve(captionsDir, 'captions.json')
  await writeJson(captionsPath, captions)
  const captionsSrtPath = path.resolve(captionsDir, 'captions.srt')
  await writeFile(captionsSrtPath, `${captionPagesToSrt(captions.pages)}\n`, 'utf-8')
  const captionsAssPath = path.resolve(captionsDir, 'captions.ass')
  await writeFile(captionsAssPath, captionPagesToAss(captions.pages), 'utf-8')

  const manualUrl = job.config.manualArticleUrl
  const txtUrl = await readArticleTxtIfPresent(job.source.sourcePath)
  const autoResult = (!manualUrl && !txtUrl) ? await findNewsArticle(combinedTranscript.fullText) : null
  const autoUrl = autoResult?.url ?? null
  const autoCandidates = autoResult?.candidates ?? []
  const selectedArticleUrl = manualUrl || txtUrl || autoUrl
  // Only capture screenshot when URL is from a trusted source (manual/txt) or already approved.
  // Auto-found articles go to pending_article_review — screenshot captured after approval.
  let articleScreenshotPath = null
  if (selectedArticleUrl && (manualUrl || txtUrl)) {
    const screenshotPath = path.resolve(assetsDir, 'article-mobile.png')
    await captureArticleScreenshot(selectedArticleUrl, screenshotPath)
    articleScreenshotPath = relativeToJob(job.id, screenshotPath)
  }
  const articleSource = manualUrl ? 'manual_ui' : txtUrl ? 'article_txt' : autoUrl ? 'auto_search' : 'none'
  const articleSelection = {
    selectedUrl: selectedArticleUrl,
    source: articleSource,
    confidence: manualUrl ? 1 : txtUrl ? 0.6 : autoUrl ? 0.5 : 0,
    reasoningSummary: manualUrl
      ? 'Manual override supplied from operator-hub'
      : txtUrl
        ? 'Loaded fallback URL from article.txt'
        : autoUrl
          ? `Auto-discovered via Omni search: ${autoUrl}`
          : 'No article found',
    screenshotPath: articleScreenshotPath,
    candidates: autoCandidates,
    needsReview: Boolean(autoUrl && !manualUrl && !txtUrl)
  }

  const socialPosts = {
    generatedAt: nowIso(),
    mode: 'scaffold',
    tikTokInstagramCaption: combinedTranscript.fullText.slice(0, 180),
    youTubeShortsTitle: job.title,
    youTubeShortsDescription: combinedTranscript.fullText.slice(0, 280),
    linkedInPost: combinedTranscript.fullText.slice(0, 400),
    hashtags: ['#shortform', '#operatorhub']
  }
  const socialPostsPath = path.resolve(metadataDir, 'social-posts.json')
  await writeJson(socialPostsPath, socialPosts)

  const renderManifest = {
    jobId: job.id,
    composition: {
      width: 1080,
      height: 1920,
      fps: 30
    },
    speakerClips: selectedSegments.map((segment) => {
      const sourceClip = clips.find((clip) => clip.index === segment.clipIndex)
      const trimStartSeconds = Number(sourceClip?.trimStartSeconds ?? 0)
      const sourceStartSeconds = Number((trimStartSeconds + segment.start).toFixed(3))
      const sourceEndSeconds = Number((trimStartSeconds + segment.end).toFixed(3))
      return {
        sourcePath: sourceClip?.sourcePath ?? null,
        sourceFileName: sourceClip?.sourceFileName ?? null,
        analysisPath: sourceClip?.analysisPath ?? null,
        trimStartSeconds,
        sourceStartSeconds,
        sourceEndSeconds,
        segmentStartSeconds: Number(segment.start.toFixed(3)),
        segmentEndSeconds: Number(segment.end.toFixed(3)),
        durationSeconds: Number((segment.end - segment.start).toFixed(3)),
        words: segment.words
          .filter((word) => Number.isFinite(word?.start) && Number.isFinite(word?.end))
          .map((word) => ({
            word: String(word.word ?? '').trim(),
            start: Number(Math.max(0, word.start - segment.start).toFixed(3)),
            end: Number(Math.max(0, word.end - segment.start).toFixed(3))
          }))
          .filter((word) => word.end > word.start),
        sourceClipIndex: segment.clipIndex,
        text: segment.text
      }
    }).filter((segment) => segment.sourcePath),
    captionsPath: relativeToJob(job.id, captionsPath),
    captionsSrtPath: relativeToJob(job.id, captionsSrtPath),
    captionsAssPath: relativeToJob(job.id, captionsAssPath),
    articleBackgroundPath: articleScreenshotPath,
    transitionPreset: job.config.transitionPreset,
    sfxPreset: job.config.sfxPreset
  }
  const renderManifestPath = path.resolve(metadataDir, 'render-manifest.json')
  await writeJson(renderManifestPath, renderManifest)

  const notesLogPath = path.resolve(logsDir, 'prepare-notes.log')
  await writeFile(
    notesLogPath,
    [
      `[${nowIso()}] Prepare completed.`,
      `Usable clips: ${clips.filter((clip) => clip.kept).length}/${clips.length}`,
      `Selected segments: ${selectedSegments.length}`,
      `Whisper model: ${WHISPER_MODEL}`,
      `Whisper language: ${WHISPER_LANGUAGE}`,
      'Article discovery and final Remotion rendering are still pending implementation.'
    ].join('\n'),
    'utf-8'
  )

  return {
    clips,
    articleSelection,
    summary: {
      clipCount: clips.length,
      usableClipCount: clips.filter((clip) => clip.kept).length,
      fullTranscriptChars: combinedTranscript.fullText.length,
      articleSelected: Boolean(articleSelection.selectedUrl),
      rendered: false
    },
    paths: {
      combinedTranscriptPath: relativeToJob(job.id, combinedTranscriptPath),
      captionsPath: relativeToJob(job.id, captionsPath),
      captionsSrtPath: relativeToJob(job.id, captionsSrtPath),
      captionsAssPath: relativeToJob(job.id, captionsAssPath),
      selectionManifestPath: relativeToJob(job.id, selectionManifestPath),
      socialPostsPath: relativeToJob(job.id, socialPostsPath),
      renderManifestPath: relativeToJob(job.id, renderManifestPath),
      prepareLogPath: relativeToJob(job.id, notesLogPath)
    }
  }
}

export async function listShortFormJobs() {
  const jobIds = await listJobIds()
  const jobs = await Promise.all(jobIds.map(loadJob))
  return sortByUpdatedDesc(jobs.filter(Boolean).map(summarizeJob))
}

export async function getShortFormJob(jobId) {
  return loadJob(jobId)
}

export async function createShortFormJob(input) {
  await ensureRoots()
  await cleanupOldShortFormJobs()
  const rawSourcePath = String(input?.sourcePath ?? '').trim()
  if (!rawSourcePath) {
    throw new Error('sourcePath is required')
  }
  const sourcePath = path.resolve(rawSourcePath)

  const sourceStat = await stat(sourcePath).catch(() => null)
  if (!sourceStat || !sourceStat.isDirectory()) {
    throw new Error(`Source folder not found: ${sourcePath}`)
  }

  const title = String(input?.title ?? path.basename(sourcePath)).trim() || path.basename(sourcePath)
  const jobId = makeJobId(title)
  const workspaceDir = jobDir(jobId)

  await Promise.all([
    ensureDir(workspaceDir),
    ensureDir(path.resolve(workspaceDir, 'source')),
    ensureDir(path.resolve(workspaceDir, 'cleaned')),
    ensureDir(path.resolve(workspaceDir, 'proxies')),
    ensureDir(path.resolve(workspaceDir, 'transcripts')),
    ensureDir(path.resolve(workspaceDir, 'captions')),
    ensureDir(path.resolve(workspaceDir, 'assets')),
    ensureDir(path.resolve(workspaceDir, 'renders')),
    ensureDir(path.resolve(workspaceDir, 'metadata')),
    ensureDir(path.resolve(workspaceDir, 'logs'))
  ])

  const job = {
    id: jobId,
    title,
    status: 'queued',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    source: {
      kind: input?.sourceKind ?? 'manual',
      label: input?.sourceLabel ?? title,
      sourcePath,
      sourceFolderId: input?.sourceFolderId ?? null,
      revisionKey: input?.revisionKey ?? null
    },
    config: {
      articleMode: input?.articleMode ?? 'auto_then_fallback',
      captionPreset: input?.captionPreset ?? 'clean-news',
      transitionPreset: input?.transitionPreset ?? 'fade',
      sfxPreset: input?.sfxPreset ?? 'none',
      manualArticleUrl: input?.manualArticleUrl ?? null
    },
    summary: {
      clipCount: 0,
      usableClipCount: 0,
      fullTranscriptChars: 0,
      articleSelected: false,
      rendered: false
    },
    steps: baseSteps(),
    clips: [],
    articleSelection: {
      selectedUrl: null,
      source: 'none',
      confidence: 0,
      reasoningSummary: '',
      screenshotPath: null
    },
    paths: {
      workspaceDir,
      manifestPath: jobFile(jobId),
      renderManifestPath: null,
      reviewCutPath: null
    }
  }

  await saveJob(job)
  return job
}

export async function updateShortFormArticle(jobId, manualArticleUrl) {
  const job = await loadJob(jobId)
  if (!job) throw new Error('Job not found')
  job.config.manualArticleUrl = manualArticleUrl ? String(manualArticleUrl).trim() : null
  await saveJob(job)
  return job
}

export async function prepareShortFormJob(jobId) {
  const job = await loadJob(jobId)
  if (!job) throw new Error('Job not found')
  const currentJobDir = jobDir(job.id)
  const cleanedDir = path.resolve(currentJobDir, 'cleaned')
  const proxiesDir = path.resolve(currentJobDir, 'proxies')
  const transcriptsDir = path.resolve(currentJobDir, 'transcripts')

  job.status = 'preparing'
  job.steps = baseSteps()
  job.clips = []
  await saveJob(job)

  try {
    setStepRunning(job, 'discover', 'Scanning source folder')
    const clipFiles = await listSourceClipFiles(job.source.sourcePath)
    if (clipFiles.length === 0) {
      throw new Error('No supported video clips found in source folder')
    }
    const discoveredClips = []
    for (const [index, fileName] of clipFiles.entries()) {
      const sourcePath = path.resolve(job.source.sourcePath, fileName)
      const probe = await ffprobeJson(sourcePath)
      const videoStream = Array.isArray(probe.streams) ? probe.streams.find((stream) => stream.codec_type === 'video') : null
      const audioStream = Array.isArray(probe.streams) ? probe.streams.find((stream) => stream.codec_type === 'audio') : null
      const durationSeconds = Number(videoStream?.duration ?? probe.format?.duration ?? 0)

      discoveredClips.push({
        index,
        sourceFileName: fileName,
        sourcePath,
        sortKey: fileName,
        trim: {
          leadingSeconds: 0,
          trailingSeconds: 0
        },
        analysisPath: `proxies/clip-${String(index).padStart(3, '0')}.mp4`,
        kept: true,
        rejectReason: null,
        cleanedPath: null,
        transcriptPath: `transcripts/clip-${String(index).padStart(3, '0')}.json`,
        durationSeconds,
        hasAudio: Boolean(audioStream),
        pixelFormat: videoStream?.pix_fmt ?? null,
        whisperError: null
      })
    }
    setStepDone(job, 'discover', `${discoveredClips.length} clips discovered`, { clipFiles })

    setStepRunning(job, 'trim', 'Trimming leading and trailing silence')
    await Promise.all([ensureDir(cleanedDir), ensureDir(proxiesDir)])
    for (const clip of discoveredClips) {
      if (!clip.hasAudio || !clip.durationSeconds) {
        clip.kept = false
        clip.rejectReason = 'Clip is missing audio or duration metadata'
        clip.cleanedPath = null
        continue
      }
      const trim = await detectTrim(clip.sourcePath, clip.durationSeconds)
      clip.trim = trim
      const startSeconds = Math.min(trim.leadingSeconds, Math.max(0, clip.durationSeconds - 0.2))
      const endSeconds = Math.max(startSeconds + 0.1, clip.durationSeconds - trim.trailingSeconds)
      clip.trimStartSeconds = Number(startSeconds.toFixed(3))
      clip.trimEndSeconds = Number(endSeconds.toFixed(3))
      const proxyPath = path.resolve(currentJobDir, clip.analysisPath)
      await createProxyClip(clip.sourcePath, proxyPath, startSeconds, endSeconds, clip.hasAudio)
      const trimmedProbe = await ffprobeJson(proxyPath)
      clip.durationSeconds = Number(trimmedProbe.format?.duration ?? endSeconds - startSeconds)
    }
    setStepDone(job, 'trim', 'Silence trimming completed', {
      proxyCount: discoveredClips.filter((clip) => clip.analysisPath).length
    })

    setStepRunning(job, 'filter', 'Filtering unusable clips')
    let keptAfterFilter = 0
    for (const clip of discoveredClips) {
      if (!clip.kept) continue
      if (Number(clip.durationSeconds ?? 0) < MIN_KEPT_DURATION) {
        clip.kept = false
        clip.rejectReason = `Clip too short after trim (< ${MIN_KEPT_DURATION}s)`
        clip.analysisPath = null
        continue
      }
      keptAfterFilter += 1
    }
    if (keptAfterFilter === 0) {
      throw new Error('All clips were rejected after trim/filter')
    }
    setStepDone(job, 'filter', `${keptAfterFilter} clips kept`, { keptCount: keptAfterFilter })

    setStepRunning(job, 'transcribe', 'Transcribing kept clips with Whisper')
    await ensureDir(transcriptsDir)
    const transcriptRecords = []
    let successfulTranscripts = 0
    for (const clip of discoveredClips) {
      if (!clip.kept || !clip.analysisPath) continue
      try {
        const whisperJson = await transcribeClipAudio(path.resolve(currentJobDir, clip.analysisPath), transcriptsDir)
        const text = String(whisperJson?.text ?? '').trim()
        const words = transcriptWordsFromWhisper(whisperJson)
        if (!text) {
          clip.kept = false
          clip.rejectReason = 'No meaningful speech detected'
          continue
        }
        transcriptRecords.push({ clipIndex: clip.index, text, words })
        successfulTranscripts += 1
      } catch (error) {
        clip.kept = false
        clip.rejectReason = 'Transcription failed'
        clip.whisperError = error instanceof Error ? error.message : String(error)
      }
    }
    if (successfulTranscripts === 0) {
      throw new Error('No clips produced a usable transcript')
    }

    const script = await readScriptIfPresent(job)
    const scriptBeats = script ? parseScriptBeats(script.text) : []
    const selection = scriptBeats.length > 0
      ? selectSegmentsFromScript(discoveredClips, transcriptRecords, scriptBeats)
      : selectTranscriptSegments(discoveredClips, transcriptRecords)
    if (script?.path && selection?.mode === 'script_guided') {
      selection.scriptPath = script.path
    }
    // All kept clips are always included — no selection layer dropping
    for (const clip of discoveredClips) {
      if (!clip.kept) continue
      clip.selected = true
      // Ensure clip appears in keptSegments for downstream steps
      if (!selection.keptSegments.some(s => s.clipIndex === clip.index)) {
        const record = transcriptRecords.find(r => r.clipIndex === clip.index)
        if (record) {
          selection.keptSegments.push({
            clipIndex: clip.index,
            text: record.text,
            words: record.words ?? [],
            start: 0,
            end: clip.durationSeconds
          })
        }
      }
    }
    selection.keptSegments.sort((a, b) => a.clipIndex - b.clipIndex)

    const failedTranscriptions = discoveredClips.filter((clip) => clip.whisperError)
    if (failedTranscriptions.length > 0) {
      setStepWarning(
        job,
        'transcribe',
        `${successfulTranscripts} clips transcribed, ${selection.keptSegments.length} segments selected`,
        `${failedTranscriptions.length} clips failed transcription`,
        {
          successfulTranscripts,
          failedTranscriptions: failedTranscriptions.map((clip) => clip.sourceFileName),
          selectedSegments: selection.keptSegments.length,
          selectionMode: selection.mode ?? 'heuristic'
        }
      )
    } else {
      setStepDone(job, 'transcribe', `${successfulTranscripts} clips transcribed, ${selection.keptSegments.length} segments selected`, {
        successfulTranscripts,
        selectedSegments: selection.keptSegments.length,
        selectionMode: selection.mode ?? 'heuristic'
      })
    }

    setStepRunning(job, 'captions', 'Generating caption pages')
    const keptTranscriptRecords = transcriptRecords.filter((record) => {
      const clip = discoveredClips.find((candidate) => candidate.index === record.clipIndex)
      return clip?.kept
    })
    const captionPreview = buildCaptionPages(
      selection.keptSegments.map((segment, index) => ({
        index,
        kept: true,
        durationSeconds: Number((segment.end - segment.start).toFixed(3))
      })),
      selection.keptSegments.map((segment, index) => ({
        clipIndex: index,
        text: segment.text,
        words: segment.words
      })),
      job.config.captionPreset ?? 'clean-news'
    )
    if (captionPreview.pages.length === 0) {
      setStepWarning(job, 'captions', 'No caption pages generated', 'Transcripts had no usable word timings')
    } else {
      setStepDone(job, 'captions', `${captionPreview.pages.length} caption pages generated`, {
        pageCount: captionPreview.pages.length
      })
    }

    setStepRunning(job, 'find_article', 'Resolving article source')
    setStepDone(job, 'find_article', 'Article source resolved')

    setStepRunning(job, 'capture_article', 'Capturing article screenshot')

    setStepRunning(job, 'prepare_manifest', 'Writing review artifacts')
    const outputs = await createPrepareOutputs(job, discoveredClips, keptTranscriptRecords, selection)
    if (outputs.articleSelection?.screenshotPath) {
      setStepDone(job, 'capture_article', 'Article screenshot captured', {
        screenshotPath: outputs.articleSelection.screenshotPath
      })
    } else if (outputs.articleSelection?.selectedUrl) {
      setStepWarning(job, 'capture_article', 'Article URL resolved but screenshot missing', 'Screenshot capture did not produce an asset')
    } else {
      setStepDone(job, 'capture_article', 'No article URL available')
    }
    setStepDone(job, 'prepare_manifest', 'Manifest and preview assets written', {
      renderManifestPath: outputs.paths.renderManifestPath
    })

    setStepRunning(job, 'social_copy', 'Generating social copy drafts')
    setStepDone(job, 'social_copy', 'Social copy drafts written', { socialPostsPath: outputs.paths.socialPostsPath })

    job.clips = outputs.clips
    job.articleSelection = outputs.articleSelection
    job.summary = outputs.summary
    job.paths.renderManifestPath = path.resolve(jobDir(job.id), outputs.paths.renderManifestPath)
    if (outputs.articleSelection.needsReview) {
      job.status = 'pending_article_review'
    } else {
      job.status = outputs.articleSelection.selectedUrl ? 'prepared' : 'prepared_without_article'
    }

    await saveJob(job)
    return job
  } catch (error) {
    const currentStep = job.steps.find((step) => step.status === 'running')?.key ?? 'prepare_manifest'
    setStepFailed(job, currentStep, 'Prepare failed', error)
    job.status = 'failed'
    await saveJob(job)
    throw error
  }
}

export async function rerunShortFormArticleCapture(jobId) {
  const job = await loadJob(jobId)
  if (!job) throw new Error('Job not found')

  setStepRunning(job, 'find_article', 'Resolving article source')
  const manualUrl = job.config.manualArticleUrl
  const txtUrl = await readArticleTxtIfPresent(job.source.sourcePath)
  const transcriptTexts = await Promise.all(
    (job.clips ?? []).map(async c => {
      if (!c.transcriptPath) return ''
      const p = path.resolve(jobDir(job.id), c.transcriptPath)
      const data = await readJsonIfExists(p, null)
      return String(data?.text ?? '')
    })
  )
  const combinedTranscript = transcriptTexts.join(' ').trim()
  const autoUrl = (!manualUrl && !txtUrl && combinedTranscript.length > 20)
    ? await findNewsArticle(combinedTranscript)
    : null
  const selectedUrl = manualUrl || txtUrl || autoUrl
  let screenshotPath = null
  if (selectedUrl) {
    const outputPath = path.resolve(jobDir(job.id), 'assets', 'article-mobile.png')
    await ensureDir(path.dirname(outputPath))
    await captureArticleScreenshot(selectedUrl, outputPath)
    screenshotPath = relativeToJob(job.id, outputPath)
  }
  const articleSource = manualUrl ? 'manual_ui' : txtUrl ? 'article_txt' : autoUrl ? 'auto_search' : 'none'
  job.articleSelection = {
    selectedUrl,
    source: articleSource,
    confidence: manualUrl ? 1 : txtUrl ? 0.6 : autoUrl ? 0.5 : 0,
    reasoningSummary: selectedUrl ? `Found via ${articleSource}` : 'No article found',
    screenshotPath
  }
  setStepDone(job, 'find_article', selectedUrl ? 'Article URL resolved' : 'No article URL available')
  if (screenshotPath) {
    setStepDone(job, 'capture_article', 'Article screenshot captured', { screenshotPath })
  } else {
    setStepDone(job, 'capture_article', selectedUrl ? 'Article URL resolved without screenshot' : 'No article URL available')
  }
  job.summary.articleSelected = Boolean(selectedUrl)
  if (job.status !== 'rendering') {
    job.status = selectedUrl ? 'prepared' : 'prepared_without_article'
  }
  // Keep render manifest in sync so re-render picks up the article
  if (job.paths?.renderManifestPath && existsSync(job.paths.renderManifestPath)) {
    const manifest = await readJsonIfExists(job.paths.renderManifestPath, null)
    if (manifest) {
      manifest.articleBackgroundPath = screenshotPath ?? null
      await writeJson(job.paths.renderManifestPath, manifest)
    }
  }
  await saveJob(job)
  return job
}

export async function approveShortFormArticle(jobId, articleUrl) {
  const job = await loadJob(jobId)
  if (!job) throw new Error('Job not found')
  if (!articleUrl) throw new Error('articleUrl required')

  job.config.manualArticleUrl = articleUrl
  job.articleSelection = job.articleSelection ?? {}
  job.articleSelection.selectedUrl = articleUrl
  job.articleSelection.source = 'manual_ui'
  job.articleSelection.needsReview = false

  // Capture screenshot now that article is approved
  const assetsDir = path.resolve(jobDir(jobId), 'assets')
  await ensureDir(assetsDir)
  const screenshotPath = path.resolve(assetsDir, 'article-mobile.png')
  await captureArticleScreenshot(articleUrl, screenshotPath)
  job.articleSelection.screenshotPath = relativeToJob(jobId, screenshotPath)

  // Update render manifest so render picks up the approved article
  if (job.paths?.renderManifestPath && existsSync(job.paths.renderManifestPath)) {
    const manifest = await readJsonIfExists(job.paths.renderManifestPath, null)
    if (manifest) {
      manifest.articleBackgroundPath = job.articleSelection.screenshotPath
      await writeJson(job.paths.renderManifestPath, manifest)
    }
  }

  job.status = 'prepared'
  await saveJob(job)
  return job
}

export async function findMoreShortFormArticles(jobId) {
  const job = await loadJob(jobId)
  if (!job) throw new Error('Job not found')

  const transcriptTexts = await Promise.all(
    (job.clips ?? []).map(async c => {
      if (!c.transcriptPath) return ''
      const p = path.resolve(jobDir(jobId), c.transcriptPath)
      const d = await readJsonIfExists(p, null)
      return String(d?.text ?? '')
    })
  )
  const combinedTranscript = transcriptTexts.join(' ').trim()
  if (combinedTranscript.length < 10) throw new Error('No transcript available')

  const result = await findNewsArticle(combinedTranscript)
  const candidates = result.candidates ?? []

  job.articleSelection = job.articleSelection ?? {}
  job.articleSelection.candidates = candidates
  if (result.url && !job.config.manualArticleUrl) {
    job.articleSelection.selectedUrl = result.url
  }
  await saveJob(job)
  return { candidates, selectedUrl: result.url }
}

export async function renderShortFormJob(jobId) {
  const job = await loadJob(jobId)
  if (!job) throw new Error('Job not found')
  if (!['prepared', 'prepared_without_article', 'review_required', 'failed', 'done'].includes(job.status)) {
    throw new Error(`Job is not ready to render from status "${job.status}"`)
  }

  const rendersDir = path.resolve(jobDir(job.id), 'renders')
  const renderSegmentsDir = path.resolve(rendersDir, 'segments')
  const renderLogPath = path.resolve(jobDir(job.id), 'logs', 'render.log')
  await ensureDir(rendersDir)
  await ensureDir(renderSegmentsDir)

  setStepRunning(job, 'render', 'Writing render request artifact')
  job.status = 'rendering'
  await saveJob(job)

  const renderManifest = await readJsonIfExists(job.paths.renderManifestPath, null)
  if (!renderManifest) {
    throw new Error('Render manifest not found')
  }
  const articleBackgroundPath = renderManifest.articleBackgroundPath
    ? path.resolve(jobDir(job.id), renderManifest.articleBackgroundPath)
    : null

  const keptClips = Array.isArray(renderManifest.speakerClips) ? renderManifest.speakerClips : []
  if (keptClips.length === 0) {
    throw new Error('No selected source segments available for render')
  }

  // Tighten each clip's end to last Whisper word + 0.3 s padding
  const WORD_TRIM_PADDING = 0.3
  for (const clip of keptClips) {
    const words = Array.isArray(clip.words) ? clip.words : []
    const lastWord = words.at(-1)
    if (!lastWord || !Number.isFinite(lastWord.end)) continue
    const tightDuration = Number((lastWord.end + WORD_TRIM_PADDING).toFixed(3))
    if (tightDuration < clip.durationSeconds) {
      clip.durationSeconds = tightDuration
      clip.segmentEndSeconds = Number((clip.segmentStartSeconds + tightDuration).toFixed(3))
      clip.sourceEndSeconds = Number((clip.trimStartSeconds + tightDuration).toFixed(3))
    }
  }

  const renderableSegments = []
  for (const [index, clip] of keptClips.entries()) {
    if (!clip?.sourcePath) continue
    const baseSegmentPath = path.resolve(renderSegmentsDir, `segment-${String(index).padStart(3, '0')}.mov`)
    await trimSelectedSegment(
      clip.sourcePath,
      baseSegmentPath,
      Number(clip.sourceStartSeconds ?? 0),
      Number(clip.sourceEndSeconds ?? 0)
    )
    if (index === 0) {
      const splashSpeakerPath = path.resolve(rendersDir, 'splash-speaker-nobg.webm')
      await runCommand('ffmpeg', [
        '-y', '-hide_banner', '-i', baseSegmentPath,
        '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0',
        '-pix_fmt', 'yuva420p', '-r', '30', '-an',
        splashSpeakerPath
      ], { logPath: renderLogPath }).catch(() => {})
    }
    const hasArticle = articleBackgroundPath && existsSync(articleBackgroundPath)
    const outputPath = hasArticle
      ? path.resolve(renderSegmentsDir, `segment-${String(index).padStart(3, '0')}-composited.mp4`)
      : baseSegmentPath
    if (hasArticle) {
      const segmentDuration = Number(clip.sourceEndSeconds ?? 0) - Number(clip.sourceStartSeconds ?? 0)
      await compositeSpeakerOverArticle(articleBackgroundPath, baseSegmentPath, outputPath, segmentDuration)
      await removePathIfExists(baseSegmentPath)
    }
    renderableSegments.push({
      ...clip,
      sourceDurationSeconds: Number(clip.durationSeconds ?? 0),
      renderPath: outputPath
    })
  }
  if (renderableSegments.length === 0) {
    throw new Error('No renderable source segments were produced')
  }

  for (const segment of renderableSegments) {
    const probe = await ffprobeJson(segment.renderPath)
    segment.renderDurationSeconds = Number(probe.format?.duration ?? segment.sourceDurationSeconds ?? 0)
  }

  const concatListPath = path.resolve(rendersDir, 'concat-inputs.txt')
  const concatContent = renderableSegments
    .map((clip) => `file '${clip.renderPath.replace(/'/g, "'\\''")}'`)
    .join('\n')
  await writeFile(concatListPath, `${concatContent}\n`, 'utf-8')

  const reviewCutPath = path.resolve(rendersDir, 'review-cut.mp4')
  const reviewCutTempPath = path.resolve(rendersDir, 'review-cut.tmp.mp4')
  const renderCaptions = buildRenderAlignedCaptionPages(renderableSegments, job.config.captionPreset ?? 'clean-news')
  const captionsJsonRenderPath = path.resolve(rendersDir, 'captions.render.json')
  await writeJson(captionsJsonRenderPath, renderCaptions)
  const captionsAssPath = path.resolve(rendersDir, 'captions.render.ass')
  await writeFile(captionsAssPath, captionPagesToAss(renderCaptions.pages), 'utf-8')
  const captionsSrtPath = path.resolve(rendersDir, 'captions.render.srt')
  await writeFile(captionsSrtPath, `${captionPagesToSrt(renderCaptions.pages)}\n`, 'utf-8')
  const vfParts = [
    'scale=1080:1920:force_original_aspect_ratio=decrease',
    'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black',
    'fps=30',
    'format=yuv420p'
  ]
  if (captionsAssPath && existsSync(captionsAssPath)) {
    vfParts.push(`subtitles=${captionsAssPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:')}`)
  } else if (captionsSrtPath && existsSync(captionsSrtPath)) {
    vfParts.push(`subtitles=${captionsSrtPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:')}`)
  }

  await removePathIfExists(reviewCutTempPath)
  await runCommand('nice', [
    '-n',
    String(NICE_LEVEL),
    'ffmpeg',
    '-y',
    '-hide_banner',
    '-threads', String(FFMPEG_THREADS),
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-vf', vfParts.join(','),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-x264-params', `threads=${FFMPEG_THREADS}`,
    '-r', '30',
    '-map', '0:v',
    '-map', '0:a',
    '-c:a', 'aac',
    '-b:a', '192k',
    reviewCutTempPath
  ], { logPath: renderLogPath })

  await rename(reviewCutTempPath, reviewCutPath)

  // Splash intro via Remotion — clip 1 plays in top grid; article + text in bottom panel
  // After splash, review-cut continues from clip 2 onwards (clip 1 trimmed out)
  try {
    const splashPath = path.resolve(rendersDir, 'splash-intro.tmp.mp4')
    const renderSplashScript = path.resolve(repoRoot, 'workers/remotion-site-hero/src/render-splash-intro.mjs')

    const clip1 = keptClips[0]
    const clip1Duration = Number(clip1?.durationSeconds ?? 0)
    const clip1Frames = Math.max(30, Math.round(clip1Duration * 30))

    const splashSpeakerPath = path.resolve(rendersDir, 'splash-speaker-nobg.webm')
    const clip1VideoPath = existsSync(splashSpeakerPath)
      ? splashSpeakerPath
      : path.resolve(renderSegmentsDir, 'segment-000-composited.mp4')

    // Headline from first clip transcript
    const firstText = String(clip1?.text ?? '').trim()
    const headlineWords = firstText.split(/\s+/).slice(0, 5).join(' ').toUpperCase()
    const headlineText = headlineWords || 'SENASTE NYTT'

    // Extract captions for clip 1 (pages that start within clip 1 duration)
    const captionsForSplash = (renderCaptions?.pages ?? []).filter(p => p.start < clip1Duration)
    const splashCaptionsPath = path.resolve(rendersDir, 'splash-captions.tmp.json')
    await writeJson(splashCaptionsPath, captionsForSplash)

    const splashArgs = [
      renderSplashScript,
      '--output', splashPath,
      '--headline-text', headlineText,
      '--duration-frames', String(clip1Frames),
      '--captions-json', splashCaptionsPath
    ]
    if (existsSync(clip1VideoPath)) splashArgs.push('--speaker-video', clip1VideoPath)
    if (articleBackgroundPath && existsSync(articleBackgroundPath)) splashArgs.push('--article-image', articleBackgroundPath)

    await runCommand('node', splashArgs, { logPath: renderLogPath })

    if (existsSync(splashPath)) {
      const withSplashPath = path.resolve(rendersDir, 'review-cut.withsplash.tmp.mp4')
      const clip1Sec = clip1Duration.toFixed(3)
      // Concat: splash video + clip1 audio → then rest of main video (trimmed past clip1)
      await runCommand('nice', [
        '-n', String(NICE_LEVEL),
        'ffmpeg', '-y', '-hide_banner', '-threads', String(FFMPEG_THREADS),
        '-i', splashPath,
        '-i', reviewCutPath,
        '-filter_complex',
        `[1:a]atrim=end=${clip1Sec},asetpts=PTS-STARTPTS[a_intro];` +
        `[1:v]trim=start=${clip1Sec},setpts=PTS-STARTPTS[v_rest];` +
        `[1:a]atrim=start=${clip1Sec},asetpts=PTS-STARTPTS[a_rest];` +
        `[0:v][v_rest]concat=n=2:v=1:a=0[outv];` +
        `[a_intro][a_rest]concat=n=2:v=0:a=1[outa]`,
        '-map', '[outv]', '-map', '[outa]',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-x264-params', `threads=${FFMPEG_THREADS}`,
        '-r', '30', '-c:a', 'aac', '-b:a', '192k',
        withSplashPath
      ], { logPath: renderLogPath })
      await rename(withSplashPath, reviewCutPath)
      await removePathIfExists(splashPath)
      await removePathIfExists(splashCaptionsPath)
    }
  } catch (splashError) {
    void appendFile(renderLogPath, `\n[splash-intro] skipped: ${splashError.message}\n`, 'utf-8').catch(() => {})
  }

  // Outro via Remotion — screen-blend animation onto last 3s of main video
  try {
    const outroPath = path.resolve(rendersDir, 'outro.tmp.mp4')
    const renderOutroScript = path.resolve(repoRoot, 'workers/remotion-site-hero/src/render-outro.mjs')
    await runCommand('node', [
      renderOutroScript,
      '--output', outroPath,
      '--handle', '@sebcastwall',
      '--follow-text', 'FÖLJ MIG',
      '--duration-frames', '90'
    ], { logPath: renderLogPath })

    if (existsSync(outroPath)) {
      const withOutroPath = path.resolve(rendersDir, 'review-cut.withoutro.tmp.mp4')
      const outroDurationSec = 90 / 30  // 3.0s
      const probeResult = await ffprobeJson(reviewCutPath)
      const videoDuration = Number(probeResult.format?.duration ?? 0)
      const outroStartSec = Math.max(0, videoDuration - outroDurationSec)

      // Split main video, overlay the transparent WebM card on the last 3s
      await runCommand('nice', [
        '-n', String(NICE_LEVEL),
        'ffmpeg', '-y', '-hide_banner', '-threads', String(FFMPEG_THREADS),
        '-i', reviewCutPath,
        '-i', outroPath,
        '-filter_complex',
        `[0:v]split=2[base_early][base_late];` +
        `[base_early]trim=duration=${outroStartSec.toFixed(3)},setpts=PTS-STARTPTS[early];` +
        `[base_late]trim=start=${outroStartSec.toFixed(3)},setpts=PTS-STARTPTS[late];` +
        `[1:v]scale=1080:1920,fps=30,chromakey=0x00FF00:0.15:0.05[outro];` +
        `[late][outro]overlay=0:0[blended];` +
        `[early][blended]concat=n=2:v=1[outv]`,
        '-map', '[outv]',
        '-map', '0:a',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-x264-params', `threads=${FFMPEG_THREADS}`,
        '-r', '30',
        '-c:a', 'copy',
        withOutroPath
      ], { logPath: renderLogPath })
      await rename(withOutroPath, reviewCutPath)
      await removePathIfExists(outroPath)
    }
  } catch (outroError) {
    void appendFile(renderLogPath, `\n[outro] skipped: ${outroError.message}\n`, 'utf-8').catch(() => {})
  }

  // Mix music + SFX in one pass
  const musicExists = SHORT_FORM_MUSIC_PATH && existsSync(SHORT_FORM_MUSIC_PATH)
  const swoshPath = path.resolve(SHORT_FORM_SFX_DIR, 'swosh1.mp3')
  const popPath = path.resolve(SHORT_FORM_SFX_DIR, 'pop.mp3')
  const swoshExists = existsSync(swoshPath)
  const popExists = existsSync(popPath)

  if (musicExists || swoshExists || popExists) {
    try {
      const probeResult = await ffprobeJson(reviewCutPath)
      const videoDuration = Number(probeResult.format?.duration ?? 0)
      const outroStartMs = Math.round(Math.max(0, videoDuration - 3.0) * 1000)

      // Music plays only during the first clip, then fades out
      const firstClipDuration = Number(keptClips[0]?.durationSeconds ?? videoDuration)
      const musicFadeOut = Math.max(1.0, firstClipDuration - 1.5)

      const ffArgs = ['-n', String(NICE_LEVEL), 'ffmpeg', '-y', '-hide_banner', '-threads', String(FFMPEG_THREADS), '-i', reviewCutPath]
      const filterParts = []
      const mixPads = ['[0:a]']
      let inputIdx = 1

      if (musicExists) {
        ffArgs.push('-i', SHORT_FORM_MUSIC_PATH)
        filterParts.push(`[${inputIdx}:a]volume=0.04,afade=t=in:st=0:d=1.2,afade=t=out:st=${musicFadeOut.toFixed(2)}:d=1.5[music]`)
        mixPads.push('[music]')
        inputIdx += 1
      }
      if (swoshExists) {
        ffArgs.push('-i', swoshPath)
        filterParts.push(`[${inputIdx}:a]volume=0.7,adelay=0|0[swosh]`)
        mixPads.push('[swosh]')
        inputIdx += 1
      }
      if (popExists) {
        ffArgs.push('-i', popPath)
        filterParts.push(`[${inputIdx}:a]volume=0.8,adelay=${outroStartMs}|${outroStartMs}[pop]`)
        mixPads.push('[pop]')
        inputIdx += 1
      }

      filterParts.push(`${mixPads.join('')}amix=inputs=${mixPads.length}:duration=first:dropout_transition=2[aout]`)
      const withAudioPath = path.resolve(rendersDir, 'review-cut.audio.tmp.mp4')
      ffArgs.push('-filter_complex', filterParts.join(';'), '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', withAudioPath)

      await runCommand('nice', ffArgs, { logPath: renderLogPath })
      await rename(withAudioPath, reviewCutPath)
    } catch (audioError) {
      void appendFile(renderLogPath, `\n[audio-mix] skipped: ${audioError.message}\n`, 'utf-8').catch(() => {})
    }
  }

  const publishedReviewCutPath = await publishReviewCut(job, reviewCutPath)
  setStepDone(job, 'render', 'Rendered review cut', {
    reviewCutPath: relativeToJob(job.id, reviewCutPath),
    publishedReviewCutPath
  })
  await removePathIfExists(renderSegmentsDir)
  await removePathIfExists(concatListPath)
  job.paths.reviewCutPath = reviewCutPath
  job.paths.publishedReviewCutPath = publishedReviewCutPath
  job.summary.rendered = true
  job.status = 'done'
  await saveJob(job)

  // Post-render: social copy + OneDrive upload (fire-and-forget, don't block)
  void (async () => {
    try {
      // Build transcript from clips
      const transcriptTexts = await Promise.all(
        (job.clips ?? []).map(async c => {
          if (!c.transcriptPath) return ''
          const p = path.resolve(jobDir(job.id), c.transcriptPath)
          const d = await readJsonIfExists(p, null)
          return String(d?.text ?? '')
        })
      )
      const transcript = transcriptTexts.join(' ').trim()
      const topic = String(job.clips?.[0]?.text ?? '').split(/\s+/).slice(0, 5).join(' ')

      // Generate social copy
      const socialResult = await generateSocialCopyAgent({ transcript, topic })
      if (socialResult.markdown) {
        const mdPath = path.resolve(jobDir(job.id), 'metadata', 'social-copy.md')
        await writeFile(mdPath, socialResult.markdown, 'utf-8')
        job.paths.socialCopyPath = mdPath
        await saveJob(job)
        console.log(`[short-form] social copy saved: ${mdPath}`)
      }

      // Upload to OneDrive if this job came from a slot watcher
      if (job.source?.kind === 'watcher_slot_cloud' && job.source?.revisionKey) {
        const slotKey = job.source.label?.match(/video-\d+/)?.[0] ?? null
        if (slotKey) {
          await startCloudWatcherUpload(slotKey, reviewCutPath, job.paths?.socialCopyPath ?? null)
          // Keep job folder and source files — user may want to re-render with a different article
          console.log(`[short-form] upload done for ${job.id}, keeping source files for potential re-render`)
        }
      }
    } catch (err) {
      console.error('[short-form] post-render error:', err.message)
    }
  })()

  return job
}

export async function retryShortFormUpload(jobId) {
  const job = await getShortFormJob(jobId)
  if (!job) throw new Error(`Job ${jobId} not found`)

  const rendersDir = path.resolve(jobDir(job.id), 'renders')
  const reviewCutPath = path.resolve(rendersDir, 'review-cut.mp4')

  const transcriptTexts = await Promise.all(
    (job.clips ?? []).map(async c => {
      if (!c.transcriptPath) return ''
      const p = path.resolve(jobDir(job.id), c.transcriptPath)
      const d = await readJsonIfExists(p, null)
      return String(d?.text ?? '')
    })
  )
  const transcript = transcriptTexts.join(' ').trim()
  const topic = String(job.clips?.[0]?.text ?? '').split(/\s+/).slice(0, 5).join(' ')

  const socialResult = await generateSocialCopyAgent({ transcript, topic })
  if (socialResult.markdown) {
    const mdPath = path.resolve(jobDir(job.id), 'metadata', 'social-copy.md')
    await writeFile(mdPath, socialResult.markdown, 'utf-8')
    job.paths.socialCopyPath = mdPath
    await saveJob(job)
    console.log(`[short-form] social copy saved: ${mdPath}`)
  }

  if (job.source?.kind === 'watcher_slot_cloud' && job.source?.revisionKey) {
    const slotKey = job.source.label?.match(/video-\d+/)?.[0] ?? null
    if (slotKey) {
      await startCloudWatcherUpload(slotKey, reviewCutPath, job.paths?.socialCopyPath ?? null)
    }
  }

  return job
}

export async function getShortFormWatchersStatus() {
  const state = await readJsonIfExists(WATCHER_STATE_PATH, {
    localWatcher: {
      inputDir: process.env.OPERATOR_HUB_SHORT_FORM_INPUT_DIR ?? '/workspace/short-form-input',
      jobs: []
    },
    cloudWatcher: {
      inputPath: process.env.OPERATOR_HUB_SHORT_FORM_CLOUD_INPUT_PATH ?? 'Seb/Videos/no-bg-videos',
      outputPath: process.env.OPERATOR_HUB_SHORT_FORM_CLOUD_OUTPUT_PATH ?? 'Seb/Videos/short-form-review-cuts',
      jobs: []
    }
  })

  return state
}

export async function saveShortFormWatchersStatus(state) {
  await ensureRoots()
  await writeJson(WATCHER_STATE_PATH, state)
}

export async function screenshotUrlPreview(articleUrl) {
  await ensureRoots()
  const previewDir = path.resolve(JOBS_ROOT, '_preview')
  await ensureDir(previewDir)
  const screenshotPath = path.resolve(previewDir, `url-preview-${Date.now()}.png`)
  await captureArticleScreenshot(articleUrl, screenshotPath)
  const { readFile } = await import('node:fs/promises')
  const buf = await readFile(screenshotPath)
  return { base64: buf.toString('base64'), mimeType: 'image/png' }
}

export async function previewShortFormArticle(transcript) {
  await ensureRoots()
  const { run: findNewsArticleAgent } = await import('./agents/findNewsArticle.mjs')
  const result = await findNewsArticleAgent({ text: transcript })
  if (!result?.url) return { url: null, query: result?.query ?? '', screenshotPath: null, reason: result?.reason ?? 'No article found' }

  const previewDir = path.resolve(JOBS_ROOT, '_preview')
  await ensureDir(previewDir)
  const screenshotPath = path.resolve(previewDir, `preview-${Date.now()}.png`)
  try {
    await captureArticleScreenshot(result.url, screenshotPath)
  } catch (err) {
    return { url: result.url, query: result.query, screenshotPath: null, reason: `Screenshot failed: ${err.message.slice(0, 100)}` }
  }
  return { url: result.url, query: result.query, screenshotPath, reason: result.reason }
}
