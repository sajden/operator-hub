import { loadPlannerSeries } from '../../data/plannerClient'
import type { PlannerSeriesSnapshot, PlannerWorkItem } from '../../types/planner'
import { useEffect, useState } from 'react'

function labelValue(label: string, value: string) {
  return `${label}: ${value}`
}

interface PlannerInspectorProps {
  item: PlannerWorkItem | null
  boardName?: string | null
  onUpdateItem?: (
    item: PlannerWorkItem,
    patch: Partial<
      Pick<
        PlannerWorkItem,
        | 'title'
        | 'details'
        | 'focusDate'
        | 'dueDate'
        | 'scheduledStartAt'
        | 'scheduledEndAt'
        | 'importance'
        | 'frictionType'
      >
    >
  ) => Promise<void>
  onMoveToToday?: (item: PlannerWorkItem) => Promise<void>
  onStart?: (item: PlannerWorkItem) => Promise<void>
  onComplete?: (item: PlannerWorkItem) => Promise<void>
  onDraftFollowUp?: (item: PlannerWorkItem) => Promise<void>
  onSyncToMicrosoftCalendar?: (item: PlannerWorkItem) => Promise<void>
  onSaveExecutionNote?: (item: PlannerWorkItem, executionNote: string) => Promise<void>
  onDeleteItem?: (item: PlannerWorkItem) => Promise<void>
}

export default function PlannerInspector({
  item,
  boardName,
  onUpdateItem,
  onMoveToToday,
  onStart,
  onComplete,
  onDraftFollowUp,
  onSyncToMicrosoftCalendar,
  onSaveExecutionNote,
  onDeleteItem
}: PlannerInspectorProps) {
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [focusDate, setFocusDate] = useState('')
  const [time, setTime] = useState('')
  const [importance, setImportance] = useState<PlannerWorkItem['importance']>('normal')
  const [frictionType, setFrictionType] = useState<PlannerWorkItem['frictionType']>('neutral')
  const [executionNote, setExecutionNote] = useState('')
  const [series, setSeries] = useState<PlannerSeriesSnapshot | null>(null)
  const [seriesError, setSeriesError] = useState<string | null>(null)

  useEffect(() => {
    setTitle(item?.title ?? '')
    setDetails(item?.details ?? '')
    setFocusDate(item?.focusDate ?? item?.dueDate ?? item?.scheduledStartAt?.slice(0, 10) ?? '')
    setTime(item?.scheduledStartAt?.slice(11, 16) ?? '')
    setImportance(item?.importance ?? 'normal')
    setFrictionType(item?.frictionType ?? 'neutral')
    setExecutionNote(item?.executionNote ?? '')
  }, [item?.id, item?.title, item?.details, item?.focusDate, item?.dueDate, item?.scheduledStartAt, item?.importance, item?.frictionType, item?.executionNote])

  useEffect(() => {
    let cancelled = false

    async function loadSeriesSnapshot() {
      if (!item?.seriesId) {
        setSeries(null)
        setSeriesError(null)
        return
      }

      try {
        setSeriesError(null)
        const snapshot = await loadPlannerSeries(item.seriesId)
        if (!cancelled) {
          setSeries(snapshot)
        }
      } catch (error) {
        if (!cancelled) {
          setSeries(null)
          setSeriesError(error instanceof Error ? error.message : 'Failed to load series')
        }
      }
    }

    void loadSeriesSnapshot()

    return () => {
      cancelled = true
    }
  }, [item?.seriesId])

  if (!item) {
    return (
      <aside className="planner-inspector">
        <span className="planner-sidebar-label">Inspector</span>
        <div className="planner-inspector-empty">
          <strong>Select a card</strong>
          <p>Keep card details and direct actions on the right instead of cramming them into every list.</p>
        </div>
      </aside>
    )
  }

  const currentItem = item

  const originalDate = currentItem.focusDate ?? currentItem.dueDate ?? currentItem.scheduledStartAt?.slice(0, 10) ?? ''
  const originalTime = currentItem.scheduledStartAt?.slice(11, 16) ?? ''
  const hasMainChanges =
    title !== currentItem.title ||
    details !== (currentItem.details ?? '') ||
    focusDate !== originalDate ||
    time !== originalTime ||
    importance !== currentItem.importance ||
    frictionType !== currentItem.frictionType
  const hasExecutionNoteChanges = executionNote !== (currentItem.executionNote ?? '')

  async function handleSaveMainFields() {
    if (!onUpdateItem) return

    let scheduledStartAt: string | null = null
    let scheduledEndAt: string | null = null

    if (focusDate && time) {
      scheduledStartAt = `${focusDate}T${time}:00`

      if (currentItem.scheduledStartAt && currentItem.scheduledEndAt) {
        const start = new Date(currentItem.scheduledStartAt)
        const end = new Date(currentItem.scheduledEndAt)
        const duration = Math.max(0, end.getTime() - start.getTime())
        const nextEnd = new Date(`${scheduledStartAt}.000Z`)
        nextEnd.setTime(nextEnd.getTime() + (duration || 30 * 60 * 1000))
        scheduledEndAt = nextEnd.toISOString().slice(0, 19)
      } else {
        const nextEnd = new Date(`${scheduledStartAt}.000Z`)
        nextEnd.setUTCMinutes(nextEnd.getUTCMinutes() + 30)
        scheduledEndAt = nextEnd.toISOString().slice(0, 19)
      }
    }

    await onUpdateItem(currentItem, {
      title: title.trim() || currentItem.title,
      details,
      focusDate: focusDate || null,
      dueDate: focusDate || null,
      scheduledStartAt,
      scheduledEndAt,
      importance,
      frictionType
    })
  }

  return (
    <aside className="planner-inspector">
      <span className="planner-sidebar-label">Inspector</span>
      <div className="planner-inspector-card">
        <div className="planner-inspector-head">
          <span className={`planner-badge planner-badge-${item.importance}`}>{item.importance}</span>
          <span className="planner-inspector-status">{item.status.replace('_', ' ')}</span>
        </div>

        <div className="planner-inspector-block">
          <strong>Details</strong>
          <label className="planner-inspector-field">
            <span>Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Item title" />
          </label>
          <label className="planner-inspector-field">
            <span>Description</span>
            <textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Context, notes or acceptance criteria..." rows={4} />
          </label>
          <div className="planner-inspector-edit-grid">
            <label className="planner-inspector-field">
              <span>Date</span>
              <input type="date" value={focusDate} onChange={(event) => setFocusDate(event.target.value)} />
            </label>
            <label className="planner-inspector-field">
              <span>Time</span>
              <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
            <label className="planner-inspector-field">
              <span>Priority</span>
              <select value={importance} onChange={(event) => setImportance(event.target.value as PlannerWorkItem['importance'])}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="planner-inspector-field">
              <span>Type</span>
              <select value={frictionType} onChange={(event) => setFrictionType(event.target.value as PlannerWorkItem['frictionType'])}>
                <option value="neutral">Neutral</option>
                <option value="follow_up">Follow-up</option>
                <option value="avoidance">Avoidance</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>
          {onUpdateItem ? (
            <div className="planner-inspector-inline-actions">
              <button type="button" onClick={() => void handleSaveMainFields()} disabled={!hasMainChanges}>
                Save changes
              </button>
            </div>
          ) : null}
        </div>

        <div className="planner-inspector-meta">
          {boardName ? <span>{labelValue('Board', boardName)}</span> : null}
          <span>{labelValue('Type', item.frictionType.replace('_', ' '))}</span>
          {item.seriesName ? <span>{labelValue('Series', item.seriesName)}</span> : null}
          {item.syncProvider === 'microsoft' ? <span>M365</span> : null}
          {item.scheduledStartAt ? <span>{labelValue('Time', new Date(item.scheduledStartAt).toLocaleString('sv-SE'))}</span> : null}
          {item.focusDate ? <span>{labelValue('Focus', item.focusDate)}</span> : null}
        </div>

        <div className="planner-inspector-block planner-inspector-notes">
          <strong>Execution note</strong>
          <textarea
            value={executionNote}
            onChange={(event) => setExecutionNote(event.target.value)}
            placeholder="Outcome, note from the meeting, rehab status, what changed..."
            rows={5}
          />
          {onSaveExecutionNote ? (
            <button
              type="button"
              onClick={() => void onSaveExecutionNote(item, executionNote)}
              disabled={!hasExecutionNoteChanges}
            >
              Save note
            </button>
          ) : null}
        </div>

        <div className="planner-inspector-actions">
          {onMoveToToday && item.status !== 'done' ? (
            <button type="button" onClick={() => void onMoveToToday(item)}>
              Focus today
            </button>
          ) : null}
          {onStart && item.status !== 'in_progress' && item.status !== 'done' ? (
            <button type="button" onClick={() => void onStart(item)}>
              Start
            </button>
          ) : null}
          {onComplete && item.status !== 'done' ? (
            <button type="button" onClick={() => void onComplete(item)}>
              Mark done
            </button>
          ) : null}
          {onDraftFollowUp ? (
            <button type="button" onClick={() => void onDraftFollowUp(item)}>
              Draft follow-up
            </button>
          ) : null}
          {onSyncToMicrosoftCalendar ? (
            <button type="button" onClick={() => void onSyncToMicrosoftCalendar(item)}>
              {item.syncProvider === 'microsoft' ? 'Resync M365' : 'Sync to M365'}
            </button>
          ) : null}
          {onDeleteItem ? (
            <button
              type="button"
              className="planner-inspector-action-danger"
              onClick={() => {
                if (window.confirm(`Delete "${item.title}"?`)) {
                  void onDeleteItem(item)
                }
              }}
            >
              Delete
            </button>
          ) : null}
        </div>

        {item.seriesId ? (
          <div className="planner-inspector-block planner-series-block">
            <strong>Series history</strong>
            {seriesError ? <p>{seriesError}</p> : null}
            {series ? (
              <>
                <div className="planner-series-stats">
                  <span>{series.recurrenceRule}</span>
                  <span>{series.stats.completedCount} done</span>
                  <span>{series.stats.plannedCount} planned</span>
                  {series.stats.lastCompletedAt ? <span>Last {new Date(series.stats.lastCompletedAt).toLocaleDateString('sv-SE')}</span> : null}
                </div>

                <div className="planner-series-list">
                  {series.occurrences.slice(0, 6).map((occurrence) => (
                    <article key={occurrence.id} className="planner-series-item">
                      <div>
                        <strong>{occurrence.focusDate ?? occurrence.dueDate ?? occurrence.createdAt.slice(0, 10)}</strong>
                        <p>{occurrence.executionNote || occurrence.details || 'No note yet.'}</p>
                      </div>
                      <span className="planner-series-status">{occurrence.status.replace('_', ' ')}</span>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p>Loading series history...</p>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  )
}
