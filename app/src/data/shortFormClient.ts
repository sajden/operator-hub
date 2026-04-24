import type { ShortFormJob, ShortFormJobSummary, ShortFormWatchersStatus } from '../types/shortForm'
import { apiPath } from './runtimePaths'

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export function listShortFormJobs() {
  return requestJson<{ jobs: ShortFormJobSummary[] }>(apiPath('/short-form/jobs'))
}

export function loadShortFormJob(jobId: string) {
  return requestJson<{ job: ShortFormJob }>(apiPath(`/short-form/jobs/${encodeURIComponent(jobId)}`))
}

export function createShortFormJob(input: {
  title?: string
  sourcePath: string
  articleMode?: string
  captionPreset?: string
  manualArticleUrl?: string | null
}) {
  return requestJson<{ jobId: string }>(apiPath('/short-form/jobs'), {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function prepareShortFormJob(jobId: string) {
  return requestJson<{ ok: boolean; status: string }>(apiPath(`/short-form/jobs/${encodeURIComponent(jobId)}/prepare`), {
    method: 'POST',
    body: JSON.stringify({})
  })
}

export function renderShortFormJob(jobId: string) {
  return requestJson<{ ok: boolean; status: string }>(apiPath(`/short-form/jobs/${encodeURIComponent(jobId)}/render`), {
    method: 'POST',
    body: JSON.stringify({})
  })
}

export function updateShortFormArticle(jobId: string, manualArticleUrl: string | null) {
  return requestJson<{ ok: boolean; articleSource: string }>(
    apiPath(`/short-form/jobs/${encodeURIComponent(jobId)}/article`),
    {
      method: 'POST',
      body: JSON.stringify({ manualArticleUrl })
    }
  )
}

export function rerunShortFormArticleCapture(jobId: string) {
  return requestJson<{ ok: boolean; status: string }>(
    apiPath(`/short-form/jobs/${encodeURIComponent(jobId)}/rerun-article-capture`),
    {
      method: 'POST',
      body: JSON.stringify({})
    }
  )
}

export function screenshotUrlPreview(url: string) {
  return requestJson<{ base64: string; mimeType: string }>(
    apiPath('/short-form/screenshot-preview'),
    { method: 'POST', body: JSON.stringify({ url }) }
  )
}

export function approveShortFormArticle(jobId: string, articleUrl: string) {
  return requestJson<{ ok: boolean; status: string }>(
    apiPath(`/short-form/jobs/${encodeURIComponent(jobId)}/approve-article`),
    { method: 'POST', body: JSON.stringify({ articleUrl }) }
  )
}

export function findMoreShortFormArticles(jobId: string) {
  return requestJson<{ ok: boolean; candidates: Array<{ url: string; title: string }>; selectedUrl: string | null }>(
    apiPath(`/short-form/jobs/${encodeURIComponent(jobId)}/find-more-articles`),
    { method: 'POST', body: JSON.stringify({}) }
  )
}

export function loadShortFormWatchers() {
  return requestJson<ShortFormWatchersStatus>(apiPath('/short-form/watchers'))
}
