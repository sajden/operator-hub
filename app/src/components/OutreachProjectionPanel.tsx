import type { OutreachProjection } from '../types/graph'

interface OutreachProjectionPanelProps {
  projection: OutreachProjection
  filter: 'all' | 'audiences' | 'problems' | 'outreach' | 'content'
}

function OutreachProjectionPanel({ projection, filter }: OutreachProjectionPanelProps) {
  const showAudiences = filter === 'all' || filter === 'audiences'
  const showProblems = filter === 'all' || filter === 'problems'
  const showOutreach = filter === 'all' || filter === 'outreach'
  const showContent = filter === 'all' || filter === 'content'

  return (
    <section className="projection-panel">
      <div className="projection-header">
        <div>
          <p className="eyebrow">Härledd vy</p>
          <h2>Outreach-projektion</h2>
        </div>
        <p className="projection-summary">
          {projection.audiences.length} målgrupper, {projection.problems.length} problem, {projection.outreach.length} kontaktspår, {projection.content.length} utkast
        </p>
      </div>

      <div className="projection-grid">
        {showAudiences ? (
          <div className="projection-card">
          <h3>Målgrupper</h3>
          <div className="projection-table-wrap">
            <table className="projection-table">
              <thead>
                <tr>
                  <th>Namn</th>
                  <th>Säkerhet</th>
                  <th>Status</th>
                  <th>Förälder</th>
                </tr>
              </thead>
              <tbody>
                {projection.audiences.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.confidenceLevel}</td>
                    <td>{row.status}</td>
                    <td>{row.parentId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        ) : null}

        {showProblems ? (
          <div className="projection-card">
          <h3>Problem</h3>
          <div className="projection-table-wrap">
            <table className="projection-table">
              <thead>
                <tr>
                  <th>Namn</th>
                  <th>Säkerhet</th>
                  <th>Status</th>
                  <th>Målgrupp</th>
                </tr>
              </thead>
              <tbody>
                {projection.problems.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.confidenceLevel}</td>
                    <td>{row.status}</td>
                    <td>{row.parentAudienceId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        ) : null}

        {showOutreach ? (
          <div className="projection-card">
          <h3>Outreach</h3>
          <div className="projection-table-wrap">
            <table className="projection-table">
              <thead>
                <tr>
                  <th>Målgrupp</th>
                  <th>Kanal</th>
                  <th>Community</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projection.outreach.map((row) => (
                  <tr key={row.id}>
                    <td>{row.audienceId}</td>
                    <td>{row.channel}</td>
                    <td>{row.community}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        ) : null}
        {showContent ? (
          <div className="projection-card">
            <h3>Content</h3>
            <div className="projection-table-wrap">
              <table className="projection-table">
                <thead>
                  <tr>
                    <th>Plattform</th>
                    <th>Titel</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.content.map((row) => (
                    <tr key={row.id}>
                      <td>{row.platform}</td>
                      <td>{row.title}</td>
                      <td>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default OutreachProjectionPanel
