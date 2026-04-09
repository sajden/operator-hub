import {
  createPlannerActionRun,
  getPlannerAction,
  getPlannerWorkItem,
  listPlannerActions
} from './plannerStore.mjs'

function buildFollowUpDraft(item) {
  const details = item.details ? `\n\n${item.details}` : ''
  return `Hej,\n\nJag följer upp kring ${item.title.toLowerCase()}.${details}\n\nHör gärna av dig om det passar att ta nästa steg denna vecka.\n\nVänliga hälsningar`
}

export function getAvailablePlannerActions({ scope } = {}) {
  if (!scope) return listPlannerActions()
  return listPlannerActions(scope)
}

export function runPlannerAction({ actionId, source }) {
  const action = getPlannerAction(actionId)
  if (!action || !action.enabled) {
    return createPlannerActionRun({
      actionId,
      sourceType: source?.type ?? 'dashboard',
      sourceId: source?.id ?? null,
      status: 'failed',
      errorMessage: `Unknown or disabled action: ${actionId}`,
      artifacts: []
    })
  }

  if (action.actionType === 'open_tv_view') {
    return createPlannerActionRun({
      actionId,
      sourceType: source?.type ?? 'dashboard',
      sourceId: source?.id ?? null,
      status: 'succeeded',
      resultSummary: 'TV wallboard is ready to open.',
      artifacts: [
        {
          type: 'link',
          label: 'TV view',
          href: '/tv'
        }
      ]
    })
  }

  if (action.actionType === 'draft_message') {
    const item = source?.id ? getPlannerWorkItem(source.id) : null
    if (!item) {
      return createPlannerActionRun({
        actionId,
        sourceType: source?.type ?? 'work_item',
        sourceId: source?.id ?? null,
        status: 'failed',
        errorMessage: 'No work item was available to draft from.',
        artifacts: []
      })
    }

    return createPlannerActionRun({
      actionId,
      sourceType: source.type,
      sourceId: source.id,
      status: 'succeeded',
      resultSummary: `Draft prepared for ${item.title}.`,
      artifacts: [
        {
          type: 'text',
          label: 'Draft',
          content: buildFollowUpDraft(item)
        }
      ]
    })
  }

  if (action.actionType === 'summarize_context') {
    const item = source?.id ? getPlannerWorkItem(source.id) : null
    const summary = item
      ? `${item.title}. Importance: ${item.importance}. Current status: ${item.status}.`
      : 'No item context was provided.'

    return createPlannerActionRun({
      actionId,
      sourceType: source?.type ?? 'dashboard',
      sourceId: source?.id ?? null,
      status: item ? 'succeeded' : 'failed',
      resultSummary: item ? 'Context summary prepared.' : 'Unable to summarize without a work item.',
      errorMessage: item ? null : 'No work item was available to summarize.',
      artifacts: item
        ? [
            {
              type: 'text',
              label: 'Summary',
              content: summary
            }
          ]
        : []
    })
  }

  return createPlannerActionRun({
    actionId,
    sourceType: source?.type ?? 'dashboard',
    sourceId: source?.id ?? null,
    status: 'failed',
    errorMessage: `Unhandled action type: ${action.actionType}`,
    artifacts: []
  })
}
