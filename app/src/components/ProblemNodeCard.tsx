import type { ProblemNodeData } from '../types/graph'

interface Props {
  data: ProblemNodeData
  onEdit?: () => void
}

function ProblemNodeCard({ data, onEdit }: Props) {
  return (
    <div className="node-card node-problem">
      <div className="node-card-header">
        <div className="node-title">Hypotes</div>
        {onEdit ? (
          <button type="button" className="node-edit-button" onClick={onEdit}>
            Redigera
          </button>
        ) : null}
      </div>
      <h3>{data.name}</h3>
      {data.notes ? <p>{data.notes}</p> : null}
      <div className="problem-meta">
        <span className="node-badge">säkerhet: {data.confidenceLevel}</span>
        <span className="node-badge node-badge-muted">status: {data.status}</span>
      </div>
    </div>
  )
}

export default ProblemNodeCard
