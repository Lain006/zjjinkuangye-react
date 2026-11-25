import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('首页矿纹可暂停并记住选择，减少动态时固定在接通的一帧', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const turns = page.locator('.vein-turn')
  await expect(turns).toHaveCount(3)
  await expect(turns.first()).toHaveCSS('animation-duration', '8s')
  const pause = page.getByRole('button', { name: '暂停矿纹动画' })
  await pause.focus()
  await page.keyboard.press('Enter')
  await expect(turns.first()).toHaveCSS('animation-play-state', 'paused')
  await page.reload()
  const resume = page.getByRole('button', { name: '播放矿纹动画' })
  await expect(resume).toBeVisible()
  await resume.click()
  await expect(turns.first()).toHaveCSS('animation-play-state', 'running')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(pause).toBeHidden()
  for (const turn of await turns.all()) {
    await expect(turn).toHaveCSS('animation-name', 'none')
    await expect(turn).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
  }
})

test('预览与所选来源一致，打开详情后可以返回原检索', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const query = new URLSearchParams({ category: '跨境资金' })
  const { items } = await (await page.request.get('/api/v1/documents?' + query)).json()
  const doc = items[1]
  await page.goto('/documents?' + query)
  const row = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: doc.title, exact: true }) })
  await row.getByRole('button', { name: '预览', exact: true }).click()
  const preview = page.getByRole('complementary', { name: '文献预览' })
  await expect(preview.getByRole('link', { name: '打开原始出处' })).toHaveAttribute('href', doc.sourceUrl)
  await preview.getByRole('link', { name: '阅读完整记录' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(doc.title)
  await page.getByRole('link', { name: '返回文献库' }).click()
  await expect(page).toHaveURL(url => url.searchParams.get('category') === '跨境资金')
})

test('主题图例和 API 一致，键盘点选并带条件下钻', async ({ page }) => {
  const query = new URLSearchParams({ region: '三亚·海南' })
  const { topics, total } = await (await page.request.get('/api/v1/analytics?' + query)).json()
  const percent = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 })
  await page.goto('/analytics?' + query)
  await page.getByRole('heading', { name: '主题分布' }).waitFor()
  await expect(page.getByRole('tab', { name: '数量列表' })).toHaveCount(0)
  const legend = page.getByRole('list', { name: '各主题文献数量与占比' })
  await expect(legend.getByRole('button')).toHaveCount(topics.length)
  for (const { label, count } of topics) {
    const button = legend.getByRole('button', { name: new RegExp('^' + label) })
    await expect(button).toContainText(percent.format(count / total))
  }
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(scan.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([])
  const { label, count } = topics[0]
  await legend.getByRole('button', { name: new RegExp('^' + label) }).press('Enter')
  await expect(page.locator('.vein-pulse')).toHaveCSS('animation-name', 'vein-pulse')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.vein-pulse')).toHaveCSS('animation-name', 'none')
  await page.getByRole('link', { name: `查看所选主题文献（${label}）` }).click()
  await expect(page).toHaveURL(url => url.searchParams.get('topic') === label && url.searchParams.get('region') === '三亚·海南')
  await expect(page.getByRole('status')).toContainText(count + ' 条文献')
})

test('矿脉自动换支、悬停优先且不改变选中主题，暂停后静止', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/analytics')
  const idle = page.locator('.vein-flow--idle')
  const hover = page.locator('.vein-flow--hover')
  const selected = page.locator('.theme-legend [aria-pressed=true]')
  const selection = (await selected.textContent()) ?? ''
  await expect(idle).toHaveCount(1)
  const initialPath = await idle.getAttribute('d')
  await expect.poll(async () => {
    const path = await idle.evaluateAll(nodes => nodes[0]?.getAttribute('d'))
    return Boolean(path && path !== initialPath)
  }, { timeout: 5500 }).toBe(true)
  const branch = page.locator('.vein-branch').last()
  await branch.locator('.vein-end').hover()
  await expect(hover).toHaveCount(1)
  await expect(branch.locator('.vein-flow--hover')).toHaveCount(1)
  await expect(idle).toHaveCount(0)
  await expect(selected).toHaveText(selection)
  await page.getByRole('button', { name: '暂停全站动效' }).click()
  await expect(page.locator('.vein-flow')).toHaveCount(0)
  await page.getByRole('button', { name: '播放全站动效' }).click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.vein-flow')).toHaveCount(0)
})

test('矿脉按真实占比分拆，连续选择后铜线连到相符的文献', async ({ page }) => {
  const { topics, total }: { topics: { label: string; count: number }[]; total: number } =
    await (await page.request.get('/api/v1/analytics')).json()
  await page.goto('/analytics')
  const branches = page.getByRole('group', { name: '按文献数量分岔的主题矿脉' })
  await expect(branches.getByRole('button')).toHaveCount(topics.length)
  const widths = await branches.locator('.vein-band[stroke-width]').evaluateAll(paths => paths.map(p => Number(p.getAttribute('stroke-width'))))
  const fullWidth = widths.reduce((a, b) => a + b, 0)
  expect(widths.length).toBe(topics.length)
  for (const [i, category] of topics.entries()) {
    expect(widths[i] / fullWidth).toBeCloseTo(category.count / total, 5)
    const branch = branches.getByRole('button', { name: `选择主题 ${category.label}，${category.count} 条`, exact: true })
    await branch.locator('.vein-end').click()
    await expect(branch).toHaveAttribute('aria-pressed', 'true')
    const readout = page.locator('.theme-legend [aria-pressed=true]')
    await expect(readout).toContainText(category.label)
    expect(await readout.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0)
  }
  const chosen = topics[0]
  const target = branches.getByRole('button', { name: `选择主题 ${chosen.label}，${chosen.count} 条`, exact: true })
  await target.focus()
  await page.keyboard.press('Space')
  await expect(target).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('link', { name: `查看所选主题文献（${chosen.label}）` }).click()
  await expect(page.getByRole('status')).toContainText(chosen.count + ' 条文献')
  await expect(page.locator('.route-carry path')).toHaveAttribute('d', /^M /)
  const row = page.locator('.result-item').first()
  await row.getByRole('heading').getByRole('link').click()
  await expect(page.getByRole('link', { name: '打开原始出处' })).toHaveAttribute('href', /^https?:/)
})

test('时间轨、地区地球和日期筛选与数据库结果相符', async ({ page }) => {
  const filters = new URLSearchParams({ dateFrom: '2026-05-03', dateTo: '2026-10-29' })
  const { months, regions } = await (await page.request.get('/api/v1/analytics?' + filters)).json()
  const month = months[0]
  await page.goto('/analytics?view=time&' + filters)
  await page.getByRole('button', { name: '选择月份 ' + month.label }).click()
  const monthly = page.locator('.month-readout').getByRole('link')
  const matched = new URL(await monthly.getAttribute('href') ?? '', page.url())
  expect(matched.searchParams.get('dateFrom')).toBe(month.label === '2026-05' ? '2026-05-03' : month.label + '-01')
  await monthly.click()
  await expect(page.getByRole('status')).toContainText(month.count + ' 条文献')
  await page.goBack()
  const region = regions[regions.length - 1]
  await page.getByRole('tab', { name: '地区' }).click()
  await page.getByRole('button', { name: '选择地区 ' + region.label }).click()
  await page.getByRole('link', { name: /查看所选地区文献/ }).click()
  await expect(page).toHaveURL(url => url.searchParams.get('dateTo') === filters.get('dateTo') && url.searchParams.get('region') === region.label)
  await expect(page.getByRole('status')).toContainText(region.count + ' 条文献')
})

test('单主题、年份切换、未标日期和地区分页共用真实计数', async ({ page }) => {
  await page.route('**/api/v1/analytics*', route => route.fulfill({ json: {
    total: 110, latestCollectedAt: null, topics: [{ label: '样本分类', count: 110 }],
    months: [{ label: '2021-01', count: 6 }, { label: '2022-02', count: 97 }],
    regions: [{ label: '甲地', count: 97 }, { label: '乙地', count: 7 },
      ...Array.from({ length: 6 }, (_, i) => ({ label: `地区 ${i + 1}`, count: 1 }))],
  } }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/analytics')
  await expect(page.locator('.theme-legend [aria-pressed=true]')).toContainText('100%')
  await page.getByRole('tab', { name: '时间' }).click()
  await expect(page.getByText('7 条文献缺少发布日期。')).toBeVisible()
  await expect(page.getByRole('button', { name: '选择月份 2022-02' })).toBeVisible()
  await page.getByRole('tab', { name: '地区' }).click()
  const smaller = page.getByRole('button', { name: '选择地区 乙地' })
  await smaller.click()
  await expect(smaller).toHaveAttribute('aria-pressed', 'true')
  await expect(smaller).toContainText('7 条')
  await expect(smaller).toContainText('无单点坐标')
  const specimens = page.getByRole('list', { name: '按地区汇总的文献' })
  await expect(specimens.getByRole('button')).toHaveCount(6)
  await page.getByRole('navigation', { name: '地区分页' }).getByRole('button', { name: '第 2 页' }).click()
  await expect(specimens.getByRole('button')).toHaveCount(2)
  await page.getByRole('tab', { name: '时间' }).click()
  await page.getByLabel('选择发布年份').selectOption('2021')
  await expect(page.getByRole('button', { name: '选择月份 2021-01' })).toBeVisible()
  await expect(page.getByRole('button', { name: '选择月份 2022-02' })).toHaveCount(0)
})

test('年轮跨过空月份、支持键盘选择和按时间顺序回放', async ({ page }) => {
  await page.route('**/api/v1/analytics*', route => route.fulfill({ json: {
    total: 10, latestCollectedAt: null, topics: [{ label: '样本分类', count: 10 }], regions: [],
    months: [{ label: '2024-01', count: 2 }, { label: '2024-03', count: 3 }, { label: '2024-12', count: 5 }],
  } }))
  await page.goto('/analytics?view=time')
  const dial = page.getByRole('group', { name: '2024年发布月份' })
  const january = dial.getByRole('button', { name: '选择月份 2024-01' })
  const march = dial.getByRole('button', { name: '选择月份 2024-03' })
  const december = dial.getByRole('button', { name: '选择月份 2024-12' })
  await expect(dial.getByRole('button')).toHaveCount(3)
  await expect(dial.locator('.chronograph-empty-month')).toHaveCount(9)
  await expect(december).toHaveAttribute('aria-pressed', 'true')
  await december.press('ArrowRight')
  await expect(january).toBeFocused()
  await expect(january).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.month-readout')).toContainText('2 条文献')
  await expect(page.getByRole('link', { name: '查看当月文献（2024-01）' })).toHaveAttribute('href', /dateFrom=2024-01-01&dateTo=2024-01-31/)

  await page.getByRole('button', { name: '回放这一年' }).click()
  await expect(january).toHaveAttribute('aria-pressed', 'true')
  await expect(march).toHaveAttribute('aria-pressed', 'true')
  await expect(december).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '回放这一年' })).toBeVisible()
  await page.getByRole('button', { name: '回放这一年' }).click()
  await page.getByRole('button', { name: '暂停全站动效' }).click()
  await expect(page.getByRole('button', { name: '停止回放' })).toHaveCount(0)
  await expect(january).toHaveAttribute('aria-pressed', 'true')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await march.click()
  await expect(march).toHaveAttribute('aria-pressed', 'true')
  await expect(dial.locator('.chronograph-echo')).toHaveCount(0)
})

test('地球自动旋转、可暂停拖动并能点选球面地区', async ({ page }) => {
  await page.route('**/api/v1/analytics*', route => route.fulfill({ json: {
    total: 8, latestCollectedAt: null, topics: [{ label: '样本分类', count: 8 }], months: [],
    regions: [{ label: '中国', count: 5 }, { label: '三亚·海南', count: 3 }],
  } }))
  await page.goto('/analytics?view=regions')
  const canvas = page.getByLabel('可交互的三维文献地球')
  await canvas.scrollIntoViewIfNeeded()
  const signature = () => canvas.evaluate((element: HTMLCanvasElement) => {
    const ctx = element.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D unavailable')
    const { data } = ctx.getImageData(Math.floor(element.width * .32), Math.floor(element.height * .34), 48, 32)
    return data.reduce((hash, value) => Math.imul(hash ^ value, 16777619), 0)
  })
  const initial = await signature()
  await expect.poll(signature).not.toBe(initial)
  await page.getByRole('button', { name: '暂停自转' }).click()
  await expect(page.getByRole('button', { name: '恢复自转' })).toBeVisible()
  const paused = await signature()
  await expect.poll(async () => {
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 160)))
    return signature()
  }).toBe(paused)
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('Globe bounds unavailable')
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 90, y + 60, { steps: 8 })
  await page.mouse.up()
  expect(await signature()).not.toBe(paused)
  await canvas.focus()
  const dragged = await signature()
  await page.keyboard.press('ArrowRight')
  expect(await signature()).not.toBe(dragged)

  await page.getByRole('button', { name: '选择地区 三亚·海南' }).click()
  await expect(page.getByRole('button', { name: '选择地区 三亚·海南' })).toHaveAttribute('aria-pressed', 'true')
  await canvas.scrollIntoViewIfNeeded()
  const centered = await canvas.boundingBox()
  if (!centered) throw new Error('Globe bounds unavailable')
  const cx = centered.x + centered.width / 2
  const cy = centered.y + centered.height / 2
  const radius = Math.min(centered.width * .395, centered.height * .42)
  await page.mouse.click(cx - radius * .079, cy - radius * .29)
  await expect(page.getByRole('button', { name: '选择地区 中国' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('link', { name: '查看所选地区文献（中国）' })).toHaveAttribute('href', /region=/)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.getByRole('button', { name: '恢复自转' })).toHaveCount(0)
  await expect(canvas).toBeVisible()
})

test('展品切换支持键盘、深链接和历史记录，并保留读数、停止回放', async ({ page }) => {
  await page.clock.install()
  const filters = new URLSearchParams({ region: '三亚·海南' })
  const requests: string[] = []
  await page.route('**/api/v1/analytics*', route => {
    requests.push(new URL(route.request().url()).search)
    return route.fulfill({ json: {
      total: 10, latestCollectedAt: null,
      topics: [{ label: '跨境资金与金融合规', count: 7 }, { label: '其他', count: 3 }],
      months: [{ label: '2024-01', count: 2 }, { label: '2024-03', count: 3 }, { label: '2024-12', count: 5 }],
      regions: [{ label: '中国', count: 5 }, { label: '三亚·海南', count: 5 }],
    } })
  })
  await page.goto('/analytics?view=invalid&' + filters)
  const topics = page.getByRole('tab', { name: '主题', exact: true })
  const time = page.getByRole('tab', { name: '时间', exact: true })
  const regions = page.getByRole('tab', { name: '地区', exact: true })
  await expect(topics).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.globe-stage canvas')).toHaveCount(0)
  await page.getByRole('list', { name: '各主题文献数量与占比' }).getByRole('button', { name: /^其他/ }).click()
  await topics.press('ArrowRight')
  await expect(time).toBeFocused()
  await expect(topics).toHaveAttribute('aria-selected', 'true')
  await time.press('Enter')
  await expect(page).toHaveURL(url => url.searchParams.get('view') === 'time' && url.searchParams.get('region') === '三亚·海南')
  await expect(page.getByRole('tabpanel')).toHaveCount(1)
  await page.getByRole('button', { name: '回放这一年' }).click()
  await regions.click()
  await expect(page.getByRole('tabpanel', { name: '地区' })).toBeVisible()
  await expect(page.locator('.vein-flow')).toHaveCount(0)
  await page.getByRole('button', { name: '选择地区 三亚·海南' }).click()
  await page.clock.runFor(1600)
  await page.goBack()
  await expect(time).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: '选择月份 2024-01' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '停止回放' })).toHaveCount(0)
  await page.goForward()
  await expect(page.getByRole('button', { name: '选择地区 三亚·海南' })).toHaveAttribute('aria-pressed', 'true')
  await topics.click()
  await expect(page.getByRole('link', { name: '查看所选主题文献（其他）' })).toHaveAttribute('href', /topic=/)
  await expect(page.getByRole('link', { name: '查看范围内文献' })).toHaveAttribute('href', '/documents?' + filters)
  expect(requests).toHaveLength(1)
  expect(new URLSearchParams(requests[0]).get('view')).toBeNull()
})

test('点光会转向最后落点，暂停和减少动态都能跨页生效', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 850 })
  await page.goto('/')
  await page.getByRole('searchbox', { name: '搜索合规文献' }).waitFor()
  await page.mouse.click(14, 165)
  await page.mouse.click(10, 255)
  const pool = page.locator('.stage-spotlight .lamp-pool')
  await expect.poll(() => pool.evaluate((element: SVGGElement) => {
    const transforms = element.transform.baseVal
    if (!transforms.numberOfItems) return null
    const { e, f } = transforms.getItem(0).matrix
    return [Math.round(e * 1000) / 1000, Math.round(f * 1000) / 1000]
  })).toEqual([10, 255])
  await expect(page.locator('.stage-spotlight')).toHaveCSS('opacity', '0')
  await page.getByRole('button', { name: '暂停全站动效' }).click()
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '文献库' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused')
  await page.mouse.click(12, 200)
  await expect(page.locator('.stage-spotlight')).toHaveCSS('opacity', '0')
  await page.reload()
  await expect(page.getByRole('button', { name: '播放全站动效' })).toBeVisible()
})

test('维护目录在窄屏保留行操作，桌面与移动均可读取标题及按钮', async ({ page, baseURL }, testInfo) => {
  if (!baseURL) throw new Error('需要端到端测试站点')
  const response = await page.request.post('/api/v1/admin/session', {
    headers: { Origin: baseURL }, data: { password: process.env.PW_TEST_ADMIN_PASSWORD },
  })
  expect(response.ok()).toBe(true)
  await page.goto('/admin')
  await page.getByRole('group', { name: '按资料状态筛选' }).getByRole('button', { name: '已发布' }).click()
  const table = page.getByRole('table', { name: '资料目录' })
  const action = table.getByRole('button', { name: /^归档《/ }).first()
  for (const width of [320, 390, 740, 741, 768, 1020, 1021, 1440]) {
    await page.setViewportSize({ width, height: width <= 740 ? 844 : 900 })
    await expect(action).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    if (width === 390 || width === 1440) {
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      await page.screenshot({ path: testInfo.outputPath(`maintenance-${width}.png`) })
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(scan.violations).toEqual([])
    }
  }
})
