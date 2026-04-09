import { useEffect, useMemo, useState } from 'react'
import ActionResultPanel from '../components/planner/ActionResultPanel'
import PlannerQuickCreate from '../components/planner/PlannerQuickCreate'
import WorkItemCard from '../components/planner/WorkItemCard'
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

interface PlannerWeekPageProps {
  onNavigate: (path: string) => void
  theme: 'light' | 'dark' | string
  onSetTheme: (theme: 'light' | 'dark') => void
}

function startOfWeek(date = new Date()) {
  const next = new Date(date)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function localDayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isoDay(date: Date) {
  return localDayKey(date)
}

function syncStatusLabel(scope: string) {
  const lastRun = readLastAutoImportRun(scope)
  if (!lastRun) return null
  return `M365 synced ${new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' }).format(lastRun)}`
}

function titleDate(date: Date) {
  return new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' }).format(date)
}

function weekdayLabel(date: Date) {
  return new Intl.DateTimeFormat('sv-SE', { weekday: 'long' }).format(date)
}

function dayNumber(date: Date) {
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric' }).format(date)
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat('sv-SE', { month: 'short' }).format(date)
}

function effectiveRecurrenceRule(item: PlannerWorkItem) {
  if (item.recurrenceRule && item.recurrenceRule !== 'none') return item.recurrenceRule
  if (String(item.externalEventId ?? '').startsWith('series-summary:')) return 'daily'
  return 'none'
}

function itemDateKey(item: PlannerWorkItem) {
  return item.scheduledStartAt?.slice(0, 10) ?? item.focusDate ?? item.dueDate ?? null
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

function completedDayKey(item: PlannerWorkItem) {
  if (!item.completedAt) return null
  const date = new Date(item.completedAt)
  if (Number.isNaN(date.getTime())) return null
  return isoDay(date)
}

function shouldProjectRecurringItem(item: PlannerWorkItem, dayKey: string) {
  if (!isCalendarSeriesSummary(item)) return item.status !== 'done'
  return completedDayKey(item) !== dayKey
}

function patchDatePart(value: string | null, dayKey: string) {
  if (!value || !value.includes('T')) return value
  return `${dayKey}${value.slice(10)}`
}

function sortItems(items: PlannerWorkItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.scheduledStartAt ?? `${itemDateKey(left) ?? left.createdAt}T23:59:59`
    const rightTime = right.scheduledStartAt ?? `${itemDateKey(right) ?? right.createdAt}T23:59:59`
    if (leftTime !== rightTime) return leftTime.localeCompare(rightTime)
    return left.title.localeCompare(right.title)
  })
}

function resolveColumnIdForWeekMove(item: PlannerWorkItem, dayKey: string) {
  if (item.status === 'done') return 'col-daily-done'
  return 'col-daily-inbox'
}

function PlannerWeekItem({
  item,
  selected,
  dragActive,
  draggable = true,
  onSelect,
  onDragStart,
  onDragEnd
}: {
  item: PlannerWorkItem
  selected: boolean
  dragActive: boolean
  draggable?: boolean
  onSelect: (item: PlannerWorkItem) => void
  onDragStart: (item: PlannerWorkItem) => void
  onDragEnd: () => void
}) {
  return (
    <WorkItemCard
      item={item}
      compact
      variant="board"
      selected={selected}
      draggable={draggable}
      dragActive={dragActive}
      onSelect={onSelect}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={onDragEnd}
    />
  )
}

export default function PlannerWeekPage({ onNavigate, theme, onSetTheme }: PlannerWeekPageProps) {
  const [payload, setPayload] = useState<PlannerBoardPayload | null>(null)
  const [selectedItem, setSelectedItem] = useState<PlannerWorkItem | null>(null)
  const [draggedItem, setDraggedItem] = useState<PlannerWorkItem | null>(null)
  const [dropTargetDay, setDropTargetDay] = useState<string | null>(null)
  const [signal, setSignal] = useState<'all' | 'follow_up' | 'avoidance' | 'high_priority'>('all')
  const [lastRun, setLastRun] = useState<PlannerActionRun | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importingCalendar, setImportingCalendar] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [lastSyncLabel, setLastSyncLabel] = useState<string | null>(syncStatusLabel('week-daily'))

  async function refresh(runAutoSync = true) {
    if (runAutoSync && shouldRunAutoImport('week-daily', 120_000)) {
      try {
        const { startDateTime, endDateTime } = plannerSyncWindow(14)
        await importMicrosoftCalendarToPlanner({
          boardId: 'board-daily',
          startDateTime,
          endDateTime
        })
        markAutoImportRun('week-daily')
        setLastSyncLabel(syncStatusLabel('week-daily'))
      } catch {
        // Keep the week view usable even if Microsoft is disconnected.
      }
    }
    setPayload(await loadPlannerBoard('daily'))
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh()
    }, 120_000)

    return () => window.clearInterval(timer)
  }, [])

  async function handleImportCalendar() {
    setImportingCalendar(true)
    setImportMessage(null)
    try {
      const { startDateTime, endDateTime } = plannerSyncWindow(14)
      const result = await importMicrosoftCalendarToPlanner({
        boardId: 'board-daily',
        startDateTime,
        endDateTime
      })
      markAutoImportRun('week-daily')
      setLastSyncLabel(syncStatusLabel('week-daily'))
      setImportMessage(`Imported ${result.imported.length} and updated ${result.updated.length} calendar items.`)
      await refresh(false)
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Calendar import failed.')
    } finally {
      setImportingCalendar(false)
    }
  }

  async function handleMoveToDay(item: PlannerWorkItem, dayKey: string) {
    await updatePlannerWorkItem(item.id, {
      focusDate: dayKey,
      dueDate: dayKey,
      scheduledStartAt: patchDatePart(item.scheduledStartAt, dayKey),
      scheduledEndAt: patchDatePart(item.scheduledEndAt, dayKey),
      columnId: resolveColumnIdForWeekMove(item, dayKey)
    })
    await refresh(false)
  }

  async function handleMoveToBacklog(item: PlannerWorkItem) {
    await updatePlannerWorkItem(item.id, {
      focusDate: null,
      dueDate: null,
      scheduledStartAt: null,
      scheduledEndAt: null,
      columnId: item.status === 'done' ? 'col-daily-done' : 'col-daily-inbox'
    })
    await refresh(false)
  }

  async function handleMoveToToday(item: PlannerWorkItem) {
    await handleMoveToDay(item, isoDay(new Date()))
  }

  async function handleStart(item: PlannerWorkItem) {
    await movePlannerWorkItem(item.id, { columnId: 'col-daily-progress', focusDate: item.focusDate })
    await refresh(false)
  }

  async function handleComplete(item: PlannerWorkItem) {
    await movePlannerWorkItem(item.id, { columnId: 'col-daily-done', focusDate: item.focusDate })
    await refresh(false)
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
      boardId: 'board-daily',
      columnId: 'col-daily-inbox',
      title: input.title,
      details: '',
      focusDate: targetDate,
      dueDate: targetDate,
      importance: input.importance ?? 'normal',
      frictionType: input.frictionType ?? 'neutral',
      recurrenceRule: input.recurrenceRule ?? 'none',
      scheduledStartAt,
      scheduledEndAt: scheduledEndAt ? scheduledEndAt.toISOString().slice(0, 19) : undefined
    })
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

  const weekDays = useMemo(() => {
    const monday = addDays(startOfWeek(), weekOffset * 7)
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(monday, index)
      return {
        key: isoDay(date),
        label: titleDate(date),
        weekday: weekdayLabel(date),
        dayNumber: dayNumber(date),
        month: monthLabel(date),
        date,
        isToday: isoDay(date) === isoDay(new Date())
      }
    })
  }, [weekOffset])

  if (!payload) {
    return <div className="planner-loading-state">Loading week...</div>
  }

  function matchesSignal(item: PlannerWorkItem) {
    if (signal === 'all') return true
    if (signal === 'follow_up') return item.frictionType === 'follow_up'
    if (signal === 'avoidance') return item.frictionType === 'avoidance'
    if (signal === 'high_priority') return item.importance === 'high' || item.importance === 'critical'
    return true
  }

  const allItems = payload.columns.flatMap((column) => column.workItems).filter((item) => item.status !== 'archived' && matchesSignal(item))
  const weekKeySet = new Set(weekDays.map((day) => day.key))
  const concreteScheduledThisWeek = allItems.filter((item) => {
    const dayKey = itemDateKey(item)
    return dayKey ? weekKeySet.has(dayKey) : false
  })
  const recurringInboxItems = allItems.filter(
    (item) => !itemDateKey(item) && effectiveRecurrenceRule(item) !== 'none'
  )
  const concreteSeriesKeys = new Set(
    concreteScheduledThisWeek.map((item) => `${item.seriesId ?? item.id}:${itemDateKey(item) ?? 'none'}`)
  )
  const projectedRecurringThisWeek = recurringInboxItems.flatMap((item) =>
    weekDays
      .filter((day) => shouldProjectRecurringItem(item, day.key))
      .filter((day) => recurrenceAppliesOnDay(item, day.key))
      .filter((day) => !concreteSeriesKeys.has(`${item.seriesId ?? item.id}:${day.key}`))
      .map((day) => ({
        ...item,
        id: `${item.id}::${day.key}`,
        focusDate: day.key,
        dueDate: day.key
      }))
  )
  const scheduledThisWeek = [...concreteScheduledThisWeek, ...projectedRecurringThisWeek]
  const unscheduledItems = sortItems(
    allItems.filter((item) => item.status !== 'done' && !itemDateKey(item) && effectiveRecurrenceRule(item) === 'none')
  )

  const weekColumns = weekDays.map((day) => ({
    ...day,
    items: sortItems(scheduledThisWeek.filter((item) => itemDateKey(item) === day.key))
  }))

  const scheduledCount = scheduledThisWeek.length
  const doneCount = scheduledThisWeek.filter((item) => item.status === 'done').length
  const followUpCount = scheduledThisWeek.filter((item) => item.frictionType === 'follow_up').length
  const carryOverCount = scheduledThisWeek.filter((item) => item.status !== 'done' && item.focusDate && item.focusDate < isoDay(new Date())).length
  const weekRangeLabel = `${titleDate(weekDays[0].date)} - ${titleDate(weekDays[6].date)}`

  return (
    <div className="planner-app-shell">
      <PlannerSidebar current="week" onNavigate={onNavigate} />

      <main className="planner-workspace">
        <PlannerTopbar
          title="Weekly planning surface"
          subtitle="Plan the week as a calendar, rebalance work across days, and keep execution detail in the inspector."
          workspace="week"
          signal={signal}
          utilityActionLabel="Sync M365"
          utilityActionBusyLabel="Syncing..."
          utilityActionPending={importingCalendar}
          syncStatusLabel={lastSyncLabel}
          onWorkspaceChange={handleWorkspaceChange}
          onSignalChange={setSignal}
          onUtilityAction={() => void handleImportCalendar()}
        />

        <section className="planner-week-hero">
          <div className="planner-week-hero-copy">
            <span className="planner-widget-eyebrow">Week</span>
            <h2>{weekRangeLabel}</h2>
            <p>Use this view to distribute work across the week before you drop into daily execution.</p>
          </div>
          <div className="planner-week-hero-controls">
            <div className="planner-week-nav">
              <button type="button" onClick={() => setWeekOffset((current) => current - 1)}>
                Previous
              </button>
              <button type="button" onClick={() => setWeekOffset(0)} className={weekOffset === 0 ? 'planner-nav-active' : ''}>
                This week
              </button>
              <button type="button" onClick={() => setWeekOffset((current) => current + 1)}>
                Next
              </button>
            </div>
            <PlannerQuickCreate defaultDate={weekDays[0].key} onCreate={handleCreateInInbox} />
            <div className="planner-week-summary-strip">
              <article className="planner-week-mini-stat">
                <span>Scheduled</span>
                <strong>{scheduledCount}</strong>
              </article>
              <article className="planner-week-mini-stat">
                <span>Done</span>
                <strong>{doneCount}</strong>
              </article>
              <article className="planner-week-mini-stat">
                <span>Follow-ups</span>
                <strong>{followUpCount}</strong>
              </article>
              <article className="planner-week-mini-stat">
                <span>Carry-over</span>
                <strong>{carryOverCount}</strong>
              </article>
              <article className="planner-week-mini-stat">
                <span>Inbox</span>
                <strong>{unscheduledItems.length}</strong>
              </article>
            </div>
          </div>
        </section>

        <section className="planner-week-overview">
          <div
            className={dropTargetDay === 'backlog' ? 'planner-week-backlog planner-week-backlog-drop-target' : 'planner-week-backlog'}
            onDragOver={(event) => {
              event.preventDefault()
              setDropTargetDay('backlog')
            }}
            onDragLeave={() => setDropTargetDay((current) => (current === 'backlog' ? null : current))}
            onDrop={(event) => {
              event.preventDefault()
              if (draggedItem) {
                void handleMoveToBacklog(draggedItem)
              }
              setDraggedItem(null)
              setDropTargetDay(null)
            }}
          >
            <div className="planner-week-lane-head">
              <strong>Inbox</strong>
              <span>{unscheduledItems.length}</span>
            </div>
            <div className="planner-week-lane-list">
              {unscheduledItems.map((item) => (
                <PlannerWeekItem
                  key={item.id}
                  item={item}
                  selected={selectedItem?.id === item.id}
                  dragActive={draggedItem?.id === item.id}
                  onSelect={setSelectedItem}
                  onDragStart={setDraggedItem}
                  onDragEnd={() => {
                    setDraggedItem(null)
                    setDropTargetDay(null)
                  }}
                />
              ))}
              {unscheduledItems.length === 0 ? <p className="planner-week-empty">Inbox is clear.</p> : null}
            </div>
          </div>

          <div className="planner-week-scroll">
            <section className="planner-week-grid">
              {weekColumns.map((day) => (
                <section
                  key={day.key}
                  className={[
                    'planner-week-day',
                    day.isToday ? 'planner-week-day-today' : '',
                    dropTargetDay === day.key ? 'planner-week-day-drop-target' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDropTargetDay(day.key)
                  }}
                  onDragLeave={() => setDropTargetDay((current) => (current === day.key ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (draggedItem) {
                      void handleMoveToDay(draggedItem, day.key)
                    }
                    setDraggedItem(null)
                    setDropTargetDay(null)
                  }}
                >
                  <div className="planner-week-lane-head">
                    <div className="planner-week-lane-title">
                      <strong>{day.weekday}</strong>
                      <div className="planner-week-lane-date">
                        <span>{day.dayNumber}</span>
                        <small>{day.month}</small>
                      </div>
                    </div>
                    <span>{day.items.length}</span>
                  </div>
                  <div className="planner-week-lane-list">
                    {day.items.map((item) => (
                          <PlannerWeekItem
                            key={item.id}
                            item={item}
                            selected={selectedItem?.id === item.id}
                            dragActive={draggedItem?.id === item.id}
                            draggable={!String(item.id).includes('::')}
                            onSelect={setSelectedItem}
                            onDragStart={setDraggedItem}
                            onDragEnd={() => {
                          setDraggedItem(null)
                          setDropTargetDay(null)
                        }}
                      />
                    ))}
                    {day.items.length === 0 ? <p className="planner-week-empty">Nothing planned.</p> : null}
                  </div>
                </section>
              ))}
            </section>
          </div>
        </section>

        {importMessage ? <div className="planner-inline-notice">{importMessage}</div> : null}
        <ActionResultPanel run={lastRun} />
      </main>

      <PlannerInspector
        item={selectedItem}
        boardName="Weekly planning"
        onUpdateItem={handleUpdateItem}
        onMoveToToday={handleMoveToToday}
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
