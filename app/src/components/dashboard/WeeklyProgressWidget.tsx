import WidgetFrame from './WidgetFrame'
import type { WeeklyProgressWidgetData } from '../../types/planner'

interface WeeklyProgressWidgetProps {
  data: WeeklyProgressWidgetData
}

export default function WeeklyProgressWidget({ data }: WeeklyProgressWidgetProps) {
  const stats = data.summary

  return (
    <WidgetFrame
      title="Momentum"
      eyebrow="Review"
      description="A compact read on whether the week is actually moving forward."
    >
      <div className="planner-metric-grid">
        <article>
          <span>Completed today</span>
            <strong>{stats.completedTodayCount}</strong>
        </article>
        <article>
          <span>Completed this week</span>
          <strong>{stats.completedThisWeekCount}</strong>
        </article>
        <article>
          <span>In progress</span>
          <strong>{stats.inProgressCount}</strong>
        </article>
        <article>
          <span>Carry-over</span>
          <strong>{stats.carryOverCount}</strong>
        </article>
      </div>
    </WidgetFrame>
  )
}
