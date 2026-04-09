import {
  isAudienceNodeData,
  isProblemNodeData,
  type AudienceNodeData,
  type GraphDocument,
  type GraphNode,
  type OutreachProjection,
  type ProblemNodeData
} from '../types/graph'

function isAudienceNode(
  node: GraphNode
): node is GraphNode & { data: AudienceNodeData; type: 'audience' } {
  return node.type === 'audience' && isAudienceNodeData(node.data)
}

function isProblemNode(
  node: GraphNode
): node is GraphNode & { data: ProblemNodeData; type: 'problem' } {
  return node.type === 'problem' && isProblemNodeData(node.data)
}

export function projectGraphToOutreach(graph: GraphDocument): OutreachProjection {
  const parentByTarget = new Map<string, string>()

  for (const edge of graph.edges) {
    parentByTarget.set(edge.target, edge.source)
  }

  const audiences = graph.nodes
    .filter(isAudienceNode)
    .map((node) => ({
      id: node.id,
      project: graph.project.id,
      parentId: parentByTarget.get(node.id) ?? '',
      name: node.data.name,
      relevanceWhy: node.data.relevanceWhy,
      confidenceLevel: node.data.confidenceLevel,
      status: node.data.status,
      notes: node.data.notes ?? '',
      tags: node.data.tags ?? []
    }))

  const problems = graph.nodes
    .filter(isProblemNode)
    .map((node) => ({
      id: node.id,
      project: graph.project.id,
      parentAudienceId: parentByTarget.get(node.id) ?? '',
      name: node.data.name,
      confidenceLevel: node.data.confidenceLevel,
      status: node.data.status,
      notes: node.data.notes ?? '',
      tags: node.data.tags ?? []
    }))

  const outreach = (graph.outreach ?? []).map((entry) => ({
    id: entry.id,
    project: entry.project || graph.project.id,
    audienceId: entry.audienceId,
    channel: entry.channel,
    community: entry.community,
    url: entry.url,
    angle: entry.angle,
    status: entry.status,
    notes: entry.notes
  }))

  const content = (graph.content ?? []).map((entry) => ({
    id: entry.id,
    project: entry.project || graph.project.id,
    audienceId: entry.audienceId,
    outreachId: entry.outreachId,
    platform: entry.platform,
    title: entry.title,
    body: entry.body,
    docLink: entry.docLink,
    status: entry.status
  }))

  const feedback = (graph.feedback ?? []).map((entry) => ({
    id: entry.id,
    project: entry.project || graph.project.id,
    audienceId: entry.audienceId,
    contentId: entry.contentId,
    outreachId: entry.outreachId,
    source: entry.source,
    summary: entry.summary,
    nextStep: entry.nextStep,
    status: entry.status
  }))

  return { audiences, problems, outreach, content, feedback }
}
