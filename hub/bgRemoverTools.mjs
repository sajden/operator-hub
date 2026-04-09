/**
 * bgRemoverTools.mjs
 * Submits background-removal jobs to the bgremover HTTP service.
 *
 * The bgremover container runs with GPU access and writes results directly
 * to the shared output volume — no Docker-in-Docker, no path hacks.
 */
import { randomBytes } from 'node:crypto'
import path from 'node:path'

const BGREMOVER_URL         = process.env.BGREMOVER_URL ?? 'http://bgremover:8095'
const BG_OUTPUT_CONTAINER_DIR = process.env.BG_WATCH_OUTPUT ?? '/workspace/bg-output'

const IMAGE_EXTS   = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif'])
const VIDEO_EXTS   = new Set(['.mp4', '.mov', '.webm', '.gif'])
const VALID_MODELS = new Set(['u2net', 'u2net_human_seg', 'u2netp'])

/** @type {Map<string, object>} */
const jobs = new Map()

export function startBgRemoverJob({ dataBase64, filePath, fileName, model = 'u2net_human_seg', alphaMatting = false }) {
  const ext = path.extname(fileName).toLowerCase()
  if (!IMAGE_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) throw new Error(`Unsupported file type: ${ext}`)
  if (!VALID_MODELS.has(model)) throw new Error(`Invalid model: ${model}`)

  const jobId = randomBytes(10).toString('hex')
  jobs.set(jobId, { status: 'processing', message: 'Förbereder…', progress: 0, startedAt: Date.now() })
  void _runJob(jobId, { dataBase64, filePath, fileName, model, alphaMatting })
  return jobId
}

async function _runJob(jobId, { dataBase64, filePath, fileName, model, alphaMatting }) {
  const job = jobs.get(jobId)
  try {
    // Submit to bgremover service
    const submitRes = await fetch(`${BGREMOVER_URL}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, ...(filePath ? { filePath } : { dataBase64 }), model, alphaMatting }),
    })
    if (!submitRes.ok) {
      const err = await submitRes.json().catch(() => ({}))
      throw new Error(`bgremover submit failed ${submitRes.status}: ${err.error ?? ''}`)
    }
    const { jobId: remoteId } = await submitRes.json()

    // Poll until done
    while (true) {
      await new Promise(r => setTimeout(r, 2000))
      const pollRes = await fetch(`${BGREMOVER_URL}/jobs/${remoteId}`)
      if (!pollRes.ok) throw new Error(`bgremover poll failed ${pollRes.status}`)
      const status = await pollRes.json()

      job.progress = status.progress ?? job.progress
      job.message  = status.message  ?? job.message

      if (status.status === 'done') {
        const isVideo = VIDEO_EXTS.has(path.extname(fileName).toLowerCase())
        job.status          = 'done'
        job.progress        = 100
        job.message         = 'Klar!'
        job.resultFileName  = status.resultFileName
        job.resultPath      = path.join(BG_OUTPUT_CONTAINER_DIR, status.resultFileName)
        job.resultMime      = isVideo ? 'video/quicktime' : 'image/png'
        break
      }
      if (status.status === 'error') {
        throw new Error(status.error ?? 'Okänt fel från bgremover')
      }
    }
  } catch (err) {
    job.status  = 'error'
    job.error   = err instanceof Error ? err.message : String(err)
    job.message = 'Fel vid bearbetning'
    console.error(`[bgr ${jobId.slice(0, 8)}] error:`, job.error)
  } finally {
    setTimeout(() => jobs.delete(jobId), 10 * 60 * 1000)
  }
}

export function getBgRemoverJob(jobId) {
  const job = jobs.get(jobId)
  if (!job) return null
  return {
    status:   job.status,
    message:  job.message,
    progress: job.progress,
    elapsed:  Math.round((Date.now() - job.startedAt) / 1000),
    ...(job.status === 'done'  ? { resultMime: job.resultMime, resultFileName: job.resultFileName } : {}),
    ...(job.status === 'error' ? { error: job.error } : {}),
  }
}

export function getBgRemoverResult(jobId) {
  const job = jobs.get(jobId)
  if (!job || job.status !== 'done' || !job.resultPath) return null
  return { resultPath: job.resultPath, resultMime: job.resultMime, resultFileName: job.resultFileName }
}
