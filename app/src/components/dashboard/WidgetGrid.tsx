import type { ReactNode } from 'react'

interface WidgetGridProps {
  children: ReactNode
  mode?: 'desktop' | 'tv'
}

export default function WidgetGrid({ children, mode = 'desktop' }: WidgetGridProps) {
  return <div className={mode === 'tv' ? 'planner-widget-grid planner-widget-grid-tv' : 'planner-widget-grid'}>{children}</div>
}
