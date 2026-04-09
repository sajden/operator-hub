import type { PlannerWorkItem } from '../../types/planner'

function formatTimeLabel(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('sv-SE', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function importanceBadgeStyle(importance: PlannerWorkItem['importance']) {
  if (importance === 'critical') {
    return {
      color: '#fff5f2',
      background: '#b45a4c'
    }
  }

  if (importance === 'high') {
    return {
      color: '#fff8ef',
      background: '#9a6523'
    }
  }

  if (importance === 'low') {
    return {
      color: '#f7fffe',
      background: '#48666b'
    }
  }

  return {
    color: '#f7fffe',
    background: '#0d7173'
  }
}

function formatMetaLabel(value: string) {
  return value.replace(/_/g, ' ')
}

interface WorkItemCardProps {
  item: PlannerWorkItem
  compact?: boolean
  variant?: 'default' | 'board'
  selected?: boolean
  draggable?: boolean
  dragActive?: boolean
  onDragStart?: (item: PlannerWorkItem) => void
  onDragEnd?: () => void
  onSelect?: (item: PlannerWorkItem) => void
  onMoveToToday?: (item: PlannerWorkItem) => Promise<void>
  onStart?: (item: PlannerWorkItem) => Promise<void>
  onComplete?: (item: PlannerWorkItem) => Promise<void>
  onDraftFollowUp?: (item: PlannerWorkItem) => Promise<void>
}

export default function WorkItemCard({
  item,
  compact = false,
  variant = 'default',
  selected = false,
  draggable = false,
  dragActive = false,
  onDragStart,
  onDragEnd,
  onSelect,
  onMoveToToday,
  onStart,
  onComplete,
  onDraftFollowUp
}: WorkItemCardProps) {
  const startTimeLabel = formatTimeLabel(item.scheduledStartAt)
  const endTimeLabel = formatTimeLabel(item.scheduledEndAt)

  function stopAndRun(event: React.MouseEvent<HTMLButtonElement>, callback?: () => void) {
    event.stopPropagation()
    callback?.()
  }

  if (compact && variant === 'board') {
    const primaryMeta = item.frictionType !== 'neutral' ? formatMetaLabel(item.frictionType) : item.status === 'planned' ? 'queued' : formatMetaLabel(item.status)

    return (
      <article
        className={[
          'planner-work-item',
          'planner-work-item-board',
          selected ? 'planner-work-item-selected' : '',
          draggable ? 'planner-work-item-draggable' : '',
          dragActive ? 'planner-work-item-drag-active' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onSelect?.(item)}
        draggable={draggable}
        onDragStart={() => onDragStart?.(item)}
        onDragEnd={() => onDragEnd?.()}
      >
        <div className="planner-work-item-board-head">
          <div className="planner-work-item-board-time">{startTimeLabel ?? '--:--'}</div>
          <span className={`planner-badge planner-badge-${item.importance}`} style={importanceBadgeStyle(item.importance)}>
            {item.importance}
          </span>
        </div>
        <div className="planner-work-item-board-titleline">
          <strong>{item.title}</strong>
        </div>
        <div className="planner-work-item-board-signals">
          {item.executionNote ? <span className="planner-work-item-board-flag">Note</span> : null}
          <div className="planner-work-item-board-meta">
            <span>{primaryMeta}</span>
            {item.syncProvider === 'microsoft' ? <span>M365</span> : null}
            {item.recurrenceRule && item.recurrenceRule !== 'none' ? <span>{item.recurrenceRule}</span> : null}
            {item.focusDate ? <span>{item.focusDate.slice(5)}</span> : null}
          </div>
        </div>
      </article>
    )
  }

  return (
    <article
      className={[
        compact ? 'planner-work-item planner-work-item-compact' : 'planner-work-item',
        selected ? 'planner-work-item-selected' : '',
        draggable ? 'planner-work-item-draggable' : '',
        dragActive ? 'planner-work-item-drag-active' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onSelect?.(item)}
      draggable={draggable}
      onDragStart={() => onDragStart?.(item)}
      onDragEnd={() => onDragEnd?.()}
    >
      <div className="planner-work-item-topline">
        <strong>{item.title}</strong>
        <span className={`planner-badge planner-badge-${item.importance}`} style={importanceBadgeStyle(item.importance)}>
          {item.importance}
        </span>
      </div>
      {!compact && item.details ? <p>{item.details}</p> : null}
      <div className="planner-meta-row">
        {startTimeLabel ? <span>{endTimeLabel ? `${startTimeLabel}–${endTimeLabel}` : startTimeLabel}</span> : null}
        {!compact ? <span>{item.status.replace('_', ' ')}</span> : null}
        {!compact ? <span>{item.frictionType.replace('_', ' ')}</span> : null}
        {!compact && item.recurrenceRule && item.recurrenceRule !== 'none' ? <span>{item.recurrenceRule}</span> : null}
        {item.syncProvider === 'microsoft' ? <span>M365</span> : null}
        {item.executionNote ? <span>Note</span> : null}
        {!compact && item.focusDate ? <span>Focus {item.focusDate}</span> : null}
      </div>
      {!compact ? (
        <div className="planner-action-row">
          {onMoveToToday ? (
            <button type="button" onClick={(event) => stopAndRun(event, () => void onMoveToToday(item))}>
              Today
            </button>
          ) : null}
          {onStart && item.status !== 'in_progress' && item.status !== 'done' ? (
            <button type="button" onClick={(event) => stopAndRun(event, () => void onStart(item))}>
              Start
            </button>
          ) : null}
          {onComplete && item.status !== 'done' ? (
            <button type="button" onClick={(event) => stopAndRun(event, () => void onComplete(item))}>
              Done
            </button>
          ) : null}
          {onDraftFollowUp ? (
            <button type="button" onClick={(event) => stopAndRun(event, () => void onDraftFollowUp(item))}>
              Draft
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
