const rawBaseUrl = import.meta.env.BASE_URL || '/'

function normalizeBasePath(value: string) {
  if (!value || value === '/') return ''
  return value.endsWith('/') ? value.slice(0, -1) : value
}

export const APP_BASE_PATH = normalizeBasePath(rawBaseUrl)

export function routePath(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return APP_BASE_PATH ? `${APP_BASE_PATH}${normalizedPath}` : normalizedPath
}

export function apiPath(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return routePath(`/api${normalizedPath}`)
}

export function stripBasePath(pathname: string) {
  if (!APP_BASE_PATH) return pathname || '/'
  if (pathname === APP_BASE_PATH) return '/'
  if (pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname.slice(APP_BASE_PATH.length) || '/'
  }
  return pathname || '/'
}

export function withAppBase(path: string) {
  if (!path.startsWith('/')) return path
  if (!APP_BASE_PATH) return path
  if (path.startsWith(`${APP_BASE_PATH}/`) || path === APP_BASE_PATH) return path
  return `${APP_BASE_PATH}${path}`
}
