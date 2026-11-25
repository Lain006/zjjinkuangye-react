import { lazy, Suspense, useEffect, useRef } from 'react'
import { ArrowUpRight, ChartNoAxesColumnIncreasing, Database, FolderOpen, House, NotebookPen } from 'lucide-react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from './HomePage'
import { DocumentPage, LibraryPage } from './Documents'
import { LoadingBlock, StateBlock } from './components'
import { StageMotionControl, StageSpotlight } from './Stage'
import { StageBackdrop } from './GeologicBackdrop'
import RouteCarry from './RouteCarry'
import './paper-ui.css'

const AnalyticsPage = lazy(() => import('./AnalyticsPage'))
const AdminPage = lazy(() => import('./admin/AdminPage'))
const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export default function App() {
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  const previousPath = useRef<string | null>(null)

  useEffect(() => {
    const labels: Record<string, string> = {
      '/': '首页',
      '/documents': '文献库',
      '/analytics': '数据分析',
      '/admin': '采集管理',
    }
    document.title = `${labels[pathname] ?? '文献详情'} · 紫金矿业跨境合规证据工作台`

    const changedRoute = previousPath.current !== null && previousPath.current !== pathname
    const openedDirectDocument = previousPath.current === null && pathname.startsWith('/documents/')
    previousPath.current = pathname
    if (changedRoute || openedDirectDocument) main.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div className="app-shell">
      <StageBackdrop />
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <div className={/^\/(?:documents|analytics)(?:\/|$)/.test(pathname) ? 'app-workspace app-workspace--catalog' : 'app-workspace'}>
        <header className="site-header">
          <div className="container header-inner">
            <Link to="/" className="brand">
              <img className="brand-icon" src="/mineral-mark.svg" width="46" height="46" alt="" />
              <span className="brand-label">
                <strong>紫金矿业</strong>
                <span>跨境合规证据工作台</span>
              </span>
            </Link>
            <nav className="topnav" aria-label="主导航">
              <NavLink end to="/"><House size={15} aria-hidden />首页</NavLink>
              <NavLink to="/documents"><FolderOpen size={15} aria-hidden />文献库</NavLink>
              <NavLink to="/analytics"><ChartNoAxesColumnIncreasing size={15} aria-hidden />数据分析</NavLink>
              <NavLink to="/admin"><NotebookPen size={15} aria-hidden />采集管理</NavLink>
            </nav>
            <StageMotionControl />
          </div>
        </header>
        <main id="main-content" tabIndex={-1} ref={main}>
          <Suspense fallback={<div className="container route-space"><LoadingBlock label="正在打开页面" /></div>}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/documents" element={<LibraryPage />} />
              <Route path="/documents/:id" element={<DocumentPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={
                <div className="container route-space">
                  <StateBlock title="页面不存在" detail="可以返回首页或从文献库继续查找。">
                    <Link className="button button--primary" to="/documents">打开文献库</Link>
                  </StateBlock>
                </div>
              } />
            </Routes>
          </Suspense>
        </main>
      </div>
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <strong>紫金矿业跨境合规证据工作台</strong>
            <p>课程项目。依据公开资料整理，文献详情附原始出处。</p>
          </div>
          <a className="text-link" href={`${apiBase}/api/v1/documents`} target="_blank" rel="noopener noreferrer">
            <Database size={16} aria-hidden /> 文献接口 <ArrowUpRight size={14} aria-hidden />
          </a>
        </div>
      </footer>
      <RouteCarry />
      <StageSpotlight />
    </div>
  )
}
