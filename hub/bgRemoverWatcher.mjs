/**
 * bgRemoverWatcher.mjs
 * Polls an input folder and auto-processes new video/image files.
 */
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { startBgRemoverJob, getBgRemoverJob, getBgRemoverResult } from './bgRemoverTools.mjs'

export const INPUT_DIR = process.env.BG_WATCH_INPUT ?? '/workspace/bg-input'
export const OUTPUT_DIR = process.env.BG_WATCH_OUTPUT ?? '/workspace/bg-output'
const MODEL = process.env.BG_WATCH_MODEL ?? 'u2net_human_seg'
const POLL_MS = 5000

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.gif'])
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif'])

/** @type {Map<string, { status: string, message: string, progress: number, elapsed: number, jobId?: string, outputFileName?: string, error?: string, detectedAt: number }>} */
const watchJobs = new Map()

/** Snapshot of file sizes used to detect when a file is done being written. */
const fileSizes = new Map()

export function getWatcherStatus() {
  const jobs = [...watchJobs.entries()].map(([fileName, job]) => ({ fileName, ...job }))
  jobs.sort((a, b) => b.detectedAt - a.detectedAt)
  return { inputDir: INPUT_DIR, outputDir: OUTPUT_DIR, jobs }
}

async function processFile(fileName) {
  const filePath = path.join(INPUT_DIR, fileName)
  const ext = path.extname(fileName).toLowerCase()

  watchJobs.set(fileName, {
    status: 'processing', message: 'Läser fil…', progress: 0,
    detectedAt: watchJobs.get(fileName)?.detectedAt ?? Date.now(),
  })

  try {
    const data = await readFile(filePath)
    const dataBase64 = data.toString('base64')

    const jobId = startBgRemoverJob({ dataBase64, fileName, model: MODEL, alphaMatting: false })
    watchJobs.set(fileName, { ...watchJobs.get(fileName), jobId, message: 'Bearbetar…' })

    // Poll until done
    await new Promise((resolve, reject) => {
      const timer = setInterval(() => {
        const job = getBgRemoverJob(jobId)
        if (!job) { clearInterval(timer); reject(new Error('Job försvann')); return }
        watchJobs.set(fileName, {
          ...watchJobs.get(fileName),
          message: job.message,
          progress: job.progress,
          elapsed: job.elapsed,
        })
        if (job.status === 'done') { clearInterval(timer); resolve(undefined) }
        else if (job.status === 'error') { clearInterval(timer); reject(new Error(job.error ?? 'Okänt fel')) }
      }, 2000)
    })

    // Result is already auto-saved to OUTPUT_DIR by bgRemoverTools
    const result = getBgRemoverResult(jobId)
    const outputFileName = result?.resultFileName ?? path.basename(fileName, ext) + '-nobg.webm'
    watchJobs.set(fileName, {
      ...watchJobs.get(fileName),
      status: 'done', message: 'Sparad!', progress: 100, outputFileName,
    })
  } catch (err) {
    watchJobs.set(fileName, {
      ...watchJobs.get(fileName),
      status: 'error',
      message: 'Fel',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

function poll() {
  if (!existsSync(INPUT_DIR)) return

  let entries
  try { entries = readdirSync(INPUT_DIR) } catch { return }

  for (const fileName of entries) {
    const ext = path.extname(fileName).toLowerCase()
    if (!VIDEO_EXTS.has(ext) && !IMAGE_EXTS.has(ext)) continue

    const job = watchJobs.get(fileName)
    if (job && job.status !== 'error') continue // already handled in this session

    // Skip if output already exists (e.g. after server restart)
    const stem = path.basename(fileName, path.extname(fileName))
    const alreadyDone = existsSync(OUTPUT_DIR) &&
      readdirSync(OUTPUT_DIR).some(f => f.startsWith(`${stem}-nobg-`))
    if (alreadyDone) {
      watchJobs.set(fileName, { status: 'done', message: 'Redan klar', progress: 100, detectedAt: Date.now() })
      continue
    }

    const filePath = path.join(INPUT_DIR, fileName)
    let size = 0
    try { size = statSync(filePath).size } catch { continue }

    // Wait for file to be fully written (size stable across two polls)
    const prevSize = fileSizes.get(fileName)
    fileSizes.set(fileName, size)
    if (prevSize !== size) continue // still being written

    if (!watchJobs.has(fileName)) {
      watchJobs.set(fileName, {
        status: 'queued', message: 'Köad…', progress: 0,
        detectedAt: Date.now(),
      })
    }

    if (watchJobs.get(fileName)?.status === 'queued') {
      void processFile(fileName)
    }
  }
}

export function startWatcher() {
  for (const dir of [INPUT_DIR, OUTPUT_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
  setInterval(poll, POLL_MS)
  console.log(`BG Remover watcher: ${INPUT_DIR} → ${OUTPUT_DIR} (polling every ${POLL_MS / 1000}s)`)
}
