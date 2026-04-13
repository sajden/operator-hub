import { useEffect, useState } from 'react'
import ParkpalGraphPage from './pages/ParkpalGraphPage'
import OperatorDashboardPage from './pages/OperatorDashboardPage'
import PlannerBoardPage from './pages/PlannerBoardPage'
import ConnectionsPage from './pages/ConnectionsPage'
import PlannerTvPage from './pages/PlannerTvPage'
import PlannerWeekPage from './pages/PlannerWeekPage'
import SkillsPage from './pages/SkillsPage'
import MediaPage from './pages/MediaPage'
import HomeAssistantMapPage from './pages/HomeAssistantMapPage'
import ResearchPage from './pages/ResearchPage'
import BgRemoverPage from './pages/BgRemoverPage'
import ServiceExplainerPage from './pages/ServiceExplainerPage'
import ArticlesPage from './pages/ArticlesPage'
import BatchJobsPage from './pages/BatchJobsPage'
import AdvisorAbusePage from './pages/AdvisorAbusePage'
import { routePath, stripBasePath } from './data/runtimePaths'

type Route =
  | { kind: 'dashboard' }
  | { kind: 'parkpal' }
  | { kind: 'connections' }
  | { kind: 'skills' }
  | { kind: 'research' }
  | { kind: 'media' }
  | { kind: 'service-explainer' }
  | { kind: 'ha' }
  | { kind: 'board'; boardId: string }
  | { kind: 'week' }
  | { kind: 'tv' }
  | { kind: 'bg-remover' }
  | { kind: 'articles' }
  | { kind: 'advisor-abuse' }
  | { kind: 'jobs' }

function parseRoute(pathname: string): Route {
  const relativePath = stripBasePath(pathname)

  if (relativePath === '/parkpal') return { kind: 'parkpal' }
  if (relativePath === '/connections') return { kind: 'connections' }
  if (relativePath === '/skills') return { kind: 'skills' }
  if (relativePath === '/research') return { kind: 'research' }
  if (relativePath === '/media') return { kind: 'media' }
  if (relativePath === '/service-explainer') return { kind: 'service-explainer' }
  if (relativePath === '/ha') return { kind: 'ha' }
  if (relativePath === '/week') return { kind: 'week' }
  if (relativePath === '/tv') return { kind: 'tv' }
  if (relativePath === '/bg-remover') return { kind: 'bg-remover' }
  if (relativePath === '/articles') return { kind: 'articles' }
  if (relativePath === '/advisor-abuse') return { kind: 'advisor-abuse' }
  if (relativePath === '/jobs') return { kind: 'jobs' }

  const boardMatch = relativePath.match(/^\/boards\/([^/]+)$/)
  if (boardMatch) {
    return {
      kind: 'board',
      boardId: decodeURIComponent(boardMatch[1])
    }
  }

  return { kind: 'dashboard' }
}

function navigate(path: string) {
  window.history.pushState({}, '', routePath(path))
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function loadThemePreference() {
  if (typeof window === 'undefined') return 'light'
  return window.localStorage.getItem('operator-hub-theme') ?? 'light'
}

function BackToDashboard() {
  return (
    <div className="planner-floating-nav">
      <button type="button" onClick={() => navigate('/')}>
        Back to dashboard
      </button>
    </div>
  )
}

function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname))
  const [theme, setTheme] = useState(loadThemePreference)

  useEffect(() => {
    function handlePopState() {
      setRoute(parseRoute(window.location.pathname))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('operator-hub-theme', theme)
  }, [theme])

  if (route.kind === 'parkpal') {
    return (
      <>
        <BackToDashboard />
        <div className="planner-theme-toggle planner-theme-toggle-floating">
          <button type="button" className={theme === 'light' ? 'planner-nav-active' : ''} onClick={() => setTheme('light')}>
            Light
          </button>
          <button type="button" className={theme === 'dark' ? 'planner-nav-active' : ''} onClick={() => setTheme('dark')}>
            Dark
          </button>
        </div>
        <ParkpalGraphPage />
      </>
    )
  }

  if (route.kind === 'board') {
    return <PlannerBoardPage boardId={route.boardId} onNavigate={navigate} theme={theme} onSetTheme={setTheme} />
  }

  if (route.kind === 'connections') {
    return <ConnectionsPage onNavigate={navigate} theme={theme} onSetTheme={setTheme} />
  }

  if (route.kind === 'week') {
    return <PlannerWeekPage onNavigate={navigate} theme={theme} onSetTheme={setTheme} />
  }

  if (route.kind === 'skills') {
    return <SkillsPage onNavigate={navigate} theme={theme} onSetTheme={setTheme} />
  }

  if (route.kind === 'media') {
    return <MediaPage onNavigate={navigate} />
  }

  if (route.kind === 'research') {
    return <ResearchPage onNavigate={navigate} theme={theme} onSetTheme={setTheme} />
  }

  if (route.kind === 'service-explainer') {
    return <ServiceExplainerPage onNavigate={navigate} theme={theme} onSetTheme={setTheme} />
  }

  if (route.kind === 'ha') {
    return <HomeAssistantMapPage onNavigate={navigate} />
  }

  if (route.kind === 'tv') {
    return <PlannerTvPage />
  }

  if (route.kind === 'bg-remover') {
    return <BgRemoverPage onNavigate={navigate} theme={theme} onSetTheme={setTheme} />
  }

  if (route.kind === 'articles') {
    return <ArticlesPage onNavigate={navigate} theme={theme} onSetTheme={setTheme} />
  }

  if (route.kind === 'advisor-abuse') {
    return <AdvisorAbusePage onNavigate={navigate} theme={theme} onSetTheme={setTheme} />
  }

  if (route.kind === 'jobs') {
    return <BatchJobsPage onNavigate={navigate} theme={theme} onSetTheme={setTheme} />
  }

  return <OperatorDashboardPage onNavigate={navigate} theme={theme} onSetTheme={setTheme} />
}

export default App
