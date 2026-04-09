export interface ContactTrackNodeData {
  outreachId: string
  categoryName: string
  community: string
  status: string
}

interface Props {
  data: ContactTrackNodeData
  onEdit?: () => void
}

function ContactTrackNodeCard({ data, onEdit }: Props) {
  return (
    <div className="node-card node-contact-track">
      <div className="node-card-header">
        <div className="node-title">Kontaktspår</div>
        {onEdit ? (
          <button type="button" className="node-edit-button" onClick={onEdit}>
            Redigera
          </button>
        ) : null}
      </div>
      <h3>{data.community}</h3>
      <p>{data.categoryName}</p>
      <span className="node-badge node-badge-muted">status: {data.status}</span>
    </div>
  )
}

export default ContactTrackNodeCard
