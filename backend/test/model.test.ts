import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { z } from 'zod'
import { collectDraft, sources } from '../src/intake.ts'
import { analyticsQuery, documentInput, documentPatch, listQuery, seedDocument } from '../src/model.ts'

const base = { title: '三亚政策', sourceName: '测试来源', sourceUrl: 'https://example.com/a',
  sourceType: '政策', region: '海南', category: '资金' }

test('documents validate boundaries and normalize the legacy collection date', () => {
  assert.equal(documentInput.parse({ ...base, collectedAt: '2026-02-01' }).collectedAt, '2026-02-01T00:00:00.000Z')
  assert.equal(documentInput.safeParse({ ...base, publishDate: '2026-02-29' }).success, false)
  assert.equal(documentInput.safeParse({ ...base, sourceUrl: 'file:///private' }).success, false)
  assert.equal(documentInput.safeParse({ ...base, status: 'published' }).success, false)
  assert.equal(documentPatch.safeParse({}).success, false)
  assert.equal(analyticsQuery.safeParse({ dateFrom: '2026-11-01', dateTo: '2026-10-01' }).success, false)
  assert.equal(listQuery.safeParse({ page: ['1', '2'] }).success, false)
})

test('the curated seed fixture uses valid input and unique sources', async () => {
  const input: unknown = JSON.parse(await readFile(new URL('../data/seed.json', import.meta.url), 'utf8'))
  const records = z.array(seedDocument).parse(input)
  assert.ok(records.length > 0)
  assert.equal(new Set(records.map((record) => record.sourceUrl)).size, records.length)
})

test('official HTML extraction returns plain metadata and a bounded excerpt', async () => {
  const mockFetch: typeof fetch = async (request, options) => {
    assert.equal(request, sources[0].url)
    assert.equal(options?.redirect, 'error')
    const html = `<!doctype html><meta charset="utf-8"><meta name="ArticleTitle" content="三亚政策">
      <meta name="PubDate" content="2026-08-01 12:41:43"><div class="article-top"><p>日期：2026-07-27</p></div>
      <div class="article-content"><p>${'政策'.repeat(60)}</p></div>`
    return new Response(html, { headers: { 'content-type': 'text/html' } })
  }
  const draft = await collectDraft(sources[0], mockFetch)
  assert.equal(draft.title, '三亚政策')
  assert.equal(draft.publishDate, '2026-07-27')
  assert.equal(draft.sourceUrl, sources[0].url)
  assert.equal(Array.from(draft.excerpt ?? '').length, 73)
  await assert.rejects(collectDraft(sources[0], async () => new Response('{}', {
    headers: { 'content-type': 'application/json' },
  })))
  await assert.rejects(collectDraft(sources[0], async () => new Response('a'.repeat(530_000), {
    headers: { 'content-type': 'text/html' },
  })))
})
