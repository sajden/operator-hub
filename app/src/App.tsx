import { useEffect, useState } from 'react'
import { routes, BOARD_PATTERN, type PageProps } from './data/routes'
import { routePath, stripBasePath } from './data/runtimePaths'
import PlannerBoardPage from './pages/PlannerBoardPage'

function navigate(path: string) {
  window.history.pushState({}, '', routePath(path))
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function App() {
  const [pathname, setPathname] = useState(window.location.pathname)
  const [theme, setTheme] = useState(() => window.localStorage.getItem('operator-hub-theme') ?? 'light')

  useEffect(() => {
    const handler = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('operator-hub-theme', theme)
  }, [theme])

  const relativePath = stripBasePath(pathname)
  const pageProps: PageProps = { onNavigate: navigate, theme, onSetTheme: setTheme }

  // Dynamic board route: /boards/:boardId
  const boardMatch = relativePath.match(BOARD_PATTERN)
  if (boardMatch) {
    const boardId = decodeURIComponent(boardMatch[1])
    // 'daily' is handled as a named route — only use dynamic render for other board ids
    if (boardId !== 'daily') {
      return <PlannerBoardPage boardId={boardId} {...pageProps} />
    }
  }

  const route = routes.find((r) => r.path === relativePath)
  if (route) return <>{route.render(pageProps)}</>

  // Fallback: dashboard
  return <>{routes[0].render(pageProps)}</>
}

export default App
