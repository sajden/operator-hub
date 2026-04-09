import { useEffect, useState } from 'react'
import { loadPlannerDashboard } from '../data/plannerClient'
import type { GoalsWidgetData, PlannerDashboardPayload, TodayWidgetData, InProgressWidgetData, WeeklyProgressWidgetData } from '../types/planner'

export default function PlannerTvPage() {
  const [payload, setPayload] = useState<PlannerDashboardPayload | null>(null)

  useEffect(() => {
    void loadPlannerDashboard('tv').then(setPayload)
  }, [])

  if (!payload) {
    return <div className="planner-loading-state">Loading TV wallboard...</div>
  }

  const todayWidget = payload.widgets.find((widget) => widget.widgetType === 'today')
  const progressWidget = payload.widgets.find((widget) => widget.widgetType === 'in_progress')
  const weeklyWidget = payload.widgets.find((widget) => widget.widgetType === 'weekly_progress')
  const goalsWidget = payload.widgets.find((widget) => widget.widgetType === 'goals')

  return (
    <main className="planner-tv-shell">
      <header className="planner-tv-header">
        <div>
          <p className="planner-widget-eyebrow">TV wallboard</p>
          <h1>{payload.view.name}</h1>
        </div>
        <div className="planner-tv-kpis">
          <span>Today {payload.summary.completedTodayCount} done</span>
          <span>Carry-over {payload.summary.carryOverCount}</span>
        </div>
      </header>

      <section className="planner-tv-grid">
        <section className="planner-tv-panel">
          <h2>Today</h2>
          <div className="planner-stack">
            {(todayWidget?.data as TodayWidgetData | undefined)?.items.map((item) => (
              <article key={item.id} className="planner-tv-item">
                <strong>{item.title}</strong>
                <span>{item.status}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="planner-tv-panel">
          <h2>In Progress</h2>
          <div className="planner-stack">
            {(progressWidget?.data as InProgressWidgetData | undefined)?.items.map((item) => (
              <article key={item.id} className="planner-tv-item">
                <strong>{item.title}</strong>
                <span>{item.importance}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="planner-tv-panel">
          <h2>Weekly Progress</h2>
          <div className="planner-tv-metrics">
            <article>
              <span>Done today</span>
              <strong>{(weeklyWidget?.data as WeeklyProgressWidgetData | undefined)?.summary.completedTodayCount ?? 0}</strong>
            </article>
            <article>
              <span>Done this week</span>
              <strong>{(weeklyWidget?.data as WeeklyProgressWidgetData | undefined)?.summary.completedThisWeekCount ?? 0}</strong>
            </article>
            <article>
              <span>Carry-over</span>
              <strong>{(weeklyWidget?.data as WeeklyProgressWidgetData | undefined)?.summary.carryOverCount ?? 0}</strong>
            </article>
          </div>
        </section>

        <section className="planner-tv-panel">
          <h2>Current Goals</h2>
          <div className="planner-stack">
            {(goalsWidget?.data as GoalsWidgetData | undefined)?.goals.map((goal) => (
              <article key={goal.id} className="planner-tv-item">
                <strong>{goal.name}</strong>
                <span>{goal.horizon}</span>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}
