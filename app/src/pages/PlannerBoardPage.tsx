import { useEffect, useState } from 'react'
import ActionResultPanel from '../components/planner/ActionResultPanel'
import BoardColumn from '../components/planner/BoardColumn'
import BoardHeader from '../components/planner/BoardHeader'
import PlannerQuickCreate from '../components/planner/PlannerQuickCreate'
import PlannerInspector from '../components/shell/PlannerInspector'
import PlannerSidebar from '../components/shell/PlannerSidebar'
import PlannerTopbar from '../components/shell/PlannerTopbar'
import { plannerSyncWindow } from '../data/calendarSyncWindow'
import { markAutoImportRun, readLastAutoImportRun, shouldRunAutoImport } from '../data/plannerPreferences'
import {
  createPlannerWorkItem,
  deletePlannerWorkItem,
  importMicrosoftCalendarToPlanner,
  loadPlannerBoard,
  movePlannerWorkItem,
  runPlannerAction,
  syncPlannerWorkItemToMicrosoftCalendar,
  updatePlannerWorkItem
} from '../data/plannerClient'
import type { PlannerActionRun, PlannerBoardPayload, PlannerWorkItem } from '../types/planner'

interface PlannerBoardPageProps {
  boardId: string
  onNavigate: (path: string) => void
  theme: 'light' | 'dark' | string
  onSetTheme: (theme: 'light' | 'dark') => void
}

function localDayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function timestampDayKey(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return localDayKey(date)
}

function effectiveRecurrenceRule(item: PlannerWorkItem) {
  if (item.recurrenceRule && item.recurrenceRule !== 'none') return item.recurrenceRule
  if (String(item.externalEventId ?? '').startsWith('series-summary:')) return 'daily'
  return 'none'
}

function weekdayNumber(dayKey: string) {
  return new Date(`${dayKey}T12:00:00`).getDay()
}

function recurrenceAppliesOnDay(item: PlannerWorkItem, dayKey: string) {
  const rule = effectiveRecurrenceRule(item)
  if (rule === 'none') return false
  if (rule === 'daily') return true
  if (rule === 'weekdays') return ![0, 6].includes(weekdayNumber(dayKey))
  if (rule === 'weekly') {
    const anchor = item.focusDate ?? item.dueDate ?? item.createdAt.slice(0, 10)
    return weekdayNumber(anchor) === weekdayNumber(dayKey)
  }
  return false
}

function isCalendarSeriesSummary(item: PlannerWorkItem) {
  return item.recurrenceSource === 'calendar' && String(item.externalEventId ?? '').startsWith('series-summary:')
}

function shouldProjectRecurringItem(item: PlannerWorkItem, dayKey: string) {
  if (!isCalendarSeriesSummary(item)) return item.status !== 'done'
  const completedDay = timestampDayKey(item.completedAt)
  return completedDay !== dayKey
}

function syncStatusLabel(scope: string) {
  const lastRun = readLastAutoImportRun(scope)
  if (!lastRun) return null
  return `M365 synced ${new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' }).format(lastRun)}`
}

function persistedWorkItemId(itemId: string) {
  return itemId.split('::projected:')[0]
}

export default function PlannerBoardPage({ boardId, onNavigate, theme, onSetTheme }: PlannerBoardPageProps) {
  const [payload, setPayload] = useState<PlannerBoardPayload | null>(null)
  const [lastRun, setLastRun] = useState<PlannerActionRun | null>(null)
  const [draggedItem, setDraggedItem] = useState<PlannerWorkItem | null>(null)
  const [dropTargetColumnId, setDropTargetColumnId] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<PlannerWorkItem | null>(null)
  const [signal, setSignal] = useState<'all' | 'follow_up' | 'avoidance' | 'high_priority'>('all')
  const [lastSyncLabel, setLastSyncLabel] = useState<string | null>(syncStatusLabel('board-daily'))

  async function refresh(runAutoSync = true) {
    if (runAutoSync && boardId === 'daily' && shouldRunAutoImport('board-daily', 120_000)) {
      try {
        const { startDateTime, endDateTime } = plannerSyncWindow(14)
        await importMicrosoftCalendarToPlanner({
          boardId: 'board-daily',
          startDateTime,
          endDateTime
        })
        markAutoImportRun('board-daily')
        setLastSyncLabel(syncStatusLabel('board-daily'))
      } catch {
        // Keep the board usable even if Microsoft is disconnected.
      }
    }
    setPayload(await loadPlannerBoard(boardId))
  }

  useEffect(() => {
    void refresh()
  }, [boardId])

  useEffect(() => {
    if (boardId !== 'daily') return undefined

    const timer = window.setInterval(() => {
      void refresh()
    }, 120_000)

    return () => window.clearInterval(timer)
  }, [boardId])

  async function handleMove(item: PlannerWorkItem, columnId: string, focusDate?: string | null) {
    await movePlannerWorkItem(persistedWorkItemId(item.id), { columnId, focusDate })
    await refresh(false)
  }

  async function handleCreateInInbox(input: {
    title: string
    date?: string
    time?: string
    importance?: PlannerWorkItem['importance']
    frictionType?: PlannerWorkItem['frictionType']
    recurrenceRule?: PlannerWorkItem['recurrenceRule']
  }) {
    const targetDate = input.date ?? undefined
    const scheduledStartAt = targetDate && input.time ? `${targetDate}T${input.time}:00` : undefined
    const scheduledEndAt = scheduledStartAt ? new Date(`${scheduledStartAt}.000Z`) : null

    if (scheduledEndAt) {
      scheduledEndAt.setUTCMinutes(scheduledEndAt.getUTCMinutes() + 30)
    }

    await createPlannerWorkItem({
      boardId: payload?.board.id ?? 'board-daily',
      columnId: 'col-daily-inbox',
      title: input.title,
      details: '',
      importance: input.importance ?? 'normal',
      frictionType: input.frictionType ?? 'neutral',
      recurrenceRule: input.recurrenceRule ?? 'none',
      focusDate: targetDate,
      dueDate: targetDate,
      scheduledStartAt,
      scheduledEndAt: scheduledEndAt ? scheduledEndAt.toISOString().slice(0, 19) : undefined
    })
    await refresh(false)
  }

  async function handleMoveToToday(item: PlannerWorkItem) {
    await movePlannerWorkItem(persistedWorkItemId(item.id), {
      columnId: item.boardId === 'board-daily' ? 'col-daily-today' : 'col-parkpal-today',
      focusDate: localDayKey(new Date())
    })
    await refresh(false)
  }

  async function handleDraftFollowUp(item: PlannerWorkItem) {
    const response = await runPlannerAction({
      actionId: 'action-draft-follow-up',
      source: { type: 'work_item', id: persistedWorkItemId(item.id) }
    })
    setLastRun(response.run)
  }

  async function handleSyncToMicrosoftCalendar(item: PlannerWorkItem) {
    const response = await syncPlannerWorkItemToMicrosoftCalendar(persistedWorkItemId(item.id))
    setSelectedItem(response.workItem)
    await refresh(false)
  }

  async function handleSaveExecutionNote(item: PlannerWorkItem, executionNote: string) {
    const updated = await updatePlannerWorkItem(persistedWorkItemId(item.id), { executionNote })
    setSelectedItem(updated)
    await refresh(false)
  }

  async function handleUpdateItem(
    item: PlannerWorkItem,
    patch: Partial<
      Pick<
        PlannerWorkItem,
        'title' | 'details' | 'focusDate' | 'dueDate' | 'scheduledStartAt' | 'scheduledEndAt' | 'importance' | 'frictionType'
      >
    >
  ) {
    const updated = await updatePlannerWorkItem(persistedWorkItemId(item.id), patch)
    setSelectedItem(updated)
    await refresh(false)
  }

  async function handleDeleteItem(item: PlannerWorkItem) {
    await deletePlannerWorkItem(persistedWorkItemId(item.id))
    setSelectedItem(null)
    await refresh(false)
  }

  async function handleDrop(columnId: string) {
    if (!draggedItem) return
    const focusDate = columnId.includes('-today') ? localDayKey(new Date()) : draggedItem.focusDate
    await handleMove(draggedItem, columnId, focusDate)
    setDraggedItem(null)
    setDropTargetColumnId(null)
  }

  function handleWorkspaceChange(workspace: string) {
    if (workspace === 'dashboard') onNavigate('/')
    if (workspace === 'daily') onNavigate('/boards/daily')
    if (workspace === 'week') onNavigate('/week')
    if (workspace === 'parkpal') onNavigate('/parkpal')
    if (workspace === 'connections') onNavigate('/connections')
    if (workspace === 'skills') onNavigate('/skills')
    if (workspace === 'research') onNavigate('/research')
    if (workspace === 'media') onNavigate('/media')
    if (workspace === 'service-explainer') onNavigate('/service-explainer')
    if (workspace === 'ha') onNavigate('/ha')
    if (workspace === 'tv') onNavigate('/tv')
    if (workspace === 'bg-remover') onNavigate('/bg-remover')
  }

  if (!payload) {
    return <div className="planner-loading-state">Loading board...</div>
  }

  const todayKey = localDayKey(new Date())

  function matchesSignal(item: PlannerWorkItem) {
    if (signal === 'all') return true
    if (signal === 'follow_up') return item.frictionType === 'follow_up'
    if (signal === 'avoidance') return item.frictionType === 'avoidance'
    if (signal === 'high_priority') return item.importance === 'high' || item.importance === 'critical'
    return true
  }

  const filteredPayload = {
    ...payload,
    columns: payload.columns.map((column) => ({
      ...column,
      workItems: column.workItems.filter((item) => {
        if (!matchesSignal(item)) return false

        if (boardId === 'daily' && column.id === 'col-daily-inbox') {
          const scheduledDay = item.scheduledStartAt?.slice(0, 10) ?? item.focusDate ?? item.dueDate ?? null
          return scheduledDay === todayKey
        }

        if (boardId === 'daily' && column.id === 'col-daily-done') {
          return timestampDayKey(item.completedAt) === todayKey
        }

        return true
      })
    }))
  }

  if (boardId === 'daily') {
    const concreteTodaySeriesKeys = new Set(
      filteredPayload.columns
        .flatMap((column) => column.workItems)
        .filter((item) => {
          const dayKey = item.scheduledStartAt?.slice(0, 10) ?? item.focusDate ?? item.dueDate ?? null
          return dayKey === todayKey
        })
        .map((item) => `${item.seriesId ?? item.id}:${todayKey}`)
    )

    const projectedTodayItems = payload.columns
      .flatMap((column) => column.workItems)
      .filter((item) => !item.focusDate && !item.dueDate && !item.scheduledStartAt)
      .filter((item) => shouldProjectRecurringItem(item, todayKey))
      .filter((item) => recurrenceAppliesOnDay(item, todayKey))
      .filter((item) => !concreteTodaySeriesKeys.has(`${item.seriesId ?? item.id}:${todayKey}`))
      .map((item) => ({
        ...item,
        id: `${item.id}::projected:${todayKey}`,
        focusDate: todayKey,
        dueDate: todayKey
      }))

    filteredPayload.columns = filteredPayload.columns.map((column) => {
      if (column.id !== 'col-daily-today') return column
      return {
        ...column,
        workItems: [...column.workItems, ...projectedTodayItems].sort((left, right) => {
          const leftTime = left.scheduledStartAt ?? left.focusDate ?? left.createdAt
          const rightTime = right.scheduledStartAt ?? right.focusDate ?? right.createdAt
          return leftTime.localeCompare(rightTime)
        })
      }
    })
  }

  const workspace = payload.board.linkedDomain === 'parkpal' ? 'parkpal' : 'daily'

  return (
    <div className="planner-app-shell">
      <PlannerSidebar current={workspace} onNavigate={onNavigate} />

      <main className="planner-workspace">
        <PlannerTopbar
          workspace={workspace}
          signal={signal}
          compact
          syncStatusLabel={boardId === 'daily' ? lastSyncLabel : null}
          onWorkspaceChange={handleWorkspaceChange}
          onSignalChange={setSignal}
        />

        <BoardHeader
          payload={payload}
          showDescription={false}
          actionSlot={
            boardId === 'daily' ? (
              <PlannerQuickCreate
                label="New item"
                defaultDate={localDayKey(new Date())}
                onCreate={handleCreateInInbox}
              />
            ) : null
          }
        />

        <section className="planner-board-grid">
          {filteredPayload.columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              selectedItemId={selectedItem?.id}
              onSelectItem={setSelectedItem}
              onMove={handleMove}
              onDraftFollowUp={handleDraftFollowUp}
              draggedItemId={draggedItem?.id ?? null}
              onDragStart={setDraggedItem}
              onDragEnd={() => {
                setDraggedItem(null)
                setDropTargetColumnId(null)
              }}
              onDropItem={handleDrop}
              isDropTarget={dropTargetColumnId === column.id}
              onDropTargetEnter={setDropTargetColumnId}
            />
          ))}
        </section>
        <ActionResultPanel run={lastRun} />
      </main>

      <PlannerInspector
        item={selectedItem}
        boardName={payload.board.name}
        onMoveToToday={handleMoveToToday}
        onStart={(item) => handleMove(item, item.boardId === 'board-daily' ? 'col-daily-progress' : 'col-parkpal-progress')}
        onComplete={(item) => handleMove(item, item.boardId === 'board-daily' ? 'col-daily-done' : 'col-parkpal-done')}
        onDraftFollowUp={handleDraftFollowUp}
        onSyncToMicrosoftCalendar={handleSyncToMicrosoftCalendar}
        onSaveExecutionNote={handleSaveExecutionNote}
        onUpdateItem={handleUpdateItem}
        onDeleteItem={handleDeleteItem}
      />
    </div>
  )
}
