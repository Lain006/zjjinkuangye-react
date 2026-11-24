import { PageControls } from './Pagination'
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { withQuery, type Tally } from './api'
import { changeFilter } from './filters'

function monthDocuments(params: URLSearchParams, month: string) {
  const lastDate = new Date(`${month}-01T00:00:00Z`)
  lastDate.setUTCMonth(lastDate.getUTCMonth() + 1, 0)
  const start = `${month}-01`
  const end = `${month}-${lastDate.getUTCDate()}`
  const currentStart = params.get('dateFrom')
  const currentEnd = params.get('dateTo')
  const dates = new URLSearchParams(params)
  dates.set('dateFrom', currentStart && currentStart > start ? currentStart : start)
  dates.set('dateTo', currentEnd && currentEnd < end ? currentEnd : end)
  return withQuery('/documents', dates)
}

interface Month extends Tally { index: number; year: number; month: number }

function MonthRail({ items, selected, onSelect, year }: {
  items: Month[]; selected: string; onSelect: (label: string) => void; year: number
}) {
  const rail = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(400)
  useEffect(() => {
    if (!rail.current) return
    const observer = new ResizeObserver(entries => {
      const size = entries[0]?.contentRect.width
      if (size) setWidth(size)
    })
    observer.observe(rail.current)
    return () => observer.disconnect()
  }, [])

  const position = (index: number) => (index - year * 12) / 11
  // Stack close marks vertically without moving their true dates on the horizontal scale.
  const laneEnds: number[] = []
  const marks = items.map(item => {
    const ratio = position(item.index)
    const px = ratio * width
    const free = laneEnds.findIndex(last => px - last >= 42)
    const lane = free === -1 ? laneEnds.length : free
    laneEnds[lane] = px
    return { ...item, ratio, lane }
  })
  const active = marks.find(item => item.label === selected)
  const ticks = [1, 4, 7, 10, 12].map(m => ({ index: year * 12 + m - 1, label: `${m}月` }))

  return <div className="month-row">
    <div className="month-track" ref={rail} role="group" aria-label={`${year}年发布月份`}
      style={{ height: 57 + laneEnds.length * 34 }}>
      <div className="rail-baseline" aria-hidden />
      {ticks.map(tick => <span className="rail-tick" key={tick.index} aria-hidden style={{ left: `${position(tick.index) * 100}%` }}>{tick.label}</span>)}
      {active && <span className="rail-cursor" aria-hidden style={{ left: `${active.ratio * 100}%` }} />}
      {marks.map((mark, i) => (
        <button type="button" className="rail-pin" key={mark.label} aria-label={`选择月份 ${mark.label}`}
          aria-pressed={selected === mark.label} title={`${mark.label} · ${mark.count} 条`}
          style={{ left: `${mark.ratio * 100}%`, '--stem': `${10 + mark.lane * 34}px` } as CSSProperties}
          onClick={() => onSelect(mark.label)} onKeyDown={event => {
            const next = event.key === 'ArrowLeft' ? i - 1 : event.key === 'ArrowRight' ? i + 1
              : event.key === 'Home' ? 0 : event.key === 'End' ? marks.length - 1 : null
            if (next === null || !marks[next]) return
            event.preventDefault()
            onSelect(marks[next].label)
            rail.current?.querySelectorAll('button')[next]?.focus()
          }}>{String(mark.month).padStart(2, '0')}</button>
      ))}
    </div>
  </div>
}

export function MonthTimeline({ items, total, params }: { items: Tally[]; total: number; params: URLSearchParams }) {
  const id = useId()
  const dated = items.filter(item => /^\d{4}-(0[1-9]|1[0-2])$/.test(item.label)).map(item => {
    const [year, month] = item.label.split('-').map(Number)
    return { ...item, year, month, index: year * 12 + month - 1 }
  }).sort((a, b) => a.index - b.index)
  const [selection, setSelection] = useState('')
  const active = dated.find(item => item.label === selection) ?? dated[dated.length - 1]
  const years = [...new Set(dated.map(item => item.year))].reverse()
  const yearMonths = dated.filter(item => item.year === active?.year)
  const missing = total - dated.reduce((sum, item) => sum + item.count, 0)
  return <section className="panel analytics-panel analytics-trend" aria-labelledby={id}>
    <div className="analytics-panel-top">
      <div><h2 id={id}>文献发布时间轨</h2><p>选中月份，查看当月发布的文献。</p></div>
      {active && <select className="chart-year" aria-label="选择发布年份" value={active.year} onChange={event => {
        const year = Number(event.target.value)
        const month = dated.filter(item => item.year === year).at(-1)
        if (month) setSelection(month.label)
      }}>{years.map(year => <option key={year} value={year}>{year} 年</option>)}</select>}
    </div>
    {active ? <>
      <div className="time-board">
        <MonthRail year={active.year} items={yearMonths} selected={active.label} onSelect={setSelection} />
      </div>
      <div className="chart-readout month-readout"><span><strong>{active.label}</strong> · {active.count} 条</span>
        <Link data-carry-link="" className="text-link" to={monthDocuments(params, active.label)} aria-label={`查看当月文献（${active.label}）`}>查看当月文献 <ArrowUpRight aria-hidden size={15} /></Link></div>
    </> : <p className="muted chart-empty">暂无按月分布的数据。</p>}
    {missing > 0 && <p className="missing-dates">{missing} 条文献缺少发布日期。</p>}
  </section>
}

function grainUnit(max: number) {
  if (max <= 36) return 1
  const magnitude = 10 ** Math.floor(Math.log10(max / 36))
  return magnitude * ([1, 2, 5, 10].find(n => n * magnitude * 36 >= max) ?? 10)
}

export function RegionSpecimens({ items, params }: { items: Tally[]; params: URLSearchParams }) {
  const id = useId()
  const [selected, setSelected] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 6
  const activePage = Math.min(page, Math.max(1, Math.ceil(items.length / pageSize)))
  const visible = items.slice((activePage - 1) * pageSize, activePage * pageSize)
  const current = visible.find(item => item.label === selected) ?? visible[0]
  const unit = grainUnit(items.reduce((max, item) => Math.max(max, item.count), 0))
  return <section className="panel analytics-panel analytics-regions" aria-labelledby={id}>
    <div className="analytics-panel-top"><div><h2 id={id}>地区标本点阵</h2>
      <p>每枚完整矿粒代表 {unit} 条文献。{unit > 1 && '末枚按余量着色。'}</p></div></div>
    {current ? <>
      <ul className="specimens" aria-label="按地区汇总的文献">
        {visible.map(({ label, count }) => <li key={label}>
          <button type="button" className="specimen" onClick={() => setSelected(label)} aria-label={`选择地区 ${label} ${count} 条`} aria-pressed={current.label === label}>
            <span className="specimen-heading"><strong>{label}</strong><span>{count} 条</span></span>
            <span className="ore-dots" aria-hidden>{Array.from({ length: Math.ceil(count / unit) }, (_, i) => {
              const fraction = Math.min(1, (count - i * unit) / unit)
              return <span key={i} className="ore-dot" style={{ '--fill': `${fraction * 100}%`, '--order': Math.min(i, 16) } as CSSProperties} />
            })}</span>
          </button>
        </li>)}
      </ul>
      <PageControls data={{ page: activePage, pageSize, total: items.length }} label="地区分页" onPage={setPage} />
      <div className="chart-readout region-readout"><span><strong>{current.label}</strong> · {current.count} 条</span>
        <Link data-carry-link="" className="text-link" to={withQuery('/documents', changeFilter(params, 'region', current.label))}
          aria-label={`查看地区文献（${current.label}）`}>查看地区文献 <ArrowUpRight aria-hidden size={15} /></Link></div>
    </> : <p className="muted chart-empty">暂无可汇总的文献。</p>}
  </section>
}
