import { useState } from 'react'
import type { WorkItemFrictionType, WorkItemImportance, WorkItemRecurrenceRule } from '../../types/planner'

interface PlannerQuickCreateProps {
  label?: string
  defaultDate?: string | null
  onCreate: (input: {
    title: string
    date?: string
    time?: string
    importance?: WorkItemImportance
    frictionType?: WorkItemFrictionType
    recurrenceRule?: WorkItemRecurrenceRule
  }) => Promise<void>
}

export default function PlannerQuickCreate({
  label = 'New item',
  defaultDate = null,
  onCreate
}: PlannerQuickCreateProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate ?? '')
  const [time, setTime] = useState('')
  const [importance, setImportance] = useState<WorkItemImportance>('normal')
  const [frictionType, setFrictionType] = useState<WorkItemFrictionType>('neutral')
  const [recurrenceRule, setRecurrenceRule] = useState<WorkItemRecurrenceRule>('none')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return

    setSubmitting(true)
    try {
      await onCreate({
        title: title.trim(),
        date: date.trim() || undefined,
        time: /^\d{2}:\d{2}$/.test(time.trim()) ? time.trim() : undefined,
        importance,
        frictionType,
        recurrenceRule
      })
      setTitle('')
      setDate(defaultDate ?? '')
      setTime('')
      setImportance('normal')
      setFrictionType('neutral')
      setRecurrenceRule('none')
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="planner-quick-create">
      <button
        type="button"
        className={open ? 'planner-quick-create-trigger planner-nav-active' : 'planner-quick-create-trigger'}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </button>

      {open ? (
        <form className="planner-quick-create-panel" onSubmit={handleSubmit}>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Skapa videos" autoFocus />
          <div className="planner-quick-create-row">
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            <input type="text" value={time} onChange={(event) => setTime(event.target.value)} placeholder="08:00" inputMode="numeric" />
          </div>
          <div className="planner-quick-create-row planner-quick-create-row-single">
            <select value={importance} onChange={(event) => setImportance(event.target.value as WorkItemImportance)}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="planner-quick-create-row">
            <select value={frictionType} onChange={(event) => setFrictionType(event.target.value as WorkItemFrictionType)}>
              <option value="neutral">Neutral</option>
              <option value="follow_up">Follow-up</option>
              <option value="avoidance">Avoidance</option>
              <option value="admin">Admin</option>
            </select>
            <select value={recurrenceRule} onChange={(event) => setRecurrenceRule(event.target.value as WorkItemRecurrenceRule)}>
              <option value="none">One-off</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div className="planner-quick-create-actions">
            <button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? 'Saving...' : 'Create in inbox'}
            </button>
            <button
              type="button"
              className="planner-button-secondary"
              onClick={() => {
                setOpen(false)
                setTitle('')
                setDate(defaultDate ?? '')
                setTime('')
                setImportance('normal')
                setFrictionType('neutral')
                setRecurrenceRule('none')
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
