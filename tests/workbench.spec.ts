import { randomUUID } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { topicOptions } from '../backend/src/topics'

const admin = '/api/v1/admin'
const base = 'http://127.0.0.1:3101'

test('首页搜索、专题深链接与来源详情', async ({ page }) => {
  await page.goto('/')
  const search = page.getByRole('searchbox', { name: '搜索合规文献' })
  await search.fill('紫金')
  await search.press('Enter')
  await expect(page).toHaveURL(/\/documents\?.*q=/)
  await expect(page.getByRole('heading', { name: '合规文献库' })).toBeVisible()
  await page.goto('/documents?category=' + encodeURIComponent('跨境资金') + '&page=999999')
  await expect(page).toHaveURL((url) => url.searchParams.get('category') === '跨境资金' && !url.searchParams.has('page'))
  const response = await page.request.get('/api/v1/documents?category=' + encodeURIComponent('跨境资金'))
  const { items } = await response.json()
  await page.goto('/documents/' + items[0].id)
  await expect(page.getByRole('heading', { name: items[0].title, exact: true })).toBeVisible()
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page.getByRole('link', { name: '打开原始出处' })).toHaveAttribute('href', items[0].sourceUrl)
})

test('首页专题可逐一切换、刷新换题，并打开对应的文献结果', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/')
  const carousel = page.getByRole('region', { name: '首页专题' })
  const current = carousel.getByRole('heading', { level: 2 })
  const initialTitle = await current.textContent()
  const initial = topicOptions.findIndex(topic => topic + '专题' === initialTitle)
  expect(initial).toBeGreaterThanOrEqual(0)
  const next = carousel.getByRole('button', { name: '下一个专题' })
  const previous = carousel.getByRole('button', { name: '上一个专题' })
  const last = topicOptions[(initial + topicOptions.length - 1) % topicOptions.length]
  await previous.click()
  await expect(current).toHaveText(last + '专题')
  await next.click()
  for (let step = 0; step < topicOptions.length; step++) {
    const topic = topicOptions[(initial + step) % topicOptions.length]
    await expect(current).toHaveText(topic + '专题')
    const url = new URL(await carousel.getByRole('link', { name: /^打开专题/ }).getAttribute('href') ?? '', page.url())
    expect(url.searchParams.get('topic')).toBe(topic)
    const response = await page.request.get('/api/v1/documents?' + url.searchParams)
    const { items } = await response.json()
    if (items.length) {
      const preview = carousel.getByRole('heading', { level: 3 }).getByRole('link')
      await expect(preview).toHaveAttribute('href', /\/documents\/.+/)
      const previewUrl = await preview.getAttribute('href')
      expect(items.some((item: { id: string }) => '/documents/' + encodeURIComponent(item.id) === previewUrl)).toBeTruthy()
    } else {
      await expect(carousel.getByText('这个专题暂未收录公开文献。')).toBeVisible()
    }
    await next.click()
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await page.reload()
  const following = topicOptions[(initial + 1) % topicOptions.length]
  await expect(current).toHaveText(following + '专题')
  await carousel.getByRole('link', { name: /^打开专题/ }).click()
  await expect(page).toHaveURL(url => url.pathname === '/documents' && url.searchParams.get('topic') === following)
})

test('专题自动换题和刷新时轻摆，悬停或暂停时保留当前专题', async ({ page }) => {
  await page.clock.install()
  await page.addInitScript(() => {
    document.addEventListener('animationstart', event => {
      if (event.animationName === 'paper-sway' && event.target instanceof HTMLElement && event.target.matches('.index-topic')) {
        const root = document.documentElement
        root.dataset.topicSways = String(Number(root.dataset.topicSways ?? 0) + 1)
      }
    })
  })
  const sways = () => page.evaluate(() => Number(document.documentElement.dataset.topicSways ?? 0))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const carousel = page.getByRole('region', { name: '首页专题' })
  const current = carousel.getByRole('heading', { level: 2 })
  await carousel.scrollIntoViewIfNeeded()
  await page.mouse.move(0, 0)
  const initial = await current.textContent()
  await page.clock.runFor(200)
  await expect.poll(sways).toBe(1)
  await page.clock.fastForward(5100)
  await expect(current).not.toHaveText(initial!)
  await expect.poll(sways).toBe(2)
  const playingTopic = await current.textContent()
  await carousel.hover()
  await page.clock.fastForward(9000)
  await expect(current).toHaveText(playingTopic!)
  await carousel.getByRole('button', { name: '暂停专题轮播' }).click()
  await page.getByRole('main').focus()
  await page.mouse.move(0, 0)
  await page.clock.fastForward(9000)
  await expect(current).toHaveText(playingTopic!)
  await carousel.getByRole('button', { name: '播放专题轮播' }).click()
  await page.getByRole('button', { name: '暂停全站动效' }).click()
  await page.clock.fastForward(9000)
  await expect(current).toHaveText(playingTopic!)
  const beforePaused = await sways()
  const next = carousel.getByRole('button', { name: '下一个专题' })
  await next.press('Enter')
  await expect(current).not.toHaveText(playingTopic!)
  expect(await sways()).toBe(beforePaused)
  await page.getByRole('button', { name: '播放全站动效' }).click()
  await next.press('Enter')
  await expect.poll(sways).toBe(beforePaused + 1)
  await page.reload()
  await carousel.scrollIntoViewIfNeeded()
  await expect.poll(sways).toBe(1)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await next.press('Enter')
  await expect(carousel).not.toHaveClass(/index-topic--sway/)
  expect(await sways()).toBe(1)
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
    evidenceLocator: '测试原文第1段',
    analysis: '验证文献发布所需的课程分析字段。',
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
    const openAnalytics = await page.context().newPage()
    await openAnalytics.goto('/analytics?q=' + encodeURIComponent(title))
    await expect(openAnalytics.getByText('当前范围暂无数据')).toBeVisible()
    await page.goto('/admin')
    await page.getByRole('button', { name: '发布《' + title + '》' }).click()
    await page.getByRole('button', { name: '确认发布' }).click()
    await expect.poll(async () => (await visitor.get('/api/v1/documents/' + id)).status()).toBe(200)
    await expect(openAnalytics.getByRole('heading', { name: '主题分布' })).toBeVisible()
    await expect(openAnalytics.locator('.theme-legend')).toContainText('跨境资金与金融合规')
    await openAnalytics.close()

    const clean = await browser.newContext({ baseURL: base })
    try {
      const anonymous = await clean.newPage()
      await anonymous.goto('/documents/' + id)
      await expect(anonymous.getByRole('heading', { name: title })).toBeVisible()
      await expect(anonymous.getByRole('link', { name: '打开原始出处' })).toHaveAttribute('href', input.sourceUrl)
      await anonymous.goto('/analytics')
      const topic = '跨境资金与金融合规'
      await anonymous.getByRole('list', { name: '各主题文献数量与占比' }).getByRole('button', { name: new RegExp('^' + topic) }).click()
      await anonymous.getByRole('link', { name: `查看所选主题文献（${topic}）` }).click()
      await expect(anonymous).toHaveURL(/\/documents\?topic=/)
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

test('管理员从 Excel、CSV 与旧版 JSON 导入待核验草稿', async ({ page }) => {
  const api = '/api/v1/admin'
  const token = randomUUID().slice(0, 8)
  const source = 'https://example.com/import/' + token
  const fixture = {
    title: '批量导入验证 ' + token, sourceName: '来源验证', sourceUrl: source,
    sourceType: '政策文件', region: '国际', category: '跨境资金', collectDate: '2026-11-23',
  }
  const login = await page.request.post(api + '/session', { headers: { Origin: base }, data: { password: process.env.PW_TEST_ADMIN_PASSWORD } })
  expect(login.ok()).toBeTruthy()
  await page.goto('/admin')
  const { utils, write } = await import('xlsx')
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, utils.json_to_sheet([fixture]), '合规数据')
  const files = [
    { name: '资料.xlsx', mimeType: 'application/octet-stream', buffer: write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer },
    { name: '资料.xls', mimeType: 'application/octet-stream', buffer: write(workbook, { type: 'buffer', bookType: 'biff8' }) as Buffer },
    { name: '资料.csv', mimeType: 'text/csv', buffer: Buffer.from('\uFEFF' + utils.sheet_to_csv(workbook.Sheets['合规数据'])) },
    { name: '资料.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ ...fixture, id: 33, status: 'published' }])) },
  ]
  for (const [index, file] of files.entries()) {
    await page.getByRole('button', { name: '批量导入', exact: true }).click()
    await page.getByLabel('选择导入文件').setInputFiles(file)
    await expect(page.getByText(fixture.title + ' · 国际')).toBeVisible()
    await page.getByRole('button', { name: '导入为草稿' }).click()
    await expect(page.getByRole('status').filter({ hasText: index === 0 ? '已导入 1 条草稿' : '跳过 1 条重复来源' })).toBeVisible()
  }
  const list = await page.request.get(api + '/documents?q=' + token)
  const {items} = await list.json()
  expect(items.map((item: {status: string}) => item.status)).toEqual(['draft'])
  const publicList = await (await page.request.get('/api/v1/documents?q=' + token)).json()
  expect(publicList.total).toBe(0)
})
