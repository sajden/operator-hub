import type { PlannerActionRun } from '../../types/planner'

interface ActionResultPanelProps {
  run: PlannerActionRun | null
}

export default function ActionResultPanel({ run }: ActionResultPanelProps) {
  if (!run) return null

  return (
    <section className={run.status === 'failed' ? 'planner-action-result planner-action-result-error' : 'planner-action-result'}>
      <header>
        <strong>{run.status === 'failed' ? 'Action failed' : 'Action result'}</strong>
        {run.resultSummary ? <span>{run.resultSummary}</span> : null}
      </header>
      {run.errorMessage ? <p>{run.errorMessage}</p> : null}
      {run.artifacts.length > 0 ? (
        <div className="planner-action-artifacts">
          {run.artifacts.map((artifact, index) => (
            <article key={`${artifact.label}-${index}`}>
              <strong>{artifact.label}</strong>
              {artifact.type === 'link' && artifact.href ? (
                <a href={artifact.href}>{artifact.href}</a>
              ) : (
                <pre>{artifact.content}</pre>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
