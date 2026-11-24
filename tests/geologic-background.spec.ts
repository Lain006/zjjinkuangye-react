import { expect, test, type Locator } from '@playwright/test'

test.use({ reducedMotion: 'no-preference' })

function sedimentFrame(backdrop: Locator) {
  return backdrop.evaluate(node => ({
    currents: [...node.querySelectorAll('.strata-current')].map(path => parseFloat(getComputedStyle(path).strokeDashoffset)),
    deposits: [...node.querySelectorAll('.strata-deposit')].map(group => {
      const transform = getComputedStyle(group).transform
      return transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a
    }),
  }))
}

test('流线沿层推进、薄透镜错时生长，层界的位置和形状稳定', async ({ page }) => {
  await page.goto('/')
  const backdrop = page.locator('.strata-backdrop')
  await expect(backdrop.locator('.strata-current').first()).toBeVisible()
  await expect(backdrop.locator('.strata-deposit').first()).toBeVisible()
  const first = await sedimentFrame(backdrop)
  await expect.poll(async () => {
    const frame = await sedimentFrame(backdrop)
    return {
      advancing: frame.currents.some((offset, i) => Math.abs(offset - first.currents[i]) > .0001),
      growing: frame.deposits.some((scale, i) => Math.abs(scale - first.deposits[i]) > .0001),
      staggered: Math.max(...frame.deposits) - Math.min(...frame.deposits) > .01,
    }
  }).toEqual({ advancing: true, growing: true, staggered: true })

  const shapeFrames = await backdrop.evaluate(node => {
    const beds = [...node.querySelectorAll<SVGPathElement>('path[data-bed]')]
    const animations = node.getAnimations({ subtree: true })
    return [0, .27, .54, .81].map(phase => {
      for (const animation of animations) {
        animation.pause()
        animation.currentTime = phase * Number(animation.effect?.getComputedTiming().duration)
      }
      return beds.map(path => {
        const matrix = path.getScreenCTM()
        if (!matrix) throw new Error('地层路径缺少屏幕投影')
        const length = path.getTotalLength()
        return [length, ...[.05, .25, .5, .75, .95].flatMap(fraction => {
          const point = path.getPointAtLength(length * fraction).matrixTransform(matrix)
          return [point.x, point.y]
        })]
      })
    })
  })
  expect(shapeFrames[0].length).toBeGreaterThan(1)
  expect(shapeFrames[0].every(([length]) => length > 0)).toBe(true)
  for (const frame of shapeFrames.slice(1)) expect(frame).toEqual(shapeFrames[0])
})

test('手机检索跨页保留暂停画面，隐藏标签和减少动态都能停住沉积纹', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const backdrop = page.locator('.strata-backdrop')
  const running = () => backdrop.evaluate(node => node.getAnimations({ subtree: true }).some(a => a.playState === 'running'))
  await expect.poll(running).toBe(true)
  await page.getByRole('button', { name: '暂停全站动效' }).click()
  await expect.poll(running).toBe(false)
  // A CSS pause can report "paused" while the final sampled time is still pending.
  await backdrop.evaluate(async node => {
    await Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.ready))
  })
  const stopped = await sedimentFrame(backdrop)
  await page.getByRole('searchbox', { name: '搜索合规文献' }).fill('矿业')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(page).toHaveURL(url => url.pathname === '/documents' && url.searchParams.get('q') === '矿业')
  expect(await sedimentFrame(backdrop)).toEqual(stopped)
  await page.getByRole('button', { name: '播放全站动效' }).click()
  await expect.poll(() => sedimentFrame(backdrop)).not.toEqual(stopped)

  // Switching headless tabs does not reliably change document visibility in Chromium.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(running).toBe(false)
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden')
    Reflect.deleteProperty(document, 'visibilityState')
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(running).toBe(true)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.getByRole('button', { name: '已减少动效' })).toBeDisabled()
  await expect.poll(running).toBe(false)
  const still = await sedimentFrame(backdrop)
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '首页' }).click()
  await expect(page.getByRole('searchbox', { name: '搜索合规文献' })).toBeVisible()
  expect(await sedimentFrame(backdrop)).toEqual(still)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
