import { lazy, Suspense, useEffect } from 'react'
import { ArrowUpRight, Database, Layers3 } from 'lucide-react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from './HomePage'
import { DocumentPage, LibraryPage } from './Documents'
import { LoadingBlock, StateBlock } from './components'

const AnalyticsPage = lazy(() => import('./AnalyticsPage'))
const AdminPage = lazy(() => import('./admin/AdminPage'))
const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export default function App() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    const labels: Record<string, string> = {
      '/': '首页',
      '/documents': '文献库',
      '/analytics': '数据分析',
      '/admin': '采集管理',
    }
    document.title = `${labels[pathname] ?? '文献详情'} · 紫金矿业跨境合规文献平台`
  }, [pathname])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <span className="brand-icon"><Layers3 size={23} strokeWidth={1.8} aria-hidden /></span>
            <span className="brand-label">
              <strong>紫金矿业</strong>
              <span>跨境合规文献平台</span>
            </span>
          </Link>
          <nav className="topnav" aria-label="主导航">
            <NavLink end to="/">首页</NavLink>
            <NavLink to="/documents">文献库</NavLink>
            <NavLink to="/analytics">数据分析</NavLink>
            <NavLink to="/admin">采集管理</NavLink>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
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
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <strong>紫金矿业跨境合规文献平台</strong>
            <p>课程项目。依据公开资料整理，文献详情附原始出处。</p>
          </div>
          <a className="text-link" href={`${apiBase}/api/v1/documents`} target="_blank" rel="noopener noreferrer">
            <Database size={16} aria-hidden /> 文献接口 <ArrowUpRight size={14} aria-hidden />
          </a>
        </div>
      </footer>
    </div>
  )
}
