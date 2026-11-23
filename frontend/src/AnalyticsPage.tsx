import { useEffect, useRef } from 'react'
import { ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesColumnIncreasing, FileText, Globe2 } from 'lucide-react'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { init, use as registerECharts, type EChartsCoreOption } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { displayDate, useApi, withQuery, type Analytics, type Tally } from './api'
import { LoadingBlock, PageHeading, StateBlock } from './components'
import { changeFilter, filterKeys, filterLabels, filterValue, readFilters } from './filters'

registerECharts([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

function monthDocuments(params: URLSearchParams, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return withQuery('/documents', params)
  const lastDate = new Date(`${month}-01T00:00:00Z`)
  lastDate.setUTCMonth(lastDate.getUTCMonth() + 1, 0)
  const start = `${month}-01`
  const end = `${month}-${lastDate.getUTCDate()}`
  const currentStart = params.get('dateFrom')
  const currentEnd = params.get('dateTo')
  const dateRange = new URLSearchParams(params)
  dateRange.set('dateFrom', currentStart && currentStart > start ? currentStart : start)
  dateRange.set('dateTo', currentEnd && currentEnd < end ? currentEnd : end)
  return withQuery('/documents', dateRange)
}

function CollectionChart({ items, params }: { items: Tally[]; params: URLSearchParams }) {
  const host = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!host.current || !items.length) return
    const element = host.current
    const chart = init(element)
    const option: EChartsCoreOption = {
      animation: false,
      grid: { left: 40, right: 12, top: 20, bottom: 35 },
      tooltip: { trigger: 'axis', renderMode: 'richText' },
      xAxis: {
        type: 'category',
        data: items.map((item) => item.label),
        axisLabel: { color: '#4e6269', hideOverlap: true },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#dde1d9' } },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: '#4e6269' },
        splitLine: { lineStyle: { color: '#e6e9e2' } },
      },
      series: [{
        type: 'bar',
        data: items.map((item) => item.count),
        barMaxWidth: 36,
        itemStyle: { color: '#9e4c2b', borderRadius: [4, 4, 0, 0] },
      }],
    }
    chart.setOption(option)
    chart.on('click', 'series', ({ name }) => {
      if (name) navigate(monthDocuments(params, name))
    })
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(element)
    return () => {
      observer.disconnect()
      chart.dispose()
    }
  }, [items, navigate, params])

  return items.length ? (
    <>
      <div className="collection-chart" ref={host} aria-hidden />
      <details className="chart-transcript">
        <summary>查看月份与文献数量</summary>
        <table><thead><tr><th scope="col">月份</th><th scope="col">文献数量</th></tr></thead>
          <tbody>{items.map((item) => (
            <tr key={item.label}>
              <td><Link className="text-link" to={monthDocuments(params, item.label)}>{item.label}</Link></td><td>{item.count}</td>
            </tr>
          ))}</tbody>
        </table>
      </details>
    </>
  ) : <p className="muted chart-empty">暂无按月分布的数据。</p>
}

function Breakdown({ title, items, params, field }: {
  title: string
  items: Tally[]
  params: URLSearchParams
  field: 'region' | 'category'
}) {
  const max = Math.max(1, ...items.map((item) => item.count))
  return (
    <section className="panel analytics-panel">
      <div className="analytics-panel-top"><h2>{title}</h2><span>点击查看文献</span></div>
      {items.length ? (
        <ul className="breakdown-list">
          {items.map(({ label, count }) => (
            <li key={label}>
              <Link to={withQuery('/documents', changeFilter(params, field, label))}>
                <span className="breakdown-label">{label}</span>
                <span className="breakdown-count">{count} 条</span>
                <span className="breakdown-bar" aria-hidden><span style={{ width: `${100 * count / max}%` }} /></span>
                <ArrowUpRight size={15} className="breakdown-arrow" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="muted chart-empty">暂无可汇总的文献。</p>}
    </section>
  )
}

function AnalyticsContent({ data, params }: { data: Analytics; params: URLSearchParams }) {
  return (
    <>
      <dl className="analytics-metrics">
        <div><dt><FileText size={18} aria-hidden /> 匹配文献</dt><dd>{data.total.toLocaleString('zh-CN')}<span>条</span></dd></div>
        <div><dt><Globe2 size={18} aria-hidden /> 覆盖地区</dt><dd>{data.regions.length.toLocaleString('zh-CN')}<span>个</span></dd></div>
        <div><dt><CalendarDays size={18} aria-hidden /> 最近采集</dt><dd>{displayDate(data.latestCollectedAt)}</dd></div>
      </dl>
      {data.total > 0 ? (
        <div className="analytics-layout">
          <section className="panel analytics-panel analytics-trend">
            <div className="analytics-panel-top"><h2>文献数量趋势</h2><span>按有记录的发布月份汇总，可点击查看文献</span></div>
            <CollectionChart items={data.months} params={params} />
          </section>
          <Breakdown title="地区分布" items={data.regions} params={params} field="region" />
          <Breakdown title="主题分布" items={data.categories} params={params} field="category" />
        </div>
      ) : (
        <StateBlock title="当前范围暂无数据" detail="可以清除筛选，查看文献库整体分布。">
          {params.size > 0 && <Link className="button button--outline" to="/analytics">清除筛选</Link>}
        </StateBlock>
      )}
    </>
  )
}

export default function AnalyticsPage() {
  const [query] = useSearchParams()
  const navigate = useNavigate()
  const params = readFilters(query)
  const analytics = useApi<Analytics>(withQuery('/analytics', params))

  return (
    <div className="container route-space analytics-page">
      <PageHeading label="数据分析" title="文献数据分析">按发布时间、地区与主题汇总已发布文献，图表与检索结果使用同一数据范围。</PageHeading>
      <div className="analytics-scope">
        <ChartNoAxesColumnIncreasing size={18} aria-hidden />
        <div className="analytics-scope-content">
          {params.size > 0 ? filterKeys.map((key) => {
            const value = params.get(key)
            return value ? <span className="tag" key={key}>{filterLabels[key]} · {filterValue(key, value)}</span> : null
          }) : <span>全部已发布文献</span>}
        </div>
        {params.size > 0 && <button className="inline-button" type="button" onClick={() => navigate('/analytics')}>清除筛选</button>}
        <Link className="text-link" to={withQuery('/documents', params)}>打开相关文献 <ArrowRight size={16} aria-hidden /></Link>
      </div>
      {analytics.status === 'loading' && <LoadingBlock label="正在汇总文献" />}
      {analytics.status === 'error' && <StateBlock title="暂时无法读取数据分析" detail={analytics.message} retry={analytics.code === 400 ? undefined : analytics.retry}>
        {analytics.code === 400 && <Link className="button button--outline" to="/analytics">清除筛选</Link>}
      </StateBlock>}
      {analytics.status === 'ready' && <AnalyticsContent data={analytics.data} params={params} />}
    </div>
  )
}
