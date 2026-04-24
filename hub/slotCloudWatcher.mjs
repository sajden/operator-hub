/**
 * slotCloudWatcher.mjs
 * Polls OneDrive video-N/raw/ for stability, then reads no-bg files from
 * a locally-synced OneDrive folder (mounted via LOCAL_NOBG_BASE) instead of
 * downloading via Graph API — eliminates the cloud round-trip.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  createShortFormJob,
  getShortFormWatchersStatus,
  saveShortFormWatchersStatus
} from './shortFormVideoTools.mjs'

const SLOTS_RAW_BASE  = process.env.BG_CLOUD_RAW_BASE  ?? 'Seb/Videos/raw-videos'
const SLOTS_NOBG_BASE = process.env.BG_CLOUD_NOBG_BASE ?? 'Seb/Videos/no-bg-videos'
const SLOT_COUNT      = Number(process.env.BG_CLOUD_SLOT_COUNT ?? 10)
const LOCAL_NOBG_BASE = process.env.LOCAL_NOBG_BASE ?? ''
const LOCAL_RAW_BASE  = process.env.LOCAL_RAW_BASE  ?? ''
const POLL_MS = 45_000

const SLOTS = [...Array(SLOT_COUNT)].map((_, i) => ({
  key:       `video-${i + 1}`,
  raw:       `${SLOTS_RAW_BASE}/video-${i + 1}`,
  rawLocal:  LOCAL_RAW_BASE  ? path.join(LOCAL_RAW_BASE,  `video-${i + 1}`) : null,
  nobgLocal: LOCAL_NOBG_BASE ? path.join(LOCAL_NOBG_BASE, `video-${i + 1}`) : null
}))

/** @type {import('./microsoftAuth.mjs').MicrosoftAuth | null} */
let auth = null
let stateFile = null

// slotKey → rawRevision string (sorted names joined) of the set that triggered the job
const triggeredRevisions = new Map()
// slotKey → last seen raw revision (for stability check across two polls)
const lastRawRevisions = new Map()

// ── helpers ──────────────────────────────────────────────────────────────────

async function loadState() {
  try { return JSON.parse(await readFile(stateFile, 'utf-8')) } catch { return { triggered: {} } }
}

async function saveState(state) {
  await mkdir(path.dirname(stateFile), { recursive: true })
  await writeFile(stateFile, JSON.stringify(state, null, 2), 'utf-8')
}

async function graphGet(token, relPath) {
  const url = `https://graph.microsoft.com/v1.0${relPath}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Graph ${res.status}: ${err?.error?.message ?? relPath}`)
  }
  return res.json()
}

function driveBase() { return `https://graph.microsoft.com/v1.0${auth.driveRootPath()}` }

async function listFolder(token, folderPath) {
  const encoded = folderPath.split('/').map(encodeURIComponent).join('/')
  const data = await graphGet(
    token,
    `${auth.driveRootPath()}/root:/${encoded}:/children?$select=id,name,size,lastModifiedDateTime,file`
  )
  return data.value ?? []
}

function listLocalVideoFiles(dirPath) {
  const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.m4v'])
  try {
    return readdirSync(dirPath)
      .filter(name => VIDEO_EXTS.has(path.extname(name).toLowerCase()))
      .map(name => ({ name, size: statSync(path.join(dirPath, name)).size, file: true }))
  } catch {
    return []
  }
}

function videoRevision(items) {
  const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.m4v'])
  return items
    .filter(i => VIDEO_EXTS.has(path.extname(i.name).toLowerCase()))
    .map(i => `${i.name}:${i.size}`)
    .sort()
    .join('|')
}

async function syncSlotStatus(slotKey, patch) {
  const state = await getShortFormWatchersStatus()
  const jobs = Array.isArray(state.slotWatcher?.jobs) ? state.slotWatcher.jobs : []
  const next = [
    { slotKey, detectedAt: Date.now(), ...patch },
    ...jobs.filter(j => j.slotKey !== slotKey)
  ].slice(0, 30)
  state.slotWatcher = { slots: SLOT_COUNT, rawBase: SLOTS_RAW_BASE, nobgBase: SLOTS_NOBG_BASE, jobs: next }
  await saveShortFormWatchersStatus(state)
}

// ── poll ─────────────────────────────────────────────────────────────────────

async function pollSlot(slot, persistedState) {
  const rawVideos  = slot.rawLocal  ? listLocalVideoFiles(slot.rawLocal)  : []
  const nobgVideos = slot.nobgLocal ? listLocalVideoFiles(slot.nobgLocal) : []

  console.log(`[slot-watcher] ${slot.key}: raw=${rawVideos.length} nobg=${nobgVideos.length}`)

  if (rawVideos.length === 0) {
    if (triggeredRevisions.has(slot.key)) {
      triggeredRevisions.delete(slot.key)
      console.log(`[slot-watcher] ${slot.key}: slot cleared`)
    }
    return
  }

  const rawRev = videoRevision(rawVideos)

  // Stability check — raw set must be identical two polls in a row
  const prevRawRev = lastRawRevisions.get(slot.key)
  lastRawRevisions.set(slot.key, rawRev)
  if (prevRawRev !== rawRev) {
    await syncSlotStatus(slot.key, { status: 'waiting', message: `Väntar på stabil raw-mapp (${rawVideos.length} filer)`, progress: 10 })
    return
  }

  // Already triggered for this exact raw set? Use persisted state as single source of truth
  if (persistedState.triggered?.[slot.key] === rawRev) return

  // Check completeness — no-bg must have >= raw count
  if (nobgVideos.length < rawVideos.length) {
    await syncSlotStatus(slot.key, {
      status: 'waiting',
      message: `Väntar på BG-borttagning (${nobgVideos.length}/${rawVideos.length})`,
      progress: Math.round((nobgVideos.length / rawVideos.length) * 80)
    })
    return
  }

  // Mark as triggered immediately — prevents concurrent polls from re-downloading
  triggeredRevisions.set(slot.key, rawRev)
  const stateEarly = await loadState()
  stateEarly.triggered = stateEarly.triggered ?? {}
  stateEarly.triggered[slot.key] = rawRev
  await saveState(stateEarly)

  // Ready — use local OneDrive-synced folder directly, no download needed
  console.log(`[slot-watcher] ${slot.key}: ${nobgVideos.length} no-bg files ready locally`)
  await syncSlotStatus(slot.key, { status: 'creating', message: 'Registrerar render-jobb…', progress: 95 })
  const job = await createShortFormJob({
    title: slot.key,
    sourcePath: slot.nobgLocal,
    sourceKind: 'watcher_slot_cloud',
    sourceLabel: `OneDrive slot: ${slot.key}`,
    revisionKey: rawRev
  })

  triggeredRevisions.set(slot.key, rawRev)
  const state = await loadState()
  state.triggered = state.triggered ?? {}
  state.triggered[slot.key] = rawRev
  await saveState(state)

  await syncSlotStatus(slot.key, {
    status: 'done',
    message: 'Render-jobb skapat',
    progress: 100,
    jobId: job.id,
    sourcePath: slot.nobgLocal,
    revisionKey: rawRev
  })
  console.log(`[slot-watcher] ✓ ${slot.key} → job ${job.id}`)
}

async function poll() {
  const state = await loadState()
  for (const slot of SLOTS) {
    try {
      await pollSlot(slot, state)
    } catch (err) {
      console.error(`[slot-watcher] slot ${slot.key} error:`, err.message)
    }
  }
}

// ── public API ────────────────────────────────────────────────────────────────

export function startSlotCloudWatcher(microsoftAuth, { repoRoot = '/workspace/operator-hub' } = {}) {
  auth = microsoftAuth
  stateFile = path.join(repoRoot, '.local/slot-cloud-state.json')

  console.log(`Slot cloud watcher: ${SLOTS.length} slots (${SLOTS_RAW_BASE} → ${SLOTS_NOBG_BASE}) (every ${POLL_MS / 1000}s)`)
  void poll()
  setInterval(() => void poll(), POLL_MS)
}
