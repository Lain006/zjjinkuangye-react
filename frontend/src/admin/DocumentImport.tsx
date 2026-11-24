import { useState } from 'react'
import { AdminModal } from './DocumentEditor'
import { adminApi, type DraftInput } from './api'

const maxRows = 100
const maxBytes = 2 * 1024 * 1024

function toDraft(value: unknown, index: number): DraftInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`第 ${index + 1} 条资料应为一条记录。`)
  const row: Record<string, unknown> = Object.fromEntries(Object.entries(value).map(([key, field]) => [key.trim(), field]))
  const field = (...keys: string[]) => {
    for (const key of keys) {
      const item = row[key]
      if (typeof item === 'string' && item.trim()) return item.trim()
    }
    return ''
  }
  const draft = {
    title: field('title', '标题'), sourceName: field('sourceName', '来源名称'),
    sourceUrl: field('sourceUrl', '来源链接'), sourceType: field('sourceType', '来源类型'),
    category: field('category', '主题') || field('topic', '一级主题'),
    topic: field('topic', '一级主题') || undefined, region: field('region', '地区', 'country', '国家'),
    publishDate: field('publishDate', '发布日期') || null,
    collectedAt: field('collectedAt', 'collectDate', '采集日期') || undefined,
    summary: field('summary', '摘要'), excerpt: field('excerpt', '摘录', '引文'),
    analysis: field('analysis', '课程分析', '整理说明', '分析'),
    evidenceLocator: field('evidenceLocator', '出处位置'),
    evidenceSourceUrl: field('evidenceSourceUrl', '摘录出处链接') || undefined,
  }
  if (![draft.title, draft.sourceName, draft.sourceUrl, draft.sourceType, draft.category, draft.region].every(Boolean)) {
    throw new Error(`第 ${index + 1} 条缺少标题、来源名称、来源链接、来源类型、主题或地区。`)
  }
  return draft
}

async function readFile(file: File): Promise<DraftInput[]> {
  if (file.size > maxBytes) throw new Error('单个文件最多 2 MB。')
  const extension = file.name.split('.').pop()?.toLowerCase()
  let rows: unknown
  if (extension === 'json') {
    rows = JSON.parse((await file.text()).replace(/^\uFEFF/u, ''))
  } else if (extension === 'csv' || extension === 'xlsx' || extension === 'xls') {
    const { read, utils } = await import('xlsx')
    const input = extension === 'csv' ? await file.text() : await file.arrayBuffer()
    const workbook = read(input, {
      type: typeof input === 'string' ? 'string' : 'array',
      raw: true, sheetRows: maxRows + 2, sheets: 0, dateNF: 'yyyy-mm-dd',
    })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    rows = sheet ? utils.sheet_to_json(sheet, { raw: false, defval: '', dateNF: 'yyyy-mm-dd' }) : []
  } else {
    throw new Error('请选择 Excel、UTF-8 CSV 或 JSON 文件。')
  }
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('文件必须包含资料记录。JSON 使用数组，表格首行使用字段名。')
  if (rows.length > maxRows) throw new Error('每批最多 100 条，请拆分文件。')
  return rows.map(toDraft)
}

type Props = {
  onClose: () => void
  restoreFocus: () => void
  onImported: (created: number, skipped: number) => void
  onError: (error: unknown) => string
}

export default function DocumentImport({ onClose, restoreFocus, onImported, onError }: Props) {
  const [drafts, setDrafts] = useState<DraftInput[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function select(file?: File) {
    setError('')
    setDrafts([])
    if (!file) return
    setBusy(true)
    try {
      setDrafts(await readFile(file))
    } catch (failure) {
      setError(failure instanceof Error && /\p{Script=Han}/u.test(failure.message) ? failure.message : '文件无法解析，请检查格式。')
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    setError('')
    setBusy(true)
    try {
      const result = await adminApi.importDrafts(drafts)
      onImported(result.created, result.skipped)
    } catch (failure) {
      setError(onError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminModal title="批量导入资料" description="支持 Excel、UTF-8 CSV 和 JSON。导入生成草稿，重复来源跳过。"
      busy={busy} onClose={onClose} restoreFocus={restoreFocus}>
      <label className="admin-field">
        <span>选择导入文件</span>
        <input type="file" accept=".xlsx,.xls,.csv,.json" disabled={busy} onChange={(event) => void select(event.target.files?.[0])} />
      </label>
      <p>首行填写标题、来源名称、来源链接、来源类型、地区、主题。也支持旧版英文字段。每批最多 100 条，表格读取首个工作表。</p>
      {error && <p role="alert">{error}</p>}
      {drafts.length > 0 && (
        <div aria-live="polite">
          <p>共识别 {drafts.length} 条，以下为前 {Math.min(5, drafts.length)} 条。</p>
          <ol>{drafts.slice(0, 5).map((draft, index) => <li key={index}>{draft.title.slice(0, 120)} · {draft.region.slice(0, 80)}</li>)}</ol>
        </div>
      )}
      <div className="admin-header__actions">
        <button className="admin-button" type="button" onClick={onClose} disabled={busy}>取消</button>
        <button className="admin-button admin-button--primary" type="button" onClick={() => void submit()} disabled={busy || !drafts.length}>
          {busy ? '正在处理…' : '导入为草稿'}
        </button>
      </div>
    </AdminModal>
  )
}
