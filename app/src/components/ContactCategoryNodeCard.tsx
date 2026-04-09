export interface ContactCategoryNodeData {
  name: string
  audienceName: string
  count: number
}

interface Props {
  data: ContactCategoryNodeData
}

function ContactCategoryNodeCard({ data }: Props) {
  return (
    <div className="node-card node-contact-category">
      <div className="node-card-header">
        <div className="node-title">Kontaktkategori</div>
      </div>
      <h3>{data.name}</h3>
      <p>{data.audienceName}</p>
      <span className="node-badge">{data.count} spår</span>
    </div>
  )
}

export default ContactCategoryNodeCard
