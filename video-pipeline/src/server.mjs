import { createServer } from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMicrosoftAuth } from './microsoftAuth.mjs'
import { startCloudWatcher as startBgRemoverCloudWatcher } from './bgRemoverCloudWatcher.mjs'
import { startShortFormCloudWatcher } from './shortFormCloudWatcher.mjs'
import { startShortFormWatcher } from './shortFormWatcher.mjs'
import { initCloudUpload } from './shortFormCloudUpload.mjs'
import {
  createShortFormJob,
  getShortFormJob,
  listShortFormJobs,
  prepareShortFormJob,
  renderShortFormJob,
  approveShortFormArticle,
  updateShortFormArticle,
  rerunShortFormArticleCapture,
  retryShortFormUpload,
  findMoreShortFormArticles,
  screenshotUrlPreview,
  getShortFormWatchersStatus
} from './shortFormVideoTools.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT ?? '3420', 10)

// Microsoft auth — same env vars as operator-hub
const microsoftAuth = createMicrosoftAuth({
  publicUrl: process.env.OPERATOR_HUB_PUBLIC_URL ?? 'http://localhost:3420',
  tenantId: process.env.OPERATOR_HUB_MS_TENANT_ID ?? 'common',
  clientId: process.env.OPERATOR_HUB_MS_CLIENT_ID ?? '',
  clientSecret: process.env.OPERATOR_HUB_MS_CLIENT_SECRET ?? '',
  scopes: (process.env.OPERATOR_HUB_MS_SCOPES ?? 'openid profile offline_access User.Read Files.ReadWrite.All').split(' '),
  tokenFilePath: process.env.MS_TOKEN_FILE ?? '/workspace/pipeline-state/microsoft-auth.json',
  useClientCredentials: process.env.OPERATOR_HUB_MS_USE_CLIENT_CREDENTIALS === 'true',
  driveUser: process.env.OPERATOR_HUB_MS_DRIVE_USER ?? null
})

function sendJson(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(data)
  })
  res.end(data)
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}) } catch { resolve({}) } })
    req.on('error', reject)
  })
}

function match(url, pattern) {
  const m = url.match(pattern)
  return m ? m : null
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = req.url ?? '/'

  try {
    // Health
    if (url === '/health' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, service: 'video-pipeline' })
    }

    // List jobs
    if (url === '/jobs' && req.method === 'GET') {
      return sendJson(res, 200, { jobs: await listShortFormJobs() })
    }

    // Create job
    if (url === '/jobs' && req.method === 'POST') {
      const body = await readBody(req)
      const job = await createShortFormJob(body)
      return sendJson(res, 200, { jobId: job.id })
    }

    // Get job
    let m
    if ((m = match(url, /^\/jobs\/([^/]+)$/)) && req.method === 'GET') {
      const job = await getShortFormJob(decodeURIComponent(m[1]))
      if (!job) return sendJson(res, 404, { error: 'Not found' })
      return sendJson(res, 200, { job })
    }

    // Prepare
    if ((m = match(url, /^\/jobs\/([^/]+)\/prepare$/)) && req.method === 'POST') {
      const job = await prepareShortFormJob(decodeURIComponent(m[1]))
      return sendJson(res, 200, { ok: true, status: job?.status ?? 'preparing' })
    }

    // Render
    if ((m = match(url, /^\/jobs\/([^/]+)\/render$/)) && req.method === 'POST') {
      const job = await renderShortFormJob(decodeURIComponent(m[1]))
      return sendJson(res, 200, { ok: true, status: job?.status ?? 'rendering' })
    }

    // Update article
    if ((m = match(url, /^\/jobs\/([^/]+)\/article$/)) && req.method === 'POST') {
      const body = await readBody(req)
      const job = await updateShortFormArticle(decodeURIComponent(m[1]), body)
      return sendJson(res, 200, { ok: true, articleSource: job?.articleSource ?? '' })
    }

    // Rerun article capture
    if ((m = match(url, /^\/jobs\/([^/]+)\/rerun-article-capture$/)) && req.method === 'POST') {
      const job = await rerunShortFormArticleCapture(decodeURIComponent(m[1]))
      return sendJson(res, 200, { ok: true, status: job?.status ?? 'running' })
    }

    // Retry upload
    if ((m = match(url, /^\/jobs\/([^/]+)\/retry-upload$/)) && req.method === 'POST') {
      const job = await retryShortFormUpload(decodeURIComponent(m[1]))
      return sendJson(res, 200, { ok: true, status: job?.status ?? 'running' })
    }

    // Approve article
    if ((m = match(url, /^\/jobs\/([^/]+)\/approve-article$/)) && req.method === 'POST') {
      const body = await readBody(req)
      const job = await approveShortFormArticle(decodeURIComponent(m[1]), body?.articleUrl ?? null)
      return sendJson(res, 200, { ok: true, status: job?.status ?? 'done' })
    }

    // Find more articles
    if ((m = match(url, /^\/jobs\/([^/]+)\/find-more-articles$/)) && req.method === 'POST') {
      const result = await findMoreShortFormArticles(decodeURIComponent(m[1]))
      return sendJson(res, 200, { ok: true, candidates: result.candidates ?? [], selectedUrl: result.selectedUrl ?? null })
    }

    // Generate / regenerate social copy
    if ((m = match(url, /^\/jobs\/([^/]+)\/social-copy\/generate$/)) && req.method === 'POST') {
      const job = await retryShortFormUpload(decodeURIComponent(m[1]))
      return sendJson(res, 200, job)
    }

    // Serve job asset (video, images)
    if ((m = match(url, /^\/jobs\/([^/]+)\/asset\/(.+)$/)) && req.method === 'GET') {
      const jobId = decodeURIComponent(m[1])
      const assetName = path.basename(decodeURIComponent(m[2]))
      const stateRoot = process.env.OPERATOR_HUB_SHORT_FORM_ROOT ?? '/workspace/pipeline-state'
      const assetPath = path.resolve(stateRoot, 'jobs', jobId, 'assets', assetName)
      if (!existsSync(assetPath)) return sendJson(res, 404, { error: 'Asset not found' })
      const ext = path.extname(assetName).toLowerCase()
      const mime = ext === '.mp4' ? 'video/mp4' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.png' ? 'image/png' : 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': mime })
      createReadStream(assetPath).pipe(res)
      return
    }

    // Serve renders (video player)
    if ((m = match(url, /^\/jobs\/([^/]+)\/renders\/(.+)$/)) && req.method === 'GET') {
      const jobId = decodeURIComponent(m[1])
      const fileName = path.basename(decodeURIComponent(m[2]))
      const stateRoot = process.env.OPERATOR_HUB_SHORT_FORM_ROOT ?? '/workspace/pipeline-state'
      const filePath = path.resolve(stateRoot, 'jobs', jobId, 'renders', fileName)
      if (!existsSync(filePath)) return sendJson(res, 404, { error: 'Not found' })
      res.writeHead(200, { 'Content-Type': 'video/mp4' })
      createReadStream(filePath).pipe(res)
      return
    }

    // Screenshot preview
    if (url === '/screenshot-preview' && req.method === 'POST') {
      const body = await readBody(req)
      const result = await screenshotUrlPreview(body?.url ?? '')
      return sendJson(res, 200, result)
    }

    // Watchers status
    if (url === '/watchers' && req.method === 'GET') {
      return sendJson(res, 200, await getShortFormWatchersStatus())
    }

    sendJson(res, 404, { error: 'Not found' })
  } catch (err) {
    console.error('[video-pipeline] error:', err.message)
    sendJson(res, 500, { error: err.message })
  }
})

server.listen(PORT, () => {
  console.log(`[video-pipeline] listening on :${PORT}`)

  // Start watchers
  startBgRemoverCloudWatcher(microsoftAuth)
  startShortFormCloudWatcher()
  startShortFormWatcher()
  initCloudUpload(microsoftAuth)

  console.log('[video-pipeline] watchers started')
})
