import { useState } from 'react'
import PlannerSidebar from '../components/shell/PlannerSidebar'
import type { PageProps } from '../data/routes'

const HUB = import.meta.env.OPERATOR_HUB_URL ?? ''

interface AgentMeta {
  id: string
  name: string
  description: string
  inputSchema: Record<string, { type: string; description: string }>
  outputSchema: Record<string, { type: string; nullable?: boolean; description: string }>
}

interface AgentRun {
  agentId: string
  input: Record<string, string>
  output: Record<string, unknown> | null
  error: string | null
  running: boolean
}

function AgentCard({ agent }: { agent: AgentMeta }) {
  const inputFields = Object.entries(agent.inputSchema)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(inputFields.map(([k]) => [k, '']))
  )
  const [run, setRun] = useState<AgentRun | null>(null)

  async function handleRun() {
    setRun({ agentId: agent.id, input: values, output: null, error: null, running: true })
    try {
      const res = await fetch(`${HUB}/api/agents/${agent.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      })
      const data = await res.json()
      if (data.ok) {
        setRun(r => r && ({ ...r, output: data.output, running: false }))
      } else {
        setRun(r => r && ({ ...r, error: data.message ?? 'Unknown error', running: false }))
      }
    } catch (err: unknown) {
      setRun(r => r && ({ ...r, error: String(err), running: false }))
    }
  }

  return (
    <div style={{ border: '1px solid #333', borderRadius: 8, padding: 20, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 4px' }}>{agent.name}</h3>
      <p style={{ margin: '0 0 16px', color: '#999', fontSize: 13 }}>{agent.description}</p>

      {inputFields.map(([key, schema]) => (
        <div key={key} style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>
            {key} — {schema.description}
          </label>
          <textarea
            value={values[key]}
            onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
            rows={3}
            style={{ width: '100%', boxSizing: 'border-box', background: '#1a1a1a', color: '#eee', border: '1px solid #444', borderRadius: 4, padding: '6px 8px', fontSize: 13, resize: 'vertical' }}
          />
        </div>
      ))}

      <button
        onClick={handleRun}
        disabled={run?.running}
        style={{ padding: '6px 16px', borderRadius: 4, background: '#2563eb', color: '#fff', border: 'none', cursor: run?.running ? 'not-allowed' : 'pointer', opacity: run?.running ? 0.6 : 1 }}
      >
        {run?.running ? 'Running…' : 'Run'}
      </button>

      {run && !run.running && (
        <div style={{ marginTop: 14 }}>
          {run.error ? (
            <div style={{ color: '#f87171', fontSize: 13 }}>Error: {run.error}</div>
          ) : (
            <pre style={{ background: '#111', border: '1px solid #333', borderRadius: 4, padding: 12, fontSize: 12, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {JSON.stringify(run.output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

export default function AgentsPage({ onNavigate, theme, onSetTheme }: PageProps) {
  const [agents, setAgents] = useState<AgentMeta[]>([])
  const [loading, setLoading] = useState(true)

  useState(() => {
    fetch(`${HUB}/api/agents`)
      .then(r => r.json())
      .then(d => { setAgents(d.agents ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <PlannerSidebar current="agents" onNavigate={onNavigate} />
      <div style={{ flex: 1, padding: '32px 40px', maxWidth: 760 }}>
        <h1 style={{ margin: '0 0 8px' }}>Agents</h1>
        <p style={{ color: '#999', fontSize: 14, margin: '0 0 28px' }}>
          {agents.length} agent{agents.length !== 1 ? 's' : ''} registered
        </p>

        {loading && <div style={{ color: '#666' }}>Loading…</div>}

        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  )
}
