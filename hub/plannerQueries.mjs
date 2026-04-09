import {
  getDashboardView,
  getPlannerBoard,
  getPlannerMetrics,
  listBoardColumns,
  listBoardWorkItems,
  listGoals,
  listPlannerActions,
  listPlannerBoards,
  listViewWidgets
} from './plannerStore.mjs'

function todayItems(workItems, today) {
  return workItems
    .filter((item) => item.status !== 'done' && item.focusDate === today)
    .sort((left, right) => {
      const leftTime = left.scheduledStartAt ?? `${left.focusDate ?? today}T23:59:59`
      const rightTime = right.scheduledStartAt ?? `${right.focusDate ?? today}T23:59:59`
      return leftTime.localeCompare(rightTime)
    })
}

function inProgressItems(workItems) {
  return workItems
    .filter((item) => item.status === 'in_progress')
    .sort((left, right) => {
      const leftTime = left.scheduledStartAt ?? left.createdAt
      const rightTime = right.scheduledStartAt ?? right.createdAt
      return leftTime.localeCompare(rightTime)
    })
}

function importanceWeight(importance) {
  if (importance === 'critical') return 3
  if (importance === 'high') return 2
  if (importance === 'normal') return 1
  return 0
}

function carryOverItems(workItems, today) {
  return workItems
    .filter((item) => item.status !== 'done' && item.focusDate && item.focusDate < today)
    .sort((left, right) => {
      const leftTime = left.scheduledStartAt ?? left.focusDate ?? left.createdAt
      const rightTime = right.scheduledStartAt ?? right.focusDate ?? right.createdAt
      return leftTime.localeCompare(rightTime)
    })
}

function followUpItems(workItems, today) {
  return workItems
    .filter((item) => item.status !== 'done' && ['follow_up', 'avoidance'].includes(item.frictionType))
    .sort((left, right) => {
      const leftOverdue = left.focusDate && left.focusDate < today ? 1 : 0
      const rightOverdue = right.focusDate && right.focusDate < today ? 1 : 0
      if (leftOverdue !== rightOverdue) return rightOverdue - leftOverdue

      const importanceDelta = importanceWeight(right.importance) - importanceWeight(left.importance)
      if (importanceDelta !== 0) return importanceDelta

      return left.createdAt.localeCompare(right.createdAt)
    })
}

function resolveWidgetData(widget, context) {
  if (widget.widgetType === 'today') {
    return {
      items: todayItems(context.workItems, context.metrics.today),
      carryOver: carryOverItems(context.workItems, context.metrics.today)
    }
  }

  if (widget.widgetType === 'in_progress') {
    return {
      items: inProgressItems(context.workItems)
    }
  }

  if (widget.widgetType === 'follow_ups') {
    return {
      items: followUpItems(context.workItems, context.metrics.today)
    }
  }

  if (widget.widgetType === 'goals') {
    return {
      goals: context.goals
    }
  }

  if (widget.widgetType === 'weekly_progress') {
    return {
      summary: {
        completedTodayCount: context.metrics.completedTodayCount,
        completedThisWeekCount: context.metrics.completedThisWeekCount,
        carryOverCount: context.metrics.carryOverCount,
        inProgressCount: context.metrics.inProgressCount
      }
    }
  }

  if (widget.widgetType === 'quick_actions') {
    return {
      actions: context.actions.filter((action) => action.scope === 'dashboard')
    }
  }

  if (widget.widgetType === 'board_summary') {
    return {
      boards: context.boards
    }
  }

  return {}
}

function buildWidget(widget, context) {
  return {
    id: widget.id,
    widgetType: widget.widgetType,
    title: widget.title,
    layout: widget.layout,
    data: resolveWidgetData(widget, context),
    actions: widget.widgetType === 'quick_actions' ? context.actions.filter((action) => action.scope === 'dashboard') : []
  }
}

export function getPlannerDashboardPayload({ mode = 'desktop' } = {}) {
  const view = getDashboardView(mode)
  if (!view) {
    throw new Error(`Unknown planner dashboard mode: ${mode}`)
  }

  const boards = listPlannerBoards()
  const workItems = boards.flatMap((board) => listBoardWorkItems(board.id))
  const goals = listGoals()
  const metrics = getPlannerMetrics()
  const actions = listPlannerActions()
  const widgets = listViewWidgets(view.id)
  const context = {
    boards,
    workItems,
    goals,
    metrics,
    actions
  }

  return {
    view,
    widgets: widgets.map((widget) => buildWidget(widget, context)),
    summary: {
      inProgressCount: metrics.inProgressCount,
      completedTodayCount: metrics.completedTodayCount,
      completedThisWeekCount: metrics.completedThisWeekCount,
      carryOverCount: metrics.carryOverCount
    },
    boards
  }
}

export function getPlannerBoardPayload(identifier) {
  const board = getPlannerBoard(identifier)
  if (!board) {
    throw new Error(`Unknown planner board: ${identifier}`)
  }

  const columns = listBoardColumns(board.id)
  const workItems = listBoardWorkItems(board.id)
  const itemsByColumn = new Map(columns.map((column) => [column.id, []]))

  for (const item of workItems) {
    const bucket = itemsByColumn.get(item.columnId)
    if (bucket) bucket.push(item)
  }

  return {
    board,
    columns: columns.map((column) => ({
      ...column,
      workItems: (itemsByColumn.get(column.id) ?? []).sort((left, right) => {
        const leftTime = left.scheduledStartAt ?? left.focusDate ?? left.createdAt
        const rightTime = right.scheduledStartAt ?? right.focusDate ?? right.createdAt
        return leftTime.localeCompare(rightTime)
      })
    })),
    summary: {
      totalCount: workItems.length,
      inProgressCount: workItems.filter((item) => item.status === 'in_progress').length,
      completedCount: workItems.filter((item) => item.status === 'done').length,
      focusedCount: workItems.filter((item) => item.focusDate).length
    }
  }
}
