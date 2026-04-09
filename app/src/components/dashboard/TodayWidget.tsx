import WorkItemComposer from '../planner/WorkItemComposer'
import WorkItemCard from '../planner/WorkItemCard'
import WidgetFrame from './WidgetFrame'
import type { PlannerBoardSummary, PlannerWorkItem, TodayWidgetData, WorkItemFrictionType, WorkItemImportance, WorkItemRecurrenceRule } from '../../types/planner'

interface TodayWidgetProps {
  data: TodayWidgetData
  boards: PlannerBoardSummary[]
  selectedItemId?: string | null
  onSelectItem: (item: PlannerWorkItem) => void
  onCreate: (input: {
    boardId: string
    title: string
    details: string
    importance: WorkItemImportance
    frictionType: WorkItemFrictionType
    recurrenceRule: WorkItemRecurrenceRule
    scheduledStartAt?: string
    scheduledEndAt?: string
  }) => Promise<void>
  onStart: (item: PlannerWorkItem) => Promise<void>
  onComplete: (item: PlannerWorkItem) => Promise<void>
  onDraftFollowUp: (item: PlannerWorkItem) => Promise<void>
}

export default function TodayWidget({
  data,
  boards,
  selectedItemId,
  onSelectItem,
  onCreate,
  onStart,
  onComplete,
  onDraftFollowUp
}: TodayWidgetProps) {
  return (
    <WidgetFrame
      title="Today Focus"
      eyebrow="Day plan"
      description="Pick the work that must move today and keep carry-over visible instead of hidden."
      className="planner-widget-hero"
      aside={<span className="planner-kpi">{data.items.length} focused</span>}
    >
      <WorkItemComposer boards={boards} onCreate={onCreate} />
      <div className="planner-stack">
        {data.items.length === 0 ? <p className="planner-empty">No work is focused for today yet.</p> : null}
        {data.items.map((item) => (
          <WorkItemCard
            key={item.id}
            item={item}
            selected={selectedItemId === item.id}
            onSelect={onSelectItem}
            onStart={onStart}
            onComplete={onComplete}
            onDraftFollowUp={onDraftFollowUp}
          />
        ))}
      </div>
      {data.carryOver.length > 0 ? (
        <div className="planner-subsection">
          <header>
            <strong>Carry-over</strong>
            <span>{data.carryOver.length} item(s)</span>
          </header>
          <div className="planner-stack">
            {data.carryOver.map((item) => (
              <WorkItemCard
                key={item.id}
                item={item}
                compact
                selected={selectedItemId === item.id}
                onSelect={onSelectItem}
                onStart={onStart}
                onComplete={onComplete}
                onDraftFollowUp={onDraftFollowUp}
              />
            ))}
          </div>
        </div>
      ) : null}
    </WidgetFrame>
  )
}
