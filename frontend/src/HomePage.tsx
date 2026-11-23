import type { FormEvent } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesColumnIncreasing, FileText, Search, Waypoints } from 'lucide-react'
import { m, useReducedMotion } from 'motion/react'
import { Link, useNavigate } from 'react-router-dom'
import { type Analytics, type DocumentList, displayDate, useApi, withQuery } from './api'
import { DocumentMeta, LoadingBlock, StateBlock } from './components'

const featuredCategory = '跨境资金'
const featuredUrl = withQuery('/documents', new URLSearchParams({ category: featuredCategory }))

export function HomePage() {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const stats = useApi<Analytics>('/analytics')
  const latest = useApi<DocumentList>('/documents')

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = String(new FormData(event.currentTarget).get('q') ?? '').trim()
    navigate(withQuery('/documents', new URLSearchParams(query ? { q: query } : undefined)))
  }

  return (
    <div className="container home">
      <section className="hero" aria-labelledby="home-title">
        <m.div
          className="hero-copy"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <div className="hero-label"><span aria-hidden /> 三亚 · 紫金矿业</div>
          <h1 id="home-title">跨境合规<span>文献库</span></h1>
          <p>从海南自贸港到海外矿业项目，检索公开政策、企业披露与行业文献，沿着每一条记录找到原始出处。</p>
          <form className="hero-search" onSubmit={search}>
            <Search size={20} aria-hidden />
            <input aria-label="搜索合规文献" name="q" type="search" maxLength={120} placeholder="试试「跨境资金」或「矿业」" />
            <button type="submit" className="button button--primary">搜索 <ArrowRight size={17} aria-hidden /></button>
          </form>
          <ul className="hero-quick" aria-label="快捷入口">
            <li><Link to="/documents">浏览全部文献 <ArrowUpRight size={14} aria-hidden /></Link></li>
            <li><Link to="/analytics">查看数据分析 <ArrowUpRight size={14} aria-hidden /></Link></li>
          </ul>
        </m.div>

        <Link className="featured" to={featuredUrl}>
          <div className="contours" aria-hidden><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <div className="featured-top">
            <span><Waypoints size={18} aria-hidden /> 文献专题</span>
            <ArrowDownRight size={24} strokeWidth={1.5} aria-hidden />
          </div>
          <div className="featured-body">
            <h2>跨境资金</h2>
            <p>查看与跨境资金运营、外汇管理和企业出海相关的公开文献。</p>
            <span className="featured-action">打开专题 <ArrowRight size={17} aria-hidden /></span>
          </div>
        </Link>
      </section>

      <section className="home-stats" aria-label="文献库概况">
        {stats.status === 'ready' ? (
          <>
            <div><FileText size={19} aria-hidden /><span>已发布文献</span><strong>{stats.data.total.toLocaleString('zh-CN')}</strong></div>
            <div><ChartNoAxesColumnIncreasing size={19} aria-hidden /><span>覆盖地区</span><strong>{stats.data.regions.length.toLocaleString('zh-CN')}</strong></div>
            <div><CalendarDays size={19} aria-hidden /><span>最近采集</span><strong>{displayDate(stats.data.latestCollectedAt)}</strong></div>
          </>
        ) : (
          <div className="home-stats-status" role="status">
            {stats.status === 'loading' ? '正在统计文献库…' : <>暂时无法读取文献库统计。 <button className="inline-button" type="button" onClick={stats.retry}>重试</button></>}
          </div>
        )}
      </section>

      <section className="home-recent" aria-labelledby="recent">
        <header className="section-heading">
          <div><h2 id="recent">文献速览</h2><p>从公开政策、企业披露和行业材料进入原始证据。</p></div>
          <Link className="text-link" to="/documents">进入文献库 <ArrowRight size={16} aria-hidden /></Link>
        </header>
        {latest.status === 'loading' && <LoadingBlock />}
        {latest.status === 'error' && <StateBlock title="暂时无法加载文献" detail={latest.message} retry={latest.retry} />}
        {latest.status === 'ready' && (latest.data.items.length ? (
          <ul className="recent-grid">
            {latest.data.items.slice(0, 3).map((doc) => (
              <li key={doc.id}>
                <Link className="recent-item" to={`/documents/${encodeURIComponent(doc.id)}`}>
                  <DocumentMeta doc={doc} />
                  <h3>{doc.title}</h3>
                  <p>{doc.sourceName || '来源待补充'}</p>
                  <ArrowUpRight className="recent-arrow" size={20} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : <StateBlock title="还没有已发布文献" detail="文献发布后将在这里显示。" />)}
      </section>
    </div>
  )
}
