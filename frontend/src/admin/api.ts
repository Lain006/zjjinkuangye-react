export type DocumentStatus = 'draft' | 'published' | 'archived'

export type DraftInput = {
  title: string
  sourceName: string
  sourceUrl: string
  sourceType: string
  region: string
  category: string
  topic?: string
  publishDate: string | null
  collectedAt?: string
  summary: string
  excerpt: string
  evidenceLocator?: string
  evidenceSourceUrl?: string | null
  analysis: string
}

export type AdminDocument = DraftInput & {
  id: string
  collectedAt: string
  status: DocumentStatus
  topicConfirmed: boolean
}

export type Source = { id: string; label: string; url: string }
export type AuditEntry = { id: string; action: string; documentId: string; documentTitle: string; createdAt: string }
type Paged<T> = { items: T[]; page: number; pageSize: number; total: number }
export type DocumentPage = Paged<AdminDocument>
export type AuditPage = Paged<AuditEntry>

export function changedDraftFields(initial: DraftInput, draft: DraftInput): Partial<DraftInput> {
  const keys = Object.keys(draft) as (keyof DraftInput)[]
  return Object.fromEntries(keys.filter((key) => draft[key] !== initial[key]).map((key) => [key, draft[key]]))
}

const apiBase = '/api/v1/admin'

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AdminApiError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function badResponse(): never {
  throw new AdminApiError(500, 'INVALID_RESPONSE', '服务返回的数据格式有误，请稍后重试。')
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : badResponse()
}

function field(value: unknown): string {
  return typeof value === 'string' ? value : badResponse()
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : badResponse()
}

function unpackItems<T>(value: unknown, decode: (item: unknown) => T): T[] {
  const { items } = record(value)
  return Array.isArray(items) ? items.map(decode) : badResponse()
}

function decodeDraft(value: unknown): DraftInput {
  const item = record(value)
  return {
    title: field(item.title),
    sourceName: field(item.sourceName),
    sourceUrl: field(item.sourceUrl),
    sourceType: field(item.sourceType),
    region: field(item.region),
    category: field(item.category),
    topic: typeof item.topic === 'string' ? item.topic : undefined,
    publishDate: item.publishDate === null ? null : field(item.publishDate),
    collectedAt: typeof item.collectedAt === 'string' ? item.collectedAt : undefined,
    summary: field(item.summary),
    excerpt: field(item.excerpt),
    evidenceLocator: typeof item.evidenceLocator === 'string' ? item.evidenceLocator : '',
    evidenceSourceUrl: typeof item.evidenceSourceUrl === 'string' ? item.evidenceSourceUrl : null,
    analysis: field(item.analysis),
  }
}

function decodeDocument(value: unknown): AdminDocument {
  const item = record(value)
  const { status } = item
  if (status !== 'draft' && status !== 'published' && status !== 'archived') badResponse()
  return {
    ...decodeDraft(item),
    id: field(item.id),
    collectedAt: field(item.collectedAt),
    status,
    topicConfirmed: item.topicConfirmed === true,
  }
}

function decodeSource(value: unknown): Source {
  const item = record(value)
  return { id: field(item.id), label: field(item.label), url: field(item.url) }
}

function decodeAudit(value: unknown): AuditEntry {
  const item = record(value)
  return {
    id: field(item.id),
    action: field(item.action),
    documentId: field(item.documentId),
    documentTitle: field(item.documentTitle),
    createdAt: field(item.createdAt),
  }
}

function decodePage<T>(value: unknown, decode: (item: unknown) => T): Paged<T> {
  const page = record(value)
  return {
    items: unpackItems(page, decode),
    page: count(page.page),
    pageSize: count(page.pageSize),
    total: count(page.total),
  }
}

async function request<T>(path: string, decode: (data: unknown) => T, options: RequestInit = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (response.status === 204) return decode(undefined)
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = isRecord(body) && isRecord(body.error) ? body.error : {}
    const code = typeof error.code === 'string' ? error.code : 'REQUEST_FAILED'
    const message = typeof error.message === 'string' ? error.message : '服务请求失败，请重试。'
    throw new AdminApiError(response.status, code, message)
  }
  return decode(body)
}

function sessionResponse(value: unknown): boolean {
  const { authenticated } = record(value)
  return typeof authenticated === 'boolean' ? authenticated : badResponse()
}

export const adminApi = {
  session: (signal: AbortSignal) => request('/session', sessionResponse, { signal }),
  signIn: (password: string) => request('/session', sessionResponse, {
    method: 'POST',
    body: JSON.stringify({ password }),
  }),
  signOut: () => request('/session', () => undefined, { method: 'DELETE' }),
  topics: (signal: AbortSignal) => request('/topics', data => unpackItems(data, field), { signal }),
  sources: (signal: AbortSignal) => request('/sources', (data) => unpackItems(data, decodeSource), { signal }),
  intake: (sourceId: string, signal: AbortSignal) => request('/intake', decodeDraft, {
    method: 'POST',
    body: JSON.stringify({ sourceId }),
    signal,
  }),
  documents: (page: number, query: string, status: DocumentStatus | '', signal: AbortSignal) => {
    const params = new URLSearchParams({ page: String(page), pageSize: '10' })
    if (query) params.set('q', query)
    if (status) params.set('status', status)
    return request(`/documents?${params}`, data => decodePage(data, decodeDocument), { signal })
  },
  document: (id: string, signal: AbortSignal) => request(`/documents/${encodeURIComponent(id)}`, decodeDocument, { signal }),
  importDrafts: (documents: DraftInput[]) => request('/documents/import', (data) => {
    const result = record(data)
    return { created: count(result.created), skipped: count(result.skipped) }
  }, { method: 'POST', body: JSON.stringify({ documents }) }),
  create: (draft: DraftInput) => request('/documents', decodeDocument, {
    method: 'POST',
    body: JSON.stringify(draft),
  }),
  update: (id: string, changes: Partial<DraftInput>) => request(`/documents/${encodeURIComponent(id)}`, decodeDocument, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  }),
  setStatus: (id: string, action: 'publish' | 'archive') => request(
    `/documents/${encodeURIComponent(id)}/${action}`,
    decodeDocument,
    { method: 'POST' },
  ),
  audit: (page: number, signal: AbortSignal) => request(`/audit?page=${page}&pageSize=10`, data => decodePage(data, decodeAudit), { signal }),
}

export function evidenceGaps(draft: DraftInput, topicConfirmed = Boolean(draft.topic)) {
  return [
    !topicConfirmed && '一级主题',
    !draft.analysis.trim() && '课程分析',
    (!draft.evidenceLocator?.trim() || (!draft.excerpt.trim() && !draft.summary.trim())) && '摘录或摘要及出处',
  ].filter(Boolean)
}

export function explainError(error: unknown): string {
  if (error instanceof AdminApiError) {
    if (error.code === 'CONFLICT') return '来源链接与库中记录重复。可按标题搜索原记录并继续编辑。'
    if (error.code === 'TOO_MANY_ATTEMPTS') return '请求过于频繁，请稍后再试。'
    if (error.code === 'SOURCE_UNAVAILABLE') return '暂时无法读取该来源，可稍后重试或转为手动录入。'
    if (error.status === 503) return '维护服务暂不可用，请稍后重试。'
    if (/\p{Script=Han}/u.test(error.message)) return error.message
    if (error.code === 'INVALID_INPUT') return '请检查表单内容、日期和来源链接。'
    if (error.code === 'NOT_FOUND') return '记录不存在或已移除，请刷新列表。'
    return '服务请求失败，请重试。'
  }
  return '无法连接维护服务，请检查网络后重试。'
}
