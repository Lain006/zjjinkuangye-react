import { useEffect, useState } from 'react'

export interface ComplianceDocument {
  id: string
  title: string
  sourceName: string
  sourceUrl: string
  sourceType: string
  region: string
  category: string
  topic: string
  evidenceLocator: string
  evidenceSourceUrl: string | null
  publishDate: string | null
  collectedAt: string
  summary: string
  excerpt: string
  analysis: string
  status: string
  legacyId: string | null
}

export interface Tally {
  label: string
  count: number
}

export interface DocumentList {
  items: ComplianceDocument[]
  total: number
  page: number
  pageSize: number
  facets: {
    regions: Tally[]
    categories: Tally[]
    topics: Tally[]
    sourceTypes: Tally[]
  }
}

export interface Analytics {
  total: number
  latestCollectedAt: string | null
  months: Tally[]
  regions: Tally[]
  categories: Tally[]
  topics: Tally[]
}

type ApiState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string; code?: number }

class ApiError extends Error {
  constructor(public readonly status: number) {
    const messages: Record<number, string> = {
      400: '当前查询条件无效。请调整关键词、日期或清除筛选。',
      404: '未找到这份已发布文献。',
    }
    super(messages[status] ?? '服务暂时无法返回数据。')
  }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

const publicationEvents = typeof BroadcastChannel === 'function' ? new BroadcastChannel('zijin-publication') : null

export function notifyPublishedChange() {
  publicationEvents?.postMessage('documents-changed')
}

export function useApi<T>(path: string): ApiState<T> & { retry: () => void } {
  const [attempt, setAttempt] = useState(0)
  const [revision, setRevision] = useState(0)
  const [response, setResponse] = useState<{ key: string; state: ApiState<T> }>()
  const key = JSON.stringify([path, attempt])

  useEffect(() => {
    const reload = (event: MessageEvent) => {
      if (event.data === 'documents-changed') setRevision(value => value + 1)
    }
    publicationEvents?.addEventListener('message', reload)
    return () => publicationEvents?.removeEventListener('message', reload)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const result = await fetch(`${apiBase}/api/v1${path}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        if (!result.ok) throw new ApiError(result.status)
        const data: T = await result.json()
        if (!controller.signal.aborted) setResponse({ key, state: { status: 'ready', data } })
      } catch (error) {
        if (controller.signal.aborted) return
        const state: ApiState<T> = error instanceof ApiError
          ? { status: 'error', message: error.message, code: error.status }
          : { status: 'error', message: '无法连接数据服务，请检查网络后重试。' }
        setResponse({ key, state })
      }
    }

    void load()
    return () => controller.abort()
  }, [key, path, revision])

  const state = response?.key === key ? response.state : { status: 'loading' as const }
  return { ...state, retry: () => setAttempt((value) => value + 1) }
}

export function withQuery(path: string, query: URLSearchParams) {
  const params = query.toString()
  return params ? `${path}?${params}` : path
}

export function displayDate(value: string | null | undefined) {
  return value?.slice(0, 10) || '未记录'
}

export function publicSource(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href
  } catch {
    // Older records can omit or contain an incomplete source address.
  }
  return null
}
