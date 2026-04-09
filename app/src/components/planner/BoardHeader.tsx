import type { ReactNode } from 'react'
import type { PlannerBoardPayload } from '../../types/planner'

interface BoardHeaderProps {
  payload: PlannerBoardPayload
  showDescription?: boolean
  actionSlot?: ReactNode
  syncState?: {
    enabled: boolean
    pending: boolean
    label?: string | null
  }
  onSyncNow?: () => void
}

export default function BoardHeader({ payload, showDescription = true, actionSlot, syncState, onSyncNow }: BoardHeaderProps) {
  const boardTone = payload.board.linkedDomain === 'parkpal' ? 'Outreach workspace' : 'Execution surface'
  const showSync = Boolean(syncState?.enabled && onSyncNow)

  return (
    <header className="planner-board-header planner-board-header-surface">
      <div className="planner-board-header-main">
        <div className="planner-board-header-copy">
          <span className="planner-board-kicker">{boardTone}</span>
          <div className="planner-board-title-row">
            <h1>{payload.board.name}</h1>
            {actionSlot ? <div className="planner-board-header-actions planner-board-header-actions-inline">{actionSlot}</div> : null}
          </div>
          {showDescription ? <p>{payload.board.description}</p> : null}
        </div>

        <div className="planner-board-summary-strip">
          <article className="planner-board-summary-card">
            <span>Total</span>
            <strong>{payload.summary.totalCount}</strong>
          </article>
          <article className="planner-board-summary-card">
            <span>Inbox / focus</span>
            <strong>{payload.summary.focusedCount}</strong>
          </article>
          <article className="planner-board-summary-card">
            <span>Active</span>
            <strong>{payload.summary.inProgressCount}</strong>
          </article>
          <article className="planner-board-summary-card">
            <span>Done</span>
            <strong>{payload.summary.completedCount}</strong>
          </article>
        </div>
      </div>

      {showSync ? (
      <div className="planner-board-header-side">
        {syncState?.enabled && onSyncNow ? (
          <div className="planner-board-sync">
            <button type="button" onClick={onSyncNow} disabled={syncState.pending}>
              {syncState.pending ? 'Syncing...' : 'Sync now'}
            </button>
            {syncState.label ? <span>{syncState.label}</span> : null}
          </div>
        ) : null}
      </div>
      ) : null}
    </header>
  )
}
