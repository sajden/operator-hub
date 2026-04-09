import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const localAssetsRoot = path.resolve(repoRoot, '.local/assets/owner-media')
const localStockAssetsRoot = path.resolve(repoRoot, '.local/assets/stock-media')
const localPreviewAssetsRoot = path.resolve(repoRoot, '.local/assets/public-previews')
const previewDockerImage = process.env.OPERATOR_HUB_PREVIEW_DOCKER_IMAGE ?? 'operator-hub-public-preview-capture'

const DEFAULT_SCREENSHOT_WIDTH = 1440
const DEFAULT_SCREENSHOT_HEIGHT = 900
const MAX_APPROVED_URLS = 50
const MAX_APPROVED_LOCAL_PATHS = 100
const MAX_MAX_ASSETS = 100
const ALLOWED_ASSET_TYPES = new Set(['screenshot', 'thumbnail', 'profile'])
const STOCK_PROVIDERS = new Set(['pexels', 'unsplash'])
const DEFAULT_STOCK_PROVIDERS = ['pexels', 'unsplash']
const DEFAULT_STOCK_ORIENTATION = 'landscape'
const MAX_STOCK_RESULTS = 50
const MAX_STOCK_SELECTIONS = 50
const MAX_PREVIEW_WIDTH = 2200
const MAX_PREVIEW_HEIGHT = 2200

function nowIso() {
  return new Date().toISOString()
}

function sha(input) {
  return createHash('sha256').update(input).digest('hex')
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseUrl(value) {
  try {
    const url = new URL(String(value))
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url
  } catch {
    return null
  }
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'operator-hub-mini-hub/0.1 media-collector',
      ...(init.headers ?? {})
    }
  })

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`)
  }

  return response.json()
}

function extensionFromContentType(contentType) {
  const normalized = String(contentType ?? '').toLowerCase()
  if (normalized.includes('png')) return 'png'
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg'
  if (normalized.includes('webp')) return 'webp'
  if (normalized.includes('gif')) return 'gif'
  if (normalized.includes('svg')) return 'svg'
  return 'bin'
}

function contentTypeFromExtension(extension) {
  const normalized = String(extension ?? '').toLowerCase().replace(/^\./, '')
  if (normalized === 'png') return 'image/png'
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg'
  if (normalized === 'webp') return 'image/webp'
  if (normalized === 'gif') return 'image/gif'
  if (normalized === 'svg') return 'image/svg+xml'
  return 'application/octet-stream'
}

function readPngDimensions(buffer) {
  if (buffer.length < 24) return null
  if (buffer.toString('ascii', 1, 4) !== 'PNG') return null
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  }
}

function readGifDimensions(buffer) {
  if (buffer.length < 10) return null
  const signature = buffer.toString('ascii', 0, 6)
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8)
  }
}

function readJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null
  let offset = 2

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = buffer[offset + 1]
    const length = buffer.readUInt16BE(offset + 2)
    if (length < 2) return null

    const isStartOfFrame =
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      }
    }

    offset += 2 + length
  }

  return null
}

function readWebpDimensions(buffer) {
  if (buffer.length < 30) return null
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null

  const chunkType = buffer.toString('ascii', 12, 16)

  if (chunkType === 'VP8X') {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    }
  }

  if (chunkType === 'VP8 ') {
    if (buffer.length < 30) return null
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    }
  }

  if (chunkType === 'VP8L') {
    if (buffer.length < 25) return null
    const bits = buffer.readUInt32LE(21)
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    }
  }

  return null
}

function detectImageDimensions(buffer, contentType) {
  const ext = extensionFromContentType(contentType)
  if (ext === 'png') return readPngDimensions(buffer)
  if (ext === 'jpg') return readJpegDimensions(buffer)
  if (ext === 'gif') return readGifDimensions(buffer)
  if (ext === 'webp') return readWebpDimensions(buffer)
  return null
}

function projectRawDir(projectSlug) {
  return path.resolve(localAssetsRoot, projectSlug, 'raw')
}

function ensureWithinDir(candidatePath, rootDir) {
  const relative = path.relative(rootDir, candidatePath)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function resolveApprovedLocalPath(projectSlug, value) {
  const rawDir = projectRawDir(projectSlug)
  const trimmed = String(value ?? '').trim()
  if (!trimmed) {
    throw new Error('collect_owner_media received an empty approvedLocalPaths entry')
  }

  const candidatePath = path.isAbsolute(trimmed)
    ? path.resolve(trimmed)
    : path.resolve(rawDir, trimmed)

  if (!ensureWithinDir(candidatePath, rawDir)) {
    throw new Error(
      `collect_owner_media approvedLocalPaths must stay inside ${relativeLocalPath(rawDir)}`
    )
  }

  return {
    sourcePath: candidatePath,
    rawDir,
    sourceUrl: `local://${relativeLocalPath(candidatePath)}`
  }
}

function normalizeInput(input) {
  const projectSlug = slugify(input?.projectSlug)
  if (!projectSlug) {
    throw new Error('collect_owner_media requires projectSlug')
  }

  const approvedUrls = Array.isArray(input?.approvedUrls)
    ? input.approvedUrls.slice(0, MAX_APPROVED_URLS).map((value) => String(value).trim()).filter(Boolean)
    : []

  const invalidUrls = approvedUrls.filter((value) => !parseUrl(value))
  if (invalidUrls.length > 0) {
    throw new Error(`collect_owner_media received invalid approvedUrls: ${invalidUrls.join(', ')}`)
  }

  const approvedLocalPaths = Array.isArray(input?.approvedLocalPaths)
    ? input.approvedLocalPaths.slice(0, MAX_APPROVED_LOCAL_PATHS).map((value) => String(value).trim()).filter(Boolean)
    : []

  if (approvedUrls.length === 0 && approvedLocalPaths.length === 0) {
    throw new Error('collect_owner_media requires approvedUrls[] or approvedLocalPaths[]')
  }

  const assetTypes = Array.isArray(input?.assetTypes)
    ? input.assetTypes.map((value) => String(value).trim().toLowerCase()).filter(Boolean)
    : []

  if (assetTypes.length === 0) {
    throw new Error('collect_owner_media requires assetTypes[]')
  }

  const invalidTypes = assetTypes.filter((type) => !ALLOWED_ASSET_TYPES.has(type))
  if (invalidTypes.length > 0) {
    throw new Error(`collect_owner_media received unsupported assetTypes: ${invalidTypes.join(', ')}`)
  }

  const maxAssets = Math.max(1, Math.min(Number(input?.maxAssets ?? approvedUrls.length), MAX_MAX_ASSETS))

  return {
    projectSlug,
    approvedUrls,
    approvedLocalPaths: approvedLocalPaths.map((value) => resolveApprovedLocalPath(projectSlug, value)),
    assetTypes,
    maxAssets
  }
}

async function ensureAssetDir(projectSlug) {
  const dir = path.resolve(localAssetsRoot, projectSlug)
  await mkdir(dir, { recursive: true })
  await mkdir(projectRawDir(projectSlug), { recursive: true })
  return dir
}

async function ensureStockAssetDir(projectSlug) {
  const dir = path.resolve(localStockAssetsRoot, projectSlug)
  await mkdir(dir, { recursive: true })
  return dir
}

async function ensurePreviewAssetDir(projectSlug) {
  const dir = path.resolve(localPreviewAssetsRoot, projectSlug)
  await mkdir(dir, { recursive: true })
  return dir
}

async function writeJson(filePath, payload) {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}

function relativeLocalPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/')
}

function detectBrowserCommand() {
  const configured = process.env.OPERATOR_HUB_SCREENSHOT_BROWSER?.trim()
  if (configured) return configured

  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/microsoft-edge'
  ]

  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

async function runProcess(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderr.trim() || `Process exited with code ${code}`))
    })
  })
}

async function runProcessWithOutput(command, args, cwd = repoRoot) {
  const stdout = []
  const stderr = []

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    child.stdout.on('data', (chunk) => {
      stdout.push(String(chunk))
    })

    child.stderr.on('data', (chunk) => {
      stderr.push(String(chunk))
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderr.join('').trim() || stdout.join('').trim() || `Process exited with code ${code}`))
    })
  })

  return {
    stdout: stdout.join(''),
    stderr: stderr.join('')
  }
}

async function captureScreenshot(sourceUrl, outputPath) {
  const browserCommand = detectBrowserCommand()
  if (!browserCommand) {
    throw new Error('No supported local browser command found for screenshots. Set OPERATOR_HUB_SCREENSHOT_BROWSER to a Chromium-compatible binary.')
  }

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=' + `${DEFAULT_SCREENSHOT_WIDTH},${DEFAULT_SCREENSHOT_HEIGHT}`,
    `--screenshot=${outputPath}`,
    sourceUrl
  ]

  await runProcess(browserCommand, args)

  return {
    width: DEFAULT_SCREENSHOT_WIDTH,
    height: DEFAULT_SCREENSHOT_HEIGHT,
    browserCommand
  }
}

async function fetchApprovedImage(sourceUrl) {
  const response = await fetch(sourceUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'operator-hub-mini-hub/0.1 media-collector'
    }
  })

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`Approved URL is not a direct image response (${contentType || 'unknown content-type'})`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const dimensions = detectImageDimensions(buffer, contentType)

  return {
    buffer,
    contentType,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null
  }
}

function buildAssetBaseName(projectSlug, assetType, sourceUrl) {
  return `${projectSlug}-${assetType}-${sha(`${assetType}:${sourceUrl}`).slice(0, 12)}`
}

async function appendManifest(projectDir, manifestEntry) {
  const manifestPath = path.resolve(projectDir, 'manifest.json')
  let manifest = { generatedAt: nowIso(), assets: [] }

  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
  } catch {
    manifest = { generatedAt: nowIso(), assets: [] }
  }

  const nextAssets = Array.isArray(manifest.assets) ? manifest.assets.filter((entry) => entry.localPath !== manifestEntry.localPath) : []
  nextAssets.push(manifestEntry)
  manifest.generatedAt = nowIso()
  manifest.assets = nextAssets

  await writeJson(manifestPath, manifest)
}

async function persistAsset(projectDir, projectSlug, assetType, sourceUrl, kind, payload) {
  const baseName = buildAssetBaseName(projectSlug, assetType, sourceUrl)
  const extension = payload.extension ?? 'bin'
  const filePath = path.resolve(projectDir, `${baseName}.${extension}`)
  const metadataPath = path.resolve(projectDir, `${baseName}.metadata.json`)

  if (payload.buffer) {
    await writeFile(filePath, payload.buffer)
  }

  if (payload.copyFromPath) {
    await copyFile(payload.copyFromPath, filePath)
  }

  const metadata = {
    projectSlug,
    collectedAt: nowIso(),
    assetType,
    sourceUrl,
    sourcePath: payload.sourcePath ? relativeLocalPath(payload.sourcePath) : null,
    kind,
    localPath: relativeLocalPath(filePath),
    width: payload.width ?? null,
    height: payload.height ?? null,
    contentType: payload.contentType ?? null,
    provenance: {
      mode: kind,
      approvedUrl: sourceUrl,
      approvedLocalPath: payload.sourcePath ? relativeLocalPath(payload.sourcePath) : null,
      deterministicKey: sha(`${projectSlug}:${assetType}:${sourceUrl}`),
      browserCommand: payload.browserCommand ?? null
    }
  }

  await writeJson(metadataPath, metadata)
  await appendManifest(projectDir, metadata)

  return {
    type: assetType,
    sourceUrl,
    localPath: metadata.localPath,
    width: metadata.width,
    height: metadata.height
  }
}

async function readApprovedLocalImage(sourcePath) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Approved local file does not exist (${relativeLocalPath(sourcePath)})`)
  }

  const extension = path.extname(sourcePath).replace(/^\./, '').toLowerCase() || 'bin'
  const contentType = contentTypeFromExtension(extension)
  if (!contentType.startsWith('image/')) {
    throw new Error(`Approved local file is not a supported image type (${extension || 'unknown'})`)
  }

  const buffer = await readFile(sourcePath)
  const dimensions = detectImageDimensions(buffer, contentType)

  return {
    sourcePath,
    extension,
    contentType,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null
  }
}

export async function collectOwnerMedia(input) {
  const normalized = normalizeInput(input)
  const projectDir = await ensureAssetDir(normalized.projectSlug)

  const assets = []
  const errors = []
  const attempts = []

  const approvedSources = [
    ...normalized.approvedUrls.map((sourceUrl) => ({ kind: 'url', sourceUrl })),
    ...normalized.approvedLocalPaths.map((entry) => ({ kind: 'local', ...entry }))
  ]

  for (const source of approvedSources) {
    for (const assetType of normalized.assetTypes) {
      if (assets.length >= normalized.maxAssets) break

      attempts.push({ sourceUrl: source.sourceUrl, assetType })

      try {
        if (source.kind === 'local' && assetType === 'screenshot') {
          throw new Error('Local files do not support screenshot capture. Use profile or thumbnail for approved local images.')
        }

        if (assetType === 'screenshot') {
          const baseName = buildAssetBaseName(normalized.projectSlug, assetType, source.sourceUrl)
          const filePath = path.resolve(projectDir, `${baseName}.png`)
          const shot = await captureScreenshot(source.sourceUrl, filePath)
          const asset = await persistAsset(projectDir, normalized.projectSlug, assetType, source.sourceUrl, 'browser_screenshot', {
            extension: 'png',
            width: shot.width,
            height: shot.height,
            contentType: 'image/png',
            browserCommand: shot.browserCommand
          })
          assets.push(asset)
          continue
        }

        let asset
        if (source.kind === 'local') {
          const image = await readApprovedLocalImage(source.sourcePath)
          asset = await persistAsset(projectDir, normalized.projectSlug, assetType, source.sourceUrl, 'approved_local_file', {
            copyFromPath: image.sourcePath,
            sourcePath: image.sourcePath,
            extension: image.extension,
            width: image.width,
            height: image.height,
            contentType: image.contentType
          })
        } else {
          const image = await fetchApprovedImage(source.sourceUrl)
          asset = await persistAsset(projectDir, normalized.projectSlug, assetType, source.sourceUrl, 'approved_direct_image', {
            buffer: image.buffer,
            extension: extensionFromContentType(image.contentType),
            width: image.width,
            height: image.height,
            contentType: image.contentType
          })
        }
        assets.push(asset)
      } catch (error) {
        errors.push({
          type: assetType,
          sourceUrl: source.sourceUrl,
          message: error instanceof Error ? error.message : String(error)
        })
      }
    }

    if (assets.length >= normalized.maxAssets) break
  }

  return {
    ok: errors.length === 0,
    projectSlug: normalized.projectSlug,
    assets,
    errors,
    attempted: attempts.length,
    savedTo: relativeLocalPath(projectDir)
  }
}

function normalizeStockSearchInput(input) {
  const query = String(input?.query ?? '').trim()
  if (!query) {
    throw new Error('search_stock_media requires query')
  }

  const providers = Array.isArray(input?.providers) && input.providers.length > 0
    ? input.providers.map((value) => String(value).trim().toLowerCase()).filter(Boolean)
    : DEFAULT_STOCK_PROVIDERS

  const invalidProviders = providers.filter((provider) => !STOCK_PROVIDERS.has(provider))
  if (invalidProviders.length > 0) {
    throw new Error(`search_stock_media received unsupported providers: ${invalidProviders.join(', ')}`)
  }

  const orientation = String(input?.orientation ?? DEFAULT_STOCK_ORIENTATION).trim().toLowerCase()
  const validOrientation =
    orientation === 'landscape' || orientation === 'portrait' || orientation === 'squarish'
      ? orientation
      : DEFAULT_STOCK_ORIENTATION

  const maxResults = Math.max(1, Math.min(Number(input?.maxResults ?? 12), MAX_STOCK_RESULTS))

  return {
    query,
    providers,
    orientation: validOrientation,
    maxResults
  }
}

function pexelsConfigured() {
  return Boolean(process.env.OPERATOR_HUB_PEXELS_API_KEY?.trim())
}

function unsplashConfigured() {
  return Boolean(process.env.OPERATOR_HUB_UNSPLASH_ACCESS_KEY?.trim())
}

async function searchPexels(query, orientation, perProviderLimit) {
  const apiKey = process.env.OPERATOR_HUB_PEXELS_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('Pexels is not configured: missing OPERATOR_HUB_PEXELS_API_KEY')
  }

  const params = new URLSearchParams({
    query,
    per_page: String(perProviderLimit),
    orientation: orientation === 'squarish' ? 'square' : orientation
  })

  const payload = await fetchJson(`https://api.pexels.com/v1/search?${params.toString()}`, {
    headers: {
      Authorization: apiKey
    }
  })

  const photos = Array.isArray(payload?.photos) ? payload.photos : []
  return photos.map((photo) => ({
    provider: 'pexels',
    assetType: 'stock_photo',
    id: String(photo.id),
    title: photo.alt || `Pexels photo ${photo.id}`,
    previewUrl: photo.src?.medium ?? photo.src?.large ?? photo.src?.original ?? null,
    sourceUrl: photo.url ?? null,
    downloadUrl: photo.src?.original ?? null,
    width: Number(photo.width ?? 0) || null,
    height: Number(photo.height ?? 0) || null,
    creatorName: photo.photographer ?? null,
    creatorUrl: photo.photographer_url ?? null,
    license: 'Pexels License',
    provenance: {
      mode: 'stock_search',
      provider: 'pexels',
      query,
      orientation
    }
  }))
}

async function searchUnsplash(query, orientation, perProviderLimit) {
  const accessKey = process.env.OPERATOR_HUB_UNSPLASH_ACCESS_KEY?.trim()
  if (!accessKey) {
    throw new Error('Unsplash is not configured: missing OPERATOR_HUB_UNSPLASH_ACCESS_KEY')
  }

  const params = new URLSearchParams({
    query,
    per_page: String(perProviderLimit),
    orientation
  })

  const payload = await fetchJson(`https://api.unsplash.com/search/photos?${params.toString()}`, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      'Accept-Version': 'v1'
    }
  })

  const photos = Array.isArray(payload?.results) ? payload.results : []
  return photos.map((photo) => ({
    provider: 'unsplash',
    assetType: 'stock_photo',
    id: String(photo.id),
    title: photo.alt_description ?? photo.description ?? `Unsplash photo ${photo.id}`,
    previewUrl: photo.urls?.small ?? photo.urls?.regular ?? photo.urls?.full ?? null,
    sourceUrl: photo.links?.html ?? null,
    downloadUrl: photo.urls?.full ?? photo.urls?.raw ?? null,
    width: Number(photo.width ?? 0) || null,
    height: Number(photo.height ?? 0) || null,
    creatorName: photo.user?.name ?? null,
    creatorUrl: photo.user?.links?.html ?? null,
    license: 'Unsplash License',
    provenance: {
      mode: 'stock_search',
      provider: 'unsplash',
      query,
      orientation
    }
  }))
}

export async function searchStockMedia(input) {
  const normalized = normalizeStockSearchInput(input)
  const errors = []
  const configuredProviders = normalized.providers.filter((provider) =>
    provider === 'pexels' ? pexelsConfigured() : unsplashConfigured()
  )

  const providersToTry = configuredProviders.length > 0 ? configuredProviders : normalized.providers
  const perProviderLimit = Math.max(1, Math.min(normalized.maxResults, 15))
  let results = []

  for (const provider of providersToTry) {
    try {
      const providerResults =
        provider === 'pexels'
          ? await searchPexels(normalized.query, normalized.orientation, perProviderLimit)
          : await searchUnsplash(normalized.query, normalized.orientation, perProviderLimit)
      results = results.concat(providerResults)
    } catch (error) {
      errors.push({
        provider,
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  results = results
    .filter((result) => result.previewUrl && result.sourceUrl)
    .sort((left, right) => {
      if (left.provider !== right.provider) return left.provider.localeCompare(right.provider)
      return left.id.localeCompare(right.id)
    })
    .slice(0, normalized.maxResults)

  return {
    ok: errors.length === 0,
    query: normalized.query,
    orientation: normalized.orientation,
    providers: normalized.providers,
    results,
    errors,
    attemptedProviders: providersToTry.length
  }
}

function normalizeStockCollectionInput(input) {
  const projectSlug = slugify(input?.projectSlug)
  if (!projectSlug) {
    throw new Error('collect_stock_media requires projectSlug')
  }

  const selections = Array.isArray(input?.selections)
    ? input.selections.slice(0, MAX_STOCK_SELECTIONS)
    : []

  if (selections.length === 0) {
    throw new Error('collect_stock_media requires selections[]')
  }

  const normalizedSelections = selections.map((selection, index) => {
    const provider = String(selection?.provider ?? '').trim().toLowerCase()
    const id = String(selection?.id ?? '').trim()
    const sourceUrl = String(selection?.sourceUrl ?? '').trim()
    const downloadUrl = String(selection?.downloadUrl ?? '').trim()
    const assetType = String(selection?.assetType ?? 'stock_photo').trim().toLowerCase()
    const title = String(selection?.title ?? '').trim() || `${provider} ${id}`.trim()

    if (!STOCK_PROVIDERS.has(provider)) {
      throw new Error(`collect_stock_media selection ${index + 1} has unsupported provider: ${provider || 'missing'}`)
    }

    if (!id) {
      throw new Error(`collect_stock_media selection ${index + 1} requires id`)
    }

    if (!parseUrl(sourceUrl)) {
      throw new Error(`collect_stock_media selection ${index + 1} has invalid sourceUrl`)
    }

    if (!parseUrl(downloadUrl)) {
      throw new Error(`collect_stock_media selection ${index + 1} has invalid downloadUrl`)
    }

    return {
      provider,
      id,
      assetType,
      title,
      sourceUrl,
      downloadUrl,
      creatorName: selection?.creatorName ? String(selection.creatorName) : null,
      creatorUrl: selection?.creatorUrl ? String(selection.creatorUrl) : null,
      license: selection?.license ? String(selection.license) : null
    }
  })

  return {
    projectSlug,
    selections: normalizedSelections
  }
}

async function fetchStockImage(downloadUrl) {
  const response = await fetch(downloadUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'operator-hub-mini-hub/0.1 media-collector'
    }
  })

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`Download URL is not a direct image response (${contentType || 'unknown content-type'})`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const dimensions = detectImageDimensions(buffer, contentType)

  return {
    buffer,
    contentType,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null
  }
}

function buildStockAssetBaseName(projectSlug, provider, id, downloadUrl) {
  return `${projectSlug}-${provider}-${sha(`${provider}:${id}:${downloadUrl}`).slice(0, 12)}`
}

async function appendStockManifest(projectDir, manifestEntry) {
  const manifestPath = path.resolve(projectDir, 'manifest.json')
  let manifest = { generatedAt: nowIso(), assets: [] }

  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
  } catch {
    manifest = { generatedAt: nowIso(), assets: [] }
  }

  const nextAssets = Array.isArray(manifest.assets)
    ? manifest.assets.filter((entry) => entry.localPath !== manifestEntry.localPath)
    : []
  nextAssets.push(manifestEntry)
  manifest.generatedAt = nowIso()
  manifest.assets = nextAssets

  await writeJson(manifestPath, manifest)
}

async function persistStockAsset(projectDir, projectSlug, selection, payload) {
  const baseName = buildStockAssetBaseName(projectSlug, selection.provider, selection.id, selection.downloadUrl)
  const extension = payload.extension ?? 'bin'
  const filePath = path.resolve(projectDir, `${baseName}.${extension}`)
  const metadataPath = path.resolve(projectDir, `${baseName}.metadata.json`)

  await writeFile(filePath, payload.buffer)

  const metadata = {
    projectSlug,
    collectedAt: nowIso(),
    assetType: selection.assetType,
    title: selection.title,
    provider: selection.provider,
    providerAssetId: selection.id,
    sourceUrl: selection.sourceUrl,
    downloadUrl: selection.downloadUrl,
    localPath: relativeLocalPath(filePath),
    width: payload.width ?? null,
    height: payload.height ?? null,
    contentType: payload.contentType ?? null,
    creatorName: selection.creatorName,
    creatorUrl: selection.creatorUrl,
    license: selection.license,
    provenance: {
      mode: 'approved_stock_asset',
      provider: selection.provider,
      providerAssetId: selection.id,
      deterministicKey: sha(`${projectSlug}:${selection.provider}:${selection.id}:${selection.downloadUrl}`)
    }
  }

  await writeJson(metadataPath, metadata)
  await appendStockManifest(projectDir, metadata)

  return {
    provider: selection.provider,
    id: selection.id,
    type: selection.assetType,
    title: selection.title,
    sourceUrl: selection.sourceUrl,
    localPath: metadata.localPath,
    width: metadata.width,
    height: metadata.height
  }
}

export async function collectStockMedia(input) {
  const normalized = normalizeStockCollectionInput(input)
  const projectDir = await ensureStockAssetDir(normalized.projectSlug)
  const assets = []
  const errors = []

  for (const selection of normalized.selections) {
    try {
      const image = await fetchStockImage(selection.downloadUrl)
      const asset = await persistStockAsset(projectDir, normalized.projectSlug, selection, {
        buffer: image.buffer,
        extension: extensionFromContentType(image.contentType),
        width: image.width,
        height: image.height,
        contentType: image.contentType
      })
      assets.push(asset)
    } catch (error) {
      errors.push({
        provider: selection.provider,
        id: selection.id,
        sourceUrl: selection.sourceUrl,
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return {
    ok: errors.length === 0,
    projectSlug: normalized.projectSlug,
    assets,
    errors,
    attempted: normalized.selections.length,
    savedTo: relativeLocalPath(projectDir)
  }
}

function normalizePreviewInput(input) {
  const projectSlug = slugify(input?.projectSlug)
  if (!projectSlug) {
    throw new Error('capture_public_profile_preview requires projectSlug')
  }

  const approvedUrl = String(input?.approvedUrl ?? '').trim()
  const parsed = parseUrl(approvedUrl)
  if (!parsed) {
    throw new Error('capture_public_profile_preview requires a valid approvedUrl')
  }

  const label = slugify(input?.label ?? parsed.hostname)
  const viewportWidth = Math.max(320, Math.min(Number(input?.viewportWidth ?? DEFAULT_SCREENSHOT_WIDTH), MAX_PREVIEW_WIDTH))
  const viewportHeight = Math.max(320, Math.min(Number(input?.viewportHeight ?? DEFAULT_SCREENSHOT_HEIGHT), MAX_PREVIEW_HEIGHT))

  return {
    projectSlug,
    approvedUrl,
    label: label || 'preview',
    viewportWidth,
    viewportHeight
  }
}

async function captureScreenshotWithViewport(sourceUrl, outputPath, viewportWidth, viewportHeight) {
  const browserCommand = detectBrowserCommand()
  if (browserCommand) {
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--window-size=' + `${viewportWidth},${viewportHeight}`,
      `--screenshot=${outputPath}`,
      sourceUrl
    ]

    await runProcess(browserCommand, args)

    return {
      width: viewportWidth,
      height: viewportHeight,
      browserCommand
    }
  }

  const containerOutputPath = `/workspace/operator-hub/${relativeLocalPath(outputPath)}`
  const result = await runProcessWithOutput('docker', [
    'run',
    '--rm',
    '-v',
    `${repoRoot}:/workspace/operator-hub`,
    '-w',
    '/workspace',
    previewDockerImage,
    'npm',
    'run',
    'capture',
    '--',
    '--url',
    sourceUrl,
    '--output',
    containerOutputPath,
    '--width',
    String(viewportWidth),
    '--height',
    String(viewportHeight)
  ])

  let parsed = null
  try {
    parsed = JSON.parse(result.stdout)
  } catch {
    parsed = null
  }

  return {
    width: viewportWidth,
    height: viewportHeight,
    browserCommand: parsed?.browser ?? `docker:${previewDockerImage}`
  }
}

async function appendPreviewManifest(projectDir, manifestEntry) {
  const manifestPath = path.resolve(projectDir, 'manifest.json')
  let manifest = { generatedAt: nowIso(), assets: [] }

  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
  } catch {
    manifest = { generatedAt: nowIso(), assets: [] }
  }

  const nextAssets = Array.isArray(manifest.assets)
    ? manifest.assets.filter((entry) => entry.localPath !== manifestEntry.localPath)
    : []
  nextAssets.push(manifestEntry)
  manifest.generatedAt = nowIso()
  manifest.assets = nextAssets

  await writeJson(manifestPath, manifest)
}

export async function capturePublicProfilePreview(input) {
  const normalized = normalizePreviewInput(input)
  const projectDir = await ensurePreviewAssetDir(normalized.projectSlug)
  const baseName = `${normalized.projectSlug}-${normalized.label}-${sha(`preview:${normalized.approvedUrl}`).slice(0, 12)}`
  const filePath = path.resolve(projectDir, `${baseName}.png`)
  const metadataPath = path.resolve(projectDir, `${baseName}.metadata.json`)

  const shot = await captureScreenshotWithViewport(
    normalized.approvedUrl,
    filePath,
    normalized.viewportWidth,
    normalized.viewportHeight
  )

  const metadata = {
    projectSlug: normalized.projectSlug,
    collectedAt: nowIso(),
    label: normalized.label,
    sourceUrl: normalized.approvedUrl,
    localPath: relativeLocalPath(filePath),
    width: shot.width,
    height: shot.height,
    contentType: 'image/png',
    provenance: {
      mode: 'public_profile_preview',
      approvedUrl: normalized.approvedUrl,
      deterministicKey: sha(`${normalized.projectSlug}:${normalized.label}:${normalized.approvedUrl}`),
      browserCommand: shot.browserCommand
    }
  }

  await writeJson(metadataPath, metadata)
  await appendPreviewManifest(projectDir, metadata)

  return {
    ok: true,
    projectSlug: normalized.projectSlug,
    preview: {
      type: 'public_profile_preview',
      sourceUrl: normalized.approvedUrl,
      localPath: metadata.localPath,
      width: metadata.width,
      height: metadata.height
    },
    savedTo: relativeLocalPath(projectDir)
  }
}
