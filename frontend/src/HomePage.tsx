import type { FormEvent } from 'react'
import { ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesColumnIncreasing, FileText, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { type Analytics, type DocumentList, displayDate, useApi, withQuery } from './api'
import { LoadingBlock, StateBlock } from './components'
import MineralPlate from './MineralPlate'
import FeaturedTopics from './FeaturedTopics'
import './home.css'

export function HomePage() {
  const navigate = useNavigate()
  const stats = useApi<Analytics>('/analytics')
  const latest = useApi<DocumentList>('/documents')
  const recentDocuments = latest.status === 'ready' ? latest.data.items.slice(0, 3) : []

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = String(new FormData(event.currentTarget).get('q') ?? '').trim()
    navigate(withQuery('/documents', new URLSearchParams(query ? { q: query } : undefined)))
  }

  return (
    <div className="home public-index">
      <section className="index-stage" aria-labelledby="home-title">
        <div className="container index-intro">
          <div className="index-lead">
            <h1 id="home-title"><span>跨境合规</span><span>文献库</span></h1>
            <p>查阅海南自贸港与海外矿业项目的政策、企业披露和行业文献。</p>
            <form className="hero-search" onSubmit={search}>
              <Search size={20} aria-hidden />
              <input aria-label="搜索合规文献" name="q" type="search" maxLength={120} placeholder="试试「跨境资金」或「矿业」" />
              <button type="submit" className="button button--primary">搜索 <ArrowRight size={17} aria-hidden /></button>
            </form>
            <ul className="hero-quick" aria-label="快捷入口">
              <li><Link to="/documents">浏览全部文献 <ArrowUpRight size={14} aria-hidden /></Link></li>
              <li><Link to="/analytics">查看数据分析 <ArrowUpRight size={14} aria-hidden /></Link></li>
            </ul>
          </div>
          <MineralPlate />
        </div>
      </section>
      <div className="container home-archive">
        <div className="index-editions">
          <FeaturedTopics latest={latest.status === 'ready' ? latest.data : undefined} />

          <section className="home-recent" aria-labelledby="recent">
            <header className="section-heading">
              <h2 id="recent">最近收录</h2>
              <Link className="text-link" to="/documents">进入文献库 <ArrowRight size={16} aria-hidden /></Link>
            </header>
            {latest.status === 'loading' && <LoadingBlock />}
            {latest.status === 'error' && <StateBlock title="暂时无法加载文献" detail={latest.message} retry={latest.retry} />}
            {latest.status === 'ready' && (latest.data.items.length ? (
              <ul className="recent-grid">
                {recentDocuments.map((doc) => (
                  <li key={doc.id}>
                    <Link className="recent-item" to={`/documents/${encodeURIComponent(doc.id)}`}>
                      {doc.publishDate && <time dateTime={doc.publishDate}>{displayDate(doc.publishDate)}</time>}
                      <div className="recent-story">
                        <h3>{doc.title}</h3>
                        <p>{[doc.sourceName || '来源待补充', doc.region].filter(Boolean).join(' · ')}</p>
                      </div>
                      <ArrowUpRight className="recent-arrow" size={20} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <StateBlock title="还没有已发布文献" detail="文献发布后将在这里显示。" />)}
          </section>
        </div>
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
      </div>
    </div>
  )
}
