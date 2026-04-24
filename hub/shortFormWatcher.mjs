import { readdirSync, statSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import {
  createShortFormJob,
  getShortFormWatchersStatus,
  saveShortFormWatchersStatus
} from './shortFormVideoTools.mjs'

const INPUT_DIR = process.env.OPERATOR_HUB_SHORT_FORM_INPUT_DIR ?? '/workspace/short-form-input'
const POLL_MS = 10_000
const seenRevisions = new Map()

function isVideo(fileName) {
  return /\.(mp4|mov|webm|m4v)$/i.test(fileName)
}

function folderRevision(folderPath) {
  const fileNames = readdirSync(folderPath).filter(isVideo).sort()
  const parts = fileNames.map((fileName) => {
    const filePath = path.join(folderPath, fileName)
    const fileStat = statSync(filePath)
    return `${fileName}:${fileStat.size}:${Math.round(fileStat.mtimeMs)}`
  })
  return parts.join('|')
}

async function syncWatcherStatus(folderName, patch) {
  const state = await getShortFormWatchersStatus()
  const jobs = Array.isArray(state.localWatcher?.jobs) ? state.localWatcher.jobs : []
  const next = [
    { folderName, detectedAt: Date.now(), ...patch },
    ...jobs.filter((job) => job.folderName !== folderName && job.fileName !== folderName)
  ].slice(0, 20)
  state.localWatcher = {
    inputDir: INPUT_DIR,
    jobs: next.map((job) => ({
      fileName: job.folderName ?? job.fileName,
      ...job
    }))
  }
  await saveShortFormWatchersStatus(state)
}

async function scan() {
  if (!existsSync(INPUT_DIR)) return

  const entries = readdirSync(INPUT_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory())
  for (const entry of entries) {
    const folderPath = path.join(INPUT_DIR, entry.name)
    const revision = folderRevision(folderPath)
    if (!revision) continue

    const previous = seenRevisions.get(folderPath)
    seenRevisions.set(folderPath, revision)
    if (previous !== revision) {
      await syncWatcherStatus(entry.name, { status: 'queued', message: 'Väntar på stabil folder', progress: 0 })
      continue
    }

    const state = await getShortFormWatchersStatus()
    const alreadyTracked = Array.isArray(state.localWatcher?.jobs)
      && state.localWatcher.jobs.some((job) => job.sourcePath === folderPath || job.revisionKey === revision)
    if (alreadyTracked) continue

    await syncWatcherStatus(entry.name, { status: 'processing', message: 'Registrerar jobb', progress: 15 })
    const job = await createShortFormJob({
      title: entry.name,
      sourcePath: folderPath,
      sourceKind: 'watcher_local',
      sourceLabel: `Local watcher: ${entry.name}`,
      revisionKey: revision
    })
    await syncWatcherStatus(entry.name, {
      status: 'done',
      message: 'Jobb registrerat',
      progress: 100,
      sourcePath: folderPath,
      revisionKey: revision,
      jobId: job.id
    })
  }
}

export function startShortFormWatcher() {
  if (!existsSync(INPUT_DIR)) {
    mkdirSync(INPUT_DIR, { recursive: true })
  }
  setInterval(() => {
    void scan().catch((error) => {
      console.error('[short-form-watcher] scan failed:', error.message)
    })
  }, POLL_MS)
  console.log(`Short-form watcher: ${INPUT_DIR} (polling every ${POLL_MS / 1000}s)`)
}
