import { useEffect, useState } from 'react'
import ActionResultPanel from '../components/planner/ActionResultPanel'
import FollowUpsWidget from '../components/dashboard/FollowUpsWidget'
import BoardLibraryWidget from '../components/dashboard/BoardLibraryWidget'
import GoalsWidget from '../components/dashboard/GoalsWidget'
import InProgressWidget from '../components/dashboard/InProgressWidget'
import QuickActionsWidget from '../components/dashboard/QuickActionsWidget'
import TodayWidget from '../components/dashboard/TodayWidget'
import WeeklyProgressWidget from '../components/dashboard/WeeklyProgressWidget'
import PlannerInspector from '../components/shell/PlannerInspector'
import PlannerSidebar from '../components/shell/PlannerSidebar'
import PlannerTopbar from '../components/shell/PlannerTopbar'
import { plannerSyncWindow } from '../data/calendarSyncWindow'
import { markAutoImportRun, shouldRunAutoImport } from '../data/plannerPreferences'
import {
  createPlannerBoard,
  createPlannerWorkItem,
  deletePlannerWorkItem,
  importMicrosoftCalendarToPlanner,
  loadPlannerDashboard,
  movePlannerWorkItem,
  runPlannerAction,
  syncPlannerWorkItemToMicrosoftCalendar
  ,
  updatePlannerWorkItem
} from '../data/plannerClient'
import type {
  FollowUpsWidgetData,
  GoalsWidgetData,
  InProgressWidgetData,
  PlannerAction,
  PlannerActionRun,
  PlannerDashboardPayload,
  PlannerWorkItem,
  QuickActionsWidgetData,
  TodayWidgetData,
  WeeklyProgressWidgetData,
  WorkItemRecurrenceRule,
  WorkItemFrictionType,
  WorkItemImportance
} from '../types/planner'

interface OperatorDashboardPageProps {
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

export default function OperatorDashboardPage({ onNavigate, theme, onSetTheme }: OperatorDashboardPageProps) {
  const [payload, setPayload] = useState<PlannerDashboardPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<PlannerActionRun | null>(null)
  const [selectedItem, setSelectedItem] = useState<PlannerWorkItem | null>(null)
  const [signal, setSignal] = useState<'all' | 'follow_up' | 'avoidance' | 'high_priority'>('all')
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importingCalendar, setImportingCalendar] = useState(false)

  async function refresh(runAutoSync = true) {
    try {
      setError(null)
      if (runAutoSync && shouldRunAutoImport('dashboard-daily')) {
        try {
          const { startDateTime, endDateTime } = plannerSyncWindow(14)
          const result = await importMicrosoftCalendarToPlanner({
            boardId: 'board-daily',
            startDateTime,
            endDateTime
          })
          if (result.imported.length || result.updated.length) {
            setImportMessage(`Synced ${result.imported.length + result.updated.length} M365 event(s) into Daily.`)
          }
          markAutoImportRun('dashboard-daily')
        } catch {
          // Keep dashboard usable even if Microsoft is not connected.
        }
      }
      setPayload(await loadPlannerDashboard('desktop'))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard')
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function handleCreate(input: {
    boardId: string
    title: string
    details: string
    importance: WorkItemImportance
    frictionType: WorkItemFrictionType
    recurrenceRule: WorkItemRecurrenceRule
    scheduledStartAt?: string
    scheduledEndAt?: string
  }) {
    await createPlannerWorkItem({
      boardId: input.boardId,
      title: input.title,
      details: input.details,
      importance: input.importance,
      frictionType: input.frictionType,
      recurrenceRule: input.recurrenceRule,
      scheduledStartAt: input.scheduledStartAt,
      scheduledEndAt: input.scheduledEndAt,
      columnId: input.boardId === 'board-daily' ? 'col-daily-today' : undefined
    })
    await refresh(false)
  }

  async function handleStart(item: PlannerWorkItem) {
    await movePlannerWorkItem(item.id, {
      columnId: item.boardId === 'board-daily' ? 'col-daily-progress' : 'col-parkpal-progress'
    })
    await refresh(false)
  }

  async function handleFocusToday(item: PlannerWorkItem) {
    await movePlannerWorkItem(item.id, {
      columnId: item.boardId === 'board-daily' ? 'col-daily-today' : 'col-parkpal-today',
      focusDate: localDayKey(new Date())
    })
    await refresh(false)
  }

  async function handleComplete(item: PlannerWorkItem) {
    await movePlannerWorkItem(item.id, {
      columnId: item.boardId === 'board-daily' ? 'col-daily-done' : 'col-parkpal-done'
    })
    await refresh(false)
  }

  async function handleRunDashboardAction(action: PlannerAction) {
    const response = await runPlannerAction({
      actionId: action.id,
      source: { type: 'dashboard', id: 'dashboard-main' }
    })

    setLastRun(response.run)
    const linkArtifact = response.run.artifacts.find((artifact) => artifact.type === 'link' && artifact.href)
    if (linkArtifact?.href) {
      onNavigate(linkArtifact.href)
    }
  }

  async function handleDraftFollowUp(item: PlannerWorkItem) {
    const response = await runPlannerAction({
      actionId: 'action-draft-follow-up',
      source: { type: 'work_item', id: item.id }
    })
    setLastRun(response.run)
  }

  async function handleSyncToMicrosoftCalendar(item: PlannerWorkItem) {
    const response = await syncPlannerWorkItemToMicrosoftCalendar(item.id)
    setSelectedItem(response.workItem)
    await refresh(false)
  }

  async function handleCreateBoard(input: { name: string; description: string }) {
    const board = await createPlannerBoard({
      name: input.name,
      description: input.description,
      boardType: 'specialized'
    })
    await refresh()
    onNavigate(`/boards/${board.slug}`)
  }

  async function handleImportCalendar() {
    setImportingCalendar(true)
    setImportMessage(null)
    try {
      const { startDateTime, endDateTime } = plannerSyncWindow(14)

      const response = await importMicrosoftCalendarToPlanner({
        boardId: 'board-daily',
        startDateTime,
        endDateTime
      })

      const affected = response.imported[0] ?? response.updated[0] ?? null
      if (affected) {
        setSelectedItem(affected)
      }
      setImportMessage(`Imported ${response.imported.length} and updated ${response.updated.length} calendar items.`)
      await refresh(false)
    } catch (importError) {
      setImportMessage(importError instanceof Error ? importError.message : 'Calendar import failed.')
    } finally {
      setImportingCalendar(false)
    }
  }

  async function handleSaveExecutionNote(item: PlannerWorkItem, executionNote: string) {
    const updated = await updatePlannerWorkItem(item.id, { executionNote })
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
    const updated = await updatePlannerWorkItem(item.id, patch)
    setSelectedItem(updated)
    await refresh(false)
  }

  async function handleDeleteItem(item: PlannerWorkItem) {
    await deletePlannerWorkItem(item.id)
    setSelectedItem(null)
    await refresh(false)
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

  if (error) {
    return <div className="planner-error-state">{error}</div>
  }

  if (!payload) {
    return <div className="planner-loading-state">Loading dashboard...</div>
  }

  const widgetByType = new Map(payload.widgets.map((widget) => [widget.widgetType, widget]))
  const todayWidget = widgetByType.get('today')
  const inProgressWidget = widgetByType.get('in_progress')
  const followUpsWidget = widgetByType.get('follow_ups')
  const goalsWidget = widgetByType.get('goals')
  const weeklyProgressWidget = widgetByType.get('weekly_progress')
  const quickActionsWidget = widgetByType.get('quick_actions')
  const boardNames = new Map(payload.boards.map((board) => [board.id, board.name]))

  function matchesSignal(item: PlannerWorkItem) {
    if (signal === 'all') return true
    if (signal === 'follow_up') return item.frictionType === 'follow_up'
    if (signal === 'avoidance') return item.frictionType === 'avoidance'
    if (signal === 'high_priority') return item.importance === 'high' || item.importance === 'critical'
    return true
  }

  const filteredTodayWidget = todayWidget
    ? {
        ...(todayWidget.data as TodayWidgetData),
        items: (todayWidget.data as TodayWidgetData).items.filter(matchesSignal),
        carryOver: (todayWidget.data as TodayWidgetData).carryOver.filter(matchesSignal)
      }
    : null

  const filteredInProgressWidget = inProgressWidget
    ? {
        ...(inProgressWidget.data as InProgressWidgetData),
        items: (inProgressWidget.data as InProgressWidgetData).items.filter(matchesSignal)
      }
    : null

  const filteredFollowUpsWidget = followUpsWidget
    ? {
        ...(followUpsWidget.data as FollowUpsWidgetData),
        items: (followUpsWidget.data as FollowUpsWidgetData).items.filter(matchesSignal)
      }
    : null

  return (
    <div className="planner-app-shell">
      <PlannerSidebar current="dashboard" onNavigate={onNavigate} />

      <main className="planner-workspace">
        <PlannerTopbar
          title="Today-first command center"
          subtitle="Dense enough to work from, structured enough to keep direction and avoided work visible."
          workspace="dashboard"
          signal={signal}
          utilityActionLabel="Import M365"
          utilityActionBusyLabel="Importing..."
          utilityActionPending={importingCalendar}
          onWorkspaceChange={handleWorkspaceChange}
          onSignalChange={setSignal}
          onUtilityAction={() => void handleImportCalendar()}
        />

        <section className="planner-dashboard-layout">
          <div className="planner-dashboard-main">
            {filteredTodayWidget ? (
              <TodayWidget
                data={filteredTodayWidget}
                boards={payload.boards}
                selectedItemId={selectedItem?.id}
                onSelectItem={setSelectedItem}
                onCreate={handleCreate}
                onStart={handleStart}
                onComplete={handleComplete}
                onDraftFollowUp={handleDraftFollowUp}
              />
            ) : null}

            <div className="planner-dashboard-bottom">
              {filteredInProgressWidget ? (
                <InProgressWidget
                  data={filteredInProgressWidget}
                  selectedItemId={selectedItem?.id}
                  onSelectItem={setSelectedItem}
                  onComplete={handleComplete}
                />
              ) : null}
              {weeklyProgressWidget ? (
                <WeeklyProgressWidget data={weeklyProgressWidget.data as WeeklyProgressWidgetData} />
              ) : null}
            </div>

            {quickActionsWidget ? (
              <section className="planner-dashboard-utility">
                <QuickActionsWidget
                  data={quickActionsWidget.data as QuickActionsWidgetData}
                  onRunAction={handleRunDashboardAction}
                />
              </section>
            ) : null}

            <section className="planner-dashboard-utility">
              <BoardLibraryWidget
                boards={payload.boards}
                onOpenBoard={(board) => onNavigate(board.linkedDomain === 'parkpal' ? '/parkpal' : `/boards/${board.slug}`)}
                onCreateBoard={handleCreateBoard}
              />
            </section>
          </div>

          <aside className="planner-dashboard-side">
            {filteredFollowUpsWidget ? (
              <FollowUpsWidget
                data={filteredFollowUpsWidget}
                selectedItemId={selectedItem?.id}
                onSelectItem={setSelectedItem}
                onMoveToToday={handleFocusToday}
                onStart={handleStart}
                onComplete={handleComplete}
                onDraftFollowUp={handleDraftFollowUp}
              />
            ) : null}
            {goalsWidget ? <GoalsWidget data={goalsWidget.data as GoalsWidgetData} /> : null}
          </aside>
        </section>

        {importMessage ? <div className="planner-inline-notice">{importMessage}</div> : null}
        <ActionResultPanel run={lastRun} />
      </main>

      <PlannerInspector
        item={selectedItem}
        boardName={selectedItem ? boardNames.get(selectedItem.boardId) : null}
        onUpdateItem={handleUpdateItem}
        onMoveToToday={handleFocusToday}
        onStart={handleStart}
        onComplete={handleComplete}
        onDraftFollowUp={handleDraftFollowUp}
        onSyncToMicrosoftCalendar={handleSyncToMicrosoftCalendar}
        onSaveExecutionNote={handleSaveExecutionNote}
        onDeleteItem={handleDeleteItem}
      />
    </div>
  )
}
