import { useState } from 'react'
import type { PlannerBoardSummary, WorkItemFrictionType, WorkItemImportance, WorkItemRecurrenceRule } from '../../types/planner'

interface WorkItemComposerProps {
  onCreate: (input: {
    boardId: string
    title: string
    details: string
    importance: WorkItemImportance
    frictionType: WorkItemFrictionType
    recurrenceRule: WorkItemRecurrenceRule
    scheduledStartAt?: string
    scheduledEndAt?: string
  }) => Promise<void> | Promise<void[]>
  boards: PlannerBoardSummary[]
}

function localDayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function WorkItemComposer({ onCreate, boards }: WorkItemComposerProps) {
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [boardId, setBoardId] = useState(boards[0]?.id ?? 'board-daily')
  const [importance, setImportance] = useState<WorkItemImportance>('high')
  const [frictionType, setFrictionType] = useState<WorkItemFrictionType>('follow_up')
  const [recurrenceRule, setRecurrenceRule] = useState<WorkItemRecurrenceRule>('none')
  const [scheduledTime, setScheduledTime] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function parseScheduledTimes(rawValue: string) {
    return rawValue
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => /^\d{2}:\d{2}$/.test(part))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return

    setSubmitting(true)
    try {
      const today = localDayKey(new Date())
      const slots = parseScheduledTimes(scheduledTime)

      if (slots.length === 0) {
        await onCreate({
          boardId,
          title: title.trim(),
          details: details.trim(),
          importance,
          frictionType,
          recurrenceRule
        })
      } else {
        for (const slot of slots) {
          const scheduledStartAt = `${today}T${slot}:00`
          const [hour, minute] = slot.split(':').map(Number)
          const endDate = new Date(`${today}T${slot}:00`)
          if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
            endDate.setMinutes(endDate.getMinutes() + 30)
          }

          await onCreate({
            boardId,
            title: slots.length > 1 ? `${title.trim()} · ${slot}` : title.trim(),
            details: details.trim(),
            importance,
            frictionType,
            recurrenceRule,
            scheduledStartAt,
            scheduledEndAt: endDate.toISOString().slice(0, 19)
          })
        }
      }

      setTitle('')
      setDetails('')
      setBoardId(boards[0]?.id ?? 'board-daily')
      setImportance('high')
      setFrictionType('follow_up')
      setRecurrenceRule('none')
      setScheduledTime('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="planner-composer" onSubmit={handleSubmit}>
      <label>
        <span>New work item</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Skicka mail till Patrik" />
      </label>
      <label>
        <span>Notes</span>
        <textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={3} placeholder="Next step or context" />
      </label>
      <div className="planner-composer-row">
        <label>
          <span>Board</span>
          <select value={boardId} onChange={(event) => setBoardId(event.target.value)}>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Importance</span>
          <select value={importance} onChange={(event) => setImportance(event.target.value as WorkItemImportance)}>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
      </div>
      <div className="planner-composer-row">
        <label>
          <span>Type</span>
          <select value={frictionType} onChange={(event) => setFrictionType(event.target.value as WorkItemFrictionType)}>
            <option value="follow_up">Follow-up</option>
            <option value="avoidance">Avoidance</option>
            <option value="admin">Admin</option>
            <option value="neutral">Neutral</option>
          </select>
        </label>
        <label>
          <span>Repeat</span>
          <select value={recurrenceRule} onChange={(event) => setRecurrenceRule(event.target.value as WorkItemRecurrenceRule)}>
            <option value="none">Once</option>
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
        <label>
          <span>Time(s)</span>
          <input
            type="text"
            value={scheduledTime}
            onChange={(event) => setScheduledTime(event.target.value)}
            placeholder="08:00, 12:00, 20:00"
          />
        </label>
      </div>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Saving...' : 'Add to dashboard'}
      </button>
    </form>
  )
}
