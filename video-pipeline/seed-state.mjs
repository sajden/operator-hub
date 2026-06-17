/**
 * seed-state.mjs  — one-shot script to populate bg-cloud-state.json
 * based on what already exists in no-bg-videos on OneDrive.
 *
 * Run inside the video-pipeline container:
 *   node /app/seed-state.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createMicrosoftAuth } from './src/microsoftAuth.mjs'

const SLOTS_RAW_BASE  = process.env.BG_CLOUD_RAW_BASE  ?? 'Seb/Videos/raw-videos'
const SLOTS_NOBG_BASE = process.env.BG_CLOUD_NOBG_BASE ?? 'Seb/Videos/no-bg-videos'
const SLOT_COUNT      = Number(process.env.BG_CLOUD_SLOT_COUNT ?? 10)
const STATE_FILE      = process.env.OPERATOR_HUB_SHORT_FORM_ROOT
  ? path.join(process.env.OPERATOR_HUB_SHORT_FORM_ROOT, 'bg-cloud-state.json')
  : '/workspace/pipeline-state/bg-cloud-state.json'

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.gif'])

const microsoftAuth = createMicrosoftAuth({
  publicUrl:             process.env.OPERATOR_HUB_PUBLIC_URL ?? 'http://localhost:3420',
  tenantId:              process.env.OPERATOR_HUB_MS_TENANT_ID ?? 'common',
  clientId:              process.env.OPERATOR_HUB_MS_CLIENT_ID ?? '',
  clientSecret:          process.env.OPERATOR_HUB_MS_CLIENT_SECRET ?? '',
  scopes:                (process.env.OPERATOR_HUB_MS_SCOPES ?? 'openid profile offline_access User.Read Files.ReadWrite.All').split(' '),
  tokenFilePath:         process.env.MS_TOKEN_FILE ?? '/workspace/pipeline-state/microsoft-auth.json',
  useClientCredentials:  process.env.OPERATOR_HUB_MS_USE_CLIENT_CREDENTIALS === 'true',
  driveUser:             process.env.OPERATOR_HUB_MS_DRIVE_USER ?? null,
})

async function listFolder(token, folderPath) {
  const encoded = folderPath.split('/').map(encodeURIComponent).join('/')
  const url = `https://graph.microsoft.com/v1.0${microsoftAuth.driveRootPath()}/root:/${encoded}:/children?$select=id,name,lastModifiedDateTime,file`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 404) return null
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(`Graph ${res.status}: ${e?.error?.message ?? folderPath}`) }
  return (await res.json()).value ?? []
}

async function main() {
  const token = await microsoftAuth.ensureAccessToken()
  console.log('Auth OK')

  // Load existing state so we don't wipe the 4 entries already written
  let state
  try { state = JSON.parse(await readFile(STATE_FILE, 'utf-8')) } catch { state = {} }
  state.processed = state.processed ?? {}
  state.failed    = state.failed    ?? {}

  let seeded = 0

  for (let i = 1; i <= SLOT_COUNT; i++) {
    const slotKey  = `video-${i}`
    const rawPath  = `${SLOTS_RAW_BASE}/${slotKey}`
    const nobgPath = `${SLOTS_NOBG_BASE}/${slotKey}`

    const [rawItems, nobgItems] = await Promise.all([
      listFolder(token, rawPath),
      listFolder(token, nobgPath),
    ])

    if (!rawItems) { console.log(`  ${slotKey}: no raw folder`); continue }
    if (!nobgItems) { console.log(`  ${slotKey}: no output folder yet, skipping`); continue }

    const nobgNames = nobgItems.map(f => f.name)

    for (const item of rawItems) {
      if (!item.file) continue
      const ext  = path.extname(item.name).toLowerCase()
      if (!VIDEO_EXTS.has(ext)) continue

      // Already in state — keep it
      if (state.processed[item.id] === item.lastModifiedDateTime) {
        console.log(`  = ${slotKey}/${item.name} (already in state)`)
        continue
      }

      const base    = item.name.replace(/\.[^.]+$/, '')  // strip extension case-insensitively
      const hasNobg = nobgNames.some(n => n.startsWith(base + '-nobg-'))

      if (hasNobg) {
        state.processed[item.id] = item.lastModifiedDateTime
        delete state.failed[item.id]
        seeded++
        console.log(`  ✓ ${slotKey}/${item.name}`)
      } else {
        console.log(`  ○ ${slotKey}/${item.name}  ← no output, will be queued`)
      }
    }
  }

  await mkdir(path.dirname(STATE_FILE), { recursive: true })
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2))
  console.log(`\nDone. Seeded ${seeded} new entries → ${STATE_FILE}`)
  console.log(`Total processed: ${Object.keys(state.processed).length}`)
}

main().catch(err => { console.error(err); process.exit(1) })
