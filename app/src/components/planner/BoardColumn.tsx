import WorkItemCard from './WorkItemCard'
import type { PlannerBoardPayload, PlannerWorkItem } from '../../types/planner'

interface BoardColumnProps {
  column: PlannerBoardPayload['columns'][number]
  selectedItemId?: string | null
  onSelectItem: (item: PlannerWorkItem) => void
  onMove: (item: PlannerWorkItem, columnId: string, focusDate?: string | null) => Promise<void>
  onDraftFollowUp: (item: PlannerWorkItem) => Promise<void>
  draggedItemId?: string | null
  onDragStart: (item: PlannerWorkItem) => void
  onDragEnd: () => void
  onDropItem: (columnId: string) => Promise<void>
  isDropTarget: boolean
  onDropTargetEnter: (columnId: string | null) => void
}

export default function BoardColumn({
  column,
  selectedItemId,
  onSelectItem,
  onMove,
  onDraftFollowUp,
  draggedItemId,
  onDragStart,
  onDragEnd,
  onDropItem,
  isDropTarget,
  onDropTargetEnter
}: BoardColumnProps) {
  const toneClass = `planner-board-column-tone-${column.columnKind}`

  return (
    <section
      className={[
        'planner-board-column',
        toneClass,
        isDropTarget ? 'planner-board-column-drop-target' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={() => onDropTargetEnter(column.id)}
      onDragLeave={() => onDropTargetEnter(null)}
      onDrop={(event) => {
        event.preventDefault()
        void onDropItem(column.id)
      }}
    >
      <header>
        <div className="planner-board-column-headline">
          <strong>{column.name}</strong>
          <small>{column.columnKind.replace('_', ' ')}</small>
        </div>
        <span>{column.workItems.length}</span>
      </header>
      <div className="planner-stack">
        {column.workItems.map((item) => (
          <WorkItemCard
            key={item.id}
            item={item}
            compact
            variant="board"
            selected={selectedItemId === item.id}
            draggable
            dragActive={draggedItemId === item.id}
            onSelect={onSelectItem}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDraftFollowUp={onDraftFollowUp}
          />
        ))}
      </div>
    </section>
  )
}
