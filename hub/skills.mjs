function topAudiences(projection) {
  return projection.audiences.map((audience) => ({
    id: audience.id,
    name: audience.name,
    confidence: audience.confidence_level,
    status: audience.status,
    problemCount: projection.problems.filter((problem) => problem.parent_audience_id === audience.id).length
  }))
}

export function getSkills() {
  return [
    {
      name: 'prepare_site_media_package',
      description:
        'Prepare a bounded media package for site-building workflows by collecting approved owner media and optionally searching stock candidates.',
      inputSchema: {
        type: 'object',
        properties: {
          projectSlug: { type: 'string' },
          approvedUrls: { type: 'array', items: { type: 'string' } },
          approvedLocalPaths: { type: 'array', items: { type: 'string' } },
          ownerAssetTypes: { type: 'array', items: { type: 'string' } },
          ownerMaxAssets: { type: 'number' },
          stockQuery: { type: 'string' },
          stockProviders: { type: 'array', items: { type: 'string' } },
          stockOrientation: { type: 'string' },
          stockMaxResults: { type: 'number' }
        },
        required: ['projectSlug']
      }
    },
    {
      name: 'summarize_project_hypotheses',
      description: 'Summarize the current project hypotheses from the graph and outreach projection.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'suggest_next_outreach_steps',
      description: 'Generate practical next-step suggestions from current audiences and problems.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'find_communities_for_audience',
      description:
        'Build a structured community research plan for an audience, including likely platforms, search queries, and starter hypotheses.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          audienceId: { type: 'string' },
          market: { type: 'string' }
        },
        required: ['projectId', 'audienceId']
      }
    },
    {
      name: 'sync_audiences_to_excel',
      description:
        'Sync the graph-derived audience projection into the Audiences sheet of a selected project workbook.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          fileId: { type: 'string' }
        },
        required: ['projectId', 'fileId']
      }
    },
    {
      name: 'sync_problems_to_excel',
      description:
        'Sync the graph-derived problem projection into the Problems sheet of a selected project workbook.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          fileId: { type: 'string' }
        },
        required: ['projectId', 'fileId']
      }
    },
    {
      name: 'sync_project_workbook',
      description:
        'Sync the graph-derived audience, problem, and outreach projection into the bound project workbook.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          fileId: { type: 'string' }
        },
        required: ['projectId', 'fileId']
      }
    },
    {
      name: 'sync_outreach_to_excel',
      description:
        'Sync the graph-derived outreach projection into the Outreach sheet of a selected project workbook.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          fileId: { type: 'string' }
        },
        required: ['projectId', 'fileId']
      }
    }
  ]
}

export function buildAudienceSyncMatrix(projection, options = {}) {
  const headers = [
    'id',
    'project',
    'name',
    'parent_id',
    'relevance_why',
    'confidence_level',
    'status',
    'notes',
    'tags'
  ]

  const rows = projection.audiences.map((audience) => [
    audience.id,
    audience.project,
    audience.name,
    audience.parent_id,
    audience.relevance_why,
    audience.confidence_level,
    audience.status,
    audience.notes,
    Array.isArray(audience.tags) ? audience.tags.join(', ') : ''
  ])

  const minimumRows = Math.max(Number(options.minimumRows ?? 25), rows.length + 1)
  const matrix = [headers, ...rows]

  while (matrix.length < minimumRows) {
    matrix.push(new Array(headers.length).fill(''))
  }

  return {
    headers,
    rowCount: matrix.length,
    columnCount: headers.length,
    values: matrix
  }
}

export function buildProblemSyncMatrix(projection, options = {}) {
  const headers = [
    'id',
    'project',
    'parent_audience_id',
    'name',
    'confidence_level',
    'status',
    'notes',
    'tags'
  ]

  const rows = projection.problems.map((problem) => [
    problem.id,
    problem.project,
    problem.parent_audience_id,
    problem.name,
    problem.confidence_level,
    problem.status,
    problem.notes,
    Array.isArray(problem.tags) ? problem.tags.join(', ') : ''
  ])

  const minimumRows = Math.max(Number(options.minimumRows ?? 25), rows.length + 1)
  const matrix = [headers, ...rows]

  while (matrix.length < minimumRows) {
    matrix.push(new Array(headers.length).fill(''))
  }

  return {
    headers,
    rowCount: matrix.length,
    columnCount: headers.length,
    values: matrix
  }
}

export function buildOutreachSyncMatrix(projection, options = {}) {
  const headers = ['id', 'project', 'audience_id', 'channel', 'community', 'angle', 'status', 'notes']

  const rows = projection.outreach.map((entry) => [
    entry.id,
    entry.project,
    entry.audience_id,
    entry.channel,
    entry.community,
    entry.angle,
    entry.status,
    entry.notes
  ])

  const minimumRows = Math.max(Number(options.minimumRows ?? 25), rows.length + 1)
  const matrix = [headers, ...rows]

  while (matrix.length < minimumRows) {
    matrix.push(new Array(headers.length).fill(''))
  }

  return {
    headers,
    rowCount: matrix.length,
    columnCount: headers.length,
    values: matrix
  }
}

export function buildContentSyncMatrix(projection, options = {}) {
  const headers = [
    'id',
    'project',
    'audience_id',
    'outreach_id',
    'platform',
    'title',
    'body',
    'doc_link',
    'status',
    'sent_at',
    'posted_channel',
    'post_url'
  ]

  const rows = (projection.content ?? []).map((entry) => [
    entry.id,
    entry.project,
    entry.audience_id,
    entry.outreach_id,
    entry.platform,
    entry.title,
    entry.body,
    entry.doc_link,
    entry.status,
    entry.sent_at ?? '',
    entry.posted_channel ?? '',
    entry.post_url ?? ''
  ])

  const minimumRows = Math.max(Number(options.minimumRows ?? 25), rows.length + 1)
  const matrix = [headers, ...rows]

  while (matrix.length < minimumRows) {
    matrix.push(new Array(headers.length).fill(''))
  }

  return {
    headers,
    rowCount: matrix.length,
    columnCount: headers.length,
    values: matrix
  }
}

export function buildFeedbackSyncMatrix(projection, options = {}) {
  const headers = ['id', 'project', 'audience_id', 'content_id', 'outreach_id', 'source', 'summary', 'next_step', 'status']

  const rows = (projection.feedback ?? []).map((entry) => [
    entry.id,
    entry.project,
    entry.audience_id,
    entry.content_id,
    entry.outreach_id,
    entry.source,
    entry.summary,
    entry.next_step ?? '',
    entry.status
  ])

  const minimumRows = Math.max(Number(options.minimumRows ?? 25), rows.length + 1)
  const matrix = [headers, ...rows]

  while (matrix.length < minimumRows) {
    matrix.push(new Array(headers.length).fill(''))
  }

  return {
    headers,
    rowCount: matrix.length,
    columnCount: headers.length,
    values: matrix
  }
}

export function summarizeProjectHypotheses(projectId, graph, projection) {
  const audiences = topAudiences(projection)
  const problems = projection.problems.map((problem) => ({
    id: problem.id,
    name: problem.name,
    audienceId: problem.parent_audience_id,
    confidence: problem.confidence_level,
    status: problem.status
  }))

  return {
    projectId,
    projectName: graph.project?.name ?? projectId,
    summary: graph.project?.summary ?? '',
    keyStrengths: Array.isArray(graph.project?.strengths) ? graph.project.strengths : [],
    audienceHypotheses: audiences,
    problemHypotheses: problems,
    interpretation: [
      `${audiences.length} audience hypothesis/hypotheses are currently mapped.`,
      `${problems.length} problem hypothesis/hypotheses are attached to those audiences.`,
      'Treat low-confidence or new nodes as discovery targets rather than settled truth.'
    ]
  }
}

export function suggestNextOutreachSteps(projectId, graph, projection) {
  const audiences = topAudiences(projection)

  const suggestions = audiences.flatMap((audience) => {
    const problems = projection.problems.filter((problem) => problem.parent_audience_id === audience.id)
    const firstProblem = problems[0]
    const steps = [
      {
        type: 'validate_audience',
        audienceId: audience.id,
        title: `Validate ${audience.name} as a target audience`,
        why: `Audience is currently ${audience.confidence} / ${audience.status}.`
      }
    ]

    if (firstProblem) {
      steps.push({
        type: 'message_angle',
        audienceId: audience.id,
        relatedProblemId: firstProblem.id,
        title: `Draft one outreach angle around "${firstProblem.name}"`,
        why: 'Use the strongest visible problem branch to create a focused first message.'
      })
    }

    steps.push({
      type: 'channel_research',
      audienceId: audience.id,
      title: `List 3 communities or channels for ${audience.name}`,
      why: 'The graph currently captures audiences/problems but not channel hypotheses yet.'
    })

    return steps
  })

  return {
    projectId,
    projectName: graph.project?.name ?? projectId,
    nextSteps: suggestions.slice(0, 6)
  }
}

export function findCommunitiesForAudience(projectId, graph, projection, options = {}) {
  const audienceId = options.audienceId
  const market = options.market ?? 'Sverige'
  const audience = projection.audiences.find((item) => item.id === audienceId)

  if (!audience) {
    throw new Error(`Unknown audience: ${audienceId}`)
  }

  const relatedProblems = projection.problems
    .filter((problem) => problem.parent_audience_id === audienceId)
    .map((problem) => problem.name)

  const existingOutreach = projection.outreach.filter((entry) => entry.audience_id === audienceId)

  const communityHypotheses = [
    {
      platform: 'forum',
      label: `${audience.name} forum`,
      why: 'Forum passar bra för långa praktiska diskussioner om vardagsproblem och konkreta workarounds.',
      searchQueries: [
        `${audience.name} forum ${market}`,
        `elbilsforum ${market}`,
        `${audience.name} laddning parkering forum`
      ]
    },
    {
      platform: 'facebook',
      label: `${audience.name} Facebook-grupper`,
      why: 'Facebook-grupper är ofta bra för svenska nischade communities och snabb discovery.',
      searchQueries: [
        `${audience.name} facebook grupp ${market}`,
        `elbil sverige facebook grupp`,
        `${audience.name} laddning parkering facebook`
      ]
    },
    {
      platform: 'reddit',
      label: `${audience.name} Reddit-spår`,
      why: 'Reddit passar för att snabbt hitta diskussioner, språkbruk och återkommande frustrationspunkter.',
      searchQueries: [
        `${audience.name} reddit`,
        `electric vehicles sweden reddit`,
        `${audience.name} charging parking reddit`
      ]
    },
    {
      platform: 'linkedin',
      label: `${audience.name} LinkedIn-spår`,
      why: 'LinkedIn är relevant när målgruppen också påverkas av operatörer, mobilitet eller B2B-beslut.',
      searchQueries: [
        `${audience.name} linkedin ${market}`,
        `ev charging parking linkedin ${market}`,
        `mobilitet laddning parkering linkedin`
      ]
    },
    {
      platform: 'newsletter',
      label: `${audience.name} nyhetsbrev och redaktörer`,
      why: 'Bra senare kanal när ett budskap eller en liten story redan börjar sätta sig.',
      searchQueries: [
        `${audience.name} nyhetsbrev ${market}`,
        `elbil nyhetsbrev sverige`,
        `${audience.name} community editor`
      ]
    }
  ]

  return {
    projectId,
    projectName: graph.project?.name ?? projectId,
    audience: {
      id: audience.id,
      name: audience.name,
      relevanceWhy: audience.relevance_why,
      confidence: audience.confidence_level,
      status: audience.status
    },
    market,
    relatedProblems,
    existingOutreach,
    researchGoal: `Identifiera relevanta communities och kanaler där ${audience.name.toLowerCase()} faktiskt diskuterar sina vardagsproblem.`,
    communityHypotheses,
    nextActions: [
      `Verifiera 3-5 konkreta communities för ${audience.name}.`,
      'Notera URL, storlek, aktivitet och ton i varje community.',
      'Välj 1-2 communities för första discovery-outreach.'
    ]
  }
}
