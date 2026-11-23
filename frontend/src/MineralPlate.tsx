import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { toggleStageMotion, useStageMotion } from './stageMotion'
import { MineralSurface } from './MineralSurface'
import MineralFaces from './MineralFaces'

function Crystal({ x, y, scale, flip = false }: { x: number; y: number; scale: number; flip?: boolean }) {
  return (
    <g transform={'translate(' + x + ' ' + y + ') scale(' + (flip ? -scale : scale) + ' ' + scale + ')'}
      stroke="#40594e" strokeWidth="1.5" strokeLinejoin="round">
      <path d="m-14-2-12-52 6-22 16 11 17 58L0 4Z" fill="#a7bfac" />
      <path d="m-20-76 4 22L0 4l13-11-17-58Z" fill="#6f9785" />
      <path d="m-26-54 6-22 16 11-12 11Z" fill="#eff1d6" />
      <path d="m-20-76 4 22L0 4" fill="none" />
      <path d="m-21-47 9 38m-6-31 6 23" stroke="#e3efce" strokeWidth="1.4" />
    </g>
  )
}

export default function MineralPlate() {
  const plate = useRef<HTMLElement>(null)
  const motion = useStageMotion()
  const paused = motion !== 'running'
  const [inView, setInView] = useState(true)
  useEffect(() => {
    if (!plate.current) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    observer.observe(plate.current)
    return () => observer.disconnect()
  }, [])

  return (
    <figure className="mineral-plate" ref={plate} data-running={inView && !paused} aria-label="矿纹剖面图版">
      <svg className="mineral-print" viewBox="0 0 704 364" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="spec-top"><rect width="395" height="195" /></clipPath>
          <pattern id="sample-hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(27)">
            <path d="M0 0v7" stroke="#354f43" strokeWidth="1.4" opacity=".47" />
          </pattern>
          <pattern id="sample-fleck" patternUnits="userSpaceOnUse" width="14" height="9">
            <circle cx="2" cy="4" r="1.1" fill="#525f51" /><path d="m9 7 2-1" stroke="#64745f" strokeWidth=".9" />
          </pattern>
          <pattern id="sample-sun" patternUnits="userSpaceOnUse" width="5" height="5">
            <path d="M0 5 5 0" stroke="#b88e62" strokeWidth=".8" />
          </pattern>
          <g id="ore-seam" fill="none" stroke="currentColor" strokeLinejoin="miter">
            <path d="M-2 32H13L29 16H41L52 32H66" strokeWidth="6" />
            <path d="M-2 42H17L32 27H38L49 42H66" strokeWidth="2" />
          </g>
        </defs>

        <g className="sample-survey" fill="none">
          <circle cx="495" cy="90" r="68" fill="url(#sample-sun)" opacity=".95" />
          <path d="M36 221 259 103l352 49m-510 82 355 51 205-110" stroke="#799384" strokeDasharray="3 6" />
          <path d="m57 131 6 1m-3-4v7m548 44 7 1m-3-4v7m-355 111 8 1m-4-4v7" stroke="#557363" strokeWidth="1.3" />
        </g>
        <path className="sample-cast" d="m59 281 208-107 394 69-197 98Z" fill="#66745f" opacity=".21" />
        <path d="m79 285 382 53 185-97" fill="none" stroke="#7f8e78" strokeWidth="1" opacity=".55" />

        <MineralFaces />
        <MineralSurface />
        <g>
          <path d="m324 117 45 10 24-9-31-8Z" fill="#8aa183" />
          <Crystal x={333} y={116} scale={.5} />
          <Crystal x={347} y={117} scale={.91} />
          <Crystal x={359} y={120} scale={.78} flip />
          <Crystal x={370} y={121} scale={.41} flip />
        </g>
        <g className="sample-callout" stroke="#446052" fill="none" strokeWidth="1.4">
          <circle cx="393" cy="233" r="3" fill="#fbefd0" />
          <path d="m396 234 113 66h64" />
        </g>
        <text x="580" y="305" className="sample-label">矿脉</text>
      </svg>
      <figcaption className="sample-caption">
        <span className="sample-key" aria-hidden="true" /><span>矿纹剖面</span>
        <button type="button" className="plate-control" onClick={toggleStageMotion}
          aria-label={paused ? '播放矿纹动画' : '暂停矿纹动画'} title={paused ? '播放矿纹动画（全站同步）' : '暂停矿纹动画（全站同步）'}>
          {paused ? <Play size={13} aria-hidden /> : <Pause size={13} aria-hidden />}
        </button>
      </figcaption>
    </figure>
  )
}
