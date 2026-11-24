import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createPool, transaction } from '../backend/src/db.ts'

test('四页文献与百条以上的审计记录可直接跳页，两个工作区各自记页', async ({ page, baseURL }) => {
  test.setTimeout(60_000)
  const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://zj_course@127.0.0.1:55432/zj_course'
  test.skip(!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(databaseUrl).hostname), '分页压力数据使用本地测试库')
  const token = 'pagination-' + randomUUID().slice(0, 8)
  const api = '/api/v1/admin'
  const headers = { Origin: baseURL! }
  const input = {
    title: `${token} 课程分页核对资料及超长标题排版校验`,
    sourceName: '本地分页检验来源',
    sourceType: '政府动态',
    region: '三亚·海南',
    category: '资金',
    topic: '跨境资金与金融合规',
    summary: '验证真实分页。'.repeat(30),
    evidenceLocator: '测试正文第一段',
    analysis: '分页验收资料。',
  }
  const documents = Array.from({ length: 101 }, (_, index) => ({
    ...input, title: `${input.title} ${index + 1}`, sourceUrl: `https://example.com/${token}/${index + 1}`,
  }))
  const login = await page.request.post(api + '/session', { headers, data: { password: process.env.PW_TEST_ADMIN_PASSWORD } })
  expect(login.ok()).toBeTruthy()
  try {
    for (const batch of [documents.slice(0, 100), documents.slice(100)]) {
      const imported = await page.request.post(api + '/documents/import', { headers, data: { documents: batch } })
      expect(await imported.json()).toEqual({ created: batch.length, skipped: 0 })
    }
    const { items } = await (await page.request.get(`${api}/documents?q=${token}&pageSize=27`)).json()
    expect(items).toHaveLength(27)
    for (const { id } of items) {
      expect((await page.request.post(`${api}/documents/${id}/publish`, { headers })).ok()).toBeTruthy()
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/documents?q=${token}`)
    const results = page.locator('.result-list > li')
    await expect(results).toHaveCount(8)
    await expect(results.first().getByRole('link', { name: '原文' })).toBeVisible()
    await page.getByLabel('跳到文献页码').fill('4')
    await page.getByRole('button', { name: '跳页' }).click()
    await expect(page).toHaveURL(url => url.searchParams.get('page') === '4')
    await expect(results).toHaveCount(3)
    await expect(page.getByRole('heading', { name: '检索结果' })).toBeFocused()
    await results.first().getByRole('heading').getByRole('link').click()
    await page.getByRole('link', { name: '返回文献库' }).click()
    await expect(page).toHaveURL(url => url.searchParams.get('page') === '4')
    await page.goto(`/documents?q=${token}&page=999`)
    await expect(page).toHaveURL(url => url.searchParams.get('page') === '4')
    await page.getByRole('searchbox', { name: '检索文献关键词' }).press('Enter')
    await expect(page).toHaveURL(url => !url.searchParams.has('page'))
    await expect(results).toHaveCount(8)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

    await page.goto('/admin')
    const catalog = page.getByRole('tab', { name: '资料目录' })
    const audit = page.getByRole('tab', { name: '操作记录' })
    await expect(catalog).toHaveAttribute('aria-selected', 'true')
    const keyword = page.getByRole('textbox', { name: '检索关键词' })
    await keyword.fill(token)
    await keyword.press('Enter')
    await page.getByLabel('跳到资料页码').fill('3')
    await page.getByRole('button', { name: '跳页' }).click()
    const table = page.getByRole('table', { name: '资料目录' })
    await expect(table.locator('tbody tr')).toHaveCount(10)
    await expect(page.getByRole('navigation', { name: '资料分页' }).locator('[aria-current]')).toHaveText('3')
    await audit.click()
    await expect(table).toHaveCount(0)
    await page.getByLabel('跳到操作记录页码').fill('11')
    await page.getByRole('button', { name: '跳页' }).click()
    const history = await (await page.request.get(api + '/audit?page=11')).json()
    expect(history.total).toBeGreaterThan(100)
    expect(history.items).toHaveLength(10)
    await expect(page.locator('.admin-audit__feed > li')).toHaveCount(10)
    await expect(page.locator('.admin-audit__feed').first()).toContainText(history.items[0].documentTitle)
    await catalog.click()
    await expect(page.getByRole('navigation', { name: '资料分页' }).locator('[aria-current]')).toHaveText('3')
    await audit.click()
    await expect(page.getByRole('navigation', { name: '操作记录分页' }).locator('[aria-current]')).toHaveText('11')
  } finally {
    const pool = createPool(databaseUrl)
    const urls = documents.map(document => document.sourceUrl)
    try {
      await transaction(pool, async client => {
        // Only remove records and audit events created by this browser test.
        await client.query(`DELETE FROM document_audit USING documents
          WHERE document_id = documents.id AND source_url = ANY($1::text[])`, [urls])
        await client.query('DELETE FROM documents WHERE source_url = ANY($1::text[])', [urls])
      })
    } finally {
      await pool.end()
    }
  }
})
