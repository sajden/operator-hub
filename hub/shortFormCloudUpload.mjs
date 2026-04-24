/**
 * shortFormCloudUpload.mjs
 * Uploads the rendered video and social-copy.md to the OneDrive slot folder.
 */
import { stat, readFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'

const SHORT_FORM_OUTPUT_BASE = process.env.OPERATOR_HUB_SHORT_FORM_CLOUD_OUTPUT_PATH ?? 'Seb/Videos/short-form-review-cuts'
const UPLOAD_CHUNK    = 5 * 1024 * 1024  // 5 MB

let auth = null

export function initCloudUpload(microsoftAuth) {
  auth = microsoftAuth
}

function driveBase() {
  return `https://graph.microsoft.com/v1.0${auth.driveRootPath()}`
}

async function uploadSmallFile(token, folderPath, fileName, content, contentType = 'text/plain') {
  const encoded = [...folderPath.split('/'), fileName].map(encodeURIComponent).join('/')
  const res = await fetch(
    `${driveBase()}/root:/${encoded}:/content`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      body: content
    }
  )
  if (!res.ok) throw new Error(`Upload small file ${res.status}: ${await res.text().catch(() => '')}`)
  return res.json()
}

async function uploadLargeFile(token, folderPath, fileName, filePath) {
  const encoded = [...folderPath.split('/'), fileName].map(encodeURIComponent).join('/')
  const { size: total } = await stat(filePath)

  const sessionRes = await fetch(
    `${driveBase()}/root:/${encoded}:/createUploadSession`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } })
    }
  )
  if (!sessionRes.ok) throw new Error(`Upload session ${sessionRes.status}`)
  const { uploadUrl } = await sessionRes.json()

  let offset = 0
  while (offset < total) {
    const end = Math.min(offset + UPLOAD_CHUNK, total)
    const stream = createReadStream(filePath, { start: offset, end: end - 1 })
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(end - offset),
        'Content-Range': `bytes ${offset}-${end - 1}/${total}`
      },
      body: stream,
      duplex: 'half'
    })
    if (!res.ok && res.status !== 202 && res.status !== 308) {
      throw new Error(`Upload chunk ${res.status}`)
    }
    offset = end
  }
  console.log(`[cloud-upload] ✓ ${fileName} (${(total / 1024 / 1024).toFixed(1)} MB)`)
}

export async function startCloudWatcherUpload(slotKey, videoPath, socialCopyPath) {
  if (!auth) { console.warn('[cloud-upload] auth not initialized'); return }

  const destFolder = `${SHORT_FORM_OUTPUT_BASE}/${slotKey}`
  const token = await auth.ensureAccessToken()

  console.log(`[cloud-upload] uploading render for ${slotKey} → ${destFolder}`)

  await uploadLargeFile(token, destFolder, 'render-final.mp4', videoPath)

  if (socialCopyPath) {
    const md = await readFile(socialCopyPath, 'utf-8')
    await uploadSmallFile(token, destFolder, 'social-copy.md', md, 'text/markdown')
    console.log(`[cloud-upload] ✓ social-copy.md`)
  }

  console.log(`[cloud-upload] done for ${slotKey}`)
}
