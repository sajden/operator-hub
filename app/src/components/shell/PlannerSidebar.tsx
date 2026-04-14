import { routes } from '../../data/routes'

interface PlannerSidebarProps {
  current: string
  onNavigate: (path: string) => void
}

export default function PlannerSidebar({ current, onNavigate }: PlannerSidebarProps) {
  return (
    <aside className="planner-sidebar">
      <div className="planner-sidebar-brand">
        <strong>Operator Hub</strong>
      </div>

      <div className="planner-sidebar-section">
        <span className="planner-sidebar-label">Workspaces</span>
        <div className="planner-sidebar-nav">
          {routes.map((route) => (
            <button
              key={route.id}
              type="button"
              className={current === route.id ? 'planner-sidebar-item planner-sidebar-item-active' : 'planner-sidebar-item'}
              onClick={() => onNavigate(route.path)}
            >
              <strong>{route.label}</strong>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
