import { useEffect, useMemo, useRef, useState } from 'react'
import { Responsive } from 'react-grid-layout'
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeProps
} from 'reactflow'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import 'reactflow/dist/style.css'
import ProjectNodeCard from '../components/ProjectNodeCard'
import AudienceNodeCard from '../components/AudienceNodeCard'
import ProblemNodeCard from '../components/ProblemNodeCard'
import ContactCategoryNodeCard, { type ContactCategoryNodeData } from '../components/ContactCategoryNodeCard'
import ContactTrackNodeCard, { type ContactTrackNodeData } from '../components/ContactTrackNodeCard'
import NodeInspector from '../components/NodeInspector'
import OutreachProjectionPanel from '../components/OutreachProjectionPanel'
import OutreachEditorPanel from '../components/OutreachEditorPanel'
import OutreachInspector from '../components/OutreachInspector'
import ContentPanel from '../components/ContentPanel'
import { loadParkpalGraph, saveParkpalGraph } from '../data/loadGraph'
import { projectGraphToOutreach } from '../data/projectGraph'
import {
  isAudienceNodeData,
  isProblemNodeData,
  isProjectNodeData,
  type GraphDocument,
  type GraphNode,
  type GraphNodeData,
  type GraphContentEntry,
  type GraphOutreachEntry,
  type OutreachProjection
} from '../types/graph'

type FlowNodeData = GraphNodeData | ContactCategoryNodeData | ContactTrackNodeData
type FlowNode = Node<FlowNodeData, 'project' | 'audience' | 'problem' | 'contact_category' | 'contact_track'>
const ResponsiveGrid = Responsive as unknown as React.ComponentType<any>
const DASHBOARD_LAYOUT_KEY = 'operator-hub-parkpal-dashboard-layouts'
const DASHBOARD_WIDGETS_KEY = 'operator-hub-parkpal-dashboard-widgets'
const SUMMARY_LAYOUT_KEY = 'operator-hub-parkpal-summary-layouts'
const CONTACT_POSITION_KEY = 'operator-hub-parkpal-contact-node-positions'
type DashboardLayoutItem = {
  i: string
  x: number
  y: number
  w: number
  h: number
}
type DashboardLayouts = Record<string, DashboardLayoutItem[]>
type ContactNodePositions = Record<string, { x: number; y: number }>
type WidgetType = 'graph' | 'contact_tracks' | 'content' | 'projection' | 'counter' | 'workflow_board' | 'sent_items' | 'feedback_log'
type CounterMetric =
  | 'audiences_count'
  | 'problems_count'
  | 'contact_tracks_count'
  | 'draft_content_count'
  | 'ready_outreach_count'

interface DashboardWidget {
  id: string
  type: WidgetType
  title: string
  metric?: CounterMetric
}

const DEFAULT_LAYOUTS: DashboardLayouts = {
  lg: [
    { i: 'workflow-board-main', x: 0, y: 0, w: 12, h: 4 },
    { i: 'graph-main', x: 0, y: 4, w: 7, h: 10 },
    { i: 'contact-tracks-main', x: 7, y: 4, w: 5, h: 7 },
    { i: 'content-main', x: 0, y: 14, w: 7, h: 5 },
    { i: 'projection-main', x: 7, y: 11, w: 5, h: 8 }
  ],
  md: [
    { i: 'workflow-board-main', x: 0, y: 0, w: 10, h: 4 },
    { i: 'graph-main', x: 0, y: 4, w: 6, h: 9 },
    { i: 'contact-tracks-main', x: 6, y: 4, w: 4, h: 6 },
    { i: 'content-main', x: 0, y: 13, w: 6, h: 5 },
    { i: 'projection-main', x: 6, y: 10, w: 4, h: 8 }
  ],
  sm: [
    { i: 'workflow-board-main', x: 0, y: 0, w: 1, h: 6 },
    { i: 'graph-main', x: 0, y: 6, w: 1, h: 8 },
    { i: 'contact-tracks-main', x: 0, y: 14, w: 1, h: 6 },
    { i: 'content-main', x: 0, y: 20, w: 1, h: 6 },
    { i: 'projection-main', x: 0, y: 26, w: 1, h: 6 }
  ]
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'workflow-board-main', type: 'workflow_board', title: 'Arbetsbräda' },
  { id: 'graph-main', type: 'graph', title: 'Graf' },
  { id: 'contact-tracks-main', type: 'contact_tracks', title: 'Kontaktspår' },
  { id: 'content-main', type: 'content', title: 'Utkast' },
  { id: 'projection-main', type: 'projection', title: 'Projektion' }
]

const DEFAULT_SUMMARY_LAYOUTS: DashboardLayouts = {
  lg: [
    { i: 'audiences', x: 0, y: 0, w: 3, h: 2 },
    { i: 'problems', x: 3, y: 0, w: 3, h: 2 },
    { i: 'outreach', x: 6, y: 0, w: 3, h: 2 },
    { i: 'active-view', x: 9, y: 0, w: 3, h: 2 }
  ],
  md: [
    { i: 'audiences', x: 0, y: 0, w: 5, h: 2 },
    { i: 'problems', x: 5, y: 0, w: 5, h: 2 },
    { i: 'outreach', x: 0, y: 2, w: 5, h: 2 },
    { i: 'active-view', x: 5, y: 2, w: 5, h: 2 }
  ],
  sm: [
    { i: 'audiences', x: 0, y: 0, w: 1, h: 2 },
    { i: 'problems', x: 0, y: 2, w: 1, h: 2 },
    { i: 'outreach', x: 0, y: 4, w: 1, h: 2 },
    { i: 'active-view', x: 0, y: 6, w: 1, h: 2 }
  ]
}

const WIDGET_LIBRARY: Array<{ type: WidgetType; title: string; metric?: CounterMetric; singleton?: boolean }> = [
  { type: 'workflow_board', title: 'Arbetsbräda', singleton: true },
  { type: 'graph', title: 'Graf', singleton: true },
  { type: 'contact_tracks', title: 'Kontaktspår', singleton: true },
  { type: 'content', title: 'Utkast', singleton: true },
  { type: 'projection', title: 'Projektion', singleton: true },
  { type: 'sent_items', title: 'Skickat' },
  { type: 'feedback_log', title: 'Feedback-logg' },
  { type: 'counter', title: 'Counter: målgrupper', metric: 'audiences_count' },
  { type: 'counter', title: 'Counter: problem', metric: 'problems_count' },
  { type: 'counter', title: 'Counter: kontaktspår', metric: 'contact_tracks_count' },
  { type: 'counter', title: 'Counter: utkast', metric: 'draft_content_count' },
  { type: 'counter', title: 'Counter: redo att kontakta', metric: 'ready_outreach_count' }
]

function mergeLayouts(layouts: DashboardLayouts, fallback: DashboardLayouts): DashboardLayouts {
  const merged: DashboardLayouts = {}

  for (const breakpoint of Object.keys(fallback)) {
    const base = fallback[breakpoint] ?? []
    const current = layouts[breakpoint] ?? []
    const currentById = new Map(current.map((item) => [item.i, item]))
    const baseItems = base.map((item) => currentById.get(item.i) ?? item)
    const extraItems = current.filter((item) => !base.some((baseItem) => baseItem.i === item.i))
    merged[breakpoint] = [...baseItems, ...extraItems]
  }

  return merged
}

function loadLayouts(storageKey: string, fallback: DashboardLayouts): DashboardLayouts {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return fallback
    return mergeLayouts(JSON.parse(raw) as DashboardLayouts, fallback)
  } catch {
    return fallback
  }
}

function saveLayouts(storageKey: string, layouts: DashboardLayouts) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey, JSON.stringify(layouts))
}

function loadContactNodePositions(): ContactNodePositions {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(CONTACT_POSITION_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as ContactNodePositions
  } catch {
    return {}
  }
}

function saveContactNodePositions(positions: ContactNodePositions) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CONTACT_POSITION_KEY, JSON.stringify(positions))
}

function loadDashboardWidgets(): DashboardWidget[] {
  if (typeof window === 'undefined') return DEFAULT_WIDGETS

  try {
    const raw = window.localStorage.getItem(DASHBOARD_WIDGETS_KEY)
    if (!raw) return DEFAULT_WIDGETS
    const widgets = JSON.parse(raw) as DashboardWidget[]
    return widgets.length > 0 ? widgets : DEFAULT_WIDGETS
  } catch {
    return DEFAULT_WIDGETS
  }
}

function saveDashboardWidgets(widgets: DashboardWidget[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(DASHBOARD_WIDGETS_KEY, JSON.stringify(widgets))
}

function mergeUpdatedLayouts(current: DashboardLayouts, incoming: DashboardLayouts): DashboardLayouts {
  const merged: DashboardLayouts = {}

  for (const breakpoint of Object.keys(current)) {
    const currentItems = current[breakpoint] ?? []
    const incomingItems = incoming[breakpoint] ?? []
    const incomingById = new Map(incomingItems.map((item) => [item.i, item]))

    merged[breakpoint] = currentItems.map((item) => incomingById.get(item.i) ?? item)
  }

  return merged
}

function getViewportWidth() {
  if (typeof window === 'undefined') return 1280
  return Math.max(window.innerWidth - 32, 320)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function stopGridEvent(event: { stopPropagation: () => void }) {
  event.stopPropagation()
}

function ParkpalGraphPage() {
  const [drawerMode, setDrawerMode] = useState<'node' | 'outreach' | null>(null)
  const [panelLibraryOpen, setPanelLibraryOpen] = useState(false)
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>(() => loadDashboardWidgets())
  const [dashboardLayouts, setDashboardLayouts] = useState<DashboardLayouts>(() =>
    loadLayouts(DASHBOARD_LAYOUT_KEY, DEFAULT_LAYOUTS)
  )
  const [summaryLayouts, setSummaryLayouts] = useState<DashboardLayouts>(() =>
    loadLayouts(SUMMARY_LAYOUT_KEY, DEFAULT_SUMMARY_LAYOUTS)
  )
  const [contactNodePositions, setContactNodePositions] = useState<ContactNodePositions>(() => loadContactNodePositions())
  const [dashboardWidth, setDashboardWidth] = useState<number>(() => getViewportWidth())
  const [graph, setGraph] = useState<GraphDocument | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string>()
  const [selectedAudienceFilterId, setSelectedAudienceFilterId] = useState<string>('')
  const [selectedOutreachId, setSelectedOutreachId] = useState<string>()
  const [selectedContentId, setSelectedContentId] = useState<string>()
  const [projectionFilter, setProjectionFilter] = useState<'all' | 'audiences' | 'problems' | 'outreach' | 'content'>('all')
  const [editMode, setEditMode] = useState(false)
  const [dataSource, setDataSource] = useState<'hub' | 'fallback'>('fallback')
  const [saveMessage, setSaveMessage] = useState('Läsläge')
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [projection, setProjection] = useState<OutreachProjection>({
    audiences: [],
    problems: [],
    outreach: [],
    content: [],
    feedback: []
  })
  const autosaveTimerRef = useRef<number | null>(null)
  const lastSavedSnapshotRef = useRef<string>('')
  const inflightSaveRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    loadParkpalGraph()
      .then(({ graph: loadedGraph, source }) => {
        setDataSource(source)
        setGraph(loadedGraph)
        setSelectedNodeId(loadedGraph.nodes[0]?.id)
        setSelectedOutreachId(loadedGraph.outreach?.[0]?.id)
        setSelectedContentId(loadedGraph.content?.[0]?.id)
        lastSavedSnapshotRef.current = JSON.stringify(loadedGraph)
        setProjection(projectGraphToOutreach(loadedGraph))
      })
      .catch((error: Error) => {
        setSaveMessage(error.message)
      })
  }, [])

  useEffect(() => {
    if (!graph) return
    setProjection(projectGraphToOutreach(graph))
  }, [graph])

  const graphSnapshot = useMemo(() => (graph ? JSON.stringify(graph) : ''), [graph])
  const hasUnsavedChanges = Boolean(graph && graphSnapshot !== lastSavedSnapshotRef.current)

  useEffect(() => {
    if (!editMode || !graph) return

    if (!hasUnsavedChanges) {
      if (saveState !== 'idle' && saveState !== 'saved') {
        setSaveState('idle')
      }
      return
    }

    setSaveState((current) => (current === 'saving' ? current : 'dirty'))
    setSaveMessage('Osparade ändringar')

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void handleSave('autosave')
    }, 1800)

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [editMode, graph, graphSnapshot, hasUnsavedChanges, saveState])

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handleResize = () => setDashboardWidth(getViewportWidth())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const selectedNode = graph?.nodes.find((node) => node.id === selectedNodeId)
  const parentByTarget = new Map((graph?.edges ?? []).map((edge) => [edge.target, edge.source]))
  const audienceNameById = new Map(
    (graph?.nodes ?? [])
      .filter((node) => node.type === 'audience' && isAudienceNodeData(node.data))
      .map((node) => [node.id, node.data.name] as const)
  )
  const audienceOptions = (graph?.nodes ?? [])
    .filter((node) => node.type === 'audience' && isAudienceNodeData(node.data))
    .map((node) => ({ id: node.id, name: node.data.name }))
  const selectedAudienceFromNode =
    selectedNode?.type === 'audience'
      ? selectedNode.id
      : selectedNode?.type === 'problem'
        ? parentByTarget.get(selectedNode.id) ?? ''
        : ''
  const activeAudienceId = selectedAudienceFilterId || selectedAudienceFromNode || ''
  const filteredOutreach = (graph?.outreach ?? []).filter((entry) =>
    activeAudienceId ? entry.audienceId === activeAudienceId : true
  )
  const selectedOutreach = (graph?.outreach ?? []).find((entry) => entry.id === selectedOutreachId)

  const contactCategoryNodes: FlowNode[] = []
  const contactTrackNodes: FlowNode[] = []
  const contactEdges: Edge[] = []

  if (graph) {
    const groupedOutreach = new Map<string, GraphOutreachEntry[]>()

    for (const entry of graph.outreach ?? []) {
      const parentId = entry.audienceId || 'project-parkpal'
      const key = `${parentId}:${entry.channel}`
      groupedOutreach.set(key, [...(groupedOutreach.get(key) ?? []), entry])
    }

    Array.from(groupedOutreach.entries()).forEach(([key, entries], categoryIndex) => {
      const [parentId, channel] = key.split(':')
      const parentNode = graph.nodes.find((node) => node.id === parentId)
      const parentPosition = parentNode?.position ?? { x: 50, y: 180 }
      const categoryNodeId = `contact-category-${parentId}-${channel}`
      const audienceName = parentId === 'project-parkpal' ? 'Projektövergripande' : audienceNameById.get(parentId) ?? 'Målgrupp'
      const defaultCategoryPosition = {
        x: parentPosition.x + 40,
        y: parentPosition.y + 320 + categoryIndex * 140
      }
      const categoryPosition = contactNodePositions[categoryNodeId] ?? defaultCategoryPosition

      contactCategoryNodes.push({
        id: categoryNodeId,
        type: 'contact_category',
        position: categoryPosition,
        data: {
          name: channel.toUpperCase(),
          audienceName,
          count: entries.length
        },
        selected: selectedNodeId === categoryNodeId
      })

      contactEdges.push({
        id: `edge-${parentId}-to-${categoryNodeId}`,
        source: parentId,
        target: categoryNodeId,
        animated: false
      })

      entries.forEach((entry, trackIndex) => {
        const trackNodeId = `contact-track-${entry.id}`
        const defaultTrackPosition = {
          x: categoryPosition.x + 280,
          y: categoryPosition.y + trackIndex * 92
        }
        const trackPosition = contactNodePositions[trackNodeId] ?? defaultTrackPosition
        contactTrackNodes.push({
          id: trackNodeId,
          type: 'contact_track',
          position: trackPosition,
          data: {
            outreachId: entry.id,
            categoryName: channel.toUpperCase(),
            community: entry.community,
            status: entry.status
          },
          selected: selectedNodeId === trackNodeId
        })

        contactEdges.push({
          id: `edge-${categoryNodeId}-to-${trackNodeId}`,
          source: categoryNodeId,
          target: trackNodeId,
          animated: false
        })
      })
    })
  }

  useEffect(() => {
    if (filteredOutreach.length === 0) {
      setSelectedOutreachId(undefined)
      return
    }

    if (!selectedOutreachId || !filteredOutreach.some((entry) => entry.id === selectedOutreachId)) {
      setSelectedOutreachId(filteredOutreach[0]?.id)
    }
  }, [filteredOutreach, selectedOutreachId])

  useEffect(() => {
    const contentEntries = graph?.content ?? []
    if (contentEntries.length === 0) {
      setSelectedContentId(undefined)
      return
    }

    if (!selectedContentId || !contentEntries.some((entry) => entry.id === selectedContentId)) {
      setSelectedContentId(contentEntries[0].id)
    }
  }, [graph?.content, selectedContentId])

  const nodeTypes = useMemo(
    () => ({
      project: ({ id, data, selected }: NodeProps<FlowNodeData>) => {
        const projectData = data as GraphNodeData
        if (!isProjectNodeData(projectData)) return null
        return (
          <div className={`node-shell ${selected ? 'node-shell-selected' : ''}`}>
            <Handle type="source" position={Position.Right} />
            <ProjectNodeCard
              data={projectData}
              onEdit={() => {
                setEditMode(true)
                setSelectedNodeId(id)
                setDrawerMode('node')
              }}
            />
          </div>
        )
      },
      audience: ({ id, data, selected }: NodeProps<FlowNodeData>) => {
        const audienceData = data as GraphNodeData
        if (!isAudienceNodeData(audienceData)) return null
        return (
          <div className={`node-shell ${selected ? 'node-shell-selected' : ''}`}>
            <Handle type="target" position={Position.Left} />
            <Handle type="source" position={Position.Right} />
            <AudienceNodeCard
              data={audienceData}
              onEdit={() => {
                setEditMode(true)
                setSelectedNodeId(id)
                setDrawerMode('node')
              }}
            />
          </div>
        )
      },
      problem: ({ id, data, selected }: NodeProps<FlowNodeData>) => {
        const problemData = data as GraphNodeData
        if (!isProblemNodeData(problemData)) return null
        return (
          <div className={`node-shell ${selected ? 'node-shell-selected' : ''}`}>
            <Handle type="target" position={Position.Left} />
            <ProblemNodeCard
              data={problemData}
              onEdit={() => {
                setEditMode(true)
                setSelectedNodeId(id)
                setDrawerMode('node')
              }}
            />
          </div>
        )
      },
      contact_category: ({ data, selected }: NodeProps<FlowNodeData>) => {
        if (!('count' in data) || !('audienceName' in data)) return null
        return (
          <div className={`node-shell ${selected ? 'node-shell-selected' : ''}`}>
            <Handle type="target" position={Position.Left} />
            <Handle type="source" position={Position.Right} />
            <ContactCategoryNodeCard data={data} />
          </div>
        )
      },
      contact_track: ({ id, data, selected }: NodeProps<FlowNodeData>) => {
        if (!('outreachId' in data) || !('categoryName' in data)) return null
        return (
          <div className={`node-shell ${selected ? 'node-shell-selected' : ''}`}>
            <Handle type="target" position={Position.Left} />
            <ContactTrackNodeCard
              data={data}
              onEdit={() => {
                setEditMode(true)
                setSelectedNodeId(id)
                setSelectedOutreachId(data.outreachId)
                setDrawerMode('outreach')
              }}
            />
          </div>
        )
      }
    }),
    []
  )

  if (!graph) {
    return (
      <main className="page">
        <header className="page-header">
          <h1>Parkpal Outreach Discovery</h1>
          <p>Laddar graf...</p>
        </header>
      </main>
    )
  }

  const baseNodes: FlowNode[] = graph.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
    selected: node.id === selectedNodeId
  }))
  const nodes: FlowNode[] = [...baseNodes, ...contactCategoryNodes, ...contactTrackNodes]
  const baseEdges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    animated: false
  }))
  const edges: Edge[] = [...baseEdges, ...contactEdges]

  const updateNode = (nodeId: string, updater: (node: GraphNode) => GraphNode) => {
    setGraph((currentGraph) => {
      if (!currentGraph) return currentGraph
      return {
        ...currentGraph,
        nodes: currentGraph.nodes.map((node) => (node.id === nodeId ? updater(node) : node))
      }
    })
  }

  const handleNodeClick: NodeMouseHandler = (_, node) => {
    setSelectedNodeId(node.id)
    if (node.type === 'contact_track' && 'outreachId' in node.data) {
      setSelectedOutreachId(node.data.outreachId)
    }
  }

  const handleNodeDragStop: NodeMouseHandler = (_, node) => {
    setSelectedNodeId(node.id)
    if (node.type === 'contact_category' || node.type === 'contact_track') {
      setContactNodePositions((current) => {
        const next = {
          ...current,
          [node.id]: node.position
        }
        saveContactNodePositions(next)
        return next
      })
      return
    }
    updateNode(node.id, (currentNode) => ({
      ...currentNode,
      position: node.position
    }))
  }

  const handleChangeField = (field: string, value: string) => {
    if (!selectedNodeId) return
    updateNode(selectedNodeId, (node) => ({
      ...node,
      data: {
        ...node.data,
        [field]: value
      }
    }))
  }

  const handleChangeStrengths = (value: string) => {
    if (!selectedNodeId) return
    updateNode(selectedNodeId, (node) => ({
      ...node,
      data: {
        ...node.data,
        strengths: value
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean)
      }
    }))
  }

  const addAudience = () => {
    const label = `Målgrupp ${graph.nodes.filter((node) => node.type === 'audience').length + 1}`
    const newId = `audience-${slugify(label)}-${Date.now()}`
    const newNode: GraphNode = {
      id: newId,
      type: 'audience',
      position: { x: 430, y: 180 + graph.nodes.filter((node) => node.type === 'audience').length * 160 },
      data: {
        name: label,
        relevanceWhy: 'Lägg till en första relevanshypotes.',
        confidenceLevel: 'hypotes',
        status: 'new',
        notes: '',
        tags: [],
        updatedAt: new Date().toISOString()
      }
    }

    setGraph((currentGraph) => {
      if (!currentGraph) return currentGraph
      return {
        ...currentGraph,
        nodes: [...currentGraph.nodes, newNode],
        edges: [
          ...currentGraph.edges,
          {
            id: `edge-project-to-${newId}`,
            source: 'project-parkpal',
            target: newId
          }
        ]
      }
    })
    setSelectedNodeId(newId)
    setEditMode(true)
  }

  const addChildProblem = () => {
    if (!selectedNode || selectedNode.type !== 'audience') return

    const problemCount = graph.edges.filter((edge) => edge.source === selectedNode.id).length + 1
    const newId = `problem-${slugify(selectedNode.id)}-${Date.now()}`
    const newNode: GraphNode = {
      id: newId,
      type: 'problem',
      position: {
        x: selectedNode.position.x + 380,
        y: selectedNode.position.y + problemCount * 110 - 110
      },
      data: {
        name: `Problem ${problemCount}`,
        confidenceLevel: 'hypotes',
        status: 'new',
        notes: '',
        tags: [],
        updatedAt: new Date().toISOString()
      }
    }

    setGraph((currentGraph) => {
      if (!currentGraph) return currentGraph
      return {
        ...currentGraph,
        nodes: [...currentGraph.nodes, newNode],
        edges: [
          ...currentGraph.edges,
          {
            id: `edge-${selectedNode.id}-to-${newId}`,
            source: selectedNode.id,
            target: newId
          }
        ]
      }
    })
    setSelectedNodeId(newId)
  }

  const addOutreach = () => {
    const defaultAudienceId = activeAudienceId || (audienceOptions[0]?.id ?? '')
    const newEntry: GraphOutreachEntry = {
      id: `outreach-${Date.now()}`,
      project: graph.project.id,
      audienceId: defaultAudienceId,
      channel: 'linkedin',
      community: 'Ny community',
      angle: 'Ny outreach-vinkel',
      status: 'draft',
      notes: ''
    }

    setGraph((currentGraph) => {
      if (!currentGraph) return currentGraph
      return {
        ...currentGraph,
        outreach: [...(currentGraph.outreach ?? []), newEntry]
      }
    })
    setEditMode(true)
    setSelectedOutreachId(newEntry.id)
    setDrawerMode('outreach')
  }

  const updateOutreachField = (field: keyof GraphOutreachEntry, value: string) => {
    if (!selectedOutreachId) return

    setGraph((currentGraph) => {
      if (!currentGraph) return currentGraph
      return {
        ...currentGraph,
        outreach: (currentGraph.outreach ?? []).map((entry) =>
          entry.id === selectedOutreachId ? { ...entry, [field]: value } : entry
        )
      }
    })
  }

  const removeOutreach = (entryId: string) => {
    setGraph((currentGraph) => {
      if (!currentGraph) return currentGraph

      const nextOutreach = (currentGraph.outreach ?? []).filter((entry) => entry.id !== entryId)
      setSelectedOutreachId(nextOutreach[0]?.id)
      if (nextOutreach.length === 0) {
        setDrawerMode(null)
      }

      return {
        ...currentGraph,
        outreach: nextOutreach
      }
    })
  }

  const updateContentStatus = (contentId: string, status: string) => {
    setGraph((currentGraph) => {
      if (!currentGraph) return currentGraph
      return {
        ...currentGraph,
        content: (currentGraph.content ?? []).map((entry) =>
          entry.id === contentId
            ? {
                ...entry,
                status,
                sentAt:
                  status === 'draft'
                    ? undefined
                    : entry.sentAt ?? (['sent', 'replied', 'no_response', 'follow_up'].includes(status) ? new Date().toISOString() : undefined)
              }
            : entry
        )
      }
    })
  }

  const updateContentFields = (contentId: string, updates: Partial<GraphContentEntry>) => {
    setGraph((currentGraph) => {
      if (!currentGraph) return currentGraph
      return {
        ...currentGraph,
        content: (currentGraph.content ?? []).map((entry) =>
          entry.id === contentId ? { ...entry, ...updates } : entry
        )
      }
    })
  }

  const createContentEntry = (payload: Partial<GraphContentEntry>) => {
    const newId = `content-${Date.now()}`

    setGraph((currentGraph) => {
      if (!currentGraph) return currentGraph

      const newEntry: GraphContentEntry = {
        id: newId,
        project: currentGraph.project.id,
        audienceId: payload.audienceId ?? '',
        outreachId: payload.outreachId ?? '',
        platform: payload.platform ?? 'reddit',
        title: 'Nytt utkast',
        body: '',
        docLink: '',
        status: 'draft',
        sentAt: undefined,
        postedChannel: '',
        postUrl: ''
      }

      return {
        ...currentGraph,
        content: [...(currentGraph.content ?? []), newEntry]
      }
    })

    return newId
  }

  const duplicateContentEntry = (contentId: string) => {
    const source = (graph?.content ?? []).find((entry) => entry.id === contentId)
    if (!source) return

    const newId = `content-${Date.now()}`
    const duplicated: GraphContentEntry = {
      ...source,
      id: newId,
      title: `${source.title} (kopia)`,
      status: 'draft',
      sentAt: undefined,
      postedChannel: '',
      postUrl: ''
    }

    setGraph((currentGraph) => {
      if (!currentGraph) return currentGraph
      return {
        ...currentGraph,
        content: [...(currentGraph.content ?? []), duplicated]
      }
    })

    setSelectedContentId(newId)
  }

  const workflowColumns = [
    { id: 'todo', title: 'To do', statuses: ['draft', 'ready'] },
    { id: 'in-progress', title: 'In progress', statuses: ['sent', 'follow_up'] },
    { id: 'done', title: 'Done', statuses: ['replied', 'no_response'] }
  ]

  const handleWorkflowDrop = (columnId: string, contentId: string) => {
    const nextStatus =
      columnId === 'todo' ? 'draft' : columnId === 'in-progress' ? 'sent' : 'replied'
    updateContentStatus(contentId, nextStatus)
    setSelectedContentId(contentId)
  }

  const addFeedbackEntry = (contentId: string, summary: string, nextStep: string) => {
    setGraph((currentGraph) => {
      if (!currentGraph) return currentGraph
      const contentEntry = (currentGraph.content ?? []).find((entry) => entry.id === contentId)
      const feedbackEntry = {
        id: `feedback-${Date.now()}`,
        project: currentGraph.project.id,
        audienceId: contentEntry?.audienceId ?? '',
        contentId,
        outreachId: contentEntry?.outreachId ?? '',
        source: contentEntry?.title ?? 'Feedback',
        summary,
        nextStep,
        status: 'logged'
      }
      return {
        ...currentGraph,
        feedback: [...(currentGraph.feedback ?? []), feedbackEntry]
      }
    })
  }

  const handleSave = async (mode: 'manual' | 'autosave' = 'manual') => {
    if (!graph || !hasUnsavedChanges || inflightSaveRef.current) return

    setSaveState('saving')
    setSaveMessage(mode === 'autosave' ? 'Sparar och synkar automatiskt...' : 'Sparar och synkar...')

    const savePromise = (async () => {
      try {
        const result = await saveParkpalGraph(graph)
        lastSavedSnapshotRef.current = JSON.stringify(graph)
        setProjection(projectGraphToOutreach(graph))
        setDataSource('hub')
        setSaveState('saved')
        setLastSyncedAt(new Date().toISOString())
        if (result.sync) {
          const audienceCount = result.sync.audiences?.syncedRowCount ?? 0
          const problemCount = result.sync.problems?.syncedRowCount ?? 0
          const outreachCount = result.sync.outreach?.syncedRowCount ?? 0
          const contentCount = result.sync.content?.syncedRowCount ?? 0
          const feedbackCount = result.sync.feedback?.syncedRowCount ?? 0
          setSaveMessage(
            `Sparat och synkat ${audienceCount} målgrupper, ${problemCount} problem, ${outreachCount} kontaktspår, ${contentCount} utkast, ${feedbackCount} feedback`
          )
        } else {
          setSaveMessage(result.message)
        }
      } catch (error) {
        setSaveState('error')
        setSaveMessage(error instanceof Error ? error.message : 'Sparning misslyckades')
      } finally {
        inflightSaveRef.current = null
      }
    })()

    inflightSaveRef.current = savePromise
    await savePromise
  }

  const statusLabel =
    saveState === 'saving'
      ? 'Sparar'
      : saveState === 'dirty'
        ? 'Osparat'
        : saveState === 'saved'
          ? 'Synkat'
          : saveState === 'error'
            ? 'Fel'
            : editMode
              ? 'Redigeringsläge'
              : 'Läsläge'

  const summaryCards = [
    {
      id: 'audiences',
      label: 'Målgrupper',
      value: projection.audiences.length,
      onClick: () => setProjectionFilter('audiences')
    },
    {
      id: 'problems',
      label: 'Problem',
      value: projection.problems.length,
      onClick: () => setProjectionFilter('problems')
    },
    {
      id: 'outreach',
      label: 'Kontaktspår',
      value: projection.outreach.length,
      onClick: () => setProjectionFilter('outreach')
    },
    {
      id: 'ready',
      label: 'Redo att kontakta',
      value: projection.outreach.filter((entry) => ['ready', 'queued', 'redo'].includes(entry.status.toLowerCase())).length,
      onClick: () => setProjectionFilter('outreach')
    },
    {
      id: 'content',
      label: 'Utkast',
      value: projection.content?.length ?? 0,
      onClick: () => setProjectionFilter('content')
    },
    {
      id: 'synced',
      label: 'Senast synkat',
      value: lastSyncedAt
        ? new Intl.DateTimeFormat('sv-SE', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: 'short'
          }).format(new Date(lastSyncedAt))
        : 'Inte ännu'
    }
  ]

  const handleLayoutChange = (_currentLayout: unknown, allLayouts: unknown) => {
    const nextLayouts = mergeUpdatedLayouts(dashboardLayouts, allLayouts as DashboardLayouts)
    setDashboardLayouts(nextLayouts)
    saveLayouts(DASHBOARD_LAYOUT_KEY, nextLayouts)
  }

  const handleSummaryLayoutChange = (_currentLayout: unknown, allLayouts: unknown) => {
    const nextLayouts = allLayouts as DashboardLayouts
    setSummaryLayouts(nextLayouts)
    saveLayouts(SUMMARY_LAYOUT_KEY, nextLayouts)
  }

  const addWidget = (widgetTemplate: { type: WidgetType; title: string; metric?: CounterMetric; singleton?: boolean }) => {
    if (widgetTemplate.singleton && dashboardWidgets.some((widget) => widget.type === widgetTemplate.type)) {
      setPanelLibraryOpen(false)
      return
    }

    const widgetId = `${widgetTemplate.type}-${Date.now()}`
    const nextWidget: DashboardWidget = {
      id: widgetId,
      type: widgetTemplate.type,
      title: widgetTemplate.title,
      metric: widgetTemplate.metric
    }

    const appendLayoutItem = (layouts: DashboardLayouts): DashboardLayouts => {
      const nextLayouts: DashboardLayouts = {}

      for (const breakpoint of Object.keys(layouts)) {
        const items = layouts[breakpoint] ?? []
        const maxY = items.reduce((max, item) => Math.max(max, item.y + item.h), 0)
        const width = breakpoint === 'lg' ? (widgetTemplate.type === 'counter' ? 3 : 5) : breakpoint === 'md' ? (widgetTemplate.type === 'counter' ? 5 : 4) : 1
        const height = widgetTemplate.type === 'graph' ? 9 : widgetTemplate.type === 'counter' ? 2 : 6
        nextLayouts[breakpoint] = [
          ...items,
          {
            i: widgetId,
            x: 0,
            y: maxY,
            w: width,
            h: height
          }
        ]
      }

      return nextLayouts
    }

    setDashboardWidgets((current) => {
      const next = [...current, nextWidget]
      saveDashboardWidgets(next)
      return next
    })
    setDashboardLayouts((current) => {
      const next = appendLayoutItem(current)
      saveLayouts(DASHBOARD_LAYOUT_KEY, next)
      return next
    })
    setPanelLibraryOpen(false)
  }

  const removeWidget = (widgetId: string) => {
    setDashboardWidgets((current) => {
      const next = current.filter((widget) => widget.id !== widgetId)
      saveDashboardWidgets(next)
      return next
    })
    setDashboardLayouts((current) => {
      const next: DashboardLayouts = {}
      for (const breakpoint of Object.keys(current)) {
        next[breakpoint] = (current[breakpoint] ?? []).filter((item) => item.i !== widgetId)
      }
      saveLayouts(DASHBOARD_LAYOUT_KEY, next)
      return next
    })
  }

  const resetDashboardLayout = () => {
    setDashboardLayouts(DEFAULT_LAYOUTS)
    setSummaryLayouts(DEFAULT_SUMMARY_LAYOUTS)
    setDashboardWidgets(DEFAULT_WIDGETS)
    saveLayouts(DASHBOARD_LAYOUT_KEY, DEFAULT_LAYOUTS)
    saveLayouts(SUMMARY_LAYOUT_KEY, DEFAULT_SUMMARY_LAYOUTS)
    saveDashboardWidgets(DEFAULT_WIDGETS)
  }

  const getCounterValue = (metric?: CounterMetric) => {
    switch (metric) {
      case 'audiences_count':
        return projection.audiences.length
      case 'problems_count':
        return projection.problems.length
      case 'contact_tracks_count':
        return projection.outreach.length
      case 'draft_content_count':
        return (graph?.content ?? []).filter((entry) => entry.status === 'draft').length
      case 'ready_outreach_count':
        return projection.outreach.filter((entry) => ['ready', 'queued', 'redo'].includes(entry.status.toLowerCase())).length
      default:
        return 0
    }
  }

  const renderDashboardWidget = (widget: DashboardWidget) => {
    if (widget.type === 'graph') {
      return (
        <section key={widget.id} className="dashboard-panel dashboard-panel-canvas">
          <div className="dashboard-panel-header">
            <div>
              <p className="eyebrow">Arbetsyta</p>
              <h2>{widget.title}</h2>
            </div>
            <div className="toolbar">
              <button
                type="button"
                className={editMode ? 'secondary-button' : 'primary-button'}
                onClick={() => setEditMode((current) => !current)}
              >
                {editMode ? 'Avsluta redigering' : 'Börja redigera'}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleSave('manual')}
                disabled={!editMode || saveState === 'saving' || !hasUnsavedChanges}
              >
                {saveState === 'saving' ? 'Sparar...' : 'Spara graf'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setEditMode(true)
                  setDrawerMode('node')
                }}
                disabled={!selectedNode}
              >
                Redigera vald nod
              </button>
              <button type="button" className="secondary-button" onClick={addAudience} disabled={!editMode}>
                Lägg till målgrupp
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={addChildProblem}
                disabled={!editMode || selectedNode?.type !== 'audience'}
              >
                Lägg till underproblem
              </button>
              <button type="button" className="ghost-button" onClick={() => removeWidget(widget.id)}>
                Ta bort
              </button>
            </div>
          </div>
          <div className="dashboard-panel-body dashboard-panel-body-fill">
            <section className="canvas-wrap">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                nodeTypes={nodeTypes}
                onNodeClick={handleNodeClick}
                onNodeDragStart={(_, node) => setSelectedNodeId(node.id)}
                onNodeDragStop={handleNodeDragStop}
                nodesDraggable={editMode}
                elementsSelectable={false}
                panOnDrag={!editMode}
                selectionOnDrag={false}
                nodesConnectable={false}
                zoomOnDoubleClick={false}
              >
                <Background />
                <Controls />
              </ReactFlow>
            </section>
          </div>
        </section>
      )
    }

    if (widget.type === 'contact_tracks') {
      return (
        <section key={widget.id} className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <p className="eyebrow">Redigera</p>
              <h2>{widget.title}</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => removeWidget(widget.id)}>
              Ta bort
            </button>
          </div>
          <div className="dashboard-panel-body">
            <OutreachEditorPanel
              outreach={filteredOutreach}
              audiences={audienceOptions}
              selectedAudienceId={selectedAudienceFilterId}
              selectedOutreachId={selectedOutreachId}
              editMode={editMode}
              onSelectAudience={setSelectedAudienceFilterId}
              onSelectOutreach={setSelectedOutreachId}
              onEditOutreach={(id) => {
                setEditMode(true)
                setSelectedOutreachId(id)
                setDrawerMode('outreach')
              }}
              onAddOutreach={addOutreach}
            />
          </div>
        </section>
      )
    }

    if (widget.type === 'content') {
      return (
        <section key={widget.id} className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <p className="eyebrow">Innehåll</p>
              <h2>{widget.title}</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => removeWidget(widget.id)}>
              Ta bort
            </button>
          </div>
          <div className="dashboard-panel-body">
            <ContentPanel
              content={(graph.content ?? []) as GraphContentEntry[]}
              feedback={graph.feedback ?? []}
              outreach={graph.outreach ?? []}
              audiences={audienceOptions}
              activeAudienceId={activeAudienceId}
              selectedContentId={selectedContentId}
              onSelectContent={setSelectedContentId}
              onCreateContent={createContentEntry}
              onDuplicateContent={duplicateContentEntry}
              onSetContentStatus={updateContentStatus}
              onUpdateContentFields={updateContentFields}
              onAddFeedback={addFeedbackEntry}
            />
          </div>
        </section>
      )
    }

    if (widget.type === 'workflow_board') {
      return (
        <section key={widget.id} className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <p className="eyebrow">Operativt</p>
              <h2>{widget.title}</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => removeWidget(widget.id)}>
              Ta bort
            </button>
          </div>
          <div className="dashboard-panel-body" onMouseDown={stopGridEvent} onPointerDown={stopGridEvent}>
            <section className="workflow-board" onMouseDown={stopGridEvent} onPointerDown={stopGridEvent}>
              {workflowColumns.map((column) => {
                const entries = (graph.content ?? []).filter((entry) => column.statuses.includes(entry.status))

                return (
                  <article key={column.id} className="workflow-column" onMouseDown={stopGridEvent} onPointerDown={stopGridEvent}>
                    <div className="workflow-column-header">
                      <strong>{column.title}</strong>
                      <span>{entries.length}</span>
                    </div>
                    <div
                      className="workflow-column-list"
                      onMouseDown={stopGridEvent}
                      onPointerDown={stopGridEvent}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault()
                        const contentId = event.dataTransfer.getData('text/plain')
                        if (contentId) handleWorkflowDrop(column.id, contentId)
                      }}
                    >
                      {entries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          className={`workflow-card ${selectedContentId === entry.id ? 'workflow-card-selected' : ''}`}
                          onClick={() => setSelectedContentId(entry.id)}
                          draggable
                          onMouseDown={stopGridEvent}
                          onPointerDown={stopGridEvent}
                          onDragStart={(event) => {
                            event.stopPropagation()
                            event.dataTransfer.setData('text/plain', entry.id)
                          }}
                        >
                          <strong>{entry.title}</strong>
                          <span>{entry.platform}</span>
                          {entry.postedChannel ? <span>{entry.postedChannel}</span> : null}
                          {entry.sentAt ? (
                            <span>
                              {new Intl.DateTimeFormat('sv-SE', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              }).format(new Date(entry.sentAt))}
                            </span>
                          ) : null}
                        </button>
                      ))}
                      {entries.length === 0 ? <p className="projection-summary">Inga kort här ännu.</p> : null}
                    </div>
                  </article>
                )
              })}
            </section>
          </div>
        </section>
      )
    }

    if (widget.type === 'sent_items') {
      const sentEntries = (graph?.content ?? []).filter((entry) =>
        ['sent', 'follow_up', 'replied', 'no_response'].includes(entry.status)
      )

      return (
        <section key={widget.id} className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <p className="eyebrow">Status</p>
              <h2>{widget.title}</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => removeWidget(widget.id)}>
              Ta bort
            </button>
          </div>
          <div className="dashboard-panel-body">
            <div className="content-list">
              {sentEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`content-list-item ${selectedContentId === entry.id ? 'content-list-item-selected' : ''}`}
                  onClick={() => setSelectedContentId(entry.id)}
                >
                  <strong>{entry.title}</strong>
                  <div className="content-list-item-meta">
                    <span>{entry.status}</span>
                    {entry.postedChannel ? <span>{entry.postedChannel}</span> : null}
                  </div>
                </button>
              ))}
              {sentEntries.length === 0 ? <p className="projection-summary">Inget skickat ännu.</p> : null}
            </div>
          </div>
        </section>
      )
    }

    if (widget.type === 'feedback_log') {
      const feedbackEntries = graph?.feedback ?? []

      return (
        <section key={widget.id} className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <p className="eyebrow">Respons</p>
              <h2>{widget.title}</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => removeWidget(widget.id)}>
              Ta bort
            </button>
          </div>
          <div className="dashboard-panel-body">
            <div className="content-list">
              {feedbackEntries.map((entry) => (
                <article key={entry.id} className="content-list-item feedback-list-item">
                  <strong>{entry.source}</strong>
                  <span>{entry.summary}</span>
                  {entry.nextStep ? <span>Nästa steg: {entry.nextStep}</span> : null}
                </article>
              ))}
              {feedbackEntries.length === 0 ? <p className="projection-summary">Ingen feedback ännu.</p> : null}
            </div>
          </div>
        </section>
      )
    }

    if (widget.type === 'projection') {
      return (
        <section key={widget.id} className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <p className="eyebrow">Härledd</p>
              <h2>{widget.title}</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => removeWidget(widget.id)}>
              Ta bort
            </button>
          </div>
          <div className="dashboard-panel-body">
            <OutreachProjectionPanel projection={projection} filter={projectionFilter} />
          </div>
        </section>
      )
    }

    return (
      <section key={widget.id} className="dashboard-panel">
        <div className="dashboard-panel-header">
          <div>
            <p className="eyebrow">Widget</p>
            <h2>{widget.title}</h2>
          </div>
          <button type="button" className="ghost-button" onClick={() => removeWidget(widget.id)}>
            Ta bort
          </button>
        </div>
        <div className="dashboard-panel-body">
          <article className="counter-widget">
            <span className="summary-card-label">{widget.metric?.split('_').join(' ')}</span>
            <strong className="counter-widget-value">{getCounterValue(widget.metric)}</strong>
          </article>
        </div>
      </section>
    )
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operator Hub</p>
          <h1>{graph.project.name} Outreach Discovery</h1>
        </div>
        <p>{graph.project.summary}</p>
        <div className="toolbar">
          <span className={`status-pill status-pill-${saveState}`}>{statusLabel}</span>
          <span className="status-message">{saveMessage}</span>
          <span className="status-message">Källa: {dataSource === 'hub' ? 'Hub' : 'Lokal fallback'}</span>
          <button type="button" className="secondary-button" onClick={() => setPanelLibraryOpen(true)}>
            Panelbibliotek
          </button>
        </div>
        <ResponsiveGrid
          className="summary-grid"
          layouts={summaryLayouts}
          width={dashboardWidth}
          breakpoints={{ lg: 1200, md: 860, sm: 0 }}
          cols={{ lg: 12, md: 10, sm: 1 }}
          rowHeight={38}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          draggableHandle=".summary-card"
          onLayoutChange={handleSummaryLayoutChange}
        >
          {summaryCards.map((card) => (
            <article
              key={card.id}
              className={`summary-card ${
                (card.id === projectionFilter || (projectionFilter === 'outreach' && (card.id === 'outreach' || card.id === 'ready')))
                  ? 'summary-card-active'
                  : ''
              } ${card.onClick ? 'summary-card-clickable' : ''}`}
              onClick={card.onClick}
              role={card.onClick ? 'button' : undefined}
              tabIndex={card.onClick ? 0 : undefined}
              onKeyDown={
                card.onClick
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        card.onClick?.()
                      }
                    }
                  : undefined
              }
            >
              <span className="summary-card-label">{card.label}</span>
              <strong className="summary-card-value">{card.value}</strong>
            </article>
          ))}
        </ResponsiveGrid>
      </header>
      <ResponsiveGrid
        className="dashboard-grid"
        layouts={dashboardLayouts}
        width={dashboardWidth}
        breakpoints={{ lg: 1200, md: 860, sm: 0 }}
        cols={{ lg: 12, md: 10, sm: 1 }}
        rowHeight={44}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        draggableHandle=".dashboard-panel-header"
        draggableCancel=".dashboard-panel-body, .dashboard-panel-body *, .workflow-card, .content-list-item, input, textarea, select, button, a"
        onLayoutChange={handleLayoutChange}
      >
        {dashboardWidgets.map((widget) => renderDashboardWidget(widget))}
      </ResponsiveGrid>
      <aside className={`node-drawer ${panelLibraryOpen ? 'node-drawer-open' : ''}`}>
        <div className="node-drawer-panel">
          <div className="node-drawer-header">
            <h2>Panelbibliotek</h2>
            <button type="button" className="ghost-button" onClick={() => setPanelLibraryOpen(false)}>
              Stäng
            </button>
          </div>
          <div className="node-drawer-body">
            <div className="field-stack">
              {WIDGET_LIBRARY.map((widget) => (
                <div key={`${widget.type}-${widget.metric ?? 'base'}`} className="panel-library-item">
                  <div>
                    <strong>{widget.title}</strong>
                    <p className="projection-summary">
                      {widget.singleton
                        ? dashboardWidgets.some((instance) => instance.type === widget.type)
                          ? 'Redan tillagd i dashboarden'
                          : 'Kan läggas till en gång'
                        : 'Kan läggas till flera gånger'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => addWidget(widget)}
                    disabled={Boolean(widget.singleton && dashboardWidgets.some((instance) => instance.type === widget.type))}
                  >
                    Lägg till widget
                  </button>
                </div>
              ))}
              <button type="button" className="ghost-button" onClick={resetDashboardLayout}>
                Återställ layout
              </button>
            </div>
          </div>
        </div>
      </aside>
      <aside className={`node-drawer ${drawerMode ? 'node-drawer-open' : ''}`}>
        <div className="node-drawer-panel">
          <div className="node-drawer-header">
            <h2>Redigera</h2>
            <button type="button" className="ghost-button" onClick={() => setDrawerMode(null)}>
              Stäng
            </button>
          </div>
          <div className="node-drawer-body">
            {drawerMode === 'node' ? (
              <NodeInspector
                node={selectedNode}
                editMode={editMode}
                onClose={() => setDrawerMode(null)}
                onChangeField={handleChangeField}
                onChangeStrengths={handleChangeStrengths}
                onAddChildProblem={addChildProblem}
              />
            ) : null}
            {drawerMode === 'outreach' ? (
              <OutreachInspector
                outreach={selectedOutreach}
                audiences={audienceOptions}
                editMode={editMode}
                onChangeField={updateOutreachField}
                onRemove={removeOutreach}
              />
            ) : null}
          </div>
        </div>
      </aside>
    </main>
  )
}

export default ParkpalGraphPage
