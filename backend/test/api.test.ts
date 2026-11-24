import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import type { Server } from 'node:http'
import test from 'node:test'
import { createApp } from '../src/app.ts'
import { backfillEvidence } from '../src/documents.ts'
import { createPool } from '../src/db.ts'
import { sources } from '../src/intake.ts'
import { migrate } from '../src/migrate.ts'
import type { Document } from '../src/model.ts'
import { seed } from '../src/seed.ts'

const databaseUrl = process.env.TEST_DATABASE_URL
const sample = { title: '跨境资金测试资料', sourceName: '项目测试来源', sourceUrl: 'https://example.com/seed',
  sourceType: '政策文件', region: '海南自贸港', category: '资金', publishDate: '2026-07-01',
  collectedAt: '2026-07-02T00:00:00Z' }
const credentials = randomUUID()

async function start(app: ReturnType<typeof createApp>) {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing test server address')
  return { server, url: `http://127.0.0.1:${address.port}/api/v1` }
}

function close(server: Server) {
  return new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

test('PostgreSQL-backed publication, collection, visibility, audit and session lifecycle', {
  skip: !databaseUrl && 'TEST_DATABASE_URL is required for the PostgreSQL integration test',
}, async () => {
  assert.ok(databaseUrl)
  const controlPool = createPool(databaseUrl)
  const schema = `api_test_${randomUUID().replaceAll('-', '')}`
  const schemaUrl = new URL(databaseUrl)
  schemaUrl.searchParams.set('options', `-c search_path=${schema}`)
  const pool = createPool(schemaUrl.toString())
  let server: Server | undefined

  try {
    await controlPool.query(`CREATE SCHEMA ${schema}`)
    assert.deepEqual(await migrate(pool), ['001_initial.sql', '002_document_editorial.sql', '003_evidence_source_url.sql'])
    assert.deepEqual(await migrate(pool), [])
    const seeds = [{ ...sample, legacyId: 1, status: 'published' },
      { ...sample, sourceUrl: 'https://example.com/legacy', legacyId: 2 }]
    assert.deepEqual(await seed(pool, seeds), { inserted: 2, existing: 0 })
    assert.deepEqual(await seed(pool, seeds), { inserted: 0, existing: 2 })

    const options = { pool, adminPassword: credentials, fetchArticle: async (url: string | URL | Request) => {
      if (url === sources[1].url) return new Response('', { status: 503 })
      assert.equal(url, sources[0].url)
      return new Response(`<!doctype html><meta charset="utf-8"><meta name="ArticleTitle" content="资金座谈会">
        <meta name="PubDate" content="2026-07-27 12:41:43">`, { headers: { 'content-type': 'text/html' } })
    } }
    const first = await start(createApp(options))
    server = first.server
    let base = first.url
    let cookie = ''
    const request = (path: string, method = 'GET', data?: unknown, headers: Record<string, string> = {}) => {
      return fetch(`${base}${path}`, { method, headers: {
        ...(cookie ? { cookie } : {}), ...(data === undefined ? {} : { 'content-type': 'application/json' }), ...headers,
      }, body: data === undefined ? undefined : JSON.stringify(data) })
    }

    assert.deepEqual(await (await request('/livez')).json(), { status: 'ok' })
    assert.deepEqual(await (await request('/health')).json(), { status: 'ok' })
    const filtered = await (await request(`/documents?q=${encodeURIComponent('跨境 资金')}&dateFrom=2026-07-01`)).json()
    assert.equal(filtered.total, 1)
    assert.equal(filtered.items[0].id, 'legacy-1')
    assert.deepEqual(filtered.facets.regions, [{ label: '海南自贸港', count: 1 }])
    assert.equal((await request('/documents/legacy-2')).status, 404)
    assert.equal((await request('/documents?page=-1')).status, 400)
    assert.equal((await request('/documents?pageSize=51')).status, 400)
    assert.equal((await (await request('/documents')).json()).pageSize, 20)
    assert.equal((await request('/admin/documents')).status, 401)
    assert.equal((await request('/admin/session', 'POST', { password: credentials }, { origin: 'https://unrelated.invalid' })).status, 403)
    const login = await request('/admin/session', 'POST', { password: credentials })
    assert.equal(login.status, 200)
    const setCookie = login.headers.get('set-cookie') ?? ''
    assert.match(setCookie, /HttpOnly/i)
    assert.match(setCookie, /SameSite=Strict/i)
    cookie = setCookie.split(';')[0]
    assert.deepEqual(await (await request('/admin/session')).json(), { authenticated: true })

    assert.equal((await request('/admin/intake', 'POST', { sourceId: 'unlisted' })).status, 404)
    assert.equal((await request('/admin/intake', 'POST', { sourceId: sources[1].id })).status, 502)
    const extraction = await request('/admin/intake', 'POST', { sourceId: sources[0].id })
    assert.equal(extraction.status, 200)
    const draft: unknown = await extraction.json()
    const write = await request('/admin/documents', 'POST', draft)
    assert.equal(write.status, 201)
    const document: Document = await write.json()
    assert.equal(document.status, 'draft')
    assert.equal((await request(`/documents/${document.id}`)).status, 404)
    assert.equal((await request('/admin/documents', 'POST', draft)).status, 409)
    const source = new URL(document.sourceUrl)
    const alternativeUrl = source.href.replace(source.host, source.hostname.toUpperCase() + ':443')
    assert.equal((await request('/admin/documents', 'POST', { ...sample, sourceUrl: alternativeUrl })).status, 409)
    const incomplete = await request(`/admin/documents/${document.id}/publish`, 'POST')
    assert.equal(incomplete.status, 409)
    assert.equal((await incomplete.json()).error.code, 'INCOMPLETE_PUBLICATION')
    assert.equal((await request(`/admin/documents/${document.id}`, 'PATCH', {
      summary: '已核对的测试摘要', analysis: '课程证据说明', evidenceLocator: '原文正文第1段',
    })).status, 200)
    const publish = await request(`/admin/documents/${document.id}/publish`, 'POST')
    assert.equal(publish.status, 200)
    assert.equal((await publish.json()).status, 'published')
    assert.equal((await request(`/admin/documents/${document.id}/publish`, 'POST')).status, 200)

    await close(server)
    const restarted = await start(createApp(options))
    server = restarted.server
    base = restarted.url
    const guest = await fetch(`${base}/documents/${document.id}`)
    assert.equal(guest.status, 200)
    assert.equal((await guest.json()).summary, '已核对的测试摘要')
    const analytics = await (await request(`/analytics?region=${encodeURIComponent('海南自贸港')}`)).json()
    assert.equal(analytics.total, 2)
    assert.ok(analytics.latestCollectedAt)
    assert.deepEqual(analytics.months, [{ label: '2026-07', count: 2 }])
    const primary = '跨境资金与金融合规'
    assert.deepEqual(analytics.topics, [{ label: primary, count: 2 }])
    const down = await (await request(`/documents?topic=${encodeURIComponent(primary)}&pageSize=1&page=2`)).json()
    assert.equal(down.total, analytics.total)
    assert.equal(down.items[0].category, '资金')
    assert.equal(down.items[0].topic, primary)

    // A failed audit must roll the associated document transition back as well.
    await pool.query(`ALTER TABLE document_audit ADD CONSTRAINT test_reject_archive CHECK (action <> 'archive')`)
    assert.equal((await request(`/admin/documents/${document.id}/archive`, 'POST')).status, 500)
    assert.equal((await request(`/documents/${document.id}`)).status, 200)
    await pool.query('ALTER TABLE document_audit DROP CONSTRAINT test_reject_archive')
    assert.equal((await request(`/admin/documents/${document.id}/archive`, 'POST')).status, 200)
    assert.equal((await request(`/documents/${document.id}`)).status, 404)
    const audit = await (await request('/admin/audit')).json()
    assert.deepEqual(audit.items.map((item: { action: string }) => item.action), ['archive', 'publish', 'update', 'create'])
    const newDraft = { ...sample, sourceUrl: 'https://example.com/imported' }
    const badBatch = await request('/admin/documents/import', 'POST', { documents: [newDraft, { ...newDraft, sourceUrl: 'file:///test' }] })
    assert.equal(badBatch.status, 400)
    assert.match((await badBatch.json()).error.message, /第 2 条/)
    const imported = await request('/admin/documents/import', 'POST', { documents: [
      newDraft, { ...newDraft, sourceUrl: 'https://EXAMPLE.com:443/imported' },
    ] })
    assert.deepEqual(await imported.json(), { created: 1, skipped: 1 })
    const repeated = await request('/admin/documents/import', 'POST', { documents: [newDraft] })
    assert.deepEqual(await repeated.json(), { created: 0, skipped: 1 })
    const importedRow = await pool.query('SELECT status FROM documents WHERE source_url = $1', [newDraft.sourceUrl])
    assert.deepEqual(importedRow.rows, [{ status: 'draft' }])
    const importAudit = await pool.query(`SELECT a.action FROM document_audit a JOIN documents d ON a.document_id = d.id WHERE d.source_url = $1`, [newDraft.sourceUrl])
    assert.deepEqual(importAudit.rows, [{ action: 'create' }])
    const reviewed = [{ id: 'legacy-1', sourceUrl: sample.sourceUrl, summary: '可回查原文摘要',
      excerpt: '经核验的测试摘录', analysis: '来源支持范围', evidenceLocator: '第1段' }]
    const preview = await backfillEvidence(pool, reviewed, false)
    assert.equal(preview[0].fields.length, 4)
    assert.equal((await (await request('/documents/legacy-1')).json()).excerpt, '')
    assert.equal((await backfillEvidence(pool, reviewed, true))[0].fields.length, 4)
    assert.deepEqual((await backfillEvidence(pool, reviewed, true))[0].fields, [])
    assert.equal((await (await request('/documents/legacy-1')).json()).excerpt, reviewed[0].excerpt)

    const draftReview = { ...reviewed[0], id: 'legacy-2', sourceUrl: 'https://example.com/legacy',
      evidenceSourceUrl: 'https://example.com/primary-source' }
    await backfillEvidence(pool, [draftReview], true, true)
    assert.equal((await request('/documents/legacy-2')).status, 404)
    const completedDraft = await (await request('/admin/documents/legacy-2')).json()
    assert.equal(completedDraft.status, 'draft')
    assert.equal(completedDraft.evidenceSourceUrl, draftReview.evidenceSourceUrl)
    assert.equal((await request('/admin/documents/legacy-2/publish', 'POST')).status, 200)
    const visibleDraft = await (await request('/documents/legacy-2')).json()
    assert.equal(visibleDraft.excerpt, draftReview.excerpt)
    assert.equal(visibleDraft.analysis, draftReview.analysis)
    assert.equal(visibleDraft.evidenceSourceUrl, draftReview.evidenceSourceUrl)
    assert.equal((await request('/admin/documents/legacy-2/archive', 'POST')).status, 200)


    const unknown = { ...newDraft, sourceUrl: 'https://example.com/unknown', category: '特别主题',
      summary: '可回查摘要', analysis: '适用范围', evidenceLocator: '第三段' }
    await request('/admin/documents/import', 'POST', { documents: [unknown] })
    const { items: unknownRows } = await (await request(`/admin/documents?category=${encodeURIComponent(unknown.category)}`)).json()
    const unknownId = unknownRows[0].id
    assert.equal(unknownRows[0].topicConfirmed, false)
    assert.equal((await request(`/admin/documents/${unknownId}/publish`, 'POST')).status, 409)
    await request(`/admin/documents/${unknownId}`, 'PATCH', { topic: primary })
    assert.equal((await request(`/admin/documents/${unknownId}/publish`, 'POST')).status, 200)
    const newTopicResults = await (await request(`/documents?topic=${encodeURIComponent(primary)}`)).json()
    assert.equal(newTopicResults.total, 2)
    assert.equal(newTopicResults.items.find((item: Document) => item.id === unknownId).category, unknown.category)

    const rotated = await start(createApp({ ...options, adminPassword: randomUUID() }))
    try {
      const priorSession = await fetch(`${rotated.url}/admin/session`, { headers: { cookie } })
      assert.deepEqual(await priorSession.json(), { authenticated: false })
    } finally {
      await close(rotated.server)
    }
    assert.equal((await request('/admin/session', 'DELETE')).status, 204)
    assert.equal((await request('/admin/audit')).status, 401)
  } finally {
    if (server) await close(server)
    await pool.end()
    await controlPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await controlPool.end()
  }
})
