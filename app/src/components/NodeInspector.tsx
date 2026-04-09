import {
  isAudienceNodeData,
  isProblemNodeData,
  isProjectNodeData,
  type ConfidenceLevel,
  type GraphNode,
  type NodeStatus
} from '../types/graph'

const CONFIDENCE_OPTIONS: ConfidenceLevel[] = ['hypotes', 'svag', 'stark']
const STATUS_OPTIONS: NodeStatus[] = ['new', 'researching', 'validated']

interface NodeInspectorProps {
  node: GraphNode | undefined
  editMode: boolean
  onClose: () => void
  onChangeField: (field: string, value: string) => void
  onChangeStrengths: (value: string) => void
  onAddChildProblem: () => void
}

function NodeInspector({
  node,
  editMode,
  onClose,
  onChangeField,
  onChangeStrengths,
  onAddChildProblem
}: NodeInspectorProps) {
  if (!node) {
    return (
      <aside className="inspector">
        <div className="inspector-empty">
          <h2>Ingen nod vald</h2>
          <p>Välj en nod i grafen för att granska eller redigera den.</p>
        </div>
      </aside>
    )
  }

  const { data } = node

  return (
    <aside className="inspector">
      <h2>{node.type === 'project' ? 'Projekt' : node.type === 'audience' ? 'Målgrupp' : 'Problem'}</h2>

      {isProjectNodeData(data) ? (
        <div className="field-stack">
          <label>
            <span>Namn</span>
            <input
              value={data.name}
              onChange={(event) => onChangeField('name', event.target.value)}
              disabled={!editMode}
            />
          </label>
          <label>
            <span>Sammanfattning</span>
            <textarea
              value={data.summary}
              onChange={(event) => onChangeField('summary', event.target.value)}
              disabled={!editMode}
              rows={4}
            />
          </label>
          <label>
            <span>Styrkor (en per rad)</span>
            <textarea
              value={data.strengths.join('\n')}
              onChange={(event) => onChangeStrengths(event.target.value)}
              disabled={!editMode}
              rows={5}
            />
          </label>
        </div>
      ) : null}

      {isAudienceNodeData(data) ? (
        <div className="field-stack">
          <label>
            <span>Namn</span>
            <input
              value={data.name}
              onChange={(event) => onChangeField('name', event.target.value)}
              disabled={!editMode}
            />
          </label>
          <label>
            <span>Varför relevant</span>
            <textarea
              value={data.relevanceWhy}
              onChange={(event) => onChangeField('relevanceWhy', event.target.value)}
              disabled={!editMode}
              rows={5}
            />
          </label>
          <label>
            <span>Säkerhet</span>
            <select
              value={data.confidenceLevel}
              onChange={(event) => onChangeField('confidenceLevel', event.target.value)}
              disabled={!editMode}
            >
              {CONFIDENCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              value={data.status}
              onChange={(event) => onChangeField('status', event.target.value)}
              disabled={!editMode}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="secondary-button" onClick={onAddChildProblem} disabled={!editMode}>
            Lägg till underproblem
          </button>
        </div>
      ) : null}

      {isProblemNodeData(data) ? (
        <div className="field-stack">
          <label>
            <span>Namn</span>
            <input
              value={data.name}
              onChange={(event) => onChangeField('name', event.target.value)}
              disabled={!editMode}
            />
          </label>
          <label>
            <span>Säkerhet</span>
            <select
              value={data.confidenceLevel}
              onChange={(event) => onChangeField('confidenceLevel', event.target.value)}
              disabled={!editMode}
            >
              {CONFIDENCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              value={data.status}
              onChange={(event) => onChangeField('status', event.target.value)}
              disabled={!editMode}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </aside>
  )
}

export default NodeInspector
