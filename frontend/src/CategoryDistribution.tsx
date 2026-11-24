import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { withQuery, type Tally } from './api'
import { changeFilter } from './filters'
import { useStageMotion } from './stageMotion'
import './analytics.css'

const percent = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 })

const oreColors: Record<string, string> = {
  '跨境资金与金融合规': '#9edbb3',
  '贸易与海关合规': '#d6c98f',
  '矿产政策与供应链尽调': '#9bcad1',
  '环境、气候与矿山安全': '#d4a7b7',
  '数据跨境与隐私': '#c8badc',
  '企业运营与治理': '#efab7c',
  '其他': '#bdc8ba',
}

function oreColor(label: string) {
  return oreColors[label] ?? oreColors['其他']
}

function useIdleVeinFlow(count: number, hovered: boolean) {
  const plate = useRef<HTMLDivElement>(null)
  const last = useRef(-1)
  const [flow, setFlow] = useState<{ index: number; cycle: number } | null>(null)
  const motion = useStageMotion()

  useEffect(() => {
    if (motion !== 'running' || hovered || !plate.current) return
    let visible = false
    let timer: number | undefined
    function schedule(initial: boolean) {
      window.clearTimeout(timer)
      if (!visible || document.hidden) {
        setFlow(null)
        return
      }
      timer = window.setTimeout(() => {
        // Skip the last branch so the next trace travels a different seam.
        const previous = last.current
        const pool = count > 1 && previous >= 0 ? count - 1 : count
        const pick = Math.floor(Math.random() * pool)
        const index = pool < count && pick >= previous ? pick + 1 : pick
        last.current = index
        setFlow(flow => ({ index, cycle: (flow?.cycle ?? 0) + 1 }))
        schedule(false)
      }, initial ? 650 + Math.random() * 400 : 2900 + Math.random() * 1100)
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      schedule(true)
    })
    const onVisibility = () => schedule(true)
    observer.observe(plate.current)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [count, hovered, motion])
  return { plate, flow: hovered || motion !== 'running' ? null : flow, motion, stopFlow: () => setFlow(null) }
}

function VeinChart({ items, total, link }: { items: Tally[]; total: number; link: (label: string) => string }) {
  const [selected, setSelected] = useState(items[0].label)
  const [hovered, setHovered] = useState<string | null>(null)
  const { plate, flow, motion, stopFlow } = useIdleVeinFlow(items.length, hovered !== null)
  const [pulse, setPulse] = useState(0)
  const current = items.find(({ label }) => label === selected) ?? items[0]
  const grainId = useId()
  // At either end of the split, each band occupies its exact share of the input bundle.
  const bundle = 76
  const gap = 35
  const branchHeight = bundle + (items.length - 1) * gap
  const height = Math.max(220, branchHeight + 66)
  let running = 0
  const branches = items.map((item, index) => {
    const width = bundle * item.count / total
    const source = height * .5 - bundle / 2 + running + width / 2
    const target = (height - branchHeight) / 2 + running + index * gap + width / 2
    running += width
    const path = `M-12 ${source + 9} L102 ${source + 9} L123 ${source - 5} L176 ${source - 5} Q203 ${source - 5} 223 ${source}
      C289 ${source + 16} 330 ${target + 7} 381 ${target + 7} L429 ${target + 7} L453 ${target - 4} L505 ${target - 4} Q528 ${target - 4} 549 ${target} L601 ${target}`
    return { ...item, width, path, target, color: oreColor(item.label) }
  })
  function preview(label: string, pointerType: string) {
    if (pointerType !== 'mouse' || motion !== 'running') return
    stopFlow()
    setHovered(label)
  }

  function choose(label: string) {
    setSelected(label)
    setPulse(value => value + 1)
  }

  return (
    <div className="theme-chart-layout">
      <div className="vein-plate" ref={plate}>
        <svg className="vein-figure" viewBox={`0 0 670 ${height}`} preserveAspectRatio="none" role="group" aria-label="按文献数量分岔的主题矿脉">
          <defs>
            <pattern id={grainId} width="15" height="15" patternUnits="userSpaceOnUse">
              <path d="M1 14l3-2m6-8 2-1" stroke="#fff9e6" opacity=".15" strokeWidth=".85" />
            </pattern>
          </defs>
          <g aria-hidden="true" pointerEvents="none">
            <rect width="670" height={height} fill="#2b423a" />
            {Array.from({ length: 11 }, (_, i) => {
              const y = height * i / 9 - 23
              return <path key={i} d={`M-18 ${y} q81 -49 165 -9 t148 6 t147 -6 t132 -18 t112 -16`}
                fill="none" stroke="#a6b7a4" strokeOpacity=".26" strokeWidth={i % 4 === 0 ? 2 : 1} />
            })}
            <rect width="670" height={height} fill={`url(#${grainId})`} />
          </g>
          {branches.map(({ label, count, width, path, target, color }, index) => {
            const active = current.label === label
            return <g key={label} className="vein-branch" role="button" tabIndex={0} aria-label={`选择主题 ${label}，${count} 条`}
              aria-pressed={selected === label} data-active={active} data-hovered={hovered === label} onClick={() => choose(label)}
              onPointerEnter={event => preview(label, event.pointerType)}
              onPointerLeave={() => setHovered(current => current === label ? null : current)}
              onKeyDown={e => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                // SVG groups have no native keyboard click. Use the same activation as pointer and stage lighting.
                if (!e.repeat) e.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
              }}>
              <path d={path} className="vein-band" stroke={color} strokeWidth={width} fill="none" strokeLinejoin="round" />
              <path className="vein-band" fill={color} d={`M600 ${target - width / 2} L615 ${target - 2} V${target + 2} L600 ${target + width / 2}Z`} />
              <path d={path} className="vein-thread" pathLength="1" fill="none" strokeWidth={Math.min(2.6, width * .25)} pointerEvents="none"/>
              <path d={path} fill="none" stroke="transparent" strokeWidth={Math.max(28, width)} />
              {active && pulse > 0 && <path key={pulse} d={path} className="vein-pulse" pathLength="1"
                strokeWidth={Math.min(4, width + 1)} fill="none" pointerEvents="none" />}
              {(flow?.index === index || (motion === 'running' && hovered === label)) &&
                <path key={hovered === label ? 'hover' : flow?.cycle} d={path}
                  className={hovered === label ? 'vein-flow vein-flow--hover' : 'vein-flow vein-flow--idle'}
                  onAnimationEnd={hovered === label ? undefined : stopFlow}
                  pathLength="1" fill="none" strokeWidth={Math.max(1.1, Math.min(2.4, width * .35))} pointerEvents="none" />}
              <g className="vein-end" transform={`translate(606,${target})`}>
                <path d="M-5 0 5-11H43L50 0 43 11H5Z" fill={color} stroke="#1d352f" strokeWidth="1.5" />
                {active && pulse > 0 && <path key={pulse} d="M-5 0 5-11H43L50 0 43 11H5Z" className="vein-crystal" pointerEvents="none" />}
                <text x="22" y="5" textAnchor="middle" textLength={count >= 1000 ? 34 : undefined}
                  lengthAdjust="spacingAndGlyphs">{count.toLocaleString('zh-CN')}</text>
              </g>
            </g>
          })}
        </svg>
      </div>
      <div className="vein-index">
        <ul className="theme-legend" aria-label="各主题文献数量与占比">
          {items.map((item) => (
            <li key={item.label}>
              <button type="button" aria-pressed={current.label === item.label} data-hovered={hovered === item.label}
                onPointerEnter={event => preview(item.label, event.pointerType)}
                onPointerLeave={() => setHovered(current => current === item.label ? null : current)}
                onClick={() => choose(item.label)}>
                <span aria-hidden className="vein-swatch" style={{ '--ore-color': oreColor(item.label) } as CSSProperties} />
                <span>{item.label}</span><span className="theme-value">{item.count} 条 · {percent.format(item.count / total)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="theme-readout chart-readout">
          <span>{current.label} · {current.count} 条 · {percent.format(current.count / total)}</span>
          <Link data-carry-link="" className="text-link" to={link(current.label)} aria-label={`查看这组文献（${current.label}）`}>查看这组文献 <ArrowUpRight size={16} aria-hidden /></Link>
        </div>
      </div>
    </div>
  )
}

export default function CategoryDistribution({ items, total, params }: { items: Tally[]; total: number; params: URLSearchParams }) {
  const id = useId()
  const link = (label: string) => withQuery('/documents', changeFilter(params, 'topic', label))
  return (
    <section className="panel analytics-panel category-panel" aria-labelledby={id}>
      <div className="analytics-panel-top">
        <div><h2 id={id}>主题分布</h2><p>矿脉的宽度对应各主题的文献占比。</p></div>
      </div>
      {!items.length ? <p className="muted chart-empty">暂无可汇总的主题。</p>
        : <VeinChart items={items} total={total} link={link} />}
    </section>
  )
}
