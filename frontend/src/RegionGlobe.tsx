import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Globe2, Hand, MapPin, Pause, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageControls } from './Pagination'
import { withQuery, type Tally } from './api'
import { changeFilter } from './filters'
import { angleDistance, drawGlobe, faceRegion, globeVector, turn, type GlobePin, type Hit, type Orientation } from './globeDrawing'
import { createGlobeRelief, type GlobeRelief } from './globeRelief'
import { useStageMotion } from './stageMotion'

// Approximate anchors for the catalogue's free-text regions. Broad scopes such as 全球 have no pin.
const regionCoordinates = new Map<string, [number, number]>([
  ['三亚·海南', [18.25, 109.51]],
  ['海南自贸港', [20.02, 110.35]],
  ['中国', [35, 104]],
  ['东南亚', [8, 110]],
  ['欧洲', [50, 15]],
  ['北美', [44, -102]],
])

const pageSize = 6

function GlobeCanvas({ pins, active, request, rotating, visiblePane, paused, onToggle, onSelect }: {
  pins: GlobePin[]; active: string; request: number; rotating: boolean; visiblePane: boolean; paused: boolean; onToggle?: () => void; onSelect: (label: string) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const heading = useId()
  const [unavailable, setUnavailable] = useState(false)
  const [hasRelief, setHasRelief] = useState(false)
  const reliefRef = useRef<GlobeRelief | undefined>(undefined)
  const startPosition = regionCoordinates.get(active) ?? [24, 100] as const
  const cameraRef = useRef({
    ...faceRegion(...startPosition), request, active, idleUntil: 0, target: undefined as Orientation | undefined,
  })

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !visiblePane) return
    const context = canvas.getContext('2d')
    if (!context) {
      setUnavailable(true)
      return
    }

    const camera = cameraRef.current
    let width = 0
    let height = 0
    let hits: Hit[] = []
    let frame = 0
    let lastFrame = 0
    let visible = false
    let disposed = false
    let drag: { id: number; x: number; y: number; distance: number; time: number } | undefined
    let velocity = { yaw: 0, pitch: 0 }
    if (camera.active !== active || camera.request !== request) {
      camera.active = active
      camera.request = request
      const coordinates = regionCoordinates.get(active)
      camera.target = undefined
      if (coordinates) {
        camera.target = faceRegion(...coordinates)
        camera.idleUntil = performance.now() + 6200
      }
    }
    if (camera.target && !rotating) {
      Object.assign(camera, camera.target)
      camera.target = undefined
    }

    const draw = (now = 0) => {
      if (!width || !height) return
      const pulse = rotating && visible ? (now % 2300) / 2300 : 0
      hits = drawGlobe(context, width, height, camera, pins, active, pulse, reliefRef.current)
    }
    const tick = (now: number) => {
      if (now - lastFrame >= 30) {
        const elapsed = lastFrame ? Math.min(now - lastFrame, 64) : 0
        lastFrame = now
        if (camera.target) {
          const yaw = angleDistance(camera.yaw, camera.target.yaw)
          const pitch = angleDistance(camera.pitch, camera.target.pitch)
          const ease = 1 - Math.exp(-elapsed / 150)
          if (Math.abs(yaw) + Math.abs(pitch) < .008) {
            Object.assign(camera, camera.target)
            camera.target = undefined
          } else {
            camera.yaw += yaw * ease
            camera.pitch += pitch * ease
          }
        } else if (!drag) {
          if (Math.abs(velocity.yaw) + Math.abs(velocity.pitch) > .00008) {
            const decay = Math.exp(-elapsed / 125)
            camera.yaw = (camera.yaw + velocity.yaw * 125 * (1 - decay)) % turn
            camera.pitch = (camera.pitch + velocity.pitch * 125 * (1 - decay)) % turn
            velocity.yaw *= decay
            velocity.pitch *= decay
          } else if (now >= camera.idleUntil) {
            camera.yaw = (camera.yaw - elapsed * .000145) % turn
          }
        }
        draw(now)
      }
      frame = requestAnimationFrame(tick)
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      lastFrame = 0
      if (visible && rotating && !document.hidden) frame = requestAnimationFrame(tick)
      else draw()
    }

    const size = () => {
      width = canvas.clientWidth
      height = canvas.clientHeight
      if (!width || !height) return
      const dpr = Math.min(devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
      draw(rotating ? performance.now() : 0)
    }
    const resize = new ResizeObserver(size)
    resize.observe(canvas)
    size()
    if (!reliefRef.current) void createGlobeRelief().then(relief => {
      if (!relief || disposed) return
      reliefRef.current = relief
      setHasRelief(true)
      draw()
    })
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      schedule()
    })
    intersection.observe(canvas)
    document.addEventListener('visibilitychange', schedule)

    const hitAt = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      let closest: Hit | undefined
      let distance = event.pointerType === 'touch' ? 22 : 16
      for (const hit of [...hits].reverse()) {
        const candidate = Math.hypot(hit.x - x, hit.y - y)
        if (candidate < distance) {
          closest = hit
          distance = candidate
        }
      }
      return closest
    }
    const start = (event: PointerEvent) => {
      if (drag || !event.isPrimary || event.button !== 0) return
      camera.target = undefined
      velocity = { yaw: 0, pitch: 0 }
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0, time: event.timeStamp }
      canvas.setPointerCapture(event.pointerId)
      canvas.dataset.dragging = 'true'
    }
    const move = (event: PointerEvent) => {
      if (!drag) {
        const hit = hitAt(event)
        canvas.title = hit?.label ?? ''
        canvas.dataset.overPin = String(Boolean(hit))
        return
      }
      if (drag.id !== event.pointerId) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      drag.distance += Math.hypot(dx, dy)
      if (drag.distance > 5) {
        const speed = Math.PI / Math.min(width, height) * 1.65
        const yaw = dx * speed * (Math.cos(camera.pitch) >= 0 ? 1 : -1)
        const pitch = dy * speed
        camera.yaw = (camera.yaw + yaw) % turn
        camera.pitch = (camera.pitch + pitch) % turn
        const elapsed = Math.max(12, event.timeStamp - drag.time)
        const limit = (value: number) => Math.min(.007, Math.max(-.007, value))
        velocity = { yaw: limit(yaw / elapsed), pitch: limit(pitch / elapsed) }
        draw()
      }
      drag.x = event.clientX
      drag.y = event.clientY
      drag.time = event.timeStamp
    }
    const finish = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return
      const hit = event.type === 'pointerup' && drag.distance <= 5 ? hitAt(event) : undefined
      if (event.type !== 'pointerup' || event.timeStamp - drag.time > 95) velocity = { yaw: 0, pitch: 0 }
      drag = undefined
      delete canvas.dataset.dragging
      camera.idleUntil = performance.now() + 3500
      if (hit) onSelect(hit.label)
    }
    const keyboard = (event: KeyboardEvent) => {
      const dx = Number(event.key === 'ArrowRight') - Number(event.key === 'ArrowLeft')
      const dy = Number(event.key === 'ArrowDown') - Number(event.key === 'ArrowUp')
      if (!dx && !dy) return
      event.preventDefault()
      camera.target = undefined
      velocity = { yaw: 0, pitch: 0 }
      camera.idleUntil = performance.now() + 3500
      camera.yaw = (camera.yaw + dx * .17 * (Math.cos(camera.pitch) >= 0 ? 1 : -1)) % turn
      camera.pitch = (camera.pitch + dy * .17) % turn
      draw()
    }
    canvas.addEventListener('pointerdown', start)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', finish)
    canvas.addEventListener('pointercancel', finish)
    canvas.addEventListener('lostpointercapture', finish)
    canvas.addEventListener('keydown', keyboard)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      resize.disconnect()
      intersection.disconnect()
      document.removeEventListener('visibilitychange', schedule)
      canvas.removeEventListener('pointerdown', start)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', finish)
      canvas.removeEventListener('pointercancel', finish)
      canvas.removeEventListener('lostpointercapture', finish)
      canvas.removeEventListener('keydown', keyboard)
      delete canvas.dataset.dragging
    }
  }, [active, onSelect, pins, request, rotating, visiblePane])

  return <div className="globe-frame">
    {!unavailable && onToggle && <div className="globe-controls">
      <button type="button" className="globe-motion" onClick={onToggle}>
        {paused ? <Play size={15} aria-hidden /> : <Pause size={15} aria-hidden />}
        {paused ? '恢复自转' : '暂停自转'}
      </button>
    </div>}
    <div className="globe-stage">
      <div className="globe-cradle" aria-hidden />
      {unavailable ? <p className="globe-fallback">当前浏览器无法绘制地球。请使用地区索引。</p> :
        <canvas ref={ref} tabIndex={0} aria-label="可交互的三维文献地球" aria-describedby={heading} />}
    </div>
    <div className="globe-caption">
      {!unavailable && <div className="globe-guide" id={heading}><Hand size={14} aria-hidden /> <span>拖动或按方向键旋转</span></div>}
      {hasRelief ? <a className="globe-source" href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/">NASA Blue Marble</a>
        : <a className="globe-source" href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth</a>}
    </div>
  </div>
}

export default function RegionGlobe({ items, params, visible }: { items: Tally[]; params: URLSearchParams; visible: boolean }) {
  const id = useId()
  const motion = useStageMotion()
  const [paused, setPaused] = useState(false)
  const [selection, setSelection] = useState({ label: '', request: 0 })
  const [page, setPage] = useState(1)
  const activePage = Math.min(page, Math.max(1, Math.ceil(items.length / pageSize)))
  const pageItems = items.slice((activePage - 1) * pageSize, activePage * pageSize)
  const current = items.find(item => item.label === selection.label) ?? pageItems[0]
  const pins = useMemo(() => items.flatMap(({ label }) => {
    const position = regionCoordinates.get(label)
    return position ? [{ label, vector: globeVector(...position) }] : []
  }), [items])
  const select = useCallback((label: string) => {
    const index = items.findIndex(item => item.label === label)
    if (index === -1) return
    setSelection(previous => ({ label, request: previous.request + 1 }))
    setPage(Math.floor(index / pageSize) + 1)
  }, [items])
  const rotating = motion === 'running' && !paused

  return <section className="panel analytics-panel analytics-regions" aria-labelledby={id}>
    <div className="analytics-panel-top">
      <div><h2 id={id}>文献地区地球 <Globe2 className="paper-heading-icon" size={34} aria-hidden /></h2>
        <p>转一转地球，或点一枚地名贴纸，看看那里收录了什么。</p></div>
    </div>
    {current ? <div className="exhibit-layout">
      <GlobeCanvas pins={pins} active={current.label} request={selection.request} rotating={rotating}
        visiblePane={visible} paused={paused} onSelect={select}
        onToggle={motion === 'running' ? () => setPaused(value => !value) : undefined} />
      <div className="exhibit-index globe-index paper-note">
        <span className="paper-tape" aria-hidden />
        <div className="globe-index-heading"><h3>文献落在哪儿？</h3><span className="paper-region-total">{items.length.toLocaleString('zh-CN')} 个地区</span></div>
        <ul className="globe-regions" aria-label="按地区汇总的文献">
          {pageItems.map(({ label, count }) => <li key={label}>
            <button type="button" onClick={() => select(label)} aria-label={`选择地区 ${label} ${count} 条`} aria-pressed={current.label === label}>
              {regionCoordinates.has(label) ? <MapPin className="paper-map-pin" size={19} aria-hidden />
                : <span className="globe-index-unmapped" aria-hidden />}
              <span className="globe-region-name"><strong>{label}</strong>
                {!regionCoordinates.has(label) && <small>无单点坐标</small>}
              </span>
              <span className="paper-region-count">{count.toLocaleString('zh-CN')} 条</span>
            </button>
          </li>)}
        </ul>
        <PageControls data={{ page: activePage, pageSize, total: items.length }} label="地区分页" onPage={next => {
          const first = items[(next - 1) * pageSize]
          if (first) select(first.label)
        }} />
        <div className="exhibit-link">
          <Link data-carry-link="" className="text-link" to={withQuery('/documents', changeFilter(params, 'region', current.label))}
            aria-label={`查看所选地区文献（${current.label}）`}>查看所选地区文献 <ArrowUpRight size={15} aria-hidden /></Link>
        </div>
      </div>
    </div> : <p className="muted chart-empty">暂无可汇总的文献。</p>}
  </section>
}
