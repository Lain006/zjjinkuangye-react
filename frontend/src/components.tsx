import type { ReactNode } from 'react'
import { CircleAlert, FileSearch, RotateCw } from 'lucide-react'
import { Link } from 'react-router-dom'

export function LoadingBlock({ label = '正在读取文献' }: { label?: string }) {
  return (
    <div className="state-block" role="status">
      <span className="state-icon"><RotateCw size={22} className="spinner" aria-hidden /></span>
      <p>{label}…</p>
      <div className="skeleton-lines" aria-hidden><span /><span /><span /></div>
    </div>
  )
}

export function StateBlock({
  title,
  detail,
  retry,
  children,
}: {
  title: string
  detail: string
  retry?: () => void
  children?: ReactNode
}) {
  const Icon = retry ? CircleAlert : FileSearch
  return (
    <div className="state-block" role={retry ? 'alert' : undefined}>
      <span className="state-icon"><Icon size={24} aria-hidden /></span>
      <h2>{title}</h2>
      <p>{detail}</p>
      {retry && <button className="button button--outline" type="button" onClick={retry}><RotateCw size={15} aria-hidden /> 重试</button>}
      {children}
    </div>
  )
}

export function PageHeading({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <header className="page-heading">
      <nav className="breadcrumbs" aria-label="当前位置"><Link to="/">首页</Link><span aria-hidden>/</span><span aria-current="page">{label}</span></nav>
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  )
}
