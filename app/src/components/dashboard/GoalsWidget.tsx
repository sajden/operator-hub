import WidgetFrame from './WidgetFrame'
import type { GoalsWidgetData } from '../../types/planner'

interface GoalsWidgetProps {
  data: GoalsWidgetData
}

export default function GoalsWidget({ data }: GoalsWidgetProps) {
  return (
    <WidgetFrame
      title="Current Direction"
      eyebrow="Direction"
      description="See the larger tracks that should give meaning to today's work."
      aside={<span className="planner-kpi">{data.goals.length}</span>}
    >
      <div className="planner-stack">
        {data.goals.length === 0 ? <p className="planner-empty">No active goals yet.</p> : null}
        {data.goals.map((goal) => (
          <article key={goal.id} className="planner-goal-card">
            <strong>{goal.name}</strong>
            <p>{goal.description}</p>
            <div className="planner-meta-row">
              <span>{goal.horizon}</span>
              {goal.targetDate ? <span>{goal.targetDate}</span> : null}
            </div>
          </article>
        ))}
      </div>
    </WidgetFrame>
  )
}
