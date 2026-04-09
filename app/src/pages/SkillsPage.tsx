import { useEffect, useMemo, useState } from 'react'
import PlannerSidebar from '../components/shell/PlannerSidebar'
import PlannerTopbar from '../components/shell/PlannerTopbar'
import { loadHubSkills, loadHubTools } from '../data/plannerClient'
import type { HubSkillsPayload, HubToolDefinition, HubToolsPayload } from '../types/planner'

type SkillSignal = 'all' | 'follow_up' | 'avoidance' | 'high_priority'

interface SkillsPageProps {
  onNavigate: (path: string) => void
  theme: 'light' | 'dark' | string
  onSetTheme: (theme: 'light' | 'dark') => void
}

function usageExample(name: string, required: string[] = []) {
  const body =
    required.length > 0
      ? required.reduce<Record<string, string>>((acc, key) => {
          acc[key] = '<value>'
          return acc
        }, {})
      : {}

  return `{\n  "tool": "${name}",\n  "arguments": ${JSON.stringify(body, null, 2).replace(/\n/g, '\n  ')}\n}`
}

function propertiesList(definition: HubToolDefinition) {
  return Object.keys(definition.inputSchema.properties ?? {})
}

function capabilityGroup(name: string) {
  if (name.includes('search') || name.includes('research') || name.includes('keyword')) return 'Research'
  if (name.includes('calendar')) return 'Calendar'
  if (name.includes('excel') || name.includes('workbook')) return 'Excel'
  if (name.includes('planner')) return 'Planner'
  if (name.includes('graph') || name.includes('project')) return 'Project'
  if (name.includes('media')) return 'Media'
  return 'General'
}

export default function SkillsPage({ onNavigate }: SkillsPageProps) {
  const [toolsPayload, setToolsPayload] = useState<HubToolsPayload | null>(null)
  const [skillsPayload, setSkillsPayload] = useState<HubSkillsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [signal, setSignal] = useState<SkillSignal>('all')

  async function refresh() {
    setBusy(true)
    try {
      setError(null)
      const [tools, skills] = await Promise.all([loadHubTools(), loadHubSkills()])
      setToolsPayload(tools)
      setSkillsPayload(skills)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load skills')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  function handleWorkspaceChange(workspace: string) {
    if (workspace === 'dashboard') onNavigate('/')
    if (workspace === 'daily') onNavigate('/boards/daily')
    if (workspace === 'week') onNavigate('/week')
    if (workspace === 'parkpal') onNavigate('/parkpal')
    if (workspace === 'connections') onNavigate('/connections')
    if (workspace === 'skills') onNavigate('/skills')
    if (workspace === 'research') onNavigate('/research')
    if (workspace === 'media') onNavigate('/media')
    if (workspace === 'service-explainer') onNavigate('/service-explainer')
    if (workspace === 'ha') onNavigate('/ha')
    if (workspace === 'tv') onNavigate('/tv')
    if (workspace === 'bg-remover') onNavigate('/bg-remover')
  }

  const groupedTools = useMemo(() => {
    const tools = toolsPayload?.tools ?? []
    return tools.reduce<Record<string, HubToolDefinition[]>>((acc, tool) => {
      const group = capabilityGroup(tool.name)
      acc[group] ??= []
      acc[group].push(tool)
      return acc
    }, {})
  }, [toolsPayload])

  const spotlightTool =
    toolsPayload?.tools.find((tool) => tool.name === 'capture_search_demand_insights') ??
    toolsPayload?.tools.find((tool) => tool.name === 'collect_owner_media') ??
    null

  return (
    <div className="planner-app-shell">
      <PlannerSidebar current="skills" onNavigate={onNavigate} />

      <main className="planner-workspace">
        <PlannerTopbar
          title="Skills and tools"
          subtitle="One place to see what operator-hub can do for other repos, how to call each capability, and what inputs they expect."
          workspace="skills"
          signal={signal}
          utilityActionLabel="Refresh"
          utilityActionBusyLabel="Refreshing..."
          utilityActionPending={busy}
          onWorkspaceChange={handleWorkspaceChange}
          onSignalChange={setSignal}
          onUtilityAction={() => void refresh()}
        />

        {error ? <div className="planner-inline-notice">{error}</div> : null}

        {spotlightTool ? (
          <section className="planner-skills-spotlight">
            <div>
              <span className="planner-widget-eyebrow">New capability</span>
              <h2>{spotlightTool.name}</h2>
              <p>{spotlightTool.description}</p>
            </div>
            <pre className="planner-skills-code">{usageExample(spotlightTool.name, spotlightTool.inputSchema.required)}</pre>
          </section>
        ) : null}

        <section className="planner-skills-layout">
          <div className="planner-skills-column">
            <div className="planner-skills-section-head">
              <strong>Hub tools</strong>
              <span>{toolsPayload?.tools.length ?? 0}</span>
            </div>

            {Object.entries(groupedTools).map(([group, tools]) => (
              <section key={group} className="planner-skills-group">
                <div className="planner-skills-group-head">
                  <strong>{group}</strong>
                  <span>{tools.length}</span>
                </div>

                <div className="planner-skills-grid">
                  {tools.map((tool) => (
                    <article key={tool.name} className="planner-skill-card">
                      <div className="planner-skill-head">
                        <strong>{tool.name}</strong>
                        <span>{tool.inputSchema.required?.length ?? 0} required</span>
                      </div>
                      <p>{tool.description}</p>
                      <div className="planner-skill-tags">
                        {propertiesList(tool).map((property) => (
                          <span key={property}>{property}</span>
                        ))}
                      </div>
                      <div className="planner-skill-how">
                        <span>How to use</span>
                        <pre className="planner-skills-code">{usageExample(tool.name, tool.inputSchema.required)}</pre>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="planner-skills-column planner-skills-column-side">
            <div className="planner-skills-section-head">
              <strong>Hub skills</strong>
              <span>{skillsPayload?.skills.length ?? 0}</span>
            </div>

            <div className="planner-skills-list">
              {(skillsPayload?.skills ?? []).map((skill) => (
                <article key={skill.name} className="planner-skill-card planner-skill-card-compact">
                  <div className="planner-skill-head">
                    <strong>{skill.name}</strong>
                    <span>{skill.inputSchema.required?.length ?? 0} required</span>
                  </div>
                  <p>{skill.description}</p>
                  <div className="planner-skill-tags">
                    {propertiesList(skill).map((property) => (
                      <span key={property}>{property}</span>
                    ))}
                  </div>
                  <div className="planner-skill-how">
                    <span>How to use</span>
                    <pre className="planner-skills-code">{usageExample(skill.name, skill.inputSchema.required)}</pre>
                  </div>
                </article>
              ))}
            </div>

            <section className="planner-skill-notes">
              <strong>Why this exists</strong>
              <p>Other repos should use operator-hub as the shared capability layer instead of re-implementing OAuth, media collection, planner access, or project sync logic.</p>
              <p>Use hub tools for explicit capabilities. Use hub skills for higher-level workflows that bundle hub data and reasoning.</p>
            </section>
          </aside>
        </section>
      </main>
    </div>
  )
}
