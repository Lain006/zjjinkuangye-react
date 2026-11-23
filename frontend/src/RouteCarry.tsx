import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

interface Departure { x: number; y: number; href: string }

function motionPaused() {
  return document.documentElement.dataset.motion === 'paused' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function RouteCarry() {
  const { key } = useLocation()
  const departure = useRef<Departure | null>(null)
  const line = useRef<SVGPathElement>(null)

  useEffect(() => {
    function remember(event: MouseEvent) {
      departure.current = null
      if (motionPaused() || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[data-carry-link]') : null
      if (!link || link.origin !== location.origin || (link.target && link.target !== '_self')) return
      const box = link.getBoundingClientRect()
      departure.current = { x: box.left + box.width / 2, y: box.top + box.height / 2, href: link.href }
    }
    document.addEventListener('click', remember, true)
    return () => document.removeEventListener('click', remember, true)
  }, [])

  useLayoutEffect(() => {
    const start = departure.current
    departure.current = null
    const path = line.current
    if (!start || start.href !== location.href || !path || motionPaused()) return

    let frame = 0
    let animation: Animation | undefined
    const observer = new MutationObserver(schedule)
    function trace() {
      frame = 0
      const destination = document.querySelector<HTMLElement>('[data-carry-destination]')
      if (!destination || !path || !start || motionPaused()) return
      observer.disconnect()
      const rect = destination.getBoundingClientRect()
      if (rect.bottom < 4 || rect.top > innerHeight - 20) destination.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      const { top, left, width, height } = destination.getBoundingClientRect()
      const edge = left + 2
      const cap = top + 2
      const bend = edge + Math.min(32, width / 4)
      const rail = Math.max(8, cap - 18)
      path.setAttribute('d', `M ${start.x} ${start.y} Q ${start.x} ${rail} ${bend} ${rail} H ${edge} V ${cap + Math.min(30, height - 2)} V ${cap} H ${left + width - 2}`)
      animation = path.animate([
        { strokeDashoffset: '1', opacity: 0.85, offset: 0 },
        { strokeDashoffset: '0', opacity: 1, offset: 0.65 },
        { strokeDashoffset: '0', opacity: 0, offset: 1 },
      ], { duration: 740, easing: 'cubic-bezier(.23,.76,.38,1)' })
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(trace) }
    const stop = () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      animation?.cancel()
    }
    observer.observe(document.getElementById('main-content')!, { childList: true, subtree: true })
    schedule()
    const timeout = window.setTimeout(stop, 4000)
    window.addEventListener('pointerdown', stop, { once: true, capture: true })
    window.addEventListener('resize', stop)
    window.addEventListener('wheel', stop, { passive: true })
    return () => {
      stop()
      window.clearTimeout(timeout)
      window.removeEventListener('pointerdown', stop, true)
      window.removeEventListener('resize', stop)
      window.removeEventListener('wheel', stop)
    }
  }, [key])

  return <svg className="route-carry" aria-hidden="true" focusable="false">
    <path ref={line} pathLength="1" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1" opacity="0" />
  </svg>
}
