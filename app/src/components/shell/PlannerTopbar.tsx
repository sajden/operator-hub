interface PlannerTopbarProps {
  title?: string
  subtitle?: string
  workspace: string
  signal: 'all' | 'follow_up' | 'avoidance' | 'high_priority'
  compact?: boolean
  utilityActionLabel?: string | null
  utilityActionBusyLabel?: string | null
  utilityActionPending?: boolean
  syncStatusLabel?: string | null
  onWorkspaceChange: (workspace: string) => void
  onSignalChange: (signal: 'all' | 'follow_up' | 'avoidance' | 'high_priority') => void
  onUtilityAction?: () => void
}

export default function PlannerTopbar({
  title,
  subtitle,
  workspace,
  signal,
  compact = false,
  utilityActionLabel,
  utilityActionBusyLabel,
  utilityActionPending = false,
  syncStatusLabel,
  onWorkspaceChange,
  onSignalChange,
  onUtilityAction
}: PlannerTopbarProps) {
  return (
    <header className={compact ? 'planner-topbar planner-topbar-compact' : 'planner-topbar'}>
      {!compact && title ? (
        <div className="planner-topbar-copy">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      ) : null}

      <div className="planner-topbar-controls">
        <label className="planner-topbar-control">
          <span>Workspace</span>
          <select value={workspace} onChange={(event) => onWorkspaceChange(event.target.value)}>
            <option value="dashboard">Dashboard</option>
            <option value="daily">Daily board</option>
            <option value="week">Week view</option>
            <option value="parkpal">Parkpal</option>
            <option value="connections">Connections</option>
            <option value="skills">Skills</option>
            <option value="research">Research</option>
            <option value="media">Media</option>
            <option value="service-explainer">Service explainer</option>
            <option value="ha">HA map</option>
            <option value="tv">TV wallboard</option>
            <option value="bg-remover">BG Remover</option>
          </select>
        </label>

        <label className="planner-topbar-control">
          <span>Signal</span>
          <select value={signal} onChange={(event) => onSignalChange(event.target.value as PlannerTopbarProps['signal'])}>
            <option value="all">All work</option>
            <option value="follow_up">Follow-ups</option>
            <option value="avoidance">Avoided</option>
            <option value="high_priority">High priority</option>
          </select>
        </label>

        {utilityActionLabel && onUtilityAction ? (
          <div className="planner-topbar-action">
            <button type="button" onClick={onUtilityAction} disabled={utilityActionPending}>
              {utilityActionPending ? utilityActionBusyLabel ?? utilityActionLabel : utilityActionLabel}
            </button>
          </div>
        ) : null}

        {syncStatusLabel ? <div className="planner-topbar-sync-status">{syncStatusLabel}</div> : null}
      </div>
    </header>
  )
}
