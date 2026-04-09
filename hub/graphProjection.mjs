export function buildParentMap(edges) {
  const parentByTarget = new Map()

  for (const edge of edges) {
    if (typeof edge?.source === 'string' && typeof edge?.target === 'string') {
      parentByTarget.set(edge.target, edge.source)
    }
  }

  return parentByTarget
}

export function projectGraph(graph) {
  const projectId = String(graph.project?.id ?? '')
  const parentByTarget = buildParentMap(graph.edges ?? [])

  const audiences = []
  const problems = []
  const outreach = []
  const content = []
  const feedback = []

  for (const node of graph.nodes ?? []) {
    const data = node?.data
    if (!data || typeof data !== 'object') continue

    if (node.type === 'audience') {
      audiences.push({
        id: node.id ?? '',
        project: projectId,
        parent_id: parentByTarget.get(String(node.id ?? '')) ?? '',
        name: data.name ?? '',
        relevance_why: data.relevanceWhy ?? '',
        confidence_level: data.confidenceLevel ?? '',
        status: data.status ?? '',
        notes: data.notes ?? '',
        tags: Array.isArray(data.tags) ? data.tags : []
      })
    }

    if (node.type === 'problem') {
      problems.push({
        id: node.id ?? '',
        project: projectId,
        parent_audience_id: parentByTarget.get(String(node.id ?? '')) ?? '',
        name: data.name ?? '',
        confidence_level: data.confidenceLevel ?? '',
        status: data.status ?? '',
        notes: data.notes ?? '',
        tags: Array.isArray(data.tags) ? data.tags : []
      })
    }
  }

  for (const entry of graph.outreach ?? []) {
    if (!entry || typeof entry !== 'object') continue

    outreach.push({
      id: entry.id ?? '',
      project: entry.project ?? projectId,
      audience_id: entry.audienceId ?? '',
      channel: entry.channel ?? '',
      community: entry.community ?? '',
      angle: entry.angle ?? '',
      status: entry.status ?? '',
      notes: entry.notes ?? ''
    })
  }

  for (const entry of graph.content ?? []) {
    if (!entry || typeof entry !== 'object') continue

    content.push({
      id: entry.id ?? '',
      project: entry.project ?? projectId,
      audience_id: entry.audienceId ?? '',
      outreach_id: entry.outreachId ?? '',
      platform: entry.platform ?? '',
      title: entry.title ?? '',
      body: entry.body ?? '',
      doc_link: entry.docLink ?? '',
      status: entry.status ?? '',
      sent_at: entry.sentAt ?? '',
      posted_channel: entry.postedChannel ?? '',
      post_url: entry.postUrl ?? ''
    })
  }

  for (const entry of graph.feedback ?? []) {
    if (!entry || typeof entry !== 'object') continue

    feedback.push({
      id: entry.id ?? '',
      project: entry.project ?? projectId,
      audience_id: entry.audienceId ?? '',
      content_id: entry.contentId ?? '',
      outreach_id: entry.outreachId ?? '',
      source: entry.source ?? '',
      summary: entry.summary ?? '',
      next_step: entry.nextStep ?? '',
      status: entry.status ?? ''
    })
  }

  return { audiences, problems, outreach, content, feedback }
}
