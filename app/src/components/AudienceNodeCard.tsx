import type { AudienceNodeData } from '../types/graph'

interface Props {
  data: AudienceNodeData
  onEdit?: () => void
}

function AudienceNodeCard({ data, onEdit }: Props) {
  return (
    <div className="node-card node-audience">
      <div className="node-card-header">
        <div className="node-title">Målgrupp</div>
        {onEdit ? (
          <button type="button" className="node-edit-button" onClick={onEdit}>
            Redigera
          </button>
        ) : null}
      </div>
      <h3>{data.name}</h3>
      <p>{data.relevanceWhy}</p>
      <span className="node-badge">säkerhet: {data.confidenceLevel}</span>
      <span className="node-badge node-badge-muted">status: {data.status}</span>
    </div>
  )
}

export default AudienceNodeCard
