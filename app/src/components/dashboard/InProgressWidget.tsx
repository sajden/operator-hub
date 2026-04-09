import WidgetFrame from './WidgetFrame'
import WorkItemCard from '../planner/WorkItemCard'
import type { InProgressWidgetData, PlannerWorkItem } from '../../types/planner'

interface InProgressWidgetProps {
  data: InProgressWidgetData
  selectedItemId?: string | null
  onSelectItem: (item: PlannerWorkItem) => void
  onComplete: (item: PlannerWorkItem) => Promise<void>
}

export default function InProgressWidget({ data, selectedItemId, onSelectItem, onComplete }: InProgressWidgetProps) {
  return (
    <WidgetFrame
      title="In Motion"
      eyebrow="Execution"
      description="Keep the active thread short so work does not sprawl."
      aside={<span className="planner-kpi">{data.items.length}</span>}
    >
      <div className="planner-stack">
        {data.items.length === 0 ? <p className="planner-empty">Nothing is actively in progress right now.</p> : null}
        {data.items.map((item) => (
          <WorkItemCard
            key={item.id}
            item={item}
            compact
            selected={selectedItemId === item.id}
            onSelect={onSelectItem}
            onComplete={onComplete}
          />
        ))}
      </div>
    </WidgetFrame>
  )
}
