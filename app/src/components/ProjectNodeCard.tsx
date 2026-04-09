import type { ProjectNodeData } from '../types/graph'

interface Props {
  data: ProjectNodeData
  onEdit?: () => void
}

function ProjectNodeCard({ data, onEdit }: Props) {
  return (
    <div className="node-card node-project">
      <div className="node-card-header">
        <div className="node-title">Projekt</div>
        {onEdit ? (
          <button type="button" className="node-edit-button" onClick={onEdit}>
            Redigera
          </button>
        ) : null}
      </div>
      <h3>{data.name}</h3>
      <p>{data.summary}</p>
      <ul>
        {data.strengths.map((strength) => (
          <li key={strength}>{strength}</li>
        ))}
      </ul>
    </div>
  )
}

export default ProjectNodeCard
