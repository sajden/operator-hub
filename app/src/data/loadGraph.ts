import graphData from '../../../projects/parkpal/data/graph.json'
import { projectGraphToOutreach } from './projectGraph'
import { apiPath } from './runtimePaths'
import type { GraphDocument, OutreachProjection, SaveGraphResult } from '../types/graph'

const PROJECT_ID = 'parkpal'
const GRAPH_ENDPOINT = apiPath(`/projects/${PROJECT_ID}/graph`)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export type GraphLoadSource = 'hub' | 'fallback'

export interface GraphLoadResult {
  graph: GraphDocument
  source: GraphLoadSource
}

export function validateGraphDocument(raw: unknown): GraphDocument {
  if (!isRecord(raw) || !('project' in raw) || !('nodes' in raw) || !('edges' in raw)) {
    throw new Error('Invalid graph document: expected top-level project, nodes, and edges')
  }

  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
    throw new Error('Invalid graph document: nodes and edges must be arrays')
  }

  return raw as unknown as GraphDocument
}

export async function loadParkpalGraph(): Promise<GraphLoadResult> {
  try {
    const response = await fetch(GRAPH_ENDPOINT)
    if (!response.ok) {
      throw new Error(`Graph load failed with status ${response.status}`)
    }

    const raw = (await response.json()) as unknown
    return {
      graph: validateGraphDocument(raw),
      source: 'hub'
    }
  } catch {
    return {
      graph: validateGraphDocument(graphData as unknown),
      source: 'fallback'
    }
  }
}

export async function saveParkpalGraph(graph: GraphDocument): Promise<SaveGraphResult> {
  validateGraphDocument(graph)

  const response = await fetch(GRAPH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(graph, null, 2)
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Save failed with status ${response.status}`)
  }

  return (await response.json()) as SaveGraphResult
}

export async function loadParkpalOutreachProjection(graph?: GraphDocument): Promise<OutreachProjection> {
  return projectGraphToOutreach(graph ?? validateGraphDocument(graphData as unknown))
}
