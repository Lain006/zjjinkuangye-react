import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Pause, Play } from 'lucide-react'
import { stageMotionState, toggleStageMotion, useStageMotion } from './stageMotion'
import './stage.css'

export function StageMotionControl() {
  const motion = useStageMotion()
  const running = motion === 'running'
  const label = motion === 'reduced' ? '已减少动效' : running ? '暂停全站动效' : '播放全站动效'
  return (
    <button className="stage-motion-control" type="button" aria-label={label} title={label}
      disabled={motion === 'reduced'} onClick={toggleStageMotion}>
      {running ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
      <span>{label}</span>
    </button>
  )
}

export function StageSpotlight() {
  const overlay = useRef<SVGSVGElement>(null)
  const motion = useStageMotion()

  useEffect(() => {
    const svg = overlay.current
    if (!svg || motion !== 'running') return
    const beam = svg.querySelector<SVGPolygonElement>('polygon')!
    const light = svg.querySelector<SVGGElement>('.lamp-pool')!
    const root = document.documentElement
    let frame = 0
    let x = 0, y = 0, strength = 0
    let hasAim = false
    let keyboardTarget: Element | null = null
    let press: { id: number; x: number; y: number; dragged: boolean } | undefined

    function reset() {
      cancelAnimationFrame(frame)
      frame = 0
      strength = 0
      svg!.style.opacity = '0'
      root.style.removeProperty('--stage-shadow-x')
      root.style.removeProperty('--stage-shadow-y')
    }
    function illuminate(targetX: number, targetY: number) {
      const originX = -32, originY = -42
      // The light retains its last bearing after fading. Its first sweep enters from the rig above.
      const fromX = hasAim ? x : window.innerWidth * .54
      const fromY = hasAim ? y : -20
      hasAim = true
      const fromStrength = strength
      const radius = Math.min(95, Math.max(48, window.innerWidth * .075))
      const start = performance.now()
      cancelAnimationFrame(frame)
      root.style.setProperty('--stage-shadow-x', (2 - 5 * targetX / window.innerWidth).toFixed(1) + 'px')
      root.style.setProperty('--stage-shadow-y', (3 - 4 * targetY / window.innerHeight).toFixed(1) + 'px')

      function paint(now: number) {
        const elapsed = Math.max(0, now - start)
        if (elapsed >= 670) { reset(); return }
        const t = 1 - Math.pow(1 - Math.min(1, elapsed / 220), 3)
        x = fromX + (targetX - fromX) * t
        y = fromY + (targetY - fromY) * t
        strength = elapsed < 220 ? fromStrength + (1 - fromStrength) * Math.min(1, elapsed / 80)
          : Math.pow(1 - (elapsed - 220) / 450, 1.5)
        const angle = Math.atan2(y - originY, x - originX)
        const dx = Math.sin(angle) * radius * .86
        const dy = -Math.cos(angle) * radius * .45
        beam.setAttribute('points', [originX + ',' + originY, (x + dx) + ',' + (y + dy), (x - dx) + ',' + (y - dy)].join(' '))
        light.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(' + radius / 84 + ')')
        svg!.style.opacity = String(strength)
        frame = requestAnimationFrame(paint)
      }
      frame = requestAnimationFrame(paint)
    }
    function down(e: PointerEvent) {
      keyboardTarget = null
      if (e.isPrimary && e.button === 0) press = { id: e.pointerId, x: e.clientX, y: e.clientY, dragged: false }
    }
    function move(e: PointerEvent) {
      if (press?.id === e.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) press.dragged = true
    }
    function cancel(e: PointerEvent) { if (press?.id === e.pointerId) press.dragged = true }
    function centerOn(target: Element) {
      const rect = target.getBoundingClientRect()
      illuminate(rect.x + rect.width / 2, rect.y + rect.height / 2)
    }
    function keyDown(e: KeyboardEvent) {
      if (e.repeat || (e.key !== 'Enter' && e.key !== ' ') || !(e.target instanceof Element)) return
      const target = e.target.closest('[role="button"],[role="tab"]')
      // Native controls emit a click. SVG and other custom buttons handle the key directly.
      if (!target || target.matches('button,a[href],input,select,textarea,summary,[aria-disabled="true"]')) return
      keyboardTarget = target
      centerOn(target)
    }
    function click(e: MouseEvent) {
      if (e.button !== 0 || stageMotionState() !== 'running') return
      if (!e.detail) {
        if (!(e.target instanceof Element)) return
        const target = e.target.closest('button,a[href],input,select,textarea,summary,[role="tab"],[role="button"]')
        if (target && target !== keyboardTarget) centerOn(target)
        keyboardTarget = null
      } else if (!press?.dragged && window.getSelection()?.isCollapsed !== false) {
        illuminate(e.clientX, e.clientY)
      }
      press = undefined
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointercancel', cancel, true)
    window.addEventListener('click', click, true)
    window.addEventListener('keydown', keyDown, true)
    window.addEventListener('blur', reset)
    return () => {
      reset()
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointercancel', cancel, true)
      window.removeEventListener('click', click, true)
      window.removeEventListener('keydown', keyDown, true)
      window.removeEventListener('blur', reset)
    }
  }, [motion])

  return createPortal(
    <svg ref={overlay} className="stage-spotlight" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="stage-beam" x1="0" x2="1" y1="0" y2="1" gradientUnits="objectBoundingBox">
          <stop stopColor="#fff5b4" stopOpacity=".07" />
          <stop offset="1" stopColor="#ffdc7a" stopOpacity=".24" />
        </linearGradient>
        <radialGradient id="stage-pool">
          <stop stopColor="#fff9bf" stopOpacity=".37" />
          <stop offset=".76" stopColor="#f6ce73" stopOpacity=".28" />
          <stop offset="1" stopColor="#fcda8d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="stage-ore-mask">
          <stop stopColor="white" /><stop offset=".55" stopColor="#aaa" /><stop offset="1" stopColor="black" />
        </radialGradient>
        <mask id="stage-ore-window" x="-90" y="-50" width="180" height="100" maskUnits="userSpaceOnUse">
          <ellipse rx="84" ry="39" fill="url(#stage-ore-mask)" />
        </mask>
      </defs>
      <polygon fill="url(#stage-beam)" />
      <g className="lamp-pool">
        <ellipse rx="86" ry="40" fill="url(#stage-pool)" />
        <g mask="url(#stage-ore-window)" fill="none" stroke="#996131" opacity=".44">
          <path d="m-89 20 29-9 22 3 20-11 16 1 12-8 19 2 16-9 32 5M-16 3l7 5 15-1 11 7 9-3 16 4M14-4l-3-8 6-7 1-6" />
          <path d="m-80 23 22-8 18 3 25-12 14 1 16-8 20 1 17-7" strokeWidth=".65" />
        </g>
      </g>
    </svg>, document.body,
  )
}
