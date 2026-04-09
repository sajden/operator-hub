import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const host = process.env.OPERATOR_HUB_RESEARCH_HELPER_HOST ?? '0.0.0.0'
const port = Number(process.env.OPERATOR_HUB_RESEARCH_HELPER_PORT ?? 8788)
const workerDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

function parseJsonSafe(raw, fallback = null) {
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function readJsonBody(req) {
  const body = await new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
  return parseJsonSafe(body, {})
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

async function runCapture(payload) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'operator-hub-search-demand-'))
  const htmlOutput = path.resolve(tempRoot, 'capture.html')
  const screenshotOutput = path.resolve(tempRoot, 'capture.png')

  try {
    await mkdir(tempRoot, { recursive: true })

    const args = [
      'src/capture-source.mjs',
      '--source', String(payload.source ?? ''),
      '--seed-query', String(payload.seedQuery ?? ''),
      '--url', String(payload.url ?? ''),
      '--html-output', htmlOutput,
      '--screenshot-output', screenshotOutput,
      '--width', String(payload.width ?? 1440),
      '--height', String(payload.height ?? 1600),
      '--wait-ms', String(payload.waitMs ?? 8000)
    ]

    if (payload.browser) args.push('--browser', String(payload.browser))
    if (payload.userDataDir) args.push('--user-data-dir', String(payload.userDataDir))
    if (payload.profileDirectory) args.push('--profile-directory', String(payload.profileDirectory))
    if (payload.preferredAccountText) args.push('--preferred-account-text', String(payload.preferredAccountText))
    if (payload.mode) args.push('--mode', String(payload.mode))
    if (payload.remoteDebuggingUrl) args.push('--remote-debugging-url', String(payload.remoteDebuggingUrl))

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
          reject(new Error(stderr.join('').trim() || stdout.join('').trim() || `Capture exited with code ${code}`))
          return
        }
        resolve(parseJsonSafe(stdout.join(''), {}))
      })
    })

    const html = existsSync(htmlOutput) ? await readFile(htmlOutput, 'utf-8') : ''
    const screenshotBase64 = existsSync(screenshotOutput)
      ? (await readFile(screenshotOutput)).toString('base64')
      : null

    return {
      ok: true,
      pageTitle: output.pageTitle ?? null,
      browser: output.browser ?? payload.browser ?? null,
      htmlBytes: output.htmlBytes ?? Buffer.byteLength(html, 'utf-8'),
      screenshotCreated: Boolean(screenshotBase64),
      renderedText: output.renderedText ?? null,
      actionSummary: output.actionSummary ?? null,
      html,
      screenshotBase64
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { ok: true, service: 'search-demand-helper' })
      return
    }

    if (req.method === 'POST' && req.url === '/capture') {
      const payload = await readJsonBody(req)
      if (!payload?.url) {
        sendJson(res, 400, { ok: false, message: 'Missing url' })
        return
      }
      const result = await runCapture(payload)
      sendJson(res, 200, result)
      return
    }

    sendJson(res, 404, { ok: false, message: 'Not found' })
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    })
  }
})

server.listen(port, host, () => {
  process.stdout.write(`search-demand-helper listening on http://${host}:${port}\n`)
})
