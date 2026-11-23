import { randomUUID } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const admin = '/api/v1/admin'
const base = 'http://127.0.0.1:3101'

test('首页搜索、专题深链接与来源详情', async ({ page }) => {
  await page.goto('/')
  const search = page.getByRole('searchbox', { name: '搜索合规文献' })
  await search.fill('紫金')
  await search.press('Enter')
  await expect(page).toHaveURL(/\/documents\?.*q=/)
  await expect(page.getByRole('heading', { name: '合规文献库' })).toBeVisible()
  await page.goto('/documents?category=' + encodeURIComponent('跨境资金'))
  const response = await page.request.get('/api/v1/documents?category=' + encodeURIComponent('跨境资金'))
  const { items } = await response.json()
  await page.goto('/documents/' + items[0].id)
  await expect(page.getByRole('heading', { name: items[0].title, exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '打开原始出处' })).toHaveAttribute('href', items[0].sourceUrl)
})

test('测试资料保存、发布、独立会话可查与归档', async ({ page, browser, playwright }) => {
  const visitor = await playwright.request.newContext({ baseURL: base })
  const writes = { Origin: base }
  const suffix = randomUUID()
  const title = '课程验证 跨境资金 ' + suffix.slice(0, 8)
  const input = {
    title,
    sourceName: '课程验证来源',
    sourceUrl: 'https://example.com/course-verification/' + suffix,
    sourceType: '政府动态',
    region: '三亚·海南',
    category: '跨境资金',
    summary: '仅用于验证开发环境写入及公开检索。',
    publishDate: '2026-07-27',
  }
  expect((await visitor.post(admin + '/documents', { headers: writes, data: input })).status()).toBe(401)
  const signedIn = await page.request.post(admin + '/session', { headers: writes, data: { password: process.env.PW_TEST_ADMIN_PASSWORD } })
  expect(signedIn.ok()).toBeTruthy()
  const created = await page.request.post(admin + '/documents', { headers: writes, data: input })
  expect(created.status()).toBe(201)
  const { id } = await created.json()
  expect((await page.request.post(admin + '/documents', { headers: writes, data: input })).status()).toBe(409)

  try {
    expect((await visitor.get('/api/v1/documents/' + id)).status()).toBe(404)
    await page.goto('/admin')
    await page.getByRole('button', { name: '发布《' + title + '》' }).click()
    await page.getByRole('button', { name: '确认发布' }).click()
    await expect.poll(async () => (await visitor.get('/api/v1/documents/' + id)).status()).toBe(200)

    const clean = await browser.newContext({ baseURL: base })
    try {
      const anonymous = await clean.newPage()
      await anonymous.goto('/documents/' + id)
      await expect(anonymous.getByRole('heading', { name: title })).toBeVisible()
      await expect(anonymous.getByRole('link', { name: '打开原始出处' })).toHaveAttribute('href', input.sourceUrl)
      await anonymous.goto('/analytics')
      const drilldown = anonymous.getByRole('link', { name: /^跨境资金\s+\d+\s*条$/ })
      await drilldown.click()
      await expect(anonymous).toHaveURL(/\/documents\?category=/)
      const data = await (await visitor.get('/api/v1/documents?q=' + encodeURIComponent(title))).json()
      expect(data.items.map((item: {id: string}) => item.id)).toEqual([id])
    } finally {
      await clean.close()
    }
    await page.getByRole('button', { name: '归档《' + title + '》' }).click()
    await page.getByRole('button', { name: '确认归档' }).click()
    await expect.poll(async () => (await visitor.get('/api/v1/documents/' + id)).status()).toBe(404)
    const audit = await (await page.request.get(admin + '/audit')).json()
    expect(audit.items.filter((entry: {documentId: string}) => entry.documentId === id).map((entry: {action: string}) => entry.action)).toEqual(['archive', 'publish', 'create'])
  } finally {
    await page.request.post(admin + '/documents/' + id + '/archive', { headers: writes })
    await visitor.dispose()
  }
})

test('检索故障有重试入口并重新载入实际结果', async ({ page }) => {
  const api = '**/api/v1/documents*'
  await page.route(api, (route) => route.abort('failed'), { times: 1 })
  await page.goto('/documents')
  const retry = page.getByRole('button', { name: '重试' })
  await expect(retry).toBeVisible()
  await retry.click()
  await expect(retry).toBeHidden()
  await expect(page.getByRole('link', { name: /伴企扬帆出海/ })).toBeVisible()
})

test('窄屏筛选、键盘关闭、可访问性和视口宽度', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 })
    await page.goto('/documents')
    await expect(page.getByRole('heading', { name: '合规文献库' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1)
  }
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(scan.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')).toEqual([])
  await page.setViewportSize({ width: 390, height: 844 })
  const filters = page.getByRole('button', { name: '筛选', exact: true })
  await filters.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: '筛选文献' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(filters).toBeFocused()
})
