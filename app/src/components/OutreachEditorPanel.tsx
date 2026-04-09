import type { GraphOutreachEntry } from '../types/graph'

interface AudienceOption {
  id: string
  name: string
}

interface OutreachEditorPanelProps {
  outreach: GraphOutreachEntry[]
  audiences: AudienceOption[]
  selectedAudienceId: string
  selectedOutreachId?: string
  editMode: boolean
  onSelectAudience: (id: string) => void
  onSelectOutreach: (id: string) => void
  onEditOutreach: (id: string) => void
  onAddOutreach: () => void
}

function OutreachEditorPanel({
  outreach,
  audiences,
  selectedAudienceId,
  selectedOutreachId,
  editMode,
  onSelectAudience,
  onSelectOutreach,
  onEditOutreach,
  onAddOutreach
}: OutreachEditorPanelProps) {
  return (
    <section className="outreach-editor">
      <div className="projection-header">
        <div>
          <p className="eyebrow">Redigerbar yta</p>
          <h2>Kontaktspår</h2>
        </div>
        <div className="toolbar">
          <select className="audience-filter" value={selectedAudienceId} onChange={(event) => onSelectAudience(event.target.value)}>
            <option value="">Projektövergripande</option>
            {audiences.map((audience) => (
              <option key={audience.id} value={audience.id}>
                {audience.name}
              </option>
            ))}
          </select>
          <button type="button" className="secondary-button" onClick={onAddOutreach} disabled={!editMode}>
            Lägg till spår
          </button>
          <span className="projection-summary">{outreach.length} spår</span>
        </div>
      </div>

      <div className="outreach-editor-grid">
        <div className="projection-card">
          <h3>Spår</h3>
          <div className="outreach-list">
            {outreach.map((entry) => (
              <div
                key={entry.id}
                className={`outreach-list-item ${selectedOutreachId === entry.id ? 'outreach-list-item-selected' : ''}`}
                onClick={() => onSelectOutreach(entry.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectOutreach(entry.id)
                  }
                }}
              >
                <div className="outreach-list-item-header">
                  <strong>{entry.community || entry.channel || entry.id}</strong>
                  <button
                    type="button"
                    className="node-edit-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onEditOutreach(entry.id)
                    }}
                  >
                    Redigera
                  </button>
                </div>
                <span>{entry.angle || 'Ingen vinkel ännu'}</span>
                {selectedOutreachId === entry.id ? (
                  <div className="outreach-list-item-details">
                    <div className="outreach-detail-row">
                      <span className="outreach-detail-label">Kategori</span>
                      <strong>{entry.channel || 'Ej satt'}</strong>
                    </div>
                    <div className="outreach-detail-row">
                      <span className="outreach-detail-label">Status</span>
                      <strong>{entry.status || 'Ej satt'}</strong>
                    </div>
                    {entry.url ? (
                      <div className="outreach-detail-row">
                        <span className="outreach-detail-label">Länk</span>
                        <a href={entry.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                          {entry.url}
                        </a>
                      </div>
                    ) : null}
                    {entry.notes ? (
                      <div className="outreach-detail-row outreach-detail-row-notes">
                        <span className="outreach-detail-label">Notering</span>
                        <p>{entry.notes}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
            {outreach.length === 0 ? <p className="projection-summary">Inga outreach-spår ännu.</p> : null}
          </div>
        </div>
      </div>
    </section>
  )
}

export default OutreachEditorPanel
