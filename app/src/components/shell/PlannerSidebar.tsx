interface PlannerSidebarProps {
  current:
    | 'dashboard'
    | 'daily'
    | 'week'
    | 'parkpal'
    | 'connections'
    | 'skills'
    | 'research'
    | 'media'
    | 'service-explainer'
    | 'ha'
    | 'tv'
    | 'bg-remover'
    | 'articles'
  | 'jobs'
  onNavigate: (path: string) => void
}

const items = [
  { id: 'dashboard', label: 'Home', path: '/' },
  { id: 'daily', label: 'Daily', path: '/boards/daily' },
  { id: 'week', label: 'Week', path: '/week' },
  { id: 'parkpal', label: 'Parkpal', path: '/parkpal' },
  { id: 'connections', label: 'Connections', path: '/connections' },
  { id: 'skills', label: 'Skills', path: '/skills' },
  { id: 'research', label: 'Research', path: '/research' },
  { id: 'media', label: 'Media', path: '/media' },
  { id: 'service-explainer', label: 'Explainer', path: '/service-explainer' },
  { id: 'ha', label: 'HA', path: '/ha' },
  { id: 'tv', label: 'TV', path: '/tv' },
  { id: 'bg-remover', label: 'BG Remover', path: '/bg-remover' },
  { id: 'articles', label: 'SEO Artiklar', path: '/articles' },
  { id: 'jobs', label: 'Batch Jobs', path: '/jobs' },
] as const

export default function PlannerSidebar({ current, onNavigate }: PlannerSidebarProps) {
  return (
    <aside className="planner-sidebar">
      <div className="planner-sidebar-brand">
        <strong>Operator Hub</strong>
      </div>

      <div className="planner-sidebar-section">
        <span className="planner-sidebar-label">Workspaces</span>
        <div className="planner-sidebar-nav">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={current === item.id ? 'planner-sidebar-item planner-sidebar-item-active' : 'planner-sidebar-item'}
              onClick={() => onNavigate(item.path)}
            >
              <strong>{item.label}</strong>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
