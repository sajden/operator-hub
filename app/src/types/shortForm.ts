export type ShortFormJobStatus =
  | 'queued'
  | 'preparing'
  | 'prepared'
  | 'prepared_without_article'
  | 'pending_article_review'
  | 'review_required'
  | 'rendering'
  | 'done'
  | 'failed'

export type ShortFormStepStatus = 'pending' | 'running' | 'done' | 'warning' | 'skipped' | 'failed'

export interface ShortFormJobSummary {
  id: string
  title: string
  status: ShortFormJobStatus
  sourceKind: 'manual' | 'watcher_local' | 'watcher_cloud'
  createdAt: string
  updatedAt: string
  summary: {
    clipCount: number
    usableClipCount: number
    articleSelected: boolean
    rendered: boolean
  }
}

export interface ShortFormJobStep {
  key: string
  status: ShortFormStepStatus
  startedAt: string | null
  finishedAt: string | null
  message: string
  warning: string | null
  error: string | null
  outputs: Record<string, unknown>
}

export interface ShortFormClipRecord {
  index: number
  sourceFileName: string
  sourcePath: string
  sortKey: string
  kept: boolean
  rejectReason: string | null
  cleanedPath: string | null
  transcriptPath: string | null
  durationSeconds: number | null
  trim: {
    leadingSeconds: number | null
    trailingSeconds: number | null
  }
}

export interface ShortFormJob {
  id: string
  title: string
  status: ShortFormJobStatus
  createdAt: string
  updatedAt: string
  source: {
    kind: 'manual' | 'watcher_local' | 'watcher_cloud'
    label: string
    sourcePath: string
    sourceFolderId: string | null
    revisionKey: string | null
  }
  config: {
    articleMode: string
    captionPreset: string
    transitionPreset: string
    sfxPreset: string
    manualArticleUrl: string | null
  }
  summary: {
    clipCount: number
    usableClipCount: number
    fullTranscriptChars: number
    articleSelected: boolean
    rendered: boolean
  }
  steps: ShortFormJobStep[]
  clips: ShortFormClipRecord[]
  articleSelection: {
    selectedUrl: string | null
    source: 'auto_search' | 'article_txt' | 'manual_ui' | 'none'
    confidence: number
    reasoningSummary: string
    screenshotPath: string | null
    needsReview?: boolean
    candidates?: Array<{ url: string; title: string }>
  }
  paths: {
    workspaceDir: string
    manifestPath: string
    renderManifestPath: string | null
    reviewCutPath: string | null
  }
}

export interface ShortFormWatchersStatus {
  localWatcher: {
    inputDir: string
    jobs: Array<{
      fileName: string
      status: string
      message: string
      progress: number
      detectedAt?: number
      sourcePath?: string
      revisionKey?: string
      jobId?: string
    }>
  }
  cloudWatcher: {
    inputPath: string
    outputPath: string
    jobs: Array<{
      fileName: string
      status: string
      message: string
      progress: number
      detectedAt?: number
      sourcePath?: string
      revisionKey?: string
      jobId?: string
    }>
  }
}
