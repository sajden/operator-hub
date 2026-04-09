import type {
  HubHealthStatus,
  HubSkillsPayload,
  HubToolsPayload,
  MicrosoftAuthStatus,
  MicrosoftCalendarEventsPayload,
  MicrosoftProfile,
  OwnerMediaFolderResponse,
  OwnerMediaProjectPayload,
  OwnerMediaUploadResponse,
  PlannerActionRunResponse,
  PlannerBoardSummary,
  PlannerBoardPayload,
  PlannerDashboardPayload,
  PlannerSeriesSnapshot,
  PlannerWorkItem,
  SearchDemandInsightsResult,
  ServiceExplainerMotionResult,
  ServiceExplainerRendersPayload,
  SiteHeroRendersPayload,
  StockMediaCollectResponse,
  StockMediaSearchResponse,
  WorkItemRecurrenceRule,
  WorkItemFrictionType,
  WorkItemImportance
} from '../types/planner'
import { apiPath } from './runtimePaths'

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export function loadPlannerDashboard(mode: 'desktop' | 'tv' = 'desktop') {
  return requestJson<PlannerDashboardPayload>(`${apiPath('/planner/dashboard')}?mode=${mode}`)
}

export function loadPlannerBoard(boardId: string) {
  return requestJson<PlannerBoardPayload>(apiPath(`/planner/boards/${encodeURIComponent(boardId)}`))
}

export function loadPlannerSeries(seriesId: string) {
  return requestJson<PlannerSeriesSnapshot>(apiPath(`/planner/series/${encodeURIComponent(seriesId)}`))
}

export function listPlannerBoards() {
  return requestJson<{ boards: PlannerBoardSummary[] }>(apiPath('/planner/boards'))
}

export function createPlannerWorkItem(input: {
  boardId: string
  columnId?: string
  title: string
  details?: string
  focusDate?: string
  dueDate?: string
  importance?: WorkItemImportance
  frictionType?: WorkItemFrictionType
  recurrenceRule?: WorkItemRecurrenceRule
  scheduledStartAt?: string
  scheduledEndAt?: string
}) {
  return requestJson<PlannerWorkItem>(apiPath('/planner/work-items'), {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function createPlannerBoard(input: {
  name: string
  description?: string
  boardType?: PlannerBoardSummary['boardType']
}) {
  return requestJson<PlannerBoardSummary>(apiPath('/planner/boards'), {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function movePlannerWorkItem(workItemId: string, input: { columnId: string; focusDate?: string | null }) {
  return requestJson<PlannerWorkItem>(apiPath(`/planner/work-items/${encodeURIComponent(workItemId)}/move`), {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function updatePlannerWorkItem(workItemId: string, patch: Partial<PlannerWorkItem>) {
  return requestJson<PlannerWorkItem>(apiPath(`/planner/work-items/${encodeURIComponent(workItemId)}`), {
    method: 'PATCH',
    body: JSON.stringify(patch)
  })
}

export function deletePlannerWorkItem(workItemId: string) {
  return requestJson<{ ok: boolean }>(apiPath(`/planner/work-items/${encodeURIComponent(workItemId)}`), {
    method: 'DELETE'
  })
}

export function runPlannerAction(input: {
  actionId: string
  source: { type: 'dashboard' | 'widget' | 'board' | 'work_item'; id: string | null }
}) {
  return requestJson<PlannerActionRunResponse>(apiPath('/planner/actions/run'), {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function listMicrosoftCalendarEvents(input?: { startDateTime?: string; endDateTime?: string }) {
  const params = new URLSearchParams()
  if (input?.startDateTime) params.set('startDateTime', input.startDateTime)
  if (input?.endDateTime) params.set('endDateTime', input.endDateTime)
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return requestJson<MicrosoftCalendarEventsPayload>(`${apiPath('/auth/microsoft/calendar/events')}${suffix}`)
}

export function createMicrosoftCalendarEvent(input: {
  subject: string
  body?: string
  startDateTime: string
  endDateTime: string
  timeZone?: string
}) {
  return requestJson<Record<string, unknown>>(apiPath('/auth/microsoft/calendar/events'), {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function syncPlannerWorkItemToMicrosoftCalendar(
  workItemId: string,
  input?: { subject?: string; body?: string; startDateTime?: string; endDateTime?: string; timeZone?: string }
) {
  return requestJson<{ workItem: PlannerWorkItem; event: Record<string, unknown> }>(
    apiPath(`/planner/work-items/${encodeURIComponent(workItemId)}/sync/microsoft-calendar`),
    {
      method: 'POST',
      body: JSON.stringify(input ?? {})
    }
  )
}

export function importMicrosoftCalendarToPlanner(input?: {
  boardId?: string
  startDateTime?: string
  endDateTime?: string
}) {
  return requestJson<{ imported: PlannerWorkItem[]; updated: PlannerWorkItem[] }>(apiPath('/planner/import/microsoft-calendar'), {
    method: 'POST',
    body: JSON.stringify(input ?? {})
  })
}

export function cleanupMicrosoftCalendarPlannerImports(input?: { boardId?: string }) {
  return requestJson<{
    boardId: string
    removedCount: number
    removedIds: string[]
    reasons: {
      futureRecurringOccurrences: number
      placeholderTestImports: number
      duplicateExternalEvents: number
      duplicateSeriesSummaries: number
    }
  }>(apiPath('/planner/cleanup/microsoft-calendar'), {
    method: 'POST',
    body: JSON.stringify(input ?? {})
  })
}

export function loadHubHealth() {
  return requestJson<HubHealthStatus>(apiPath('/health'))
}

export function loadHubTools() {
  return requestJson<HubToolsPayload>(apiPath('/hub/tools'))
}

export function loadHubSkills() {
  return requestJson<HubSkillsPayload>(apiPath('/skills'))
}

export function callHubTool<T>(tool: string, argumentsPayload: Record<string, unknown>) {
  return requestJson<{ tool: string; result: T }>(apiPath('/mcp/call'), {
    method: 'POST',
    body: JSON.stringify({
      tool,
      arguments: argumentsPayload
    })
  })
}

export function captureSearchDemandInsights(input: {
  project_slug: string
  seed_queries: string[]
  market?: string
  language?: string
  sources?: Array<'google_keyword_planner' | 'google_trends'>
  session_hint?: string
  notes?: string
}) {
  return callHubTool<SearchDemandInsightsResult>('capture_search_demand_insights', input)
}

export function loadMicrosoftAuthStatus() {
  return requestJson<MicrosoftAuthStatus>(apiPath('/auth/microsoft/status'))
}

export function loadMicrosoftProfile() {
  return requestJson<MicrosoftProfile>(apiPath('/auth/microsoft/me'))
}

export function logoutMicrosoft() {
  return requestJson<{ ok: boolean }>(apiPath('/auth/microsoft/logout'), {
    method: 'POST'
  })
}

export function loadOwnerMediaProject(projectSlug: string) {
  return requestJson<OwnerMediaProjectPayload>(apiPath(`/media/owner/${encodeURIComponent(projectSlug)}`))
}

export function loadSiteHeroRenders(projectSlug: string) {
  return requestJson<SiteHeroRendersPayload>(apiPath(`/media/renders/${encodeURIComponent(projectSlug)}`))
}

export function loadServiceExplainerRenders(projectSlug: string) {
  return requestJson<ServiceExplainerRendersPayload>(
    apiPath(`/media/service-explainer-renders/${encodeURIComponent(projectSlug)}`)
  )
}

export function renderServiceExplainerMotion(input: {
  projectSlug: string
  title: string
  mode?: 'three_step_process' | 'before_after' | 'service_spotlight'
  serviceType?: 'automation' | 'integration' | 'internal_tools' | 'generic'
  tone?: 'clean_premium' | 'operator_tech' | 'bold_editorial' | 'calm_trust'
  pace?: 'slow' | 'medium' | 'fast'
  aspectRatio?: 'square' | 'portrait' | 'landscape'
  durationInSeconds?: number
  fps?: number
  brief?: {
    problem?: string
    decision?: string
    outcome?: string
  }
}) {
  return callHubTool<ServiceExplainerMotionResult>('render_service_explainer_motion', input)
}

export function uploadOwnerMediaFile(input: {
  projectSlug: string
  fileName: string
  targetDir?: string
  dataBase64: string
}) {
  return requestJson<OwnerMediaUploadResponse>(apiPath(`/media/owner/${encodeURIComponent(input.projectSlug)}/upload`), {
    method: 'POST',
    body: JSON.stringify({
      fileName: input.fileName,
      targetDir: input.targetDir,
      dataBase64: input.dataBase64
    })
  })
}

export function createOwnerMediaFolder(input: { projectSlug: string; folderPath: string }) {
  return requestJson<OwnerMediaFolderResponse>(apiPath(`/media/owner/${encodeURIComponent(input.projectSlug)}/folders`), {
    method: 'POST',
    body: JSON.stringify({
      folderPath: input.folderPath
    })
  })
}

export function collectOwnerMediaFromProject(input: {
  projectSlug: string
  approvedLocalPaths?: string[]
  assetTypes?: string[]
  maxAssets?: number
}) {
  return requestJson<{
    ok: boolean
    projectSlug: string
    assets: Array<{ type: string; sourceUrl: string; localPath: string; width: number | null; height: number | null }>
    errors: Array<{ type: string; sourceUrl: string; message: string }>
    attempted: number
    savedTo: string
  }>(apiPath(`/media/owner/${encodeURIComponent(input.projectSlug)}/collect`), {
    method: 'POST',
    body: JSON.stringify({
      approvedLocalPaths: input.approvedLocalPaths,
      assetTypes: input.assetTypes,
      maxAssets: input.maxAssets
    })
  })
}

export function searchStockMedia(input: {
  query: string
  providers?: string[]
  orientation?: string
  maxResults?: number
}) {
  return requestJson<StockMediaSearchResponse>(apiPath('/media/stock/search'), {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function collectStockMedia(input: {
  projectSlug: string
  selections: Array<{
    provider: string
    id: string
    assetType?: string
    title?: string
    sourceUrl: string
    downloadUrl: string
    creatorName?: string | null
    creatorUrl?: string | null
    license?: string | null
  }>
}) {
  return requestJson<StockMediaCollectResponse>(apiPath('/media/stock/collect'), {
    method: 'POST',
    body: JSON.stringify(input)
  })
}
