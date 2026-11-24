import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import compression from 'compression'
import express from 'express'
import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express'
import type { Pool } from 'pg'
import { z } from 'zod'
import { createRateLimit, sessions } from './auth.ts'
import { IncompletePublication, createDocument, getAnalytics, getDocument, importDocuments, listAudit, listDocuments, reviseDocument } from './documents.ts'
import { collectDraft, sources } from './intake.ts'
import { adminListQuery, auditQuery, analyticsQuery, documentId, documentInput, documentPatch, listQuery } from './model.ts'
import { resolveTopic, topicOptions } from './topics.ts'

type AppOptions = {
  pool: Pool
  adminPassword: string
  publicOrigin?: string
  secureCookies?: boolean
  trustProxy?: number
  staticDirectory?: string
  fetchArticle?: typeof fetch
}

class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const notFound = () => new ApiError(404, 'NOT_FOUND', '未找到该资源。')
const unauthenticated = () => new ApiError(401, 'UNAUTHENTICATED', '请先登录管理员。')
const loginInput = z.strictObject({ password: z.string().min(1).max(256) })
const intakeInput = z.strictObject({ sourceId: z.string().min(1).max(100) })

function sameOrigin(request: Request, configuredOrigin: string | undefined, secure: boolean) {
  if (request.get('sec-fetch-site') === 'cross-site') return false
  const origin = request.get('origin')
  if (!origin) return true
  if (configuredOrigin) return origin === configuredOrigin
  if (origin === `${secure ? 'https' : request.protocol}://${request.get('host')}`) return true
  // Vite uses a second port on loopback during local development.
  return !secure && /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin)
    && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(request.get('host') ?? '')
}

export function createApp(options: AppOptions) {
  const { pool, staticDirectory } = options
  const secure = options.secureCookies ?? false
  const configuredOrigin = options.publicOrigin ? new URL(options.publicOrigin).origin : undefined
  const app = express()
  const auth = sessions(pool, options.adminPassword, secure)
  const loginAllowed = createRateLimit(10, 15 * 60_000)
  const collectionAllowed = createRateLimit(12, 60_000)
  const parseJson = express.json({ limit: '128kb' })
  const api = express.Router()
  const admin = express.Router()

  app.disable('x-powered-by')
  if (options.trustProxy) app.set('trust proxy', options.trustProxy)
  app.use((_request, response, next) => {
    response.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    })
    next()
  })

  api.use((_request, response, next) => {
    response.set({ 'Cache-Control': 'no-store', 'X-Request-Id': randomUUID() })
    next()
  })

  api.get('/livez', (_request, response) => response.json({ status: 'ok' }))
  api.get('/health', async (_request, response) => {
    try {
      const result = await pool.query('SELECT 1 FROM schema_migrations LIMIT 1')
      if (!result.rowCount) throw new Error('No migration has been applied')
    } catch {
      throw new ApiError(503, 'SERVICE_UNAVAILABLE', '资料服务正在准备中，请稍后重试。')
    }
    response.json({ status: 'ok' })
  })

  api.get('/documents', async (request, response) => {
    response.json(await listDocuments(pool, listQuery.parse(request.query), 'published'))
  })
  api.get('/documents/:id', async (request, response) => {
    const document = await getDocument(pool, documentId.parse(request.params.id), true)
    if (!document) throw notFound()
    response.json(document)
  })
  api.get('/analytics', async (request, response) => {
    response.json(await getAnalytics(pool, analyticsQuery.parse(request.query)))
  })

  const unsafeMethods = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])
  admin.use((request, _response, next) => {
    if (unsafeMethods.has(request.method) && !sameOrigin(request, configuredOrigin, secure)) {
      throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', '请求来源不受信任。')
    }
    next()
  })

  admin.get('/session', async (request, response) => {
    response.json({ authenticated: await auth.authenticated(request) })
  })
  admin.post('/session', parseJson, async (request, response) => {
    if (!loginAllowed(request.ip ?? 'unknown')) {
      response.set('Retry-After', '900')
      throw new ApiError(429, 'TOO_MANY_ATTEMPTS', '登录尝试过于频繁，请稍后重试。')
    }
    const input = loginInput.parse(request.body)
    if (!auth.passwordMatches(input.password)) throw new ApiError(401, 'UNAUTHENTICATED', '管理员密码有误。')
    response.cookie(auth.cookieName, await auth.open(request), { ...auth.options, maxAge: auth.maxAge })
    response.json({ authenticated: true })
  })
  admin.delete('/session', async (request, response) => {
    await auth.close(request)
    response.clearCookie(auth.cookieName, auth.options).status(204).end()
  })

  const requireAdmin: RequestHandler = async (request, _response, next) => {
    if (!await auth.authenticated(request)) throw unauthenticated()
    next()
  }
  admin.use(requireAdmin)

  admin.get('/topics', (_request, response) => response.json({ items: topicOptions }))
  admin.get('/sources', (_request, response) => {
    response.json({ items: sources.map(({ id, label, url }) => ({ id, label, url })) })
  })
  admin.post('/intake', parseJson, async (request, response) => {
    const { sourceId } = intakeInput.parse(request.body)
    const source = sources.find((item) => item.id === sourceId)
    if (!source) throw notFound()
    if (!collectionAllowed(request.ip ?? 'unknown')) {
      response.set('Retry-After', '60')
      throw new ApiError(429, 'TOO_MANY_ATTEMPTS', '采集请求过于频繁，请稍后重试。')
    }
    try {
      const draft = await collectDraft(source, options.fetchArticle)
      response.json({ ...draft, topic: resolveTopic(draft.category, null) })
    } catch {
      throw new ApiError(502, 'SOURCE_UNAVAILABLE', '来源网站暂时无法采集。可稍后重试，或核对原文后手动录入。')
    }
  })
  admin.get('/documents', async (request, response) => {
    const query = adminListQuery.parse(request.query)
    response.json(await listDocuments(pool, query, query.status))
  })
  admin.get('/documents/:id', async (request, response) => {
    const document = await getDocument(pool, documentId.parse(request.params.id), false)
    if (!document) throw notFound()
    response.json(document)
  })
  admin.post('/documents/import', express.json({ limit: '2mb' }), async (request, response) => {
    const input = z.strictObject({ documents: z.array(documentInput).min(1).max(100) }).safeParse(request.body)
    if (!input.success) {
      const [, index, field] = input.error.issues[0]?.path ?? []
      const message = typeof index === 'number'
        ? `第 ${index + 1} 条资料的 ${String(field ?? '记录')} 格式无效，整批未写入。`
        : '每批至少 1 条、最多 100 条资料。'
      throw new ApiError(400, 'INVALID_INPUT', message)
    }
    response.json(await importDocuments(pool, input.data.documents))
  })
  admin.post('/documents', parseJson, async (request, response) => {
    response.status(201).json(await createDocument(pool, documentInput.parse(request.body)))
  })
  admin.patch('/documents/:id', parseJson, async (request, response) => {
    const id = documentId.parse(request.params.id)
    const fields = documentPatch.parse(request.body)
    const document = await reviseDocument(pool, id, { action: 'update', fields })
    if (!document) throw notFound()
    response.json(document)
  })

  for (const action of ['publish', 'archive'] as const) {
    admin.post(`/documents/:id/${action}`, async (request, response) => {
      const document = await reviseDocument(pool, documentId.parse(request.params.id), { action })
      if (!document) throw notFound()
      response.json(document)
    })
  }
  admin.get('/audit', async (request, response) => {
    const { page, pageSize } = auditQuery.parse(request.query)
    response.json(await listAudit(pool, page, pageSize))
  })

  api.use('/admin', admin)
  app.use('/api/v1', api)
  app.use('/api', () => { throw notFound() })

  if (staticDirectory) {
    app.use(compression(), express.static(staticDirectory, { index: false }))
    app.get('/{*path}', (request, response, next) => {
      if (!request.accepts('html') || request.path.split('/').pop()?.includes('.')) return next()
      response.set('Cache-Control', 'no-cache')
      response.sendFile(join(staticDirectory, 'index.html'))
    })
  }

  app.use(() => { throw notFound() })
  app.use(apiErrors)
  return app
}

function reply(response: Response, error: ApiError) {
  response.status(error.status).json({ error: { code: error.code, message: error.message } })
}

const apiErrors: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) return next(error)
  if (error instanceof IncompletePublication) return reply(response, new ApiError(409, 'INCOMPLETE_PUBLICATION', error.message))
  if (error instanceof ApiError) return reply(response, error)
  if (error instanceof z.ZodError) {
    const field = error.issues[0]?.path.join('.')
    return reply(response, new ApiError(400, 'INVALID_INPUT', field ? `请检查字段 ${field} 的格式。` : '请检查请求参数的格式。'))
  }

  const attributes = typeof error === 'object' && error !== null ? error : {}
  const code: unknown = Reflect.get(attributes, 'code')
  const type: unknown = Reflect.get(attributes, 'type')
  const status: unknown = Reflect.get(attributes, 'status')
  if (type === 'entity.parse.failed') return reply(response, new ApiError(400, 'INVALID_INPUT', '请求不是有效的 JSON。'))
  if (type === 'entity.too.large') return reply(response, new ApiError(413, 'INVALID_INPUT', '请求内容超过大小限制。'))
  if (status === 404) return reply(response, notFound())
  if (code === '23505') return reply(response, new ApiError(409, 'CONFLICT', '已有相同来源链接的资料。请编辑已有记录。'))

  console.error('Request failed.', { requestId: response.get('X-Request-Id'), code: typeof code === 'string' ? code : undefined })
  return reply(response, new ApiError(500, 'INTERNAL_ERROR', '服务暂时无法处理请求，请稍后重试。'))
}
