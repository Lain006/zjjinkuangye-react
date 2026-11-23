import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { withQuery, type Tally } from './api'
import { changeFilter } from './filters'
import './analytics.css'

type View = 'chart' | 'list'
const views = ['chart', 'list'] as const
const viewLabels = { chart: '占比图', list: '数量列表' }
const percent = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 })

function ViewSwitch({ view, onChange, id }: { view: View; onChange: (next: View) => void; id: string }) {
  const start = useRef<{ id: number; x: number; step: number; value: number } | null>(null)
  const moved = useRef(false)
  const [position, setPosition] = useState<number | null>(null)
  const [instant, setInstant] = useState(false)
  const current = view === 'chart' ? 0 : 1

  function begin(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0 || start.current) return
    const step = event.currentTarget.getBoundingClientRect().width
    start.current = { id: event.pointerId, x: event.clientX, step, value: current }
    moved.current = false
    setInstant(false)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function travel(event: PointerEvent<HTMLButtonElement>) {
    const drag = start.current
    if (!drag || drag.id !== event.pointerId) return null
    const delta = event.clientX - drag.x
    if (!moved.current && Math.abs(delta) < 4) return null
    moved.current = true
    return Math.max(0, Math.min(1, drag.value + delta / drag.step))
  }

  function finish(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerId !== start.current?.id) return
    const end = travel(event)
    if (end !== null) {
      const next = views[end < 0.5 ? 0 : 1]
      onChange(next)
      document.getElementById(id + next)?.focus({ preventScroll: true })
    }
    start.current = null
    setPosition(null)
  }

  function keyboard(event: KeyboardEvent<HTMLButtonElement>) {
    let next: View
    if (event.key === 'Home') next = 'chart'
    else if (event.key === 'End') next = 'list'
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') next = view === 'chart' ? 'list' : 'chart'
    else return
    event.preventDefault()
    setInstant(true)
    onChange(next)
    document.getElementById(id + next)?.focus()
  }

  return (
    <div className="theme-switch" role="tablist" aria-label="主题分布视图">
      <span aria-hidden className="theme-switch-thumb" data-instant={instant} data-dragging={position !== null}
        style={{ transform: `translateX(${100 * (position ?? current)}%)` }} />
      {views.map((mode) => (
        <button key={mode} type="button" id={id + mode} role="tab" aria-selected={view === mode}
          aria-controls={id + 'panel'} tabIndex={view === mode ? 0 : -1}
          onKeyDown={keyboard} onPointerDown={begin}
          onPointerMove={(event) => { const next = travel(event); if (next !== null) setPosition(next) }}
          onPointerUp={finish} onLostPointerCapture={(event) => {
            if (start.current?.id === event.pointerId) { start.current = null; setPosition(null) }
          }}
          onClick={(event) => { if (!moved.current || !event.detail) onChange(mode) }}>
          {viewLabels[mode]}
        </button>
      ))}
    </div>
  )
}

const oreColors: Record<string, string> = { 跨境资金: '#9edbb3', 企业动态: '#efab7c', 数据跨境: '#c8badc' }
const secondaryColors = ['#9bcad1', '#d6c98f', '#d4a7b7']

function oreColor(label: string) {
  if (oreColors[label]) return oreColors[label]
  let hash = 0
  for (const ch of label) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0
  return secondaryColors[hash % secondaryColors.length]
}

function VeinChart({ items, total, link }: { items: Tally[]; total: number; link: (label: string) => string }) {
  const [selected, setSelected] = useState(items[0].label)
  const [preview, setPreview] = useState<string | null>(null)
  const current = items.find(({ label }) => label === (preview ?? selected)) ?? items[0]
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
  function choose(label: string) {
    setSelected(label)
    setPreview(null)
  }

  return (
    <div className="theme-chart-layout">
      <div className="vein-plate">
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
          {branches.map(({ label, count, width, path, target, color }) => {
            const active = current.label === label
            return <g key={label} className="vein-branch" role="button" tabIndex={0} aria-label={`选择主题 ${label}，${count} 条`}
              aria-pressed={selected === label} data-active={active} onClick={() => choose(label)}
              onFocus={() => setPreview(label)} onBlur={() => setPreview(null)}
              onPointerEnter={e => { if (e.pointerType === 'mouse') setPreview(label) }}
              onPointerLeave={() => setPreview(null)}
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
              <g className="vein-end" transform={`translate(606,${target})`}>
                <path d="M-5 0 5-11H43L50 0 43 11H5Z" fill={color} stroke="#1d352f" strokeWidth="1.5" />
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
              <Link data-carry-link="" to={link(item.label)} data-active={current.label === item.label}
                onPointerEnter={e => { if (e.pointerType === 'mouse') setPreview(item.label) }} onPointerLeave={() => setPreview(null)}
                onFocus={() => setPreview(item.label)} onBlur={() => setPreview(null)}>
                <span aria-hidden className="vein-swatch" style={{ '--ore-color': oreColor(item.label) } as CSSProperties} />
                <span>{item.label}</span><span className="theme-value">{item.count} 条 · {percent.format(item.count / total)}</span>
              </Link>
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
  const [view, setView] = useState<View>('chart')
  const link = (label: string) => withQuery('/documents', changeFilter(params, 'category', label))
  return (
    <section className="panel analytics-panel category-panel" aria-labelledby={id + 'title'}>
      <div className="analytics-panel-top">
        <div><h2 id={id + 'title'}>主题分布</h2><p>矿脉的宽度对应各主题的文献占比。</p></div>
        {items.length > 0 && <ViewSwitch view={view} onChange={setView} id={id} />}
      </div>
      {!items.length ? <p className="muted chart-empty">暂无可汇总的主题。</p>
        : <div role="tabpanel" id={id + 'panel'} aria-labelledby={id + view}>
          {view === 'chart' ? <VeinChart items={items} total={total} link={link} /> :
            <table className="theme-table"><thead><tr><th scope="col">主题</th><th scope="col">文献数</th><th scope="col">占比</th></tr></thead>
              <tbody>{items.map(({ label, count }) => <tr key={label}><th scope="row"><Link data-carry-link="" className="text-link" to={link(label)}>{label}<ArrowUpRight size={14} aria-hidden /></Link></th>
                <td>{count}</td><td>{percent.format(count / total)}</td></tr>)}</tbody>
            </table>}
        </div>}
    </section>
  )
}
