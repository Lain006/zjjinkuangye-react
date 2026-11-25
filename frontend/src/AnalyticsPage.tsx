import { useId, useState, type ReactNode } from 'react'
import { ArrowRight, Layers3, MapPin, Orbit } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApi, withQuery, type Analytics } from './api'
import { LoadingBlock, StateBlock } from './components'
import { filterKeys, filterLabels, filterValue, readFilters } from './filters'
import CategoryDistribution from './CategoryDistribution'
import { MonthTimeline } from './EvidenceCharts'
import RegionGlobe from './RegionGlobe'
import './analytics.css'
import './paper-exhibits.css'

const exhibits = [
  { view: 'topics', label: '主题', icon: Layers3 },
  { view: 'time', label: '时间', icon: Orbit },
  { view: 'regions', label: '地区', icon: MapPin },
] as const

type View = typeof exhibits[number]['view']

function viewQuery(filters: URLSearchParams, view: View) {
  const query = new URLSearchParams(filters)
  if (view !== 'topics') query.set('view', view)
  return query
}

function ExhibitContent({ view, visible, data, params }: {
  view: View; visible: boolean; data: Analytics; params: URLSearchParams
}) {
  if (view === 'topics') return <CategoryDistribution items={data.topics} params={params} total={data.total} visible={visible} />
  if (view === 'time') return <MonthTimeline items={data.months} total={data.total} params={params} visible={visible} />
  return <RegionGlobe items={data.regions} params={params} visible={visible} />
}

function Exhibits({ data, params, view, onChange, status }: {
  data?: Analytics; params: URLSearchParams; view: View; onChange: (view: View) => void; status?: ReactNode
}) {
  const id = useId()
  const [visited, setVisited] = useState<ReadonlySet<View>>(() => new Set([view]))
  if (!visited.has(view)) setVisited(new Set([...visited, view]))

  return (
    <div className="exhibits">
      <div className="exhibit-tabs" role="tablist" aria-label="分析展品">
        {exhibits.map(({ view: tab, label, icon: Icon }, index) => (
          <button key={tab} type="button" role="tab" id={id + '-tab-' + tab}
            aria-selected={view === tab} aria-controls={id + '-panel-' + tab}
            tabIndex={view === tab ? 0 : -1} onClick={() => { if (view !== tab) onChange(tab) }}
            onKeyDown={event => {
              const advance = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? exhibits.length - 1
                : advance ? (index + advance + exhibits.length) % exhibits.length : null
              if (next === null) return
              event.preventDefault()
              document.getElementById(id + '-tab-' + exhibits[next].view)?.focus()
            }}><Icon size={17} aria-hidden /> {label}</button>
        ))}
      </div>
      {exhibits.map(({ view: tab }) => (
        <div key={tab} className="exhibit-panel" role="tabpanel" id={id + '-panel-' + tab}
          aria-labelledby={id + '-tab-' + tab} hidden={tab !== view} tabIndex={0}>
          {data && visited.has(tab) && <ExhibitContent view={tab} visible={tab === view} data={data} params={params} />}
          {!data && tab === view && status}
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [query, setQuery] = useSearchParams()
  const params = readFilters(query)
  const view = exhibits.find(exhibit => exhibit.view === query.get('view'))?.view ?? 'topics'
  const analytics = useApi<Analytics>(withQuery('/analytics', params))
  const data = analytics.status === 'ready' && analytics.data.total > 0 ? analytics.data : undefined

  const status = analytics.status === 'loading' ? <LoadingBlock label="正在汇总文献" />
    : analytics.status === 'error' ? <StateBlock title="暂时无法读取数据分析" detail={analytics.message} retry={analytics.code === 400 ? undefined : analytics.retry} />
      : <StateBlock title="当前范围暂无数据" detail={params.size ? '清除当前筛选后，可以查看文献库整体分布。' : '发布文献后，这里会显示对应的分析。'} />

  return (
    <div className="container route-space analytics-page" data-exhibit={view}>
      <header className="analysis-header">
        <h1>文献数据分析</h1>
        <div className="analytics-scope">
          <div className="analytics-scope-content">
            {params.size > 0 ? filterKeys.map(key => {
              const value = params.get(key)
              return value ? <span className="tag" key={key}>{filterLabels[key]} · {filterValue(key, value)}</span> : null
            }) : <span>全部已发布文献</span>}
            {params.size > 0 && <button className="inline-button" type="button" onClick={() => setQuery(viewQuery(new URLSearchParams(), view))}>清除筛选</button>}
          </div>
          <div className="analysis-scope-result">
            {analytics.status === 'ready' && <strong className="analytics-total" role="status">{analytics.data.total.toLocaleString('zh-CN')} 条文献</strong>}
            <Link data-carry-link="" className="text-link" to={withQuery('/documents', params)}>查看范围内文献 <ArrowRight size={16} aria-hidden /></Link>
          </div>
        </div>
      </header>
      <Exhibits key={params.toString()} data={data} params={params} view={view} status={status}
        onChange={next => setQuery(viewQuery(params, next))} />
    </div>
  )
}
