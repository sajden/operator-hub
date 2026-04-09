const AUTO_IMPORT_KEY = 'operator-hub-m365-auto-import'

function lastRunKey(scope: string) {
  return `${AUTO_IMPORT_KEY}:${scope}:last-run`
}

export function readAutoImportPreference() {
  if (typeof window === 'undefined') return true
  const value = window.localStorage.getItem(AUTO_IMPORT_KEY)
  return value === null ? true : value === 'true'
}

export function writeAutoImportPreference(enabled: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AUTO_IMPORT_KEY, String(enabled))
}

export function shouldRunAutoImport(scope: string, cooldownMs = 60_000) {
  if (typeof window === 'undefined') return false
  if (!readAutoImportPreference()) return false

  const lastRun = Number(window.sessionStorage.getItem(lastRunKey(scope)) ?? '0')
  return Number.isNaN(lastRun) || Date.now() - lastRun > cooldownMs
}

export function markAutoImportRun(scope: string) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(lastRunKey(scope), String(Date.now()))
}

export function readLastAutoImportRun(scope: string) {
  if (typeof window === 'undefined') return null
  const value = Number(window.sessionStorage.getItem(lastRunKey(scope)) ?? '0')
  if (!value || Number.isNaN(value)) return null
  return value
}
