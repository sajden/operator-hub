import type { GraphOutreachEntry } from '../types/graph'

interface AudienceOption {
  id: string
  name: string
}

interface OutreachInspectorProps {
  outreach: GraphOutreachEntry | undefined
  audiences: AudienceOption[]
  editMode: boolean
  onChangeField: (field: keyof GraphOutreachEntry, value: string) => void
  onRemove: (entryId: string) => void
}

function OutreachInspector({
  outreach,
  audiences,
  editMode,
  onChangeField,
  onRemove
}: OutreachInspectorProps) {
  if (!outreach) {
    return (
      <aside className="inspector">
        <div className="inspector-empty">
          <h2>Inget kontaktspår valt</h2>
          <p>Välj ett kontaktspår i listan för att granska eller redigera det.</p>
        </div>
      </aside>
    )
  }

  return (
    <aside className="inspector">
      <h2>Kontaktspår</h2>
      <div className="field-stack">
        <label>
          <span>Målgrupp</span>
          <select
            value={outreach.audienceId}
            onChange={(event) => onChangeField('audienceId', event.target.value)}
            disabled={!editMode}
          >
            <option value="">Projektövergripande</option>
            {audiences.map((audience) => (
              <option key={audience.id} value={audience.id}>
                {audience.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Kategori</span>
          <input
            value={outreach.channel}
            onChange={(event) => onChangeField('channel', event.target.value)}
            disabled={!editMode}
          />
        </label>
        <label>
          <span>Community</span>
          <input
            value={outreach.community}
            onChange={(event) => onChangeField('community', event.target.value)}
            disabled={!editMode}
          />
        </label>
        <label>
          <span>Länk</span>
          <input
            value={outreach.url ?? ''}
            onChange={(event) => onChangeField('url', event.target.value)}
            disabled={!editMode}
            placeholder="https://..."
          />
        </label>
        <label>
          <span>Vinkel</span>
          <textarea
            value={outreach.angle}
            onChange={(event) => onChangeField('angle', event.target.value)}
            disabled={!editMode}
            rows={4}
          />
        </label>
        <label>
          <span>Status</span>
          <input
            value={outreach.status}
            onChange={(event) => onChangeField('status', event.target.value)}
            disabled={!editMode}
          />
        </label>
        <label>
          <span>Noteringar</span>
          <textarea
            value={outreach.notes}
            onChange={(event) => onChangeField('notes', event.target.value)}
            disabled={!editMode}
            rows={4}
          />
        </label>
        <button
          type="button"
          className="secondary-button destructive-button"
          onClick={() => onRemove(outreach.id)}
          disabled={!editMode}
        >
          Ta bort kontaktspår
        </button>
      </div>
    </aside>
  )
}

export default OutreachInspector
