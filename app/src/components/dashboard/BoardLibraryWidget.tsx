import { useState } from 'react'
import WidgetFrame from './WidgetFrame'
import type { PlannerBoardSummary } from '../../types/planner'

interface BoardLibraryWidgetProps {
  boards: PlannerBoardSummary[]
  onOpenBoard: (board: PlannerBoardSummary) => void
  onCreateBoard: (input: { name: string; description: string }) => Promise<void>
}

export default function BoardLibraryWidget({ boards, onOpenBoard, onCreateBoard }: BoardLibraryWidgetProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      await onCreateBoard({ name: name.trim(), description: description.trim() })
      setName('')
      setDescription('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <WidgetFrame title="Boards" eyebrow="Library">
      <div className="planner-stack">
        {boards.map((board) => (
          <button key={board.id} type="button" className="planner-quick-action" onClick={() => onOpenBoard(board)}>
            <strong>{board.name}</strong>
            <span>{board.description || board.boardType}</span>
          </button>
        ))}
      </div>

      <form className="planner-composer planner-composer-compact" onSubmit={handleSubmit}>
        <label>
          <span>New board</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Weekly Planning" />
        </label>
        <label>
          <span>Description</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Recurring planning, rehab, routines" />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create board'}
        </button>
      </form>
    </WidgetFrame>
  )
}
