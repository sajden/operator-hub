export type NodeType = 'project' | 'audience' | 'problem'
export type ConfidenceLevel = 'hypotes' | 'svag' | 'stark'
export type NodeStatus = 'new' | 'researching' | 'validated'

export interface ProjectMetadata {
  id: string
  name: string
  summary: string
  strengths: string[]
  integrations?: ProjectIntegrations
}

export interface MicrosoftFolderBinding {
  windowsSyncPath?: string
  shortcutItemId?: string
  driveId?: string
  rootItemId?: string
  path?: string
  siteUrl?: string
  libraryName?: string
  defaultWorkbookFileId?: string
}

export interface ProjectIntegrations {
  microsoft?: {
    excelFolder?: MicrosoftFolderBinding
  }
}

export interface Position {
  x: number
  y: number
}

export interface ProjectNodeData {
  name: string
  summary: string
  strengths: string[]
  notes?: string
  tags?: string[]
  updatedAt?: string
}

export interface AudienceNodeData {
  name: string
  relevanceWhy: string
  confidenceLevel: ConfidenceLevel
  status: NodeStatus
  notes?: string
  tags?: string[]
  updatedAt?: string
}

export interface ProblemNodeData {
  name: string
  confidenceLevel: ConfidenceLevel
  status: NodeStatus
  notes?: string
  tags?: string[]
  updatedAt?: string
}

export type GraphNodeData = ProjectNodeData | AudienceNodeData | ProblemNodeData

export interface GraphNode {
  id: string
  type: NodeType
  position: Position
  data: GraphNodeData
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  relationshipType?: string
}

export interface GraphOutreachEntry {
  id: string
  project: string
  audienceId: string
  channel: string
  community: string
  url?: string
  angle: string
  status: string
  notes: string
}

export interface GraphContentEntry {
  id: string
  project: string
  audienceId: string
  outreachId?: string
  platform: string
  title: string
  body: string
  docLink?: string
  status: string
  sentAt?: string
  postedChannel?: string
  postUrl?: string
}

export interface GraphFeedbackEntry {
  id: string
  project: string
  audienceId: string
  contentId: string
  outreachId?: string
  source: string
  summary: string
  nextStep?: string
  status: string
}

export interface GraphDocument {
  project: ProjectMetadata
  nodes: GraphNode[]
  edges: GraphEdge[]
  outreach?: GraphOutreachEntry[]
  content?: GraphContentEntry[]
  feedback?: GraphFeedbackEntry[]
}

export interface SaveGraphResult {
  ok: boolean
  message: string
  sync?: {
    fileId: string
    audiences?: {
      syncedRowCount: number
    }
    problems?: {
      syncedRowCount: number
    }
    outreach?: {
      syncedRowCount: number
    }
    content?: {
      syncedRowCount: number
    }
    feedback?: {
      syncedRowCount: number
    }
  }
}

export interface OutreachAudienceRow {
  id: string
  project: string
  parentId: string
  name: string
  relevanceWhy: string
  confidenceLevel: ConfidenceLevel
  status: NodeStatus
  notes: string
  tags: string[]
}

export interface OutreachProblemRow {
  id: string
  project: string
  parentAudienceId: string
  name: string
  confidenceLevel: ConfidenceLevel
  status: NodeStatus
  notes: string
  tags: string[]
}

export interface OutreachProjection {
  audiences: OutreachAudienceRow[]
  problems: OutreachProblemRow[]
  outreach: GraphOutreachEntry[]
  content: GraphContentEntry[]
  feedback: GraphFeedbackEntry[]
}

export function isProjectNodeData(data: GraphNodeData): data is ProjectNodeData {
  return 'summary' in data && 'strengths' in data
}

export function isAudienceNodeData(data: GraphNodeData): data is AudienceNodeData {
  return 'relevanceWhy' in data && 'confidenceLevel' in data
}

export function isProblemNodeData(data: GraphNodeData): data is ProblemNodeData {
  return !('relevanceWhy' in data) && 'confidenceLevel' in data && 'name' in data
}

export function isNodeType(value: string): value is NodeType {
  return value === 'project' || value === 'audience' || value === 'problem'
}
