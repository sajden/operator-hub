export type PlannerBoardType = 'daily' | 'specialized' | 'outreach' | 'research'
export type WorkItemStatus = 'planned' | 'in_progress' | 'done' | 'archived'
export type WorkItemImportance = 'low' | 'normal' | 'high' | 'critical'
export type WorkItemFrictionType = 'neutral' | 'follow_up' | 'avoidance' | 'admin'
export type WorkItemRecurrenceRule = 'none' | 'daily' | 'weekdays' | 'weekly'
export type WorkItemSyncMode = 'none' | 'planner_to_calendar' | 'calendar_to_planner' | 'bidirectional'
export type PlannerViewMode = 'desktop' | 'tv'
export type PlannerWidgetType =
  | 'today'
  | 'in_progress'
  | 'follow_ups'
  | 'goals'
  | 'weekly_progress'
  | 'quick_actions'
  | 'board_summary'

export interface PlannerBoardSummary {
  id: string
  slug: string
  name: string
  boardType: PlannerBoardType
  description: string
  linkedDomain: string
}

export interface PlannerColumn {
  id: string
  boardId: string
  name: string
  columnKind: string
  position: number
}

export interface PlannerGoal {
  id: string
  name: string
  description: string
  horizon: string
  status: string
  targetDate: string | null
}

export interface PlannerWorkItem {
  id: string
  boardId: string
  columnId: string
  title: string
  details: string
  status: WorkItemStatus
  focusDate: string | null
  dueDate: string | null
  importance: WorkItemImportance
  frictionType: WorkItemFrictionType
  recurrenceRule: WorkItemRecurrenceRule
  recurrenceSource: 'manual' | 'calendar'
  seriesId: string | null
  seriesName: string | null
  calendarEventId: string | null
  syncMode: WorkItemSyncMode
  syncProvider: 'microsoft' | 'google' | null
  externalCalendarId: string | null
  externalEventId: string | null
  lastSyncedAt: string | null
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  executionNote: string
  goalId: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface PlannerView {
  id: string
  name: string
  viewMode: PlannerViewMode
  themePreference: 'light' | 'dark' | 'system'
}

export interface PlannerAction {
  id: string
  actionType: string
  capabilityKey: string
  scope: 'dashboard' | 'widget' | 'board' | 'work_item'
  displayLabel: string
  enabled: boolean
}

export interface PlannerActionArtifact {
  type: 'text' | 'link'
  label: string
  content?: string
  href?: string
}

export interface PlannerActionRun {
  id: string
  actionId: string
  source: {
    type: 'dashboard' | 'widget' | 'board' | 'work_item'
    id: string | null
  }
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  resultSummary?: string | null
  errorMessage?: string | null
  artifacts: PlannerActionArtifact[]
}

export interface PlannerWidgetLayout {
  x: number
  y: number
  w: number
  h: number
}

export interface TodayWidgetData {
  items: PlannerWorkItem[]
  carryOver: PlannerWorkItem[]
}

export interface InProgressWidgetData {
  items: PlannerWorkItem[]
}

export interface FollowUpsWidgetData {
  items: PlannerWorkItem[]
}

export interface GoalsWidgetData {
  goals: PlannerGoal[]
}

export interface WeeklyProgressWidgetData {
  summary: {
    inProgressCount: number
    completedTodayCount: number
    completedThisWeekCount: number
    carryOverCount: number
  }
}

export interface QuickActionsWidgetData {
  actions: PlannerAction[]
}

export type PlannerWidgetData =
  | TodayWidgetData
  | InProgressWidgetData
  | FollowUpsWidgetData
  | GoalsWidgetData
  | WeeklyProgressWidgetData
  | QuickActionsWidgetData
  | Record<string, never>

export interface PlannerWidget {
  id: string
  widgetType: PlannerWidgetType
  title: string
  layout: PlannerWidgetLayout
  data: PlannerWidgetData
  actions: PlannerAction[]
}

export interface PlannerDashboardPayload {
  view: PlannerView
  widgets: PlannerWidget[]
  summary: {
    inProgressCount: number
    completedTodayCount: number
    completedThisWeekCount: number
    carryOverCount: number
  }
  boards: PlannerBoardSummary[]
}

export interface PlannerBoardPayload {
  board: PlannerBoardSummary
  columns: Array<PlannerColumn & { workItems: PlannerWorkItem[] }>
  summary: {
    totalCount: number
    inProgressCount: number
    completedCount: number
    focusedCount: number
  }
}

export interface PlannerActionRunResponse {
  run: PlannerActionRun
}

export interface HubHealthStatus {
  ok: boolean
  service: string
}

export interface HubToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: string
    properties?: Record<string, unknown>
    required?: string[]
  }
}

export interface HubToolsPayload {
  version: string
  supportedProjects?: string[]
  tools: HubToolDefinition[]
}

export interface HubSkillsPayload {
  server: string
  version: string
  skills: HubToolDefinition[]
}

export interface SearchDemandInsightTheme {
  name: string
  opportunity: string
  seed_queries: string[]
  keyword_count: number
  example_keywords: string[]
}

export interface SearchDemandInsightKeyword {
  source: string
  query: string
  demand_bucket: string
  competition: string | null
  intent: string
  notes: string
}

export interface SearchDemandInsightSignal {
  source: string
  signal: string
  evidence: string
  inferred: boolean
}

export interface SearchDemandInsightServiceAngle {
  angle: string
  rationale: string
  based_on: string[]
}

export interface SearchDemandInsightSourceCoverage {
  source: string
  ok: boolean
  message: string
  session_hint: string | null
  artifacts: Array<{
    type: string
    source?: string
    seed_query?: string
    local_path: string
  }>
}

export interface SearchDemandInsightArtifact {
  type: string
  source?: string
  seed_query?: string
  local_path: string
}

export interface SearchDemandInsightsResult {
  ok: boolean
  project_slug: string
  run_id: string
  generated_at: string
  inputs: {
    project_slug: string
    seed_queries: string[]
    market: string
    language: string
    sources: string[]
    session_hint: string | null
    notes: string | null
  }
  summary: string[]
  themes: SearchDemandInsightTheme[]
  keywords: SearchDemandInsightKeyword[]
  demand_signals: SearchDemandInsightSignal[]
  service_angles: SearchDemandInsightServiceAngle[]
  source_coverage: SearchDemandInsightSourceCoverage[]
  artifacts: SearchDemandInsightArtifact[]
  errors: Array<{
    source: string
    seed_query: string
    message: string
  }>
}

export interface MicrosoftAuthStatus {
  provider: 'microsoft'
  configured: boolean
  tenantId: string
  clientIdConfigured: boolean
  clientSecretConfigured: boolean
  publicUrl: string
  redirectUri: string
  scopes: string[]
  authenticated: boolean
  tokenAvailable: boolean
  usable: boolean
  expiresAt: string | null
  scope: string | null
  hasRefreshToken: boolean
  tokenStored: boolean
}

export interface MicrosoftProfile {
  id?: string
  displayName?: string
  userPrincipalName?: string
  mail?: string
}

export interface MicrosoftCalendarEvent {
  id: string
  subject?: string
  start?: string
  end?: string
  webLink?: string
  seriesMasterId?: string | null
  recurrence?: Record<string, unknown> | null
}

export interface MicrosoftCalendarEventsPayload {
  range: {
    startDateTime: string
    endDateTime: string
  }
  events: MicrosoftCalendarEvent[]
}

export interface OwnerMediaAsset {
  projectSlug: string
  collectedAt: string
  assetType: string
  sourceUrl: string
  sourcePath?: string | null
  localPath: string
  width: number | null
  height: number | null
  contentType: string | null
  provenance?: Record<string, unknown>
}

export interface OwnerMediaRawFile {
  name: string
  relativePath: string
  path: string
}

export interface OwnerMediaProjectPayload {
  projectSlug: string
  rawRoot: string
  collectedRoot: string
  rawDirectories: string[]
  rawFiles: OwnerMediaRawFile[]
  collectedAssets: OwnerMediaAsset[]
  generatedAt: string | null
}

export interface OwnerMediaUploadResponse {
  ok: boolean
  projectSlug: string
  fileName: string
  path: string
}

export interface OwnerMediaFolderResponse {
  ok: boolean
  projectSlug: string
  folderPath: string
  path: string
}

export interface SiteHeroRenderVideo {
  fileName: string
  path: string
  sizeBytes: number
  modifiedAt: string
  streamUrl: string
}

export interface SiteHeroRendersPayload {
  projectSlug: string
  renderRoot: string
  videos: SiteHeroRenderVideo[]
}

export interface ServiceExplainerRenderVideo {
  fileName: string
  path: string
  sizeBytes: number
  modifiedAt: string
  streamUrl: string
}

export interface ServiceExplainerRendersPayload {
  projectSlug: string
  renderRoot: string
  videos: ServiceExplainerRenderVideo[]
}

export interface ServiceExplainerMotionResult {
  ok: boolean
  projectSlug: string
  renderJob: {
    jobId: string
    status: string
    compositionPath: string
    plannedOutputPath: string
  }
  renderExecution: {
    attempted: boolean
    mode: string
    image?: string
    ok: boolean
    outputPath: string | null
    error: string | null
  }
  composition: {
    id: string
    mode: string
    serviceType: string
    tone: string
  }
  savedTo: string
  notes: string[]
}

export interface StockMediaSearchResult {
  provider: string
  assetType: string
  id: string
  title: string
  previewUrl: string | null
  sourceUrl: string | null
  downloadUrl: string | null
  width: number | null
  height: number | null
  creatorName: string | null
  creatorUrl: string | null
  license: string | null
  provenance?: Record<string, unknown>
}

export interface StockMediaSearchResponse {
  ok: boolean
  query: string
  orientation: string
  providers: string[]
  results: StockMediaSearchResult[]
  errors: Array<{ provider: string; message: string }>
  attemptedProviders: number
}

export interface StockMediaCollectResponse {
  ok: boolean
  projectSlug: string
  assets: Array<{
    provider: string
    id: string
    type: string
    title: string
    sourceUrl: string
    localPath: string
    width: number | null
    height: number | null
  }>
  errors: Array<{ provider: string; id: string; sourceUrl: string; message: string }>
  attempted: number
  savedTo: string
}

export interface PlannerEventRecord {
  id: string
  entityType: string
  entityId: string
  eventType: string
  payload: Record<string, unknown>
  occurredAt: string
}

export interface PlannerSeriesSnapshot {
  seriesId: string
  name: string
  recurrenceRule: WorkItemRecurrenceRule
  recurrenceSource: 'manual' | 'calendar'
  syncProvider: 'microsoft' | 'google' | null
  stats: {
    totalOccurrences: number
    completedCount: number
    inProgressCount: number
    plannedCount: number
    lastCompletedAt: string | null
  }
  occurrences: PlannerWorkItem[]
  recentEvents: PlannerEventRecord[]
}
