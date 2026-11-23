import { useEffect, useRef, useState, type FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, FileText, Filter, FolderOpen, Search, X } from 'lucide-react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { displayDate, publicSource, useApi, withQuery, type ComplianceDocument, type DocumentList } from './api'
import { LoadingBlock, StateBlock } from './components'
import { changeFilter, facetOptions, filterKeys, filterLabels, filterValue, readFilters, type Facets } from './filters'
import './library.css'

const facetList = [
  ['region', 'regions'],
  ['category', 'categories'],
  ['sourceType', 'sourceTypes'],
] as const

function DocumentFilters({ params, facets, onApply }: { params: URLSearchParams; facets?: Facets; onApply: (params: URLSearchParams) => void }) {
  const [validation, setValidation] = useState('')

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const from = String(fields.get('dateFrom') ?? '')
    const to = String(fields.get('dateTo') ?? '')
    if (from && to && from > to) {
      setValidation('起始日期应早于或等于结束日期。')
      return
    }

    const next = new URLSearchParams()
    const query = params.get('q')
    if (query) next.set('q', query)
    for (const key of filterKeys.slice(1)) {
      const value = String(fields.get(key) ?? '').trim()
      if (value) next.set(key, value)
    }
    setValidation('')
    onApply(next)
  }

  return (
    <form className="filters-form" onSubmit={apply}>
      {facetList.map(([key, field]) => {
        const selection = params.get(key) ?? ''
        return (
          <label className="field-label" data-applied={selection ? 'true' : undefined} key={key}>
            <span>{filterLabels[key]}</span>
            <select className="field-control" name={key} defaultValue={selection}>
              <option value="">全部</option>
              {facetOptions(facets?.[field], selection).map(({ label, count }) => (
                <option value={label} key={label}>{label}{count > 0 ? ` (${count})` : ''}</option>
              ))}
            </select>
          </label>
        )
      })}
      <fieldset className="date-fields">
        <legend>发布日期</legend>
        <label className="field-label"><span>起始</span><input name="dateFrom" type="date" className="field-control" defaultValue={params.get('dateFrom') ?? ''} /></label>
        <label className="field-label"><span>结束</span><input name="dateTo" type="date" className="field-control" defaultValue={params.get('dateTo') ?? ''} /></label>
      </fieldset>
      {validation && <p className="field-error" role="alert">{validation}</p>}
      <button className="button button--primary" type="submit">应用筛选 <ArrowRight size={16} aria-hidden /></button>
    </form>
  )
}

function FilterSheet({ params, facets, onApply }: { params: URLSearchParams; facets?: Facets; onApply: (params: URLSearchParams) => void }) {
  const [open, setOpen] = useState(false)
  const filterCount = Array.from(params.keys()).filter((key) => key !== 'q').length

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="button button--outline filter-trigger">
          <Filter size={17} aria-hidden /> 筛选{filterCount > 0 && <span className="filter-count">{filterCount}</span>}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog filter-sheet">
          <div className="dialog-heading">
            <Dialog.Title>筛选文献</Dialog.Title>
            <Dialog.Close asChild><button type="button" className="icon-button" aria-label="关闭筛选"><X size={20} aria-hidden /></button></Dialog.Close>
          </div>
          <Dialog.Description>可以按地区、主题、来源与发布日期缩小范围。</Dialog.Description>
          <DocumentFilters key={params.toString()} params={params} facets={facets} onApply={(next) => {
            onApply(next)
            setOpen(false)
          }} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ActiveFilters({ params }: { params: URLSearchParams }) {
  if (!params.size) return null

  return (
    <div className="active-filters" aria-label="当前筛选条件">
      {filterKeys.map((key) => {
        const value = params.get(key)
        return value ? (
          <Link className="filter-chip" key={key} to={withQuery('/documents', changeFilter(params, key, ''))} aria-label={`清除${filterLabels[key]} ${value}`}>
            <span>{filterLabels[key]} · {filterValue(key, value)}</span><X size={13} aria-hidden />
          </Link>
        ) : null
      })}
      <Link className="text-link clear-filters" to="/documents">清除全部</Link>
    </div>
  )
}

function pageCount(data: DocumentList) {
  return Math.max(1, Math.ceil(data.total / data.pageSize))
}

function Pagination({ data, params }: { data: DocumentList; params: URLSearchParams }) {
  const pages = pageCount(data)
  if (pages < 2 && data.page < 2) return null

  function pageUrl(page: number) {
    const query = new URLSearchParams(params)
    if (page > 1) query.set('page', String(page))
    return withQuery('/documents', query)
  }

  return (
    <nav className="pagination" aria-label="文献分页">
      {data.page > 1
        ? <Link className="button button--outline" to={pageUrl(data.page - 1)}><ChevronLeft size={16} aria-hidden /> 上一页</Link>
        : <span className="button button--disabled"><ChevronLeft size={16} aria-hidden /> 上一页</span>}
      <span>第 {data.page} / {pages} 页</span>
      {data.page < pages
        ? <Link className="button button--outline" to={pageUrl(data.page + 1)}>下一页 <ChevronRight size={16} aria-hidden /></Link>
        : <span className="button button--disabled">下一页 <ChevronRight size={16} aria-hidden /></span>}
    </nav>
  )
}

function OriginalSource({ doc, compact = false }: { doc: ComplianceDocument; compact?: boolean }) {
  const source = publicSource(doc.sourceUrl)
  return source
    ? <a className={compact ? 'text-link result-original' : 'button button--primary'} href={source} target="_blank" rel="noopener noreferrer">{compact ? '原文' : '打开原始出处'} <ArrowUpRight size={15} aria-hidden /></a>
    : compact ? null : <p className="muted">该记录暂未提供可访问的出处链接。</p>
}

function Preview({ doc, from }: { doc: ComplianceDocument; from: string }) {
  return (
    <div className="source-preview">
      <h3>{doc.sourceName || '来源机构未记录'}</h3>
      <dl className="source-facts">
        <div><dt>发布日期</dt><dd>{displayDate(doc.publishDate)}</dd></div>
        <div><dt>采集日期</dt><dd>{displayDate(doc.collectedAt)}</dd></div>
        <div><dt>来源类型</dt><dd>{doc.sourceType || '未记录'}</dd></div>
      </dl>
      <OriginalSource doc={doc} />
      {doc.excerpt && <div className="preview-excerpt"><h4>正文摘录</h4><blockquote>{doc.excerpt}</blockquote></div>}
      <Link className="text-link" state={{ from }} to={`/documents/${encodeURIComponent(doc.id)}`}>阅读完整记录 <ArrowRight size={16} aria-hidden /></Link>
    </div>
  )
}

function DocumentResults({ data, params, from }: { data: DocumentList; params: URLSearchParams; from: string }) {
  const [selected, setSelected] = useState<string>()
  const active = data.items.find((doc) => doc.id === selected) ?? data.items[0]
  const preview = useRef<HTMLElement>(null)
  const wire = useRef<SVGPathElement>(null)
  const drawing = useRef<Animation | null>(null)
  const frame = useRef(0)

  useEffect(() => {
    const stop = () => {
      cancelAnimationFrame(frame.current)
      drawing.current?.cancel()
    }
    window.addEventListener('scroll', stop, { passive: true })
    window.addEventListener('resize', stop)
    return () => {
      stop()
      window.removeEventListener('scroll', stop)
      window.removeEventListener('resize', stop)
    }
  }, [])

  function selectRecord(id: string, trigger: HTMLButtonElement) {
    const title = trigger.closest('li')?.querySelector('h3 a')
    setSelected(id)
    drawing.current?.cancel()
    cancelAnimationFrame(frame.current)
    if (!title || document.documentElement.dataset.motion === 'paused' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    frame.current = requestAnimationFrame(() => {
      const destination = preview.current?.getBoundingClientRect()
      const path = wire.current
      if (!path || !destination?.width) return
      const titleLines = title.getClientRects()
      const lastLine = titleLines.item(titleLines.length - 1)
      if (!lastLine) return

      const x = Math.min(lastLine.right + 3, destination.left - 18)
      const y = lastLine.bottom - 1
      const elbow = destination.left - 12
      const corner = destination.top + 12
      path.setAttribute('d', `M ${x} ${y} H ${elbow - 5} Q ${elbow} ${y} ${elbow} ${y + (corner >= y ? 5 : -5)} V ${corner} H ${destination.left} V ${destination.top} H ${destination.right - 2} V ${destination.top + 30}`)
      drawing.current = path.animate([
        { strokeDashoffset: '1', opacity: 1 },
        { offset: .6, strokeDashoffset: '0', opacity: 1 },
        { strokeDashoffset: '0', opacity: 0 },
      ], { duration: 820, easing: 'cubic-bezier(.24,.70,.34,1)' })
    })
  }

  if (!active) {
    return (
      <div className="empty-results" data-carry-destination>
        <StateBlock title="没有找到文献" detail={params.size ? '试试缩短关键词，或清除筛选条件扩大搜索范围。' : '文献发布后会在这里显示。'}>
          {params.size > 0 && <Link className="button button--outline" to="/documents">清除筛选</Link>}
        </StateBlock>
        <Pagination data={data} params={params} />
      </div>
    )
  }

  return (
    <>
      <div className="library-results">
        <div className="results-top" data-carry-destination><h2>检索结果</h2><span role="status">{data.total.toLocaleString('zh-CN')} 条文献</span></div>
        <ul className="result-list">
          {data.items.map((doc) => (
            <li className={`result-item${doc.id === active.id ? ' result-item--selected' : ''}`} key={doc.id}>
              <h3><Link state={{ from }} to={`/documents/${encodeURIComponent(doc.id)}`}>{doc.title}</Link></h3>
              <div className="result-source"><span>{doc.sourceName || '来源待补充'}</span>{doc.publishDate && <time dateTime={doc.publishDate}>{displayDate(doc.publishDate)}</time>}</div>
              {doc.summary && <p>{doc.summary}</p>}
              <div className="result-foot">
                <span className="result-classification">{doc.sourceType && <span>{doc.sourceType}</span>}{doc.region && <span>{doc.region}</span>}</span>
                <OriginalSource doc={doc} compact />
                <button type="button" className="inline-button preview-action" aria-controls="document-preview" aria-pressed={doc.id === active.id} onClick={(event) => selectRecord(doc.id, event.currentTarget)}>
                  {doc.id === active.id ? '预览中' : '预览'} <ArrowRight size={15} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <Pagination data={data} params={params} />
      </div>
      <aside ref={preview} id="document-preview" className="library-preview panel" aria-label="文献预览">
        <h2 className="preview-heading"><FileText size={17} aria-hidden /> 来源核对</h2>
        <Preview doc={active} from={from} />
      </aside>
      <svg className="archive-source-wire" aria-hidden="true" focusable="false"><path ref={wire} pathLength={1} /></svg>
    </>
  )
}

export function LibraryPage() {
  const [query, setQuery] = useSearchParams()
  const location = useLocation()
  const params = readFilters(query)
  const searchInput = useRef<HTMLInputElement>(null)
  const submittedSearch = params.get('q') ?? ''
  const apiQuery = new URLSearchParams(params)
  const page = query.get('page')
  if (page && /^[1-9]\d{0,5}$/.test(page)) apiQuery.set('page', page)
  const documents = useApi<DocumentList>(withQuery('/documents', apiQuery))
  const results = documents.status === 'ready' ? documents.data : null
  const lastPage = results ? pageCount(results) : 1
  const outOfBounds = Boolean(results && results.page > lastPage)
  const facets = results?.facets

  useEffect(() => {
    if (searchInput.current) searchInput.current.value = submittedSearch
  }, [submittedSearch])

  useEffect(() => {
    if (!outOfBounds) return
    const corrected = new URLSearchParams(query)
    if (lastPage === 1) corrected.delete('page')
    else corrected.set('page', String(lastPage))
    setQuery(corrected, { replace: true })
  }, [lastPage, outOfBounds, query, setQuery])

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = String(new FormData(event.currentTarget).get('q') ?? '')
    setQuery(changeFilter(params, 'q', value))
  }

  return (
    <div className="container route-space library-workbench">
      <header className="library-toolbar">
        <div className="archive-tab-title"><FolderOpen aria-hidden size={28} strokeWidth={1.5} /><h1>合规文献库</h1></div>
        <form className="library-search" onSubmit={search}>
          <Search size={20} aria-hidden />
          <input ref={searchInput} aria-label="检索文献关键词" name="q" type="search" maxLength={120} defaultValue={submittedSearch} placeholder="搜索标题、摘要或文本摘录" />
          <button type="submit" className="button button--primary">检索</button>
        </form>
        <FilterSheet params={params} facets={facets} onApply={setQuery} />
        <Link className="text-link library-analysis" to={withQuery('/analytics', params)}>分析当前范围 <ArrowUpRight size={16} aria-hidden /></Link>
      </header>
      <ActiveFilters params={params} />
      <div className="library-layout">
        <aside className="library-filters panel" aria-label="文献筛选">
          <div className="panel-title"><Filter size={17} aria-hidden /><h2>筛选</h2></div>
          <DocumentFilters key={params.toString()} params={params} facets={facets} onApply={setQuery} />
        </aside>
        {(documents.status === 'loading' || outOfBounds) && <div className="empty-results"><LoadingBlock /></div>}
        {documents.status === 'error' && <div className="empty-results"><StateBlock title="暂时无法读取文献" detail={documents.message} retry={documents.code === 400 ? undefined : documents.retry}>
          {documents.code === 400 && <Link className="button button--outline" to="/documents">清除筛选</Link>}
        </StateBlock></div>}
        {results && !outOfBounds && <DocumentResults key={apiQuery.toString()} data={results} params={params} from={location.pathname + location.search} />}
      </div>
    </div>
  )
}

export function DocumentPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const from = location.state?.from
  const libraryUrl = typeof from === 'string' && (from === '/documents' || from.startsWith('/documents?')) ? from : '/documents'
  const document = useApi<ComplianceDocument>(`/documents/${encodeURIComponent(id)}`)

  return (
    <div className="container route-space reading-page">
      <Link className="text-link detail-back" to={libraryUrl}><ArrowLeft size={17} aria-hidden /> 返回文献库</Link>
      {document.status === 'loading' && <LoadingBlock />}
      {document.status === 'error' && <StateBlock
        title={document.code === 404 ? '文献不可用' : '暂时无法读取详情'}
        detail={document.message}
        retry={document.code === 404 ? undefined : document.retry}
      >
        {document.code === 404 && <Link className="button button--outline" to="/documents">浏览已发布文献</Link>}
      </StateBlock>}
      {document.status === 'ready' && <DocumentDetail doc={document.data} />}
    </div>
  )
}

function DocumentDetail({ doc }: { doc: ComplianceDocument }) {
  return (
    <article className="evidence-record">
      <header className="record-heading">
        <div className="record-title">
          <div className="result-classification">{doc.sourceType && <span>{doc.sourceType}</span>}{doc.region && <span>{doc.region}</span>}</div>
          <h1>{doc.title}</h1>
        </div>
        <div className="record-provenance">
          <div><strong>{doc.sourceName || '来源机构未记录'}</strong><span>发布日期 {displayDate(doc.publishDate)}</span></div>
          <OriginalSource doc={doc} />
        </div>
      </header>
      <div className="record-columns">
        <div className="record-body">
          {doc.summary && <section className="record-summary"><h2>资料摘要</h2><p>{doc.summary}</p></section>}
          <section className="record-excerpt">
            <h2>正文摘录</h2>
            {doc.excerpt ? <blockquote>{doc.excerpt}</blockquote> : <p className="muted">暂未整理正文摘录。</p>}
          </section>
          {doc.analysis && <section className="record-analysis"><h2>课程分析</h2><p>{doc.analysis}</p></section>}
        </div>
        <aside className="record-catalog" aria-label="编目记录">
          <h2>编目记录</h2>
          <dl className="source-facts">
            <div><dt>主题</dt><dd>{doc.category
              ? <Link className="text-link" to={withQuery('/documents', new URLSearchParams({ category: doc.category }))}>{doc.category}</Link>
              : '未分类'}</dd></div>
            <div><dt>采集日期</dt><dd>{displayDate(doc.collectedAt)}</dd></div>
          </dl>
        </aside>
      </div>
    </article>
  )
}
