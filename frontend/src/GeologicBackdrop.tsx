import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { useStageMotion } from './stageMotion'

// The long horizons anchor the page. Motion belongs to the small deposits
// between them, where sediment accumulates along the direction of bedding.
const formations = [
  { depth: 133, rock: '#e1eadd', ink: '#90a994', pigment: '#93b19b', start: 265, end: 1050, thickness: 13 },
  { depth: 250, rock: '#eee8d9', ink: '#b5a88d', pigment: '#be9366', start: 740, end: 1560, thickness: 11 },
  { depth: 385, rock: '#e8e2e5', ink: '#b3a2b1', pigment: '#aa95ac', start: -60, end: 770, thickness: 15 },
  { depth: 519, rock: '#e0e9df', ink: '#99ac9e', pigment: '#87a392', start: 390, end: 1290, thickness: 14 },
  { depth: 678, rock: '#eae4d7', ink: '#ab9e89', pigment: '#b18d68', start: 855, end: 1560, thickness: 10 },
  { depth: 812, rock: '#dfe4df', ink: '#9ba69c', pigment: '#9da68d', start: 20, end: 860, thickness: 13 },
]
const left = -130, right = 1570
const faultAt = (depth: number) => 1190 - depth * .33

function height(x: number, depth: number, downthrown: boolean) {
  const age = depth / 820
  const distance = (x - 730 + 85 * age) / 355
  const uplift = (14 + 32 * age) * Math.exp(-distance * distance)
  const slip = downthrown ? Math.max(0, Math.min(12, (depth - 360) * .04)) : 0
  return depth - (x - 650) * .047 - uplift + 7 * Math.sin(x / 245 + age) + slip
}

// Hermite segments retain the shallow dip when the path is sampled in reverse,
// including the return edge of a tapering lens.
function curve(from: number, to: number, count: number, elevation: (x: number) => number) {
  const step = (to - from) / count
  const xy = (x: number, y: number) => Math.round(x * 10) / 10 + ' ' + Math.round(y * 10) / 10
  const slope = (x: number) => (elevation(x + 1) - elevation(x - 1)) / 2
  let path = xy(from, elevation(from))
  for (let i = 0; i < count; i++) {
    const a = from + i * step, b = a + step, handle = step / 3
    path += 'C' + xy(a + handle, elevation(a) + handle * slope(a)) + ' '
      + xy(b - handle, elevation(b) - handle * slope(b)) + ' ' + xy(b, elevation(b))
  }
  return path
}

const beds = formations.map((bed, i) => {
  const { depth, start, end, thickness } = bed
  const fault = faultAt(depth)
  const horizon = 'M' + curve(left, fault, 8, x => height(x, depth, false))
    + 'L' + curve(fault + 4, right, 4, x => height(x, depth, true))
  // A smooth base avoids a hard seam inside the deposits that cover a buried fault.
  const position = (x: number) => (x - start) / (end - start)
  const top = (x: number) => height(x, depth, false) + 28 + 7 * Math.sin(position(x) * Math.PI)
  const thicknessAt = (x: number) => thickness * Math.sin(Math.PI * position(x)) ** 2 * (.65 + .5 * position(x))
  const upper = 'M' + curve(start, end, 10, top)
  const lens = upper + 'L' + curve(end, start, 10, x => top(x) + thicknessAt(x)) + 'Z'
  const seam = 'M' + curve(start, end, 10, x => top(x) + thicknessAt(x) * .62)
  return { ...bed, horizon, lens, seam, id: 'stratum-' + depth,
    style: { '--flow-duration': (48 + i * 3) + 's', '--deposit-duration': (19 + i * 1.8) + 's',
      '--flow-start': (-i * 7 - 3) + 's', '--deposit-start': (-i * 4.4 - 5) + 's' } as CSSProperties }
})

export function StageBackdrop() {
  const motion = useStageMotion()
  const backdrop = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    document.documentElement.dataset.motion = motion === 'running' ? 'running' : 'paused'
  }, [motion])
  useLayoutEffect(() => {
    const section = backdrop.current
    if (!section) return
    const syncVisibility = () => section.toggleAttribute('data-sleeping', document.hidden)
    syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)
    return () => document.removeEventListener('visibilitychange', syncVisibility)
  }, [])

  return (
    <div className="strata-backdrop" ref={backdrop} aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="none" focusable="false">
        <defs>
          <pattern id="stage-grain" width="21" height="19" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="4" r=".75" fill="#737961" opacity=".19" />
            <path d="m13 13 1.5-.6" stroke="#77816e" strokeWidth=".8" opacity=".18" />
          </pattern>
        </defs>
        <rect width="1440" height="900" fill="#f3f1e6" />
        {beds.map((bed, i) => <g key={bed.id}>
          <path d={bed.horizon + 'V1050H' + left + 'Z'} fill={bed.rock} />
          <path id={bed.id} data-bed={bed.depth} d={bed.horizon} fill="none" stroke={bed.ink} strokeWidth="1.25" />
          <use href={'#' + bed.id} y={5 + i % 3 * 2} opacity=".50" />
          <path d={bed.horizon} transform="translate(0 15)" fill="none" stroke="#fffced" strokeWidth="2" opacity=".78" />
        </g>)}
        <rect width="1440" height="900" fill="url(#stage-grain)" />
      </svg>
      {/* Keep the large paper texture in its own paint layer while the small deposits move. */}
      <svg className="strata-ink" viewBox="0 0 1440 900" preserveAspectRatio="none" focusable="false">
        {beds.map(bed => <g key={bed.id} style={bed.style}>
          <path className="strata-current" d={bed.horizon} transform="translate(0 15)" pathLength="1"
            fill="none" stroke={bed.pigment} strokeWidth="2.6" strokeLinecap="round" />
          <g className="strata-deposit">
            <path d={bed.lens} fill={bed.pigment} opacity=".62" />
            <path d={bed.seam} fill="none" stroke={bed.ink} strokeWidth="1" />
          </g>
        </g>)}
      </svg>
    </div>
  )
}
