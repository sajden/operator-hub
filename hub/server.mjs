import { createServer } from 'node:http'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { projectGraph } from './graphProjection.mjs'
import { getMcpTools } from './mcpTools.mjs'
import { createMicrosoftAuth } from './microsoftAuth.mjs'
import {
  capturePublicProfilePreview,
  collectOwnerMedia,
  collectStockMedia,
  searchStockMedia
} from './mediaTools.mjs'
import { captureSearchDemandInsights } from './researchTools.mjs'
import { renderServiceExplainerMotion, renderSiteHeroMotion } from './remotionTools.mjs'
import { getAvailablePlannerActions, runPlannerAction } from './plannerActions.mjs'
import { startBgRemoverJob, getBgRemoverJob, getBgRemoverResult } from './bgRemoverTools.mjs'
import { startWatcher, getWatcherStatus } from './bgRemoverWatcher.mjs'
import { startCloudWatcher, getCloudWatcherStatus } from './bgRemoverCloudWatcher.mjs'
import { getGallery, resolveFilePath, renameFile, deleteFile, createAlbum } from './mediaFileManager.mjs'
import { generateArticle, startWeeklyScheduler, getSeoSchedulerStatus } from './seoArticleGenerator.mjs'
import { publishDraft, updateDraft, unpublishDraft } from './seoPublisher.mjs'
import { getPlannerBoardPayload, getPlannerDashboardPayload } from './plannerQueries.mjs'
import {
  cleanupPlannerCalendarImports,
  createPlannerBoard,
  createPlannerWorkItem,
  deletePlannerWorkItem,
  getPlannerSeriesSnapshot,
  getPlannerWorkItem,
  importCalendarEventsToPlanner,
  listPlannerBoards,
  movePlannerWorkItem,
  updatePlannerWorkItem
} from './plannerStore.mjs'
import {
  buildAudienceSyncMatrix,
  buildContentSyncMatrix,
  buildFeedbackSyncMatrix,
  buildOutreachSyncMatrix,
  buildProblemSyncMatrix,
  findCommunitiesForAudience,
  getSkills,
  suggestNextOutreachSteps,
  summarizeProjectHypotheses
} from './skills.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return

  const raw = readFileSync(filePath, 'utf-8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    if (!key || process.env[key] !== undefined) continue

    let value = trimmed.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

loadEnvFile(path.resolve(__dirname, '.env'))
loadEnvFile(path.resolve(__dirname, '.env.local'))

const host = process.env.OPERATOR_HUB_HOST ?? '0.0.0.0'
const port = Number(process.env.OPERATOR_HUB_PORT ?? 8787)
const publicUrl = process.env.OPERATOR_HUB_PUBLIC_URL ?? `http://localhost:${port}`
const appUrl = process.env.OPERATOR_HUB_APP_URL ?? 'http://localhost:5173'
const appBasePath = (process.env.OPERATOR_HUB_APP_BASE_PATH ?? '/operatorhub-app').replace(/\/+$/, '') || '/operatorhub-app'
const frontendDistDir = path.resolve(repoRoot, 'app/dist')
const microsoftScopes = (
  process.env.OPERATOR_HUB_MS_SCOPES ?? 'openid profile offline_access User.Read Files.Read Calendars.ReadWrite'
)
  .split(/\s+/)
  .map((scope) => scope.trim())
  .filter(Boolean)

const microsoftAuth = createMicrosoftAuth({
  publicUrl,
  tenantId: process.env.OPERATOR_HUB_MS_TENANT_ID ?? 'common',
  clientId: process.env.OPERATOR_HUB_MS_CLIENT_ID ?? '',
  clientSecret: process.env.OPERATOR_HUB_MS_CLIENT_SECRET ?? '',
  scopes: microsoftScopes,
  tokenFilePath: path.resolve(repoRoot, '.local/microsoft-auth.json')
})

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.end(JSON.stringify(payload))
}

function sendHtml(res, statusCode, html) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.html') return 'text/html; charset=utf-8'
  if (extension === '.js') return 'application/javascript; charset=utf-8'
  if (extension === '.css') return 'text/css; charset=utf-8'
  if (extension === '.json') return 'application/json; charset=utf-8'
  if (extension === '.svg') return 'image/svg+xml'
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.ico') return 'image/x-icon'
  return 'application/octet-stream'
}

function normalizePrefixedUrl(url) {
  const requestUrl = new URL(url ?? '/', publicUrl)
  if (requestUrl.pathname === appBasePath || requestUrl.pathname.startsWith(`${appBasePath}/`)) {
    const nextPath = requestUrl.pathname.slice(appBasePath.length) || '/'
    requestUrl.pathname = nextPath.startsWith('/') ? nextPath : `/${nextPath}`
  }

  return `${requestUrl.pathname}${requestUrl.search}`
}

function resolveFrontendAssetPath(rawUrl) {
  const requestUrl = new URL(rawUrl ?? '/', publicUrl)
  if (!(requestUrl.pathname === appBasePath || requestUrl.pathname.startsWith(`${appBasePath}/`))) {
    return null
  }

  const relativePath = requestUrl.pathname.slice(appBasePath.length).replace(/^\/+/, '')
  const candidatePath = relativePath ? path.resolve(frontendDistDir, relativePath) : path.resolve(frontendDistDir, 'index.html')
  const resolvedPath = existsSync(candidatePath) && statSync(candidatePath).isFile() ? candidatePath : path.resolve(frontendDistDir, 'index.html')

  if (!resolvedPath.startsWith(frontendDistDir)) {
    return null
  }

  return resolvedPath
}

function serveFrontendAsset(res, filePath) {
  res.statusCode = 200
  res.setHeader('Content-Type', getContentType(filePath))
  createReadStream(filePath).pipe(res)
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

  return JSON.parse(body)
}

function matchProjectPath(url) {
  const pathname = new URL(url ?? '/', publicUrl).pathname
  const match = pathname.match(
    /^\/api\/projects\/([^/]+)\/(graph|outreach-projection|microsoft-excel-files|microsoft-workbook|microsoft-range)$/
  )
  if (!match) {
    return null
  }

  return { projectId: match[1], resource: match[2] }
}

function matchPlannerBoardPath(url) {
  const pathname = new URL(url ?? '/', publicUrl).pathname
  const match = pathname.match(/^\/api\/planner\/boards\/([^/]+)$/)
  if (!match) {
    return null
  }

  return { boardId: decodeURIComponent(match[1]) }
}

function matchPlannerWorkItemMovePath(url) {
  const pathname = new URL(url ?? '/', publicUrl).pathname
  const match = pathname.match(/^\/api\/planner\/work-items\/([^/]+)\/move$/)
  if (!match) {
    return null
  }

  return { workItemId: decodeURIComponent(match[1]) }
}

function matchPlannerWorkItemPath(url) {
  const pathname = new URL(url ?? '/', publicUrl).pathname
  const match = pathname.match(/^\/api\/planner\/work-items\/([^/]+)$/)
  if (!match) {
    return null
  }

  return { workItemId: decodeURIComponent(match[1]) }
}

function matchPlannerWorkItemCalendarSyncPath(url) {
  const pathname = new URL(url ?? '/', publicUrl).pathname
  const match = pathname.match(/^\/api\/planner\/work-items\/([^/]+)\/sync\/microsoft-calendar$/)
  if (!match) {
    return null
  }

  return { workItemId: decodeURIComponent(match[1]) }
}

function matchPlannerSeriesPath(url) {
  const pathname = new URL(url ?? '/', publicUrl).pathname
  const match = pathname.match(/^\/api\/planner\/series\/([^/]+)$/)
  if (!match) {
    return null
  }

  return { seriesId: decodeURIComponent(match[1]) }
}

function matchOwnerMediaProjectPath(url) {
  const pathname = new URL(url ?? '/', publicUrl).pathname
  const match = pathname.match(/^\/api\/media\/owner\/([^/]+)$/)
  if (!match) return null
  return { projectSlug: decodeURIComponent(match[1]) }
}

function matchOwnerMediaUploadPath(url) {
  const pathname = new URL(url ?? '/', publicUrl).pathname
  const match = pathname.match(/^\/api\/media\/owner\/([^/]+)\/upload$/)
  if (!match) return null
  return { projectSlug: decodeURIComponent(match[1]) }
}

function matchOwnerMediaFolderPath(url) {
  const pathname = new URL(url ?? '/', publicUrl).pathname
  const match = pathname.match(/^\/api\/media\/owner\/([^/]+)\/folders$/)
  if (!match) return null
  return { projectSlug: decodeURIComponent(match[1]) }
}

function matchOwnerMediaCollectPath(url) {
  const pathname = new URL(url ?? '/', publicUrl).pathname
  const match = pathname.match(/^\/api\/media\/owner\/([^/]+)\/collect$/)
  if (!match) return null
  return { projectSlug: decodeURIComponent(match[1]) }
}

function matchRenderProjectPath(url) {
  const pathname = new URL(url ?? '/', publicUrl).pathname
  const match = pathname.match(/^\/api\/media\/renders\/([^/]+)$/)
  if (!match) return null
  return { projectSlug: decodeURIComponent(match[1]) }
}

function matchServiceExplainerRenderProjectPath(url) {
  const pathname = new URL(url ?? '/', publicUrl).pathname
  const match = pathname.match(/^\/api\/media\/service-explainer-renders\/([^/]+)$/)
  if (!match) return null
  return { projectSlug: decodeURIComponent(match[1]) }
}

function matchRenderFilePath(url) {
  const pathname = new URL(url ?? '/', publicUrl).pathname
  const match = pathname.match(/^\/api\/media\/renders\/([^/]+)\/files\/([^/]+)$/)
  if (!match) return null
  return {
    projectSlug: decodeURIComponent(match[1]),
    fileName: decodeURIComponent(match[2])
  }
}

function matchServiceExplainerRenderFilePath(url) {
  const pathname = new URL(url ?? '/', publicUrl).pathname
  const match = pathname.match(/^\/api\/media\/service-explainer-renders\/([^/]+)\/files\/([^/]+)$/)
  if (!match) return null
  return {
    projectSlug: decodeURIComponent(match[1]),
    fileName: decodeURIComponent(match[2])
  }
}

function ownerMediaProjectDir(projectSlug) {
  return path.resolve(repoRoot, '.local/assets/owner-media', projectSlug)
}

function ownerMediaRawDir(projectSlug) {
  return path.resolve(ownerMediaProjectDir(projectSlug), 'raw')
}

function stockMediaProjectDir(projectSlug) {
  return path.resolve(repoRoot, '.local/assets/stock-media', projectSlug)
}

function siteHeroRenderProjectDir(projectSlug) {
  return path.resolve(repoRoot, '.local/renders/site-hero-motion', projectSlug)
}

function serviceExplainerRenderProjectDir(projectSlug) {
  return path.resolve(repoRoot, '.local/renders/service-explainer-motion', projectSlug)
}

function ensureMediaProjectSlug(value) {
  const projectSlug = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!projectSlug) {
    throw new Error('Missing valid projectSlug')
  }
  return projectSlug
}

function sanitizeRelativeUploadPath(value) {
  const trimmed = String(value ?? '').trim().replaceAll('\\', '/')
  if (!trimmed) return ''
  const normalized = trimmed
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]+/g, '-'))
    .join('/')
  if (normalized.includes('..')) {
    throw new Error('Invalid upload path')
  }
  return normalized
}

function sanitizeRelativeFolderPath(value) {
  const normalized = sanitizeRelativeUploadPath(value)
  if (!normalized) {
    throw new Error('Missing folder path')
  }
  return normalized
}

async function readJsonFileIfExists(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8'))
  } catch {
    return fallback
  }
}

async function listFilesRecursively(rootDir, currentDir = rootDir) {
  if (!existsSync(currentDir)) return []
  const entries = await readdir(currentDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.resolve(currentDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(rootDir, fullPath)))
      continue
    }

    files.push({
      name: entry.name,
      relativePath: path.relative(rootDir, fullPath).replaceAll(path.sep, '/'),
      absolutePath: fullPath
    })
  }

  return files
}

async function loadOwnerMediaProject(projectSlug) {
  const normalizedSlug = ensureMediaProjectSlug(projectSlug)
  const projectDir = ownerMediaProjectDir(normalizedSlug)
  const rawDir = ownerMediaRawDir(normalizedSlug)
  const manifest = await readJsonFileIfExists(path.resolve(projectDir, 'manifest.json'), {
    generatedAt: null,
    assets: []
  })
  const rawFiles = await listFilesRecursively(rawDir)
  const rawDirectories = [
    ...new Set(
      rawFiles
        .map((file) => {
          const parts = file.relativePath.split('/')
          parts.pop()
          return parts.join('/')
        })
        .filter((value) => value !== '')
    )
  ].sort((left, right) => left.localeCompare(right))

  return {
    projectSlug: normalizedSlug,
    rawRoot: path.relative(repoRoot, rawDir).replaceAll(path.sep, '/'),
    collectedRoot: path.relative(repoRoot, projectDir).replaceAll(path.sep, '/'),
    rawDirectories,
    rawFiles: rawFiles.map((file) => ({
      name: file.name,
      relativePath: file.relativePath,
      path: path.relative(repoRoot, file.absolutePath).replaceAll(path.sep, '/')
    })),
    collectedAssets: Array.isArray(manifest.assets) ? manifest.assets : [],
    generatedAt: manifest.generatedAt ?? null
  }
}

async function loadSiteHeroRenders(projectSlug) {
  const normalizedSlug = ensureMediaProjectSlug(projectSlug)
  const heroDir = siteHeroRenderProjectDir(normalizedSlug)
  const explainerDir = serviceExplainerRenderProjectDir(normalizedSlug)

  async function collectVideos(projectDir, streamBasePath, kind) {
    if (!existsSync(projectDir)) return []
    const entries = await readdir(projectDir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mp4'))
      .map((entry) => {
        const fullPath = path.resolve(projectDir, entry.name)
        const stats = statSync(fullPath)
        return {
          fileName: entry.name,
          path: path.relative(repoRoot, fullPath).replaceAll(path.sep, '/'),
          sizeBytes: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          streamUrl: `${streamBasePath}/${encodeURIComponent(normalizedSlug)}/files/${encodeURIComponent(entry.name)}`,
          kind
        }
      })
  }

  const [heroVideos, serviceVideos] = await Promise.all([
    collectVideos(heroDir, '/api/media/renders', 'hero'),
    collectVideos(explainerDir, '/api/media/service-explainer-renders', 'service_explainer')
  ])

  return {
    projectSlug: normalizedSlug,
    renderRoot: [heroDir, explainerDir]
      .filter((dir) => existsSync(dir))
      .map((dir) => path.relative(repoRoot, dir).replaceAll(path.sep, '/'))
      .join(' | '),
    videos: [...heroVideos, ...serviceVideos].sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))
  }
}

async function loadServiceExplainerRenders(projectSlug) {
  const normalizedSlug = ensureMediaProjectSlug(projectSlug)
  const projectDir = serviceExplainerRenderProjectDir(normalizedSlug)
  if (!existsSync(projectDir)) {
    return {
      projectSlug: normalizedSlug,
      renderRoot: path.relative(repoRoot, projectDir).replaceAll(path.sep, '/'),
      videos: []
    }
  }

  const entries = await readdir(projectDir, { withFileTypes: true })
  const videos = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mp4'))
    .map((entry) => {
      const fullPath = path.resolve(projectDir, entry.name)
      const stats = statSync(fullPath)
      return {
        fileName: entry.name,
        path: path.relative(repoRoot, fullPath).replaceAll(path.sep, '/'),
        sizeBytes: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        streamUrl: `/api/media/service-explainer-renders/${encodeURIComponent(normalizedSlug)}/files/${encodeURIComponent(entry.name)}`
      }
    })
    .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))

  return {
    projectSlug: normalizedSlug,
    renderRoot: path.relative(repoRoot, projectDir).replaceAll(path.sep, '/'),
    videos
  }
}

function streamVideoFile(req, res, absolutePath) {
  const stats = statSync(absolutePath)
  const range = req.headers.range

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Type', 'video/mp4')

  if (!range) {
    res.statusCode = 200
    res.setHeader('Content-Length', stats.size)
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    createReadStream(absolutePath).pipe(res)
    return
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  if (!match) {
    res.statusCode = 416
    res.end()
    return
  }

  const start = match[1] ? Number(match[1]) : 0
  const end = match[2] ? Number(match[2]) : stats.size - 1

  if (start > end || start >= stats.size) {
    res.statusCode = 416
    res.setHeader('Content-Range', `bytes */${stats.size}`)
    res.end()
    return
  }

  res.statusCode = 206
  res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`)
  res.setHeader('Content-Length', end - start + 1)
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(absolutePath, { start, end }).pipe(res)
}

function sendRedirect(res, location) {
  res.statusCode = 302
  res.setHeader('Location', location)
  res.end()
}

function getErrorStatusCode(error) {
  const message = error instanceof Error ? error.message : ''

  if (message.includes('missing OPERATOR_HUB_MS_CLIENT_ID')) {
    return 400
  }

  if (
    message.includes('No Microsoft auth token found') ||
    message.includes('expired and no refresh token is available')
  ) {
    return 401
  }

  if (
    message.includes('access denied') ||
    message.includes('Access denied') ||
    message.includes('Files.Read.All') ||
    message.includes('Sites.Read.All') ||
    message.includes('Calendars.Read') ||
    message.includes('Calendars.ReadWrite')
  ) {
    return 403
  }

  if (message.includes('Invalid or expired Microsoft OAuth state')) {
    return 400
  }

  return 500
}

async function listSupportedProjects() {
  const projectsRoot = path.resolve(repoRoot, 'projects')
  const entries = await readdir(projectsRoot, { withFileTypes: true })
  const projectIds = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const graphPath = path.resolve(projectsRoot, entry.name, 'data/graph.json')
    try {
      await readFile(graphPath, 'utf-8')
      projectIds.push(entry.name)
    } catch {
      continue
    }
  }

  return projectIds.sort()
}

function validateGraph(graph) {
  if (!graph || typeof graph !== 'object') {
    throw new Error('Invalid graph document: expected object')
  }

  if (!graph.project || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error('Invalid graph document: expected project, nodes, and edges')
  }
}

function getGraphPath(projectId) {
  return path.resolve(repoRoot, `projects/${projectId}/data/graph.json`)
}

function getProjectWorkbookTemplatePath(projectId, graph) {
  const projectName = graph.project?.name ?? projectId
  return path.resolve(repoRoot, `projects/${projectId}/exports/${projectName}_Outreach.xlsx`)
}

function buildProjectSummary(projectId, graph) {
  const counts = graph.nodes.reduce(
    (accumulator, node) => {
      if (node.type === 'project') accumulator.projects += 1
      if (node.type === 'audience') accumulator.audiences += 1
      if (node.type === 'problem') accumulator.problems += 1
      return accumulator
    },
    { projects: 0, audiences: 0, problems: 0 }
  )

  return {
    projectId,
    name: graph.project?.name ?? projectId,
    summary: graph.project?.summary ?? '',
    strengths: Array.isArray(graph.project?.strengths) ? graph.project.strengths : [],
    microsoftExcelFolder: graph.project?.integrations?.microsoft?.excelFolder ?? null,
    nodeCounts: counts,
    outreachCount: Array.isArray(graph.outreach) ? graph.outreach.length : 0,
    edgeCount: Array.isArray(graph.edges) ? graph.edges.length : 0
  }
}

function getProjectMicrosoftExcelFolder(graph) {
  return graph?.project?.integrations?.microsoft?.excelFolder ?? null
}

async function syncProjectWorkbook(projectId, graph, projection, fileId) {
  const folder = getProjectMicrosoftExcelFolder(graph)
  if (!folder) {
    throw new Error(`Project ${projectId} does not have a Microsoft Excel folder binding`)
  }

  const audienceMatrix = buildAudienceSyncMatrix(projection, { minimumRows: 25 })
  const problemMatrix = buildProblemSyncMatrix(projection, { minimumRows: 25 })
  const outreachMatrix = buildOutreachSyncMatrix(projection, { minimumRows: 25 })
  const contentMatrix = buildContentSyncMatrix(projection, { minimumRows: 25 })
  const feedbackMatrix = buildFeedbackSyncMatrix(projection, { minimumRows: 25 })

  const audiencesResult = await microsoftAuth.writeWorkbookRangeInConfiguredFolder(folder, {
    fileId,
    worksheetName: 'Audiences',
    address: `A1:I${audienceMatrix.rowCount}`,
    values: audienceMatrix.values
  })

  const problemsResult = await microsoftAuth.writeWorkbookRangeInConfiguredFolder(folder, {
    fileId,
    worksheetName: 'Problems',
    address: `A1:H${problemMatrix.rowCount}`,
    values: problemMatrix.values
  })

  const outreachResult = await microsoftAuth.writeWorkbookRangeInConfiguredFolder(folder, {
    fileId,
    worksheetName: 'Outreach',
    address: `A1:H${outreachMatrix.rowCount}`,
    values: outreachMatrix.values
  })

  const contentResult = await microsoftAuth.writeWorkbookRangeInConfiguredFolder(folder, {
    fileId,
    worksheetName: 'Content',
    address: `A1:L${contentMatrix.rowCount}`,
    values: contentMatrix.values
  })

  const feedbackResult = await microsoftAuth.writeWorkbookRangeInConfiguredFolder(folder, {
    fileId,
    worksheetName: 'Feedback',
    address: `A1:I${feedbackMatrix.rowCount}`,
    values: feedbackMatrix.values
  })

  return {
    fileId,
    audiences: {
      worksheetName: 'Audiences',
      address: `A1:I${audienceMatrix.rowCount}`,
      syncedRowCount: projection.audiences.length,
      headers: audienceMatrix.headers,
      result: audiencesResult
    },
    problems: {
      worksheetName: 'Problems',
      address: `A1:H${problemMatrix.rowCount}`,
      syncedRowCount: projection.problems.length,
      headers: problemMatrix.headers,
      result: problemsResult
    },
    outreach: {
      worksheetName: 'Outreach',
      address: `A1:H${outreachMatrix.rowCount}`,
      syncedRowCount: projection.outreach.length,
      headers: outreachMatrix.headers,
      result: outreachResult
    },
    content: {
      worksheetName: 'Content',
      address: `A1:L${contentMatrix.rowCount}`,
      syncedRowCount: projection.content?.length ?? 0,
      headers: contentMatrix.headers,
      result: contentResult
    },
    feedback: {
      worksheetName: 'Feedback',
      address: `A1:I${feedbackMatrix.rowCount}`,
      syncedRowCount: projection.feedback?.length ?? 0,
      headers: feedbackMatrix.headers,
      result: feedbackResult
    }
  }
}

async function loadGraph(projectId) {
  const supportedProjects = await listSupportedProjects()
  if (!supportedProjects.includes(projectId)) {
    throw new Error(`Unknown project: ${projectId}`)
  }

  const graphPath = getGraphPath(projectId)
  const raw = await readFile(graphPath, 'utf-8')
  const graph = JSON.parse(raw)
  validateGraph(graph)
  return graph
}

async function saveGraph(projectId, graph) {
  const supportedProjects = await listSupportedProjects()
  if (!supportedProjects.includes(projectId)) {
    throw new Error(`Unknown project: ${projectId}`)
  }

  validateGraph(graph)
  await writeFile(getGraphPath(projectId), `${JSON.stringify(graph, null, 2)}\n`, 'utf-8')

  const workbookFileId = graph?.project?.integrations?.microsoft?.excelFolder?.defaultWorkbookFileId
  if (!workbookFileId) {
    return { ok: true, message: `Saved graph for ${projectId} via operator-hub mini-hub` }
  }

  const projection = projectGraph(graph)
  const syncResult = await syncProjectWorkbook(projectId, graph, projection, workbookFileId)
  return {
    ok: true,
    message: `Saved graph and auto-synced workbook for ${projectId}`,
    sync: syncResult
  }
}

async function callTool(name, args) {
  if (!args || typeof args !== 'object') {
    throw new Error('Tool arguments must be an object')
  }

  if (name === 'list_projects') {
    return { tool: name, result: { projects: await listSupportedProjects() } }
  }

  if (name === 'collect_owner_media') {
    return { tool: name, result: await collectOwnerMedia(args) }
  }

  if (name === 'capture_search_demand_insights') {
    return { tool: name, result: await captureSearchDemandInsights(args) }
  }

  if (name === 'search_stock_media') {
    return { tool: name, result: await searchStockMedia(args) }
  }

  if (name === 'collect_stock_media') {
    return { tool: name, result: await collectStockMedia(args) }
  }

  if (name === 'capture_public_profile_preview') {
    return { tool: name, result: await capturePublicProfilePreview(args) }
  }

  if (name === 'render_site_hero_motion') {
    return { tool: name, result: await renderSiteHeroMotion(args) }
  }

  if (name === 'render_service_explainer_motion') {
    return { tool: name, result: await renderServiceExplainerMotion(args) }
  }

  if (name === 'get_project_summary') {
    const graph = await loadGraph(args.projectId)
    return { tool: name, result: buildProjectSummary(args.projectId, graph) }
  }

  if (name === 'get_graph') {
    return { tool: name, result: await loadGraph(args.projectId) }
  }

  if (name === 'save_graph') {
    return { tool: name, result: await saveGraph(args.projectId, args.graph) }
  }

  if (name === 'get_outreach_projection') {
    const graph = await loadGraph(args.projectId)
    return { tool: name, result: projectGraph(graph) }
  }

  if (name === 'list_excel_files') {
    return { tool: name, result: await microsoftAuth.listExcelFiles(args) }
  }

  if (name === 'list_project_excel_files') {
    const graph = await loadGraph(args.projectId)
    return {
      tool: name,
      result: await microsoftAuth.listExcelFilesInConfiguredFolder(
        getProjectMicrosoftExcelFolder(graph),
        args
      )
    }
  }

  if (name === 'create_project_excel_file') {
    const graph = await loadGraph(args.projectId)
    const templateContent = await readFile(getProjectWorkbookTemplatePath(args.projectId, graph))
    return {
      tool: name,
      result: await microsoftAuth.createExcelFileInConfiguredFolder(
        getProjectMicrosoftExcelFolder(graph),
        {
          fileName: args.fileName,
          content: templateContent
        }
      )
    }
  }

  if (name === 'get_project_workbook_metadata') {
    const graph = await loadGraph(args.projectId)
    return {
      tool: name,
      result: await microsoftAuth.getWorkbookMetadataInConfiguredFolder(
        getProjectMicrosoftExcelFolder(graph),
        {
          fileId: args.fileId
        }
      )
    }
  }

  if (name === 'read_project_workbook_range') {
    const graph = await loadGraph(args.projectId)
    return {
      tool: name,
      result: await microsoftAuth.readWorkbookRangeInConfiguredFolder(
        getProjectMicrosoftExcelFolder(graph),
        {
          fileId: args.fileId,
          worksheetName: args.worksheetName,
          address: args.address
        }
      )
    }
  }

  if (name === 'write_project_workbook_range') {
    const graph = await loadGraph(args.projectId)
    return {
      tool: name,
      result: await microsoftAuth.writeWorkbookRangeInConfiguredFolder(
        getProjectMicrosoftExcelFolder(graph),
        {
          fileId: args.fileId,
          worksheetName: args.worksheetName,
          address: args.address,
          values: args.values
        }
      )
    }
  }

  if (name === 'get_planner_dashboard') {
    return {
      tool: name,
      result: getPlannerDashboardPayload({ mode: args.mode ?? 'desktop' })
    }
  }

  if (name === 'list_planner_boards') {
    return {
      tool: name,
      result: {
        boards: listPlannerBoards()
      }
    }
  }

  if (name === 'create_planner_board') {
    return {
      tool: name,
      result: createPlannerBoard(args)
    }
  }

  if (name === 'list_calendar_events') {
    return {
      tool: name,
      result: await microsoftAuth.listCalendarEvents(args)
    }
  }

  if (name === 'create_calendar_event') {
    return {
      tool: name,
      result: await microsoftAuth.createCalendarEvent(args)
    }
  }

  if (name === 'get_planner_board') {
    return {
      tool: name,
      result: getPlannerBoardPayload(args.boardId)
    }
  }

  if (name === 'create_planner_work_item') {
    return {
      tool: name,
      result: createPlannerWorkItem(args)
    }
  }

  if (name === 'move_planner_work_item') {
    return {
      tool: name,
      result: movePlannerWorkItem(args.workItemId, {
        columnId: args.columnId,
        focusDate: args.focusDate
      })
    }
  }

  throw new Error(`Unknown tool: ${name}`)
}

async function runSkill(name, args) {
  if (!args || typeof args !== 'object') {
    throw new Error('Skill arguments must be an object')
  }

  if (name === 'prepare_site_media_package') {
    const projectSlug = String(args.projectSlug ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    if (!projectSlug) {
      throw new Error('prepare_site_media_package requires projectSlug')
    }

    const ownerAssetTypes =
      Array.isArray(args.ownerAssetTypes) && args.ownerAssetTypes.length > 0
        ? args.ownerAssetTypes
        : ['profile']

    const shouldCollectOwner =
      (Array.isArray(args.approvedUrls) && args.approvedUrls.length > 0) ||
      (Array.isArray(args.approvedLocalPaths) && args.approvedLocalPaths.length > 0)

    const ownerCollection = shouldCollectOwner
      ? await collectOwnerMedia({
          projectSlug,
          approvedUrls: args.approvedUrls,
          approvedLocalPaths: args.approvedLocalPaths,
          assetTypes: ownerAssetTypes,
          maxAssets: args.ownerMaxAssets
        })
      : {
          ok: true,
          projectSlug,
          assets: [],
          errors: [],
          attempted: 0,
          savedTo: `.local/assets/owner-media/${projectSlug}`
        }

    const stockSearch = args.stockQuery
      ? await searchStockMedia({
          query: args.stockQuery,
          providers: args.stockProviders,
          orientation: args.stockOrientation,
          maxResults: args.stockMaxResults
        })
      : {
          ok: true,
          query: '',
          orientation: args.stockOrientation ?? 'landscape',
          providers: Array.isArray(args.stockProviders) ? args.stockProviders : [],
          results: [],
          errors: [],
          attemptedProviders: 0
        }

    return {
      skill: name,
      result: {
        projectSlug,
        mediaPackage: {
          ownerAssets: ownerCollection.assets,
          stockCandidates: stockSearch.results,
          savedRoots: {
            ownerMedia: ownerCollection.savedTo,
            stockMedia: `.local/assets/stock-media/${projectSlug}`
          }
        },
        diagnostics: {
          ownerCollection: {
            ok: ownerCollection.ok,
            attempted: ownerCollection.attempted,
            errors: ownerCollection.errors
          },
          stockSearch: {
            ok: stockSearch.ok,
            attemptedProviders: stockSearch.attemptedProviders,
            errors: stockSearch.errors
          }
        },
        nextCapabilities: [
          'collect_stock_media',
          'capture_public_profile_preview',
          'render_site_hero_motion'
        ]
      }
    }
  }

  const graph = await loadGraph(args.projectId)
  const projection = projectGraph(graph)

  if (name === 'summarize_project_hypotheses') {
    return { skill: name, result: summarizeProjectHypotheses(args.projectId, graph, projection) }
  }

  if (name === 'suggest_next_outreach_steps') {
    return { skill: name, result: suggestNextOutreachSteps(args.projectId, graph, projection) }
  }

  if (name === 'find_communities_for_audience') {
    return {
      skill: name,
      result: findCommunitiesForAudience(args.projectId, graph, projection, {
        audienceId: args.audienceId,
        market: args.market
      })
    }
  }

  if (name === 'sync_audiences_to_excel') {
    const matrix = buildAudienceSyncMatrix(projection, { minimumRows: 25 })
    const syncResult = await microsoftAuth.writeWorkbookRangeInConfiguredFolder(
      getProjectMicrosoftExcelFolder(graph),
      {
        fileId: args.fileId,
        worksheetName: 'Audiences',
        address: `A1:I${matrix.rowCount}`,
        values: matrix.values
      }
    )

    return {
      skill: name,
      result: {
        projectId: args.projectId,
        fileId: args.fileId,
        worksheetName: 'Audiences',
        address: `A1:I${matrix.rowCount}`,
        syncedAudienceCount: projection.audiences.length,
        headers: matrix.headers,
        writeResult: syncResult
      }
    }
  }

  if (name === 'sync_problems_to_excel') {
    const matrix = buildProblemSyncMatrix(projection, { minimumRows: 25 })
    const syncResult = await microsoftAuth.writeWorkbookRangeInConfiguredFolder(
      getProjectMicrosoftExcelFolder(graph),
      {
        fileId: args.fileId,
        worksheetName: 'Problems',
        address: `A1:H${matrix.rowCount}`,
        values: matrix.values
      }
    )

    return {
      skill: name,
      result: {
        projectId: args.projectId,
        fileId: args.fileId,
        worksheetName: 'Problems',
        address: `A1:H${matrix.rowCount}`,
        syncedProblemCount: projection.problems.length,
        headers: matrix.headers,
        writeResult: syncResult
      }
    }
  }

  if (name === 'sync_outreach_to_excel') {
    const matrix = buildOutreachSyncMatrix(projection, { minimumRows: 25 })
    const syncResult = await microsoftAuth.writeWorkbookRangeInConfiguredFolder(
      getProjectMicrosoftExcelFolder(graph),
      {
        fileId: args.fileId,
        worksheetName: 'Outreach',
        address: `A1:H${matrix.rowCount}`,
        values: matrix.values
      }
    )

    return {
      skill: name,
      result: {
        projectId: args.projectId,
        fileId: args.fileId,
        worksheetName: 'Outreach',
        address: `A1:H${matrix.rowCount}`,
        syncedOutreachCount: projection.outreach.length,
        headers: matrix.headers,
        writeResult: syncResult
      }
    }
  }

  if (name === 'sync_project_workbook') {
    return {
      skill: name,
      result: await syncProjectWorkbook(args.projectId, graph, projection, args.fileId)
    }
  }

  throw new Error(`Unknown skill: ${name}`)
}

function renderDashboard(projects, microsoftStatus) {
  const projectLinks = projects
    .map(
      (projectId) => `
        <li>
          <strong>${projectId}</strong>
          <div><a href="/api/projects/${projectId}/graph">graph</a></div>
          <div><a href="/api/projects/${projectId}/outreach-projection">outreach projection</a></div>
          <div><a href="/api/projects/${projectId}/microsoft-excel-files">Microsoft Excel files</a></div>
          <div><code>POST /api/projects/${projectId}/microsoft-workbook</code></div>
          <div><code>POST /api/projects/${projectId}/microsoft-range</code></div>
          <div><code>PATCH /api/projects/${projectId}/microsoft-range</code></div>
        </li>
      `
    )
    .join('')

  const authConfigured = microsoftStatus.configured
    ? '<span>Configured</span>'
    : '<span>Missing client ID</span>'
  const authSession = microsoftStatus.authenticated
    ? `<span>Authenticated until ${microsoftStatus.expiresAt ?? 'unknown'}</span>`
    : '<span>No active session</span>'

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>operator-hub mini-hub</title>
    <style>
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        background: linear-gradient(135deg, #f2f6ef, #dbe7ee);
        color: #17343b;
      }
      main {
        max-width: 960px;
        margin: 0 auto;
        padding: 32px 20px 48px;
      }
      .card {
        background: rgba(255, 255, 255, 0.88);
        border: 1px solid #b5c9ce;
        border-radius: 16px;
        padding: 18px 20px;
        margin-top: 18px;
      }
      h1, h2 {
        margin: 0;
      }
      ul {
        padding-left: 20px;
      }
      code {
        background: #edf4f4;
        padding: 2px 6px;
        border-radius: 6px;
      }
      a {
        color: #0b5f6b;
      }
    </style>
  </head>
  <body>
    <main>
      <p>Local hub foundation</p>
      <h1>operator-hub mini-hub</h1>
      <div class="card">
        <h2>Projects</h2>
        <ul>${projectLinks || '<li>No projects found.</li>'}</ul>
      </div>
      <div class="card">
        <h2>Microsoft Auth</h2>
        <p>${authConfigured} · ${authSession}</p>
        <ul>
          <li><a href="/api/auth/microsoft/status"><code>/api/auth/microsoft/status</code></a></li>
          <li><a href="/api/auth/microsoft/start"><code>/api/auth/microsoft/start</code></a></li>
          <li><a href="/api/auth/microsoft/me"><code>/api/auth/microsoft/me</code></a></li>
        </ul>
      </div>
      <div class="card">
        <h2>Endpoints</h2>
        <ul>
          <li><a href="/api/health"><code>/api/health</code></a></li>
          <li><a href="/api/planner/dashboard"><code>/api/planner/dashboard</code></a></li>
          <li><a href="/api/planner/boards"><code>/api/planner/boards</code></a></li>
          <li><a href="/api/planner/actions"><code>/api/planner/actions</code></a></li>
          <li><a href="/api/hub/tools"><code>/api/hub/tools</code></a></li>
          <li><a href="/api/mcp/tools"><code>/api/mcp/tools</code></a></li>
          <li><a href="/api/skills"><code>/api/skills</code></a></li>
          <li><a href="/api/projects"><code>/api/projects</code></a></li>
          <li><a href="/api/auth/microsoft/status"><code>/api/auth/microsoft/status</code></a></li>
          <li><code>POST /api/mcp/call -> list_projects</code></li>
          <li><code>POST /api/mcp/call -> get_project_summary</code></li>
          <li><code>POST /api/skills/run -> summarize_project_hypotheses</code></li>
          <li><code>POST /api/skills/run -> suggest_next_outreach_steps</code></li>
          <li><code>POST /api/mcp/call</code></li>
          <li><code>/api/projects/:projectId/graph</code></li>
          <li><code>/api/projects/:projectId/outreach-projection</code></li>
          <li><code>/api/projects/:projectId/microsoft-excel-files</code></li>
          <li><code>POST /api/projects/:projectId/microsoft-workbook</code></li>
          <li><code>POST /api/projects/:projectId/microsoft-range</code></li>
          <li><code>PATCH /api/projects/:projectId/microsoft-range</code></li>
        </ul>
      </div>
    </main>
  </body>
</html>`
}

const server = createServer(async (req, res) => {
  try {
    const rawPath = new URL(req.url ?? '/', publicUrl).pathname
    const effectiveUrl = normalizePrefixedUrl(req.url ?? '/')
    const effectivePath = new URL(effectiveUrl, publicUrl).pathname
    const supportedProjects = await listSupportedProjects()
    const microsoftStatus = await microsoftAuth.getStatus()

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS,DELETE')
      res.end()
      return
    }

    if ((rawPath === appBasePath || rawPath.startsWith(`${appBasePath}/`)) && !effectivePath.startsWith('/api/')) {
      const staticAsset = resolveFrontendAssetPath(req.url ?? '/')
      if (staticAsset) {
        serveFrontendAsset(res, staticAsset)
        return
      }
    }

    if (effectiveUrl === '/') {
      sendHtml(res, 200, renderDashboard(supportedProjects, microsoftStatus))
      return
    }

    if (effectiveUrl === '/api/health') {
      sendJson(res, 200, { ok: true, service: 'operator-hub-mini-hub' })
      return
    }

    if (effectiveUrl === '/api/auth/microsoft/status') {
      sendJson(res, 200, await microsoftAuth.getStatus())
      return
    }

    if (effectiveUrl === '/api/auth/microsoft/start') {
      sendRedirect(res, microsoftAuth.getAuthorizationUrl())
      return
    }

    if (effectiveUrl.startsWith('/api/auth/microsoft/callback')) {
      const callbackUrl = new URL(effectiveUrl, publicUrl)
      const authError = callbackUrl.searchParams.get('error')
      const authErrorDescription = callbackUrl.searchParams.get('error_description')

      if (authError) {
        sendHtml(
          res,
          400,
          `<!doctype html><html><body><h1>Microsoft sign-in failed</h1><p>${authError}</p><pre>${authErrorDescription ?? ''}</pre></body></html>`
        )
        return
      }

      const code = callbackUrl.searchParams.get('code')
      const state = callbackUrl.searchParams.get('state')

      if (!code || !state) {
        sendJson(res, 400, { ok: false, message: 'Missing Microsoft OAuth code or state' })
        return
      }

      const token = await microsoftAuth.exchangeAuthorizationCode({ code, state })
      const returnUrl = `${appUrl.replace(/\/$/, '')}/connections`
      sendRedirect(res, `${returnUrl}?provider=microsoft&status=connected&clientId=${encodeURIComponent(token.clientId)}`)
      return
    }

    if (effectiveUrl === '/api/auth/microsoft/me') {
      sendJson(res, 200, await microsoftAuth.getProfile())
      return
    }

    if (effectiveUrl.startsWith('/api/auth/microsoft/excel-files') && req.method === 'GET') {
      const requestUrl = new URL(effectiveUrl, publicUrl)
      const query = requestUrl.searchParams.get('query') ?? undefined
      const limit = requestUrl.searchParams.get('limit') ?? undefined
      sendJson(res, 200, await microsoftAuth.listExcelFiles({ query, limit }))
      return
    }

    if (effectiveUrl.startsWith('/api/auth/microsoft/calendar/events') && req.method === 'GET') {
      const requestUrl = new URL(effectiveUrl, publicUrl)
      const startDateTime = requestUrl.searchParams.get('startDateTime') ?? undefined
      const endDateTime = requestUrl.searchParams.get('endDateTime') ?? undefined
      sendJson(res, 200, await microsoftAuth.listCalendarEvents({ startDateTime, endDateTime }))
      return
    }

    if (effectiveUrl === '/api/auth/microsoft/calendar/events' && req.method === 'POST') {
      const payload = await readJsonBody(req)
      sendJson(res, 200, await microsoftAuth.createCalendarEvent(payload ?? {}))
      return
    }

    if (effectiveUrl === '/api/auth/microsoft/logout' && req.method === 'POST') {
      sendJson(res, 200, await microsoftAuth.clearSession())
      return
    }

    if (effectiveUrl === '/api/projects') {
      sendJson(res, 200, { projects: supportedProjects })
      return
    }

    if (effectiveUrl.startsWith('/api/planner/dashboard') && req.method === 'GET') {
      const requestUrl = new URL(effectiveUrl, publicUrl)
      const mode = requestUrl.searchParams.get('mode') ?? 'desktop'
      sendJson(res, 200, getPlannerDashboardPayload({ mode }))
      return
    }

    if (effectiveUrl === '/api/planner/boards' && req.method === 'GET') {
      sendJson(res, 200, { boards: listPlannerBoards() })
      return
    }

    const plannerSeriesPath = matchPlannerSeriesPath(effectiveUrl)
    if (plannerSeriesPath && req.method === 'GET') {
      const snapshot = getPlannerSeriesSnapshot(plannerSeriesPath.seriesId)
      if (!snapshot) {
        sendJson(res, 404, { ok: false, message: `Unknown planner series: ${plannerSeriesPath.seriesId}` })
        return
      }

      sendJson(res, 200, snapshot)
      return
    }

    if (effectiveUrl === '/api/planner/boards' && req.method === 'POST') {
      const payload = await readJsonBody(req)
      sendJson(res, 200, createPlannerBoard(payload ?? {}))
      return
    }

    if (effectiveUrl === '/api/planner/work-items' && req.method === 'POST') {
      const payload = await readJsonBody(req)
      sendJson(res, 200, createPlannerWorkItem(payload ?? {}))
      return
    }

    if (effectiveUrl === '/api/planner/import/microsoft-calendar' && req.method === 'POST') {
      const payload = await readJsonBody(req)
      const calendarPayload = await microsoftAuth.listCalendarEvents({
        startDateTime: payload?.startDateTime,
        endDateTime: payload?.endDateTime
      })
      sendJson(
        res,
        200,
        importCalendarEventsToPlanner(calendarPayload.events ?? [], {
          boardId: payload?.boardId ?? 'board-daily'
        })
      )
      return
    }

    if (effectiveUrl === '/api/planner/cleanup/microsoft-calendar' && req.method === 'POST') {
      const payload = await readJsonBody(req)
      sendJson(
        res,
        200,
        cleanupPlannerCalendarImports({
          boardId: payload?.boardId ?? 'board-daily'
        })
      )
      return
    }

    if (effectiveUrl.startsWith('/api/planner/actions') && req.method === 'GET') {
      const requestUrl = new URL(effectiveUrl, publicUrl)
      const scope = requestUrl.searchParams.get('scope') ?? undefined
      sendJson(res, 200, { actions: getAvailablePlannerActions({ scope }) })
      return
    }

    if (effectiveUrl === '/api/planner/actions/run' && req.method === 'POST') {
      const payload = await readJsonBody(req)
      sendJson(
        res,
        200,
        {
          run: runPlannerAction({
            actionId: payload?.actionId,
            source: payload?.source
          })
        }
      )
      return
    }

    if (effectiveUrl === '/api/hub/tools') {
      sendJson(res, 200, {
        version: '0.1.0',
        supportedProjects,
        tools: getMcpTools()
      })
      return
    }

    if (effectiveUrl === '/api/mcp/tools') {
      sendJson(res, 200, {
        server: 'operator-hub-mini-hub',
        protocol: 'mcp-like',
        version: '0.1.0',
        tools: getMcpTools()
      })
      return
    }

    if (effectiveUrl === '/api/skills') {
      sendJson(res, 200, {
        server: 'operator-hub-mini-hub',
        version: '0.1.0',
        skills: getSkills()
      })
      return
    }

    const ownerMediaProjectPath = matchOwnerMediaProjectPath(effectiveUrl)
    if (ownerMediaProjectPath && req.method === 'GET') {
      sendJson(res, 200, await loadOwnerMediaProject(ownerMediaProjectPath.projectSlug))
      return
    }

    const ownerMediaFolderPath = matchOwnerMediaFolderPath(effectiveUrl)
    if (ownerMediaFolderPath && req.method === 'POST') {
      const projectSlug = ensureMediaProjectSlug(ownerMediaFolderPath.projectSlug)
      const payload = await readJsonBody(req)
      const relativePath = sanitizeRelativeFolderPath(payload?.folderPath)
      const targetDir = path.resolve(ownerMediaRawDir(projectSlug), relativePath)
      const relativeToRaw = path.relative(ownerMediaRawDir(projectSlug), targetDir)
      if (relativeToRaw.startsWith('..') || path.isAbsolute(relativeToRaw)) {
        throw new Error('Invalid folder path')
      }

      await mkdir(targetDir, { recursive: true })
      sendJson(res, 200, {
        ok: true,
        projectSlug,
        folderPath: relativePath,
        path: path.relative(repoRoot, targetDir).replaceAll(path.sep, '/')
      })
      return
    }

    const renderProjectPath = matchRenderProjectPath(effectiveUrl)
    if (renderProjectPath && req.method === 'GET') {
      sendJson(res, 200, await loadSiteHeroRenders(renderProjectPath.projectSlug))
      return
    }

    const serviceExplainerRenderProjectPath = matchServiceExplainerRenderProjectPath(effectiveUrl)
    if (serviceExplainerRenderProjectPath && req.method === 'GET') {
      sendJson(res, 200, await loadServiceExplainerRenders(serviceExplainerRenderProjectPath.projectSlug))
      return
    }

    const renderFilePath = matchRenderFilePath(effectiveUrl)
    if (renderFilePath && (req.method === 'GET' || req.method === 'HEAD')) {
      const projectSlug = ensureMediaProjectSlug(renderFilePath.projectSlug)
      const safeFileName = path.basename(renderFilePath.fileName)
      const absolutePath = path.resolve(siteHeroRenderProjectDir(projectSlug), safeFileName)
      if (!existsSync(absolutePath)) {
        sendJson(res, 404, { ok: false, message: `Unknown render file: ${safeFileName}` })
        return
      }

      streamVideoFile(req, res, absolutePath)
      return
    }

    const serviceExplainerRenderFilePath = matchServiceExplainerRenderFilePath(effectiveUrl)
    if (serviceExplainerRenderFilePath && (req.method === 'GET' || req.method === 'HEAD')) {
      const projectSlug = ensureMediaProjectSlug(serviceExplainerRenderFilePath.projectSlug)
      const safeFileName = path.basename(serviceExplainerRenderFilePath.fileName)
      const absolutePath = path.resolve(serviceExplainerRenderProjectDir(projectSlug), safeFileName)
      if (!existsSync(absolutePath)) {
        sendJson(res, 404, { ok: false, message: `Unknown render file: ${safeFileName}` })
        return
      }

      streamVideoFile(req, res, absolutePath)
      return
    }

    const ownerMediaUploadPath = matchOwnerMediaUploadPath(effectiveUrl)
    if (ownerMediaUploadPath && req.method === 'POST') {
      const payload = await readJsonBody(req)
      const projectSlug = ensureMediaProjectSlug(ownerMediaUploadPath.projectSlug)
      const fileName = String(payload?.fileName ?? '').trim()
      const targetDir = sanitizeRelativeUploadPath(payload?.targetDir ?? '')
      const dataBase64 = String(payload?.dataBase64 ?? '').trim()

      if (!fileName || !dataBase64) {
        sendJson(res, 400, { ok: false, message: 'Missing fileName or dataBase64' })
        return
      }

      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '-')
      const rawDir = ownerMediaRawDir(projectSlug)
      const destinationDir = targetDir ? path.resolve(rawDir, targetDir) : rawDir
      const relative = path.relative(rawDir, destinationDir)
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        sendJson(res, 400, { ok: false, message: 'Invalid targetDir' })
        return
      }

      await mkdir(destinationDir, { recursive: true })
      const filePath = path.resolve(destinationDir, safeFileName)
      await writeFile(filePath, Buffer.from(dataBase64, 'base64'))

      sendJson(res, 200, {
        ok: true,
        projectSlug,
        fileName: safeFileName,
        path: path.relative(repoRoot, filePath).replaceAll(path.sep, '/')
      })
      return
    }

    const ownerMediaCollectPath = matchOwnerMediaCollectPath(effectiveUrl)
    if (ownerMediaCollectPath && req.method === 'POST') {
      const payload = await readJsonBody(req)
      const projectSlug = ensureMediaProjectSlug(ownerMediaCollectPath.projectSlug)
      const ownerProject = await loadOwnerMediaProject(projectSlug)
      const approvedLocalPaths =
        Array.isArray(payload?.approvedLocalPaths) && payload.approvedLocalPaths.length > 0
          ? payload.approvedLocalPaths
          : ownerProject.rawFiles.map((file) => file.relativePath)

      sendJson(
        res,
        200,
        await collectOwnerMedia({
          projectSlug,
          approvedLocalPaths,
          assetTypes: Array.isArray(payload?.assetTypes) && payload.assetTypes.length > 0 ? payload.assetTypes : ['profile'],
          maxAssets: payload?.maxAssets
        })
      )
      return
    }

    if (effectiveUrl === '/api/media/stock/search' && req.method === 'POST') {
      const payload = await readJsonBody(req)
      sendJson(res, 200, await searchStockMedia(payload ?? {}))
      return
    }

    if (effectiveUrl === '/api/media/stock/collect' && req.method === 'POST') {
      const payload = await readJsonBody(req)
      sendJson(res, 200, await collectStockMedia(payload ?? {}))
      return
    }

    if (effectiveUrl === '/api/mcp/call' && req.method === 'POST') {
      const payload = await readJsonBody(req)
      const toolName = payload?.tool
      const args = payload?.arguments ?? {}

      if (typeof toolName !== 'string' || !toolName) {
        sendJson(res, 400, { ok: false, message: 'Missing tool name' })
        return
      }

      sendJson(res, 200, await callTool(toolName, args))
      return
    }

    if (effectiveUrl === '/api/skills/run' && req.method === 'POST') {
      const payload = await readJsonBody(req)
      const skillName = payload?.skill
      const args = payload?.arguments ?? {}

      if (typeof skillName !== 'string' || !skillName) {
        sendJson(res, 400, { ok: false, message: 'Missing skill name' })
        return
      }

      sendJson(res, 200, await runSkill(skillName, args))
      return
    }

    const projectPath = matchProjectPath(effectiveUrl)
    if (projectPath) {
      const { projectId, resource } = projectPath

      if (!supportedProjects.includes(projectId)) {
        sendJson(res, 404, { ok: false, message: `Unknown project: ${projectId}` })
        return
      }

      if (resource === 'graph' && req.method === 'GET') {
        sendJson(res, 200, await loadGraph(projectId))
        return
      }

      if (resource === 'graph' && req.method === 'POST') {
        const graph = await readJsonBody(req)
        sendJson(res, 200, await saveGraph(projectId, graph))
        return
      }

      if (resource === 'outreach-projection' && req.method === 'GET') {
        const graph = await loadGraph(projectId)
        sendJson(res, 200, projectGraph(graph))
        return
      }

      if (resource === 'microsoft-excel-files' && req.method === 'GET') {
        const graph = await loadGraph(projectId)
        const requestUrl = new URL(effectiveUrl, publicUrl)
        const limit = requestUrl.searchParams.get('limit') ?? undefined
        sendJson(
          res,
          200,
          await microsoftAuth.listExcelFilesInConfiguredFolder(
            getProjectMicrosoftExcelFolder(graph),
            { limit }
          )
        )
        return
      }

      if (resource === 'microsoft-excel-files' && req.method === 'POST') {
        const graph = await loadGraph(projectId)
        const payload = await readJsonBody(req)
        const templateContent = await readFile(getProjectWorkbookTemplatePath(projectId, graph))
        sendJson(
          res,
          200,
          await microsoftAuth.createExcelFileInConfiguredFolder(
            getProjectMicrosoftExcelFolder(graph),
            {
              fileName: payload?.fileName,
              content: templateContent
            }
          )
        )
        return
      }

      if (resource === 'microsoft-workbook' && req.method === 'POST') {
        const graph = await loadGraph(projectId)
        const payload = await readJsonBody(req)
        sendJson(
          res,
          200,
          await microsoftAuth.getWorkbookMetadataInConfiguredFolder(
            getProjectMicrosoftExcelFolder(graph),
            {
              fileId: payload?.fileId
            }
          )
        )
        return
      }

      if (resource === 'microsoft-range' && req.method === 'POST') {
        const graph = await loadGraph(projectId)
        const payload = await readJsonBody(req)
        sendJson(
          res,
          200,
          await microsoftAuth.readWorkbookRangeInConfiguredFolder(
            getProjectMicrosoftExcelFolder(graph),
            {
              fileId: payload?.fileId,
              worksheetName: payload?.worksheetName,
              address: payload?.address
            }
          )
        )
        return
      }

      if (resource === 'microsoft-range' && req.method === 'PATCH') {
        const graph = await loadGraph(projectId)
        const payload = await readJsonBody(req)
        sendJson(
          res,
          200,
          await microsoftAuth.writeWorkbookRangeInConfiguredFolder(
            getProjectMicrosoftExcelFolder(graph),
            {
              fileId: payload?.fileId,
              worksheetName: payload?.worksheetName,
              address: payload?.address,
              values: payload?.values
            }
          )
        )
        return
      }
    }

    const plannerBoardPath = matchPlannerBoardPath(effectiveUrl)
    if (plannerBoardPath && req.method === 'GET') {
      sendJson(res, 200, getPlannerBoardPayload(plannerBoardPath.boardId))
      return
    }

    const plannerWorkItemMovePath = matchPlannerWorkItemMovePath(effectiveUrl)
    if (plannerWorkItemMovePath && req.method === 'POST') {
      const payload = await readJsonBody(req)
      sendJson(
        res,
        200,
        movePlannerWorkItem(plannerWorkItemMovePath.workItemId, {
          columnId: payload?.columnId,
          focusDate: payload?.focusDate
        })
      )
      return
    }

    const plannerWorkItemPath = matchPlannerWorkItemPath(effectiveUrl)
    if (plannerWorkItemPath && req.method === 'DELETE') {
      if (!getPlannerWorkItem(plannerWorkItemPath.workItemId)) {
        sendJson(res, 404, { ok: false, message: `Unknown work item: ${plannerWorkItemPath.workItemId}` })
        return
      }

      sendJson(res, 200, { ok: deletePlannerWorkItem(plannerWorkItemPath.workItemId) })
      return
    }

    if (plannerWorkItemPath && req.method === 'PATCH') {
      const payload = await readJsonBody(req)
      if (!getPlannerWorkItem(plannerWorkItemPath.workItemId)) {
        sendJson(res, 404, { ok: false, message: `Unknown work item: ${plannerWorkItemPath.workItemId}` })
        return
      }

      sendJson(res, 200, updatePlannerWorkItem(plannerWorkItemPath.workItemId, payload ?? {}))
      return
    }

    const plannerWorkItemCalendarSyncPath = matchPlannerWorkItemCalendarSyncPath(effectiveUrl)
    if (plannerWorkItemCalendarSyncPath && req.method === 'POST') {
      const payload = await readJsonBody(req)
      const workItem = getPlannerWorkItem(plannerWorkItemCalendarSyncPath.workItemId)
      if (!workItem) {
        sendJson(res, 404, { ok: false, message: `Unknown work item: ${plannerWorkItemCalendarSyncPath.workItemId}` })
        return
      }

      const startDate =
        payload?.startDateTime ??
        workItem.scheduledStartAt ??
        `${(workItem.focusDate ?? workItem.dueDate ?? new Date().toISOString().slice(0, 10))}T09:00:00`
      const endDate =
        payload?.endDateTime ??
        workItem.scheduledEndAt ??
        `${(workItem.focusDate ?? workItem.dueDate ?? new Date().toISOString().slice(0, 10))}T10:00:00`
      const event = await microsoftAuth.createCalendarEvent({
        subject: payload?.subject ?? workItem.title,
        body: payload?.body ?? workItem.details,
        startDateTime: startDate,
        endDateTime: endDate,
        timeZone: payload?.timeZone ?? 'UTC'
      })

      const updated = updatePlannerWorkItem(workItem.id, {
        syncMode: 'planner_to_calendar',
        syncProvider: 'microsoft',
        externalCalendarId: event.calendarId ?? 'primary',
        externalEventId: event.id,
        calendarEventId: event.id,
        lastSyncedAt: new Date().toISOString(),
        scheduledStartAt: startDate,
        scheduledEndAt: endDate
      })

      sendJson(res, 200, { workItem: updated, event })
      return
    }

    // ── BG Remover ────────────────────────────────────────────────────────
    if (effectivePath === '/api/bg-remover/process' && req.method === 'POST') {
      const { dataBase64, fileName, model, alphaMatting } = await readJsonBody(req)
      const jobId = startBgRemoverJob({ dataBase64, fileName, model, alphaMatting })
      sendJson(res, 202, { jobId })
      return
    }

    const bgStatusMatch = effectivePath.match(/^\/api\/bg-remover\/status\/([a-f0-9]+)$/)
    if (bgStatusMatch && req.method === 'GET') {
      const job = getBgRemoverJob(bgStatusMatch[1])
      if (!job) { sendJson(res, 404, { error: 'Job not found' }); return }
      sendJson(res, 200, job)
      return
    }

    const bgResultMatch = effectivePath.match(/^\/api\/bg-remover\/result\/([a-f0-9]+)$/)
    if (bgResultMatch && req.method === 'GET') {
      const result = getBgRemoverResult(bgResultMatch[1])
      if (!result) { sendJson(res, 404, { error: 'Result not found' }); return }
      res.statusCode = 200
      res.setHeader('Content-Type', result.resultMime)
      res.setHeader('Content-Disposition', `attachment; filename="${result.resultFileName}"`)
      createReadStream(result.resultPath).pipe(res)
      return
    }

    if (effectivePath === '/api/bg-remover/watcher' && req.method === 'GET') {
      sendJson(res, 200, getWatcherStatus())
      return
    }

    if (effectivePath === '/api/bg-remover/cloud-watcher' && req.method === 'GET') {
      sendJson(res, 200, getCloudWatcherStatus())
      return
    }

    // ── Batch jobs overview ────────────────────────────────────────────────
    if (effectivePath === '/api/jobs' && req.method === 'GET') {
      const local = getWatcherStatus()
      const cloud = getCloudWatcherStatus()
      const seo = getSeoSchedulerStatus()

      sendJson(res, 200, {
        jobs: [
          {
            id: 'bg-remover-local',
            name: 'BG Remover (lokal)',
            description: 'Övervakar lokal input-mapp och tar bort bakgrund automatiskt',
            type: 'watcher',
            schedule: 'Var 5:e sekund (kontinuerlig)',
            inputDir: local.inputDir,
            outputDir: local.outputDir,
            queueLength: local.jobs.filter(j => j.status === 'processing' || j.status === 'queued').length,
            recentJobs: local.jobs.slice(0, 10),
          },
          {
            id: 'bg-remover-cloud',
            name: 'BG Remover (OneDrive)',
            description: 'Hämtar videor från OneDrive, tar bort bakgrund och laddar upp resultatet',
            type: 'watcher',
            schedule: 'Var 30:e sekund (kontinuerlig)',
            inputPath: cloud.inputPath,
            outputPath: cloud.outputPath,
            queueLength: cloud.jobs.filter(j => j.status === 'processing' || j.status === 'queued').length,
            recentJobs: cloud.jobs.slice(0, 10),
          },
          {
            id: 'seo-generator',
            name: 'SEO Artikelgenerator',
            description: 'Genererar SEO-artiklar baserat på Google Trends en gång i veckan',
            type: 'scheduler',
            schedule: 'Varje måndag 08:00',
            nextRunAt: seo.nextRunAt,
            lastRunAt: seo.lastRunAt,
            lastRunStatus: seo.lastRunStatus,
            lastRunSlug: seo.lastRunSlug,
            lastRunError: seo.lastRunError,
            running: seo.running,
          },
        ],
      })
      return
    }

    // ── SEO Articles ───────────────────────────────────────────────────────
    if (effectivePath === '/api/articles' && req.method === 'GET') {
      try {
        const draftsDir = path.resolve(repoRoot, '.local/seo-drafts')
        await mkdir(draftsDir, { recursive: true })
        const files = await readdir(draftsDir)
        const drafts = []
        for (const f of files.filter(f => f.endsWith('.json'))) {
          try {
            const data = JSON.parse(await readFile(path.join(draftsDir, f), 'utf-8'))
            drafts.push(data)
          } catch {}
        }
        drafts.sort((a, b) => (b.generatedAt ?? '').localeCompare(a.generatedAt ?? ''))
        sendJson(res, 200, drafts)
      } catch (e) {
        sendJson(res, 500, { error: String(e) })
      }
      return
    }

    const articleSlugMatch = effectivePath.match(/^\/api\/articles\/([^/]+)$/)
    if (articleSlugMatch && req.method === 'GET') {
      const slug = decodeURIComponent(articleSlugMatch[1])
      const filePath = path.resolve(repoRoot, `.local/seo-drafts/${slug}.json`)
      try {
        const data = JSON.parse(await readFile(filePath, 'utf-8'))
        sendJson(res, 200, data)
      } catch {
        sendJson(res, 404, { error: 'Not found' })
      }
      return
    }

    const articleActionMatch = effectivePath.match(/^\/api\/articles\/([^/]+)\/(approve|reject)$/)
    if (articleActionMatch && req.method === 'POST') {
      const slug = decodeURIComponent(articleActionMatch[1])
      const action = articleActionMatch[2]
      const filePath = path.resolve(repoRoot, `.local/seo-drafts/${slug}.json`)
      try {
        const data = JSON.parse(await readFile(filePath, 'utf-8'))
        data.status = action === 'approve' ? 'approved' : 'rejected'
        data.reviewedAt = new Date().toISOString()
        await writeFile(filePath, JSON.stringify(data, null, 2))
        sendJson(res, 200, { ok: true, status: data.status })
      } catch {
        sendJson(res, 404, { error: 'Not found' })
      }
      return
    }

    // PATCH /api/articles/:slug — update fields (+ re-publish MDX if published)
    if (articleSlugMatch && req.method === 'PATCH') {
      const slug = decodeURIComponent(articleSlugMatch[1])
      try {
        const body = await readJsonBody(req)
        const draft = await updateDraft(slug, body)
        sendJson(res, 200, { ok: true, draft })
      } catch (e) {
        sendJson(res, 500, { error: String(e) })
      }
      return
    }

    // DELETE /api/articles/:slug — unpublish (remove MDX, revert to approved)
    if (articleSlugMatch && req.method === 'DELETE') {
      const slug = decodeURIComponent(articleSlugMatch[1])
      try {
        const result = await unpublishDraft(slug)
        sendJson(res, 200, { ok: true, ...result })
      } catch (e) {
        sendJson(res, 500, { error: String(e) })
      }
      return
    }

    const articlePublishMatch = effectivePath.match(/^\/api\/articles\/([^/]+)\/publish$/)
    if (articlePublishMatch && req.method === 'POST') {
      const slug = decodeURIComponent(articlePublishMatch[1])
      try {
        const result = await publishDraft(slug)
        sendJson(res, 200, { ok: true, ...result })
      } catch (e) {
        sendJson(res, 500, { error: String(e) })
      }
      return
    }

    if (effectivePath === '/api/articles/generate' && req.method === 'POST') {
      try {
        const draft = await generateArticle()
        sendJson(res, 201, { ok: true, slug: draft.slug, title: draft.title })
      } catch (e) {
        sendJson(res, 500, { error: String(e) })
      }
      return
    }

    if (effectivePath === '/api/articles' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req)
        const draft = body
        if (!draft.slug) { sendJson(res, 400, { error: 'slug required' }); return }
        const draftsDir = path.resolve(repoRoot, '.local/seo-drafts')
        await mkdir(draftsDir, { recursive: true })
        draft.generatedAt = draft.generatedAt ?? new Date().toISOString()
        draft.status = draft.status ?? 'pending'
        await writeFile(path.join(draftsDir, `${draft.slug}.json`), JSON.stringify(draft, null, 2))
        sendJson(res, 201, { ok: true })
      } catch (e) {
        sendJson(res, 400, { error: String(e) })
      }
      return
    }

    // ── Media gallery ──────────────────────────────────────────────────────
    if (effectivePath === '/api/media/gallery' && req.method === 'GET') {
      const url = new URL(effectiveUrl, publicUrl)
      const collection = url.searchParams.get('collection') ?? null
      const album = url.searchParams.get('album') ?? null
      sendJson(res, 200, getGallery({ collection, album }))
      return
    }

    const mediaFileMatch = effectivePath.match(/^\/api\/media\/file\/([^/]+)\/(.+)$/)
    if (mediaFileMatch && req.method === 'GET') {
      const [, collection, rest] = mediaFileMatch
      const parts = rest.split('/')
      const fileName = decodeURIComponent(parts.pop() ?? '')
      const album = parts.length > 0 ? parts.map(decodeURIComponent).join('/') : ''
      const filePath = resolveFilePath(collection, album, fileName)
      if (!filePath) { sendJson(res, 404, { error: 'Filen finns inte' }); return }
      const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
      const mime = { mp4:'video/mp4', mov:'video/quicktime', webm:'video/webm', gif:'image/gif', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp' }[ext] ?? 'application/octet-stream'
      res.statusCode = 200
      res.setHeader('Content-Type', mime)
      createReadStream(filePath).pipe(res)
      return
    }

    if (effectivePath === '/api/media/rename' && req.method === 'POST') {
      const { collection, album, fileName, newName } = await readJsonBody(req)
      sendJson(res, 200, await renameFile(collection, album ?? '', fileName, newName))
      return
    }

    if (effectivePath === '/api/media/delete' && req.method === 'POST') {
      const { collection, album, fileName } = await readJsonBody(req)
      sendJson(res, 200, await deleteFile(collection, album ?? '', fileName))
      return
    }

    if (effectivePath === '/api/media/album' && req.method === 'POST') {
      const { collection, albumName } = await readJsonBody(req)
      sendJson(res, 200, await createAlbum(collection, albumName))
      return
    }

    sendJson(res, 404, { ok: false, message: 'Not found' })
  } catch (error) {
    sendJson(res, getErrorStatusCode(error), {
      ok: false,
      message: error instanceof Error ? error.message : 'Unexpected hub error'
    })
  }
})

server.listen(port, host, () => {
  console.log(`operator-hub mini-hub listening on http://${host}:${port}`)
  startWatcher()
  startCloudWatcher(microsoftAuth, { repoRoot })
  startWeeklyScheduler((err, draft) => {
    if (err) console.error('[seo-scheduler] Weekly generation error:', err.message)
    else console.log(`[seo-scheduler] Weekly article generated: ${draft.slug}`)
  })
})
