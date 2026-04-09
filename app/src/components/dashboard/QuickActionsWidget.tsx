import WidgetFrame from './WidgetFrame'
import type { PlannerAction, QuickActionsWidgetData } from '../../types/planner'

interface QuickActionsWidgetProps {
  data: QuickActionsWidgetData
  onRunAction: (action: PlannerAction) => Promise<void>
}

export default function QuickActionsWidget({ data, onRunAction }: QuickActionsWidgetProps) {
  return (
    <WidgetFrame
      title="Quick Actions"
      eyebrow="Utility"
      description="Keep utility actions close, but out of the way of the main dashboard flow."
    >
      <div className="planner-stack planner-utility-actions">
        {data.actions.length === 0 ? <p className="planner-empty">No dashboard actions are available yet.</p> : null}
        {data.actions.map((action) => (
          <button key={action.id} type="button" className="planner-quick-action" onClick={() => void onRunAction(action)}>
            <strong>{action.displayLabel}</strong>
            <span>{action.capabilityKey}</span>
          </button>
        ))}
      </div>
    </WidgetFrame>
  )
}
