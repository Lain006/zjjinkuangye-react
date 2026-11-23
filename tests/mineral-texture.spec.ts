import { expect, test } from '@playwright/test'

test.use({ reducedMotion: 'no-preference' })

test('顶面纹线分批显隐，两个侧面的波纹在固定岩面内迁移', async ({ page }) => {
  await page.goto('/')
  const plate = page.getByRole('figure', { name: '矿纹剖面图版' })
  await expect(plate.locator('path.sample-vein-line').first()).toBeAttached()
  const samples = await plate.evaluate(figure => {
    const lines = [...figure.querySelectorAll<SVGPathElement>('path.sample-vein-line')]
    const faces = ['front', 'right'].map(name => {
      const face = figure.querySelector<SVGGraphicsElement>(`[data-ore-face="${name}"]`)
      if (!face) throw new Error('缺少岩石侧面 ' + name)
      const waves = [...face.querySelectorAll<SVGGraphicsElement>('.ore-wave-motion')].map(wave => {
        const trace = wave.querySelector<SVGUseElement>('use.ore-wave-trace')
        if (!trace) throw new Error(name + ' 缺少 ' + wave.dataset.rockLayer + ' 细纹')
        return { wave, trace }
      })
      return { face, waves }
    })
    const animations = figure.getAnimations({ subtree: true })
    const cycle = Math.max(...animations.map(a => Number(a.effect?.getComputedTiming().duration) || 0))
    if (!cycle) throw new Error('矿样没有可取样的动画周期')
    for (const animation of animations) animation.pause()

    // Seek the browser timeline directly so a complete cycle takes no wall-clock waiting.
    return Array.from({ length: 24 }, (_, step) => {
      for (const animation of animations) animation.currentTime = cycle * step / 24
      return {
        lines: lines.map(line => {
          const style = getComputedStyle(line)
          return { batch: line.dataset.batch, offset: parseFloat(style.strokeDashoffset), opacity: Number(style.opacity) }
        }),
        faces: faces.map(({ face, waves }) => {
          const matrix = face.getCTM()
          if (!matrix) throw new Error('岩石侧面缺少投影矩阵')
          return {
            anchor: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].join(','),
            waves: waves.map(({ wave, trace }) => ({
              bed: wave.dataset.rockLayer,
              x: new DOMMatrixReadOnly(getComputedStyle(wave).transform).e,
              traceOffset: parseFloat(getComputedStyle(trace).strokeDashoffset),
            })),
          }
        }),
      }
    })
  })

  for (const [i, line] of samples[0].lines.entries()) {
    if (line.batch === undefined) throw new Error('顶面纹线缺少显影批次')
    const phases = samples.map(sample => sample.lines[i])
    // pathLength=1: near zero exposes the line; a full-length offset withdraws it.
    expect(phases.some(phase => Math.abs(phase.offset) < .1 && phase.opacity > .5)).toBe(true)
    expect(phases.some(phase => Math.abs(phase.offset) > .9 && phase.opacity < .2)).toBe(true)
  }
  expect(samples.some(({ lines }) => lines.some(shown => Math.abs(shown.offset) < .1 &&
    lines.some(hidden => shown.batch !== hidden.batch && Math.abs(hidden.offset) > .9)))).toBe(true)

  for (const [i, face] of samples[0].faces.entries()) {
    expect(new Set(samples.map(sample => sample.faces[i].anchor)).size).toBe(1)
    expect(face.waves.map(wave => wave.bed).sort()).toEqual(['copper', 'greenstone', 'limestone', 'shale', 'silt'])
    expect(samples.some(sample => {
      const offsets = sample.faces[i].waves.map(wave => Math.abs(wave.traceOffset))
      return Math.min(...offsets) < .1 && Math.max(...offsets) > .9
    })).toBe(true)
    for (const [j, wave] of face.waves.entries()) {
      const phases = samples.map(sample => sample.faces[i].waves[j])
      const shifts = phases.map(phase => phase.x)
      expect(Math.max(...shifts) - Math.min(...shifts)).toBeGreaterThan(1)
      const offsets = phases.map(phase => Math.abs(phase.traceOffset))
      expect(Math.min(...offsets)).toBeLessThan(.1)
      expect(Math.max(...offsets)).toBeGreaterThan(.9)
      if (i === 0) {
        const otherFace = samples.map(sample => sample.faces[1].waves.find(other => other.bed === wave.bed))
        expect(otherFace).toEqual(phases)
      }
    }
  }
})

test('矿样细纹随全站暂停、离屏和系统减少动态而停止', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 550 })
  await page.goto('/')
  const plate = page.getByRole('figure', { name: '矿纹剖面图版' })
  const motionState = () => plate.evaluate(figure => {
    const elements = [...figure.querySelectorAll('path.sample-vein-line, .ore-wave-motion, .ore-wave-trace')]
    const running = elements.filter(node => node.getAnimations().some(animation => animation.playState === 'running'))
    if (!elements.length) throw new Error('矿样细纹缺失')
    if (!running.length) return 'still'
    return running.length === elements.length ? 'moving' : 'mixed'
  })
  await expect.poll(motionState).toBe('moving')
  await page.getByRole('button', { name: '暂停全站动效' }).click()
  await expect.poll(motionState).toBe('still')
  await page.getByRole('button', { name: '播放全站动效' }).click()
  await expect.poll(motionState).toBe('moving')

  await page.locator('footer').scrollIntoViewIfNeeded()
  await expect(plate).not.toBeInViewport()
  await expect.poll(motionState).toBe('still')
  await plate.scrollIntoViewIfNeeded()
  await expect.poll(motionState).toBe('moving')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(motionState).toBe('still')
  await expect(plate.locator('.mineral-print')).toBeVisible()
  await expect(plate.locator('path.sample-vein-line').first()).toHaveCSS('stroke-dasharray', 'none')
  const traces = plate.locator('.ore-wave-trace')
  await expect(traces).toHaveCount(10)
  expect(await traces.evaluateAll(nodes => nodes.every(node => {
    const style = getComputedStyle(node)
    return Number(style.opacity) > 0 && (style.strokeDasharray === 'none' || parseFloat(style.strokeDashoffset) === 0)
  }))).toBe(true)
})
