import WidgetFrame from './WidgetFrame'
import WorkItemCard from '../planner/WorkItemCard'
import type { FollowUpsWidgetData, PlannerWorkItem } from '../../types/planner'

interface FollowUpsWidgetProps {
  data: FollowUpsWidgetData
  selectedItemId?: string | null
  onSelectItem: (item: PlannerWorkItem) => void
  onMoveToToday: (item: PlannerWorkItem) => Promise<void>
  onStart: (item: PlannerWorkItem) => Promise<void>
  onComplete: (item: PlannerWorkItem) => Promise<void>
  onDraftFollowUp: (item: PlannerWorkItem) => Promise<void>
}

export default function FollowUpsWidget({
  data,
  selectedItemId,
  onSelectItem,
  onMoveToToday,
  onStart,
  onComplete,
  onDraftFollowUp
}: FollowUpsWidgetProps) {
  return (
    <WidgetFrame
      title="Follow-ups"
      eyebrow="Friction"
      description="Make the avoided work obvious, then make the next useful step easy."
      aside={<span className="planner-kpi">{data.items.length}</span>}
    >
      <div className="planner-stack">
        {data.items.length === 0 ? <p className="planner-empty">No follow-ups or avoided work need attention right now.</p> : null}
        {data.items.map((item) => (
          <WorkItemCard
            key={item.id}
            item={item}
            compact
            selected={selectedItemId === item.id}
            onSelect={onSelectItem}
            onMoveToToday={onMoveToToday}
            onStart={onStart}
            onComplete={onComplete}
            onDraftFollowUp={onDraftFollowUp}
          />
        ))}
      </div>
    </WidgetFrame>
  )
}
