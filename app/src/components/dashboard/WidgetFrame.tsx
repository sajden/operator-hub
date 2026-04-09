import type { ReactNode } from 'react'

interface WidgetFrameProps {
  title: string
  eyebrow?: string
  description?: string
  aside?: ReactNode
  className?: string
  children: ReactNode
}

export default function WidgetFrame({ title, eyebrow, description, aside, className, children }: WidgetFrameProps) {
  return (
    <section className={className ? `planner-widget-frame ${className}` : 'planner-widget-frame'}>
      <header className="planner-widget-header">
        <div>
          {eyebrow ? <p className="planner-widget-eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p className="planner-widget-description">{description}</p> : null}
        </div>
        {aside ? <div className="planner-widget-aside">{aside}</div> : null}
      </header>
      <div className="planner-widget-body">{children}</div>
    </section>
  )
}
