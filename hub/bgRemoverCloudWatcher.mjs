/**
 * bgRemoverCloudWatcher.mjs
 * Polls a OneDrive folder via Microsoft Graph, removes background on new files,
 * and uploads results back to a OneDrive output folder.
 *
 * No local sync required — reads and writes directly to SharePoint/OneDrive.
 */
import { readFile, writeFile, mkdir, stat, unlink } from 'node:fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import { startBgRemoverJob, getBgRemoverJob, getBgRemoverResult } from './bgRemoverTools.mjs'

const SLOTS_RAW_BASE  = process.env.BG_CLOUD_RAW_BASE  ?? 'Seb/Videos/raw-videos'
const SLOTS_NOBG_BASE = process.env.BG_CLOUD_NOBG_BASE ?? 'Seb/Videos/no-bg-videos'
const SLOT_COUNT      = Number(process.env.BG_CLOUD_SLOT_COUNT ?? 10)
const LOCAL_OUTPUT_DIR = process.env.BG_WATCH_OUTPUT ?? '/workspace/bg-output'
const LOCAL_INPUT_DIR  = process.env.BG_WATCH_INPUT  ?? '/workspace/bg-input'
const MODEL   = process.env.BG_WATCH_MODEL ?? 'u2net_human_seg'
const POLL_MS = 30_000
const UPLOAD_CHUNK = 10 * 1024 * 1024  // 10 MB

// Build slot list: [{input, output, key}, ...]
const SLOTS = [...Array(SLOT_COUNT)].map((_, i) => ({
  input:  `${SLOTS_RAW_BASE}/video-${i + 1}`,
  output: `${SLOTS_NOBG_BASE}/video-${i + 1}`,
  key:    `video-${i + 1}`
}))

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.gif'])
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif'])

/** @type {import('./microsoftAuth.mjs').MicrosoftAuth | null} */
let auth = null
let stateFile = null

/** @type {Map<string, object>} keyed by `slotKey/fileName` */
const cloudJobs = new Map()

// Single-file-at-a-time queue — prevents concurrent bgremover submissions and state write races
let _jobQueueRunning = false
const _jobQueue = []
function enqueueJob(fn) {
  _jobQueue.push(fn)
  if (!_jobQueueRunning) _drainQueue()
}
async function _drainQueue() {
  _jobQueueRunning = true
  while (_jobQueue.length > 0) {
    const fn = _jobQueue.shift()
    try { await fn() } catch {}
  }
  _jobQueueRunning = false
}

// ── state persistence ───────────────────────────────────────────────────────

async function loadState() {
  try { return JSON.parse(await readFile(stateFile, 'utf-8')) } catch { return { processed: {}, failed: {} } }
}

async function saveState(state) {
  await mkdir(path.dirname(stateFile), { recursive: true })
  await writeFile(stateFile, JSON.stringify(state, null, 2), 'utf-8')
}

async function waitForSharedFile(filePath, { attempts = 24, delayMs = 2500 } = {}) {
  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await stat(filePath)
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }
  throw lastError ?? new Error(`Timed out waiting for ${filePath}`)
}

// ── Graph helpers ───────────────────────────────────────────────────────────

function driveBase() { return `https://graph.microsoft.com/v1.0${auth.driveRootPath()}` }

async function graphGet(token, relPath) {
  const url = `https://graph.microsoft.com/v1.0${relPath}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Graph ${res.status}: ${err?.error?.message ?? relPath}`)
  }
  return res.json()
}

async function listFolder(token, folderPath) {
  const encoded = folderPath.split('/').map(encodeURIComponent).join('/')
  const data = await graphGet(
    token,
    `${auth.driveRootPath()}/root:/${encoded}:/children?$select=id,name,size,lastModifiedDateTime,file`
  )
  return data.value ?? []
}

const LARGE_FILE_THRESHOLD = 300 * 1024 * 1024  // 300 MB

async function getItemSize(token, itemId) {
  const res = await fetch(
    `${driveBase()}/items/${itemId}?$select=size`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return 0
  const json = await res.json()
  return json.size ?? 0
}

async function downloadItem(token, itemId) {
  const res = await fetch(
    `${driveBase()}/items/${itemId}/content`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`Graph download ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function downloadItemToFile(token, itemId, destPath) {
  const res = await fetch(
    `${driveBase()}/items/${itemId}/content`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`Graph download ${res.status}`)
  await mkdir(path.dirname(destPath), { recursive: true })
  await pipeline(res.body, createWriteStream(destPath))
}

async function downloadBgRemoverResultToFile(fileName, destPath) {
  const bgUrl = process.env.BGREMOVER_URL ?? 'http://bgremover:8095'
  const encoded = encodeURIComponent(fileName)
  const res = await fetch(`${bgUrl}/files/${encoded}`)
  if (!res.ok) throw new Error(`bgremover file fetch ${res.status}: ${fileName}`)
  await mkdir(path.dirname(destPath), { recursive: true })
  await pipeline(res.body, createWriteStream(destPath))
}

async function ensureFolder(token, folderPath) {
  const parts = folderPath.split('/')
  let currentPath = ''
  for (const part of parts) {
    const parentPath = currentPath || 'root'
    currentPath = currentPath ? `${currentPath}/${part}` : part
    const checkRes = await fetch(
      `${driveBase()}/root:/${currentPath}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!checkRes.ok) {
      // Folder missing — create it
      const encoded = currentPath.split('/').map(encodeURIComponent).join('/')
      const parentEncoded = parentPath === 'root'
        ? `${auth.driveRootPath()}/root/children`
        : `${auth.driveRootPath()}/root:/${parentPath.split('/').map(encodeURIComponent).join('/')}:/children`
      await fetch(`https://graph.microsoft.com/v1.0${parentEncoded}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: part, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' }),
      })
    }
  }
}

async function deleteFileIfExists(token, filePath) {
  const encoded = filePath.split('/').map(encodeURIComponent).join('/')
  const res = await fetch(
    `${driveBase()}/root:/${encoded}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (res.ok) {
    const item = await res.json()
    await fetch(`${driveBase()}/items/${item.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  }
}

async function uploadLargeFile(token, folderPath, fileName, filePath) {
  const encoded = [...folderPath.split('/'), fileName].map(encodeURIComponent).join('/')
  const { size: total } = await stat(filePath)

  // Create upload session
  const sessionRes = await fetch(
    `${driveBase()}/root:/${encoded}:/createUploadSession`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
    }
  )
  if (!sessionRes.ok) {
    const body = await sessionRes.text().catch(() => '')
    throw new Error(`Upload session ${sessionRes.status}: ${body.slice(0, 200)}`)
  }
  const { uploadUrl } = await sessionRes.json()
  console.log(`[cloud-watcher] upload session created for ${fileName} (${(total / 1024 / 1024).toFixed(0)} MB)`)

  // Stream file in chunks directly from disk — no full file in memory
  let offset = 0
  let last = null
  while (offset < total) {
    const end = Math.min(offset + UPLOAD_CHUNK, total)
    const chunkSize = end - offset
    const stream = createReadStream(filePath, { start: offset, end: end - 1 })
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunkSize),
        'Content-Range': `bytes ${offset}-${end - 1}/${total}`,
      },
      body: stream,
      duplex: 'half',
    })
    if (!res.ok && res.status !== 202 && res.status !== 308) {
      const body = await res.text().catch(() => '')
      throw new Error(`Upload chunk ${res.status}: ${body.slice(0, 200)}`)
    }
    last = await res.json().catch(() => null)
    offset = end
  }
  return last
}

// ── job processing ──────────────────────────────────────────────────────────

async function processFile(fileName, itemId, lastModified, outputPath, jobKey) {
  const setJob = (patch) => cloudJobs.set(jobKey, { ...cloudJobs.get(jobKey), ...patch })

  setJob({ status: 'processing', message: 'Laddar ner…', progress: 0 })
  console.log(`[cloud-watcher] processFile START: ${fileName} lastMod=${lastModified} itemId=${itemId}`)

  try {
    let resultFileName, resultPath

    // Check if bgremover already ran for this version (pending upload after previous failure)
    const state0 = await loadState()
    const pending = state0.pendingUpload?.[itemId]
    if (pending?.lastModified === lastModified) {
      const candidatePath = path.join(LOCAL_OUTPUT_DIR, pending.resultFileName)
      try {
        await waitForSharedFile(candidatePath, { attempts: 6, delayMs: 2000 })
        resultPath = candidatePath
        resultFileName = pending.resultFileName
        setJob({ message: 'Återupptar uppladdning…', progress: 90 })
        console.log(`[cloud-watcher] reusing existing result for ${fileName}: ${resultFileName}`)
      } catch {
        // File gone — fall through to reprocess
      }
    }

    if (!resultPath) {
      // 1 — download: small files use base64 (in-memory), large files stream to disk
      let token = await auth.ensureAccessToken()
      const fileSize = await getItemSize(token, itemId)
      const isLarge = fileSize >= LARGE_FILE_THRESHOLD

      let jobId
      if (isLarge) {
        const localInputPath = path.join(LOCAL_INPUT_DIR, fileName)
        await downloadItemToFile(token, itemId, localInputPath)
        setJob({ message: 'Bearbetar bakgrundsborttagning…' })
        jobId = startBgRemoverJob({ filePath: `/input/${fileName}`, fileName, model: MODEL, alphaMatting: false })
      } else {
        const data = await downloadItem(token, itemId)
        setJob({ message: 'Bearbetar bakgrundsborttagning…' })
        jobId = startBgRemoverJob({ dataBase64: data.toString('base64'), fileName, model: MODEL, alphaMatting: false })
      }

      await new Promise((resolve, reject) => {
        const t = setInterval(() => {
          const job = getBgRemoverJob(jobId)
          if (!job) { clearInterval(t); reject(new Error('Job försvann')); return }
          setJob({ message: job.message, progress: job.progress })
          if (job.status === 'done') { clearInterval(t); resolve() }
          if (job.status === 'error') { clearInterval(t); reject(new Error(job.error ?? 'Okänt fel')) }
        }, 2000)
      })

      const result = getBgRemoverResult(jobId)
      if (!result?.resultPath) throw new Error('Inget resultat från bgremover')

      resultFileName = result.resultFileName
      resultPath = result.resultPath

      setJob({ message: 'Väntar på resultatfil…', progress: 92 })
      try {
        await waitForSharedFile(resultPath, { attempts: 24, delayMs: 2500 })
      } catch {
        // Shared OneDrive mount can lag or miss files between containers.
        // Fall back to fetching the finished artifact directly from bgremover.
        const recoveredPath = path.join('/tmp/bg-cloud-recovery', resultFileName)
        setJob({ message: 'Hämtar resultat direkt från bgremover…', progress: 93 })
        await downloadBgRemoverResultToFile(resultFileName, recoveredPath)
        resultPath = recoveredPath
      }

      // Save pending upload — if upload fails we can retry without re-running bgremover
      const state1 = await loadState()
      state1.pendingUpload = state1.pendingUpload ?? {}
      state1.pendingUpload[itemId] = { lastModified, resultFileName }
      delete state1.failed?.[itemId]
      await saveState(state1)
    }

    // 3 — upload to OneDrive streaming from disk
    setJob({ message: 'Laddar upp till OneDrive…', progress: 95 })
    let token = await auth.ensureAccessToken()
    const { size: localSize } = await stat(resultPath)
    let uploadOk = false
    for (let attempt = 1; attempt <= 3 && !uploadOk; attempt++) {
      try {
        await ensureFolder(token, outputPath)
        await uploadLargeFile(token, outputPath, resultFileName, resultPath)
        uploadOk = true
      } catch (uploadErr) {
        const msg = uploadErr.message
        console.log(`[cloud-watcher] upload attempt ${attempt} failed: ${msg.slice(0, 120)}`)
        // Check if file actually made it despite the error (common with SharePoint eTag issues)
        token = await auth.ensureAccessToken()
        const encoded = [...outputPath.split('/'), resultFileName].map(encodeURIComponent).join('/')
        const checkRes = await fetch(`${driveBase()}/root:/${encoded}`, { headers: { Authorization: `Bearer ${token}` } })
        if (checkRes.ok) {
          const item = await checkRes.json()
          if (item.size === localSize) {
            console.log(`[cloud-watcher] file verified in OneDrive (${localSize} bytes) — treating as success`)
            uploadOk = true
            break
          }
          // File exists but wrong size — delete and retry
          await fetch(`${driveBase()}/items/${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
        }
        if (!uploadOk && attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 5000))
          token = await auth.ensureAccessToken()
        } else if (!uploadOk) {
          throw uploadErr
        }
      }
    }

    setJob({ status: 'done', message: 'Klar!', progress: 100, outputFileName: resultFileName })
    console.log(`[cloud-watcher] ✓ ${fileName} → ${outputPath}/${resultFileName}`)

    // Persist success
    const state2 = await loadState()
    state2.processed[itemId] = lastModified
    delete state2.failed?.[itemId]
    delete state2.pendingUpload?.[itemId]
    await saveState(state2)

    // Clean up local result file to free disk space
    const localResult = path.join(LOCAL_OUTPUT_DIR, resultFileName)
    await unlink(localResult).catch(() => {})

  } catch (err) {
    const isCancelledByFlush = err.message.toLowerCase().includes('cancelled by flush')
    setJob({ status: 'error', message: 'Fel', error: err.message, failedLastModified: isCancelledByFlush ? null : lastModified })
    console.error(`[cloud-watcher] ✗ ${fileName}:`, err.message)

    // "Cancelled by flush" is a transient startup race — don't persist as permanent failure
    // so the next poll will retry the file
    if (!isCancelledByFlush) {
      const state = await loadState()
      state.failed = state.failed ?? {}
      state.failed[itemId] = { lastModified, error: err.message, failedAt: new Date().toISOString() }
      await saveState(state)
    } else {
      // Clear from cloudJobs so next poll re-queues it
      cloudJobs.delete(jobKey)
    }
  }
}

// ── poll ────────────────────────────────────────────────────────────────────

async function pollSlot(token, slot, state) {
  let items
  try { items = await listFolder(token, slot.input) } catch (err) {
    // Folder may not exist yet — not an error
    if (!err.message.includes('404') && !err.message.includes('itemNotFound')) {
      console.error(`[cloud-watcher] list error (${slot.key}):`, err.message)
    }
    return
  }

  for (const item of items) {
    if (!item.file) continue
    const ext = path.extname(item.name).toLowerCase()
    if (!VIDEO_EXTS.has(ext) && !IMAGE_EXTS.has(ext)) continue

    const jobKey = `${slot.key}/${item.name}`

    const job = cloudJobs.get(jobKey)
    if (job && (job.status === 'queued' || job.status === 'processing')) continue
    if (job?.status === 'error' && job?.failedLastModified === item.lastModifiedDateTime) continue

    if (state.processed[item.id] === item.lastModifiedDateTime) {
      if (!cloudJobs.has(jobKey))
        cloudJobs.set(jobKey, { slot: slot.key, fileName: item.name, status: 'done', message: 'Redan klar', progress: 100, detectedAt: Date.now() })
      continue
    }

    if (state.failed?.[item.id]?.lastModified === item.lastModifiedDateTime) {
      if (!cloudJobs.has(jobKey))
        cloudJobs.set(jobKey, {
          slot: slot.key, fileName: item.name,
          status: 'error', message: 'Fel (se logg)', progress: 0, detectedAt: Date.now(),
          error: state.failed[item.id].error,
        })
      continue
    }

    console.log(`[cloud-watcher] queuing ${slot.key}/${item.name} itemId=${item.id}`)
    cloudJobs.set(jobKey, { slot: slot.key, fileName: item.name, status: 'queued', message: 'Köad…', progress: 0, detectedAt: Date.now() })
    enqueueJob(() => processFile(item.name, item.id, item.lastModifiedDateTime, slot.output, jobKey))
  }
}

async function poll() {
  let token
  try {
    token = await auth.ensureAccessToken()
  } catch (err) {
    console.error('[cloud-watcher] auth error:', err.message)
    return
  }

  const state = await loadState()
  for (const slot of SLOTS) {
    await pollSlot(token, slot, state)
  }
}

// ── public API ──────────────────────────────────────────────────────────────

export function getCloudWatcherStatus() {
  const jobs = [...cloudJobs.entries()].map(([key, job]) => ({ jobKey: key, ...job }))
  jobs.sort((a, b) => (b.detectedAt ?? 0) - (a.detectedAt ?? 0))
  return { slots: SLOTS.map(s => ({ key: s.key, input: s.input, output: s.output })), jobs }
}

export function startCloudWatcher(microsoftAuth, { repoRoot = '/workspace/operator-hub', bgremoverUrl = null } = {}) {
  auth = microsoftAuth
  stateFile = path.join(repoRoot, '.local/bg-cloud-state.json')

  const bgUrl = bgremoverUrl ?? process.env.BGREMOVER_URL ?? 'http://bgremover:8095'
  const slotDesc = SLOTS.length === 1 ? `${SLOTS[0].input} → ${SLOTS[0].output}` : `${SLOTS.length} slots (${SLOTS_RAW_BASE} → ${SLOTS_NOBG_BASE})`
  console.log(`BG Cloud watcher: ${slotDesc} (every ${POLL_MS / 1000}s)`)

  fetch(`${bgUrl}/jobs`, { method: 'DELETE' })
    .then(r => r.json())
    .then(d => {
      if (d.cancelled?.length) console.log(`[cloud-watcher] flushed ${d.cancelled.length} stale bgremover job(s)`)
    })
    .catch(() => {})
    .finally(() => {
      // Start polling only after flush completes (or fails) to avoid race
      void poll()
      setInterval(() => void poll(), POLL_MS)
    })
}
