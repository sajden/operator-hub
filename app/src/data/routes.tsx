/**
 * routes.tsx — single source of truth for all operator-hub routes.
 *
 * To add a new page:
 *   1. Create app/src/pages/MyPage.tsx
 *   2. Add one entry to the `routes` array below
 *   Done — sidebar and routing update automatically.
 */

import type { ReactNode } from 'react'

import OperatorDashboardPage from '../pages/OperatorDashboardPage'
import PlannerBoardPage from '../pages/PlannerBoardPage'
import PlannerWeekPage from '../pages/PlannerWeekPage'
import PlannerTvPage from '../pages/PlannerTvPage'
import ParkpalGraphPage from '../pages/ParkpalGraphPage'
import ConnectionsPage from '../pages/ConnectionsPage'
import SkillsPage from '../pages/SkillsPage'
import ResearchPage from '../pages/ResearchPage'
import MediaPage from '../pages/MediaPage'
import HomeAssistantMapPage from '../pages/HomeAssistantMapPage'
import BgRemoverPage from '../pages/BgRemoverPage'
import ServiceExplainerPage from '../pages/ServiceExplainerPage'
import ArticlesPage from '../pages/ArticlesPage'
import AdvisorAbusePage from '../pages/AdvisorAbusePage'
import AdvisorChatsPage from '../pages/AdvisorChatsPage'
import BatchJobsPage from '../pages/BatchJobsPage'

export type NavigateFn = (path: string) => void

export type PageProps = {
  onNavigate: NavigateFn
  theme: string
  onSetTheme: (t: string) => void
  /** Populated for dynamic routes (e.g. /boards/:boardId) */
  pathParams?: Record<string, string>
}

export type RouteConfig = {
  /** Unique id — also used to match active sidebar item */
  id: string
  /** URL path, e.g. '/week'. Use '' for the default/dashboard. */
  path: string
  /** Sidebar label */
  label: string
  render: (props: PageProps) => ReactNode
}

function ThemeToggle({ theme, onSetTheme }: { theme: string; onSetTheme: (t: string) => void }) {
  return (
    <div className="planner-theme-toggle planner-theme-toggle-floating">
      <button type="button" className={theme === 'light' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('light')}>Light</button>
      <button type="button" className={theme === 'dark' ? 'planner-nav-active' : ''} onClick={() => onSetTheme('dark')}>Dark</button>
    </div>
  )
}

function BackToDashboard({ onNavigate }: { onNavigate: NavigateFn }) {
  return (
    <div className="planner-floating-nav">
      <button type="button" onClick={() => onNavigate('/')}>Back to dashboard</button>
    </div>
  )
}

export const routes: RouteConfig[] = [
  {
    id: 'dashboard',
    path: '/',
    label: 'Home',
    render: (p) => <OperatorDashboardPage {...p} />,
  },
  {
    id: 'daily',
    path: '/boards/daily',
    label: 'Daily',
    render: (p) => <PlannerBoardPage boardId="daily" {...p} />,
  },
  {
    id: 'week',
    path: '/week',
    label: 'Week',
    render: (p) => <PlannerWeekPage {...p} />,
  },
  {
    id: 'parkpal',
    path: '/parkpal',
    label: 'Parkpal',
    render: (p) => (
      <>
        <BackToDashboard onNavigate={p.onNavigate} />
        <ThemeToggle theme={p.theme} onSetTheme={p.onSetTheme} />
        <ParkpalGraphPage />
      </>
    ),
  },
  {
    id: 'connections',
    path: '/connections',
    label: 'Connections',
    render: (p) => <ConnectionsPage {...p} />,
  },
  {
    id: 'skills',
    path: '/skills',
    label: 'Skills',
    render: (p) => <SkillsPage {...p} />,
  },
  {
    id: 'research',
    path: '/research',
    label: 'Research',
    render: (p) => <ResearchPage {...p} />,
  },
  {
    id: 'media',
    path: '/media',
    label: 'Media',
    render: (p) => <MediaPage onNavigate={p.onNavigate} />,
  },
  {
    id: 'service-explainer',
    path: '/service-explainer',
    label: 'Explainer',
    render: (p) => <ServiceExplainerPage {...p} />,
  },
  {
    id: 'ha',
    path: '/ha',
    label: 'HA',
    render: (p) => <HomeAssistantMapPage onNavigate={p.onNavigate} />,
  },
  {
    id: 'tv',
    path: '/tv',
    label: 'TV',
    render: () => <PlannerTvPage />,
  },
  {
    id: 'bg-remover',
    path: '/bg-remover',
    label: 'BG Remover',
    render: (p) => <BgRemoverPage {...p} />,
  },
  {
    id: 'articles',
    path: '/articles',
    label: 'SEO Artiklar',
    render: (p) => <ArticlesPage {...p} />,
  },
  {
    id: 'advisor-abuse',
    path: '/advisor-abuse',
    label: 'Advisor Abuse',
    render: (p) => <AdvisorAbusePage {...p} />,
  },
  {
    id: 'advisor-chats',
    path: '/advisor-chats',
    label: 'Advisor Chattar',
    render: (p) => <AdvisorChatsPage {...p} />,
  },
  {
    id: 'jobs',
    path: '/jobs',
    label: 'Batch Jobs',
    render: (p) => <BatchJobsPage {...p} />,
  },
]

/** Dynamic route: /boards/:boardId */
export const BOARD_PATTERN = /^\/boards\/([^/]+)$/
