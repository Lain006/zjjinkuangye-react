import type { FormEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

type PageInfo = { page: number; pageSize: number; total: number }

export function lastPage({ total, pageSize }: PageInfo) {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function PageJump({ data, label, onPage }: { data: PageInfo; label: string; onPage: (page: number) => void }) {
  const pages = lastPage(data)
  if (pages < 2) return null
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const page = Number(new FormData(event.currentTarget).get('page'))
    if (Number.isInteger(page) && page >= 1 && page <= pages && page !== data.page) onPage(page)
  }
  return <form className="page-jump" onSubmit={submit}>
    <input key={data.page} aria-label={label} name="page" type="number" min={1} max={pages} required defaultValue={data.page} />
    <span aria-hidden>/ {pages}</span>
    <button type="submit">跳页</button>
  </form>
}

type PageControlsProps = {
  data: PageInfo
  label: string
  href?: (page: number) => string
  onPage?: (page: number) => void
  disabled?: boolean
}

export function PageControls({ data, label, href, onPage, disabled }: PageControlsProps) {
  const pages = lastPage(data)
  const current = data.page
  if (pages < 2) return null
  const visible = [...new Set([1, current - 1, current, current + 1, pages])]
    .filter(page => page >= 1 && page <= pages).sort((a, b) => a - b)
  function control(page: number, label: string, text: React.ReactNode) {
    const active = page === current
    if (active) return <span className="page-control" aria-current="page" aria-label={label}>{text}</span>
    if (href && page >= 1 && page <= pages) return <Link className="page-control" aria-label={label} to={href(page)}>{text}</Link>
    return <button className="page-control" type="button" aria-label={label}
      disabled={disabled || page < 1 || page > pages} onClick={() => onPage?.(page)}>{text}</button>
  }
  return <nav className="page-controls" aria-label={label}>
    {control(current - 1, '上一页', <ChevronLeft size={16} aria-hidden />)}
    {visible.map((page, index) => <span className="page-step" key={page}>
      {index > 0 && page - visible[index - 1] > 1 && <span aria-hidden>…</span>}
      {control(page, `第 ${page} 页`, page)}
    </span>)}
    {control(current + 1, '下一页', <ChevronRight size={16} aria-hidden />)}
  </nav>
}
