import { ArrowRight, CalendarDays, ChartNoAxesColumnIncreasing, FileText, Globe2 } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { displayDate, useApi, withQuery, type Analytics } from './api'
import { LoadingBlock, PageHeading, StateBlock } from './components'
import { filterKeys, filterLabels, filterValue, readFilters } from './filters'
import CategoryDistribution from './CategoryDistribution'
import { MonthTimeline, RegionSpecimens } from './EvidenceCharts'

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
          <CategoryDistribution key={params.toString()} items={data.categories} params={params} total={data.total} />
          <MonthTimeline items={data.months} total={data.total} params={params} />
          <RegionSpecimens items={data.regions} params={params} />
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
        <Link data-carry-link="" className="text-link" to={withQuery('/documents', params)}>打开相关文献 <ArrowRight size={16} aria-hidden /></Link>
      </div>
      {analytics.status === 'loading' && <LoadingBlock label="正在汇总文献" />}
      {analytics.status === 'error' && <StateBlock title="暂时无法读取数据分析" detail={analytics.message} retry={analytics.code === 400 ? undefined : analytics.retry}>
        {analytics.code === 400 && <Link className="button button--outline" to="/analytics">清除筛选</Link>}
      </StateBlock>}
      {analytics.status === 'ready' && <AnalyticsContent data={analytics.data} params={params} />}
    </div>
  )
}
