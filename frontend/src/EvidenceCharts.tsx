import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { ArrowUpRight, ChevronDown, Circle, Gem, Orbit, Play, Square } from 'lucide-react'
import { Link } from 'react-router-dom'
import { withQuery, type Tally } from './api'
import { useStageMotion } from './stageMotion'

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

interface Month extends Tally { year: number; month: number }

const months = Array.from({ length: 12 }, (_, index) => {
  const angle = index * Math.PI / 6
  return {
    month: index + 1,
    position: {
      left: `${50 + 42 * Math.sin(angle)}%`,
      top: `${50 - 42 * Math.cos(angle)}%`,
    } satisfies CSSProperties,
  }
})

function YearDial({ items, active, onSelect, animated, forward }: {
  items: Month[]; active: Month; onSelect: (label: string) => void; animated: boolean; forward: boolean
}) {
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const angle = (active.month - 1) * 30
  const sweep = useRef<HTMLDivElement>(null)
  const [initialAngle] = useState(angle)
  useEffect(() => {
    const pointer = sweep.current
    if (!pointer) return
    const current = Number.parseFloat(getComputedStyle(pointer).rotate) || 0
    const turns = (current - angle) / 360
    const target = animated ? angle + (forward ? Math.ceil(turns) : Math.round(turns)) * 360 : angle
    pointer.style.rotate = `${target}deg`
  }, [angle, animated, forward])

  return <div className="chronograph-plate">
    <div className="chronograph-dial" role="group" aria-label={`${active.year}年发布月份`}>
      <div className="chronograph-face" aria-hidden />
      <div className="chronograph-ticks" aria-hidden />
      <div ref={sweep} className="chronograph-sweep" data-animated={animated} style={{ rotate: `${initialAngle}deg` }} aria-hidden />
      <div className="chronograph-center" aria-hidden>
        <span>{active.year}</span>
        <strong>{String(active.month).padStart(2, '0')}<small>月</small></strong>
      </div>
      {months.map(({ month, position }) => {
        const index = items.findIndex(item => item.month === month)
        const mark = items[index]
        const number = String(month).padStart(2, '0')
        if (!mark) return <span key={month} className="chronograph-empty-month" style={position} aria-hidden>{number}</span>
        return <button type="button" className="chronograph-month" key={month}
          ref={button => {
            if (button) buttons.current.set(mark.label, button)
            else buttons.current.delete(mark.label)
          }}
          aria-label={`选择月份 ${mark.label}`} aria-pressed={active.label === mark.label}
          title={`${mark.label} · ${mark.count} 条`} style={position}
          onClick={() => onSelect(mark.label)} onKeyDown={event => {
            const next = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index + items.length - 1) % items.length
              : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index + 1) % items.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null
            if (next === null) return
            event.preventDefault()
            onSelect(items[next].label)
            buttons.current.get(items[next].label)?.focus()
          }}>
          <span className="chronograph-crystal">{number}</span>
          {active.label === mark.label && animated && <span className="chronograph-echo" aria-hidden />}
        </button>
      })}
    </div>
  </div>
}

export function MonthTimeline({ items, total, params, visible }: { items: Tally[]; total: number; params: URLSearchParams; visible: boolean }) {
  const id = useId()
  const stageMotion = useStageMotion()
  const animated = visible && stageMotion === 'running'
  const dated = items.filter(item => /^\d{4}-(0[1-9]|1[0-2])$/.test(item.label)).map(item => {
    const [year, month] = item.label.split('-').map(Number)
    return { ...item, year, month }
  }).sort((a, b) => a.year - b.year || a.month - b.month)
  const [selection, setSelection] = useState({ label: '', forward: false })
  const [playing, setPlaying] = useState(false)
  const active = dated.find(item => item.label === selection.label) ?? dated[dated.length - 1]
  const years = [...new Set(dated.map(item => item.year))].reverse()
  const yearMonths = dated.filter(item => item.year === active?.year)
  const index = yearMonths.findIndex(item => item.label === active?.label)
  const nextMonth = yearMonths[index + 1]?.label
  const replaying = Boolean(playing && animated && nextMonth)
  const missing = total - dated.reduce((sum, item) => sum + item.count, 0)
  useEffect(() => {
    if (!replaying || !nextMonth) return
    const timer = window.setTimeout(() => setSelection({ label: nextMonth, forward: true }), 1250)
    return () => window.clearTimeout(timer)
  }, [nextMonth, replaying])
  useEffect(() => {
    if (!animated || !nextMonth) setPlaying(false)
  }, [animated, nextMonth])
  useEffect(() => {
    const stopOnHide = () => {
      if (document.hidden) setPlaying(false)
    }
    document.addEventListener('visibilitychange', stopOnHide)
    return () => document.removeEventListener('visibilitychange', stopOnHide)
  }, [])

  function selectMonth(label: string) {
    setPlaying(false)
    setSelection({ label, forward: false })
  }

  return <section className="panel analytics-panel analytics-trend" aria-labelledby={id}>
    <div className="analytics-panel-top">
      <div><h2 id={id}>文献发布时间轨 <Orbit className="paper-heading-icon" size={34} aria-hidden /></h2>
        <p>沿着年轮找找，哪几个月留下了文献？</p></div>
    </div>
    {active ? <>
      <div className="chronograph-controls">
        <div className="paper-year">
          <select className="chart-year" aria-label="选择发布年份" value={active.year} onChange={event => {
            const year = Number(event.target.value)
            const lastMonth = dated.filter(item => item.year === year).at(-1)
            if (lastMonth) selectMonth(lastMonth.label)
          }}>{years.map(year => <option key={year} value={year}>{year} 年</option>)}</select>
          <ChevronDown size={16} aria-hidden />
        </div>
        {animated && yearMonths.length > 1 && <button type="button" className="chronograph-replay" onClick={() => {
          if (replaying) setPlaying(false)
          else {
            setSelection({ label: yearMonths[0].label, forward: false })
            setPlaying(true)
          }
        }}>{replaying ? <Square size={15} aria-hidden /> : <Play size={15} aria-hidden />}
          {replaying ? '停止回放' : '回放这一年'}
        </button>}
      </div>
      <div className="exhibit-layout">
        <YearDial items={yearMonths} active={active} onSelect={selectMonth} animated={animated} forward={selection.forward} />
        <div className="exhibit-index chronograph-details">
          <div className="month-readout paper-note">
            <span className="paper-tape" aria-hidden />
            <div className="chronograph-reading" aria-live="polite">
              <strong>{active.year} 年 {active.month} 月</strong>
              <span><b>{active.count.toLocaleString('zh-CN')}</b> 条文献</span>
            </div>
            <Link data-carry-link="" className="text-link" to={monthDocuments(params, active.label)}
              aria-label={`查看当月文献（${active.label}）`}>查看当月文献 <ArrowUpRight aria-hidden size={16} /></Link>
          </div>
          <ul className="chronograph-key" aria-label="年轮图例">
            <li><Gem size={19} aria-hidden /><span>挖到文献</span></li>
            <li><Circle size={17} aria-hidden /><span>留白月份</span></li>
          </ul>
        </div>
      </div>
    </> : <p className="muted chart-empty">暂无按月分布的数据。</p>}
    {missing > 0 && <p className="missing-dates">{missing} 条文献缺少发布日期。</p>}
  </section>
}
