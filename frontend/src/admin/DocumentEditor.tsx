import * as Dialog from '@radix-ui/react-dialog'
import { Check, ExternalLink, LoaderCircle, X } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { AdminDocument, DraftInput } from './api'

export const emptyDraft: DraftInput = {
  title: '',
  sourceName: '',
  sourceUrl: '',
  sourceType: '',
  region: '',
  category: '',
  publishDate: null,
  summary: '',
  excerpt: '',
  analysis: '',
}

export type EditorState = {
  document?: AdminDocument
  initial: DraftInput
  mode: 'manual' | 'intake' | 'edit'
}

export function isSecureSource(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && !parsed.username && !parsed.password
  } catch {
    return false
  }
}

type ModalProps = {
  title: string
  description: string
  busy?: boolean
  wide?: boolean
  onClose: () => void
  restoreFocus: () => void
  children: ReactNode
}

export function AdminModal({ title, description, busy, wide, onClose, restoreFocus, children }: ModalProps) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="admin-backdrop" />
        <Dialog.Content
          className={`admin-modal${wide ? ' admin-modal--wide' : ''}`}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            restoreFocus()
          }}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => { if (busy) event.preventDefault() }}
        >
          <div className="admin-modal__heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="admin-icon-button" type="button" aria-label="关闭对话框" disabled={busy}>
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type EditorProps = {
  editor: EditorState
  busy: boolean
  error: string
  onSave: (draft: DraftInput) => void
  onClose: () => void
  restoreFocus: () => void
}

const requiredFields = [
  { key: 'title', label: '标题', max: 200, wide: true },
  { key: 'sourceName', label: '来源名称', max: 120 },
  { key: 'sourceType', label: '来源类型', max: 80 },
  { key: 'region', label: '地区', max: 80 },
  { key: 'category', label: '主题', max: 80 },
] as const

const longFields = [
  { key: 'summary', label: '摘要', max: 1600, rows: 3 },
  { key: 'excerpt', label: '引文', max: 6000, rows: 4 },
  { key: 'analysis', label: '整理说明', max: 6000, rows: 4 },
] as const

export default function DocumentEditor({ editor, busy, error, onSave, onClose, restoreFocus }: EditorProps) {
  const [draft, setDraft] = useState(editor.initial)
  const [validation, setValidation] = useState('')
  const title = editor.mode === 'edit' ? '编辑资料' : editor.mode === 'intake' ? '核对采集草稿' : '手动录入资料'
  const isPublic = editor.document?.status === 'published'
  const description = isPublic
    ? '这条资料已发布，保存后公开页面会显示更新后的内容。'
    : '标有星号的字段必填。请核对标题、时间与原文出处。'

  function update(field: keyof DraftInput, value: string | null) {
    setValidation('')
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const missing = requiredFields.find((item) => draft[item.key].trim() === '')
    if (missing) {
      setValidation(`请填写${missing.label}。`)
      event.currentTarget.querySelector<HTMLInputElement>(`#admin-field-${missing.key}`)?.focus()
      return
    }
    if (!isSecureSource(draft.sourceUrl.trim())) {
      setValidation('请输入完整的 HTTPS 原文链接，例如 https://example.org/article。')
      event.currentTarget.querySelector<HTMLInputElement>('#admin-field-sourceUrl')?.focus()
      return
    }
    onSave({
      title: draft.title.trim(),
      sourceName: draft.sourceName.trim(),
      sourceUrl: draft.sourceUrl.trim(),
      sourceType: draft.sourceType.trim(),
      region: draft.region.trim(),
      category: draft.category.trim(),
      publishDate: draft.publishDate,
      collectedAt: draft.collectedAt,
      summary: draft.summary.trim(),
      excerpt: draft.excerpt.trim(),
      analysis: draft.analysis.trim(),
    })
  }

  return (
    <AdminModal title={title} description={description} busy={busy} wide onClose={onClose} restoreFocus={restoreFocus}>
      <form className="admin-editor" onSubmit={submit}>
        <div className="admin-editor__body">
          <fieldset className="admin-editor__fields" disabled={busy}>
            <legend>出处信息</legend>
            {requiredFields.map((item) => (
              <label className={`admin-field${'wide' in item ? ' admin-field--wide' : ''}`} key={item.key}>
                <span>{item.label} <span aria-hidden="true">*</span></span>
                <input
                  className="admin-input"
                  id={`admin-field-${item.key}`}
                  value={draft[item.key]}
                  maxLength={item.max}
                  required
                  onChange={(event) => update(item.key, event.target.value)}
                />
              </label>
            ))}
            <label className="admin-field admin-field--wide">
              <span>原文链接 <span aria-hidden="true">*</span></span>
              <input
                className="admin-input"
                id="admin-field-sourceUrl"
                type="url"
                placeholder="https://"
                value={draft.sourceUrl}
                maxLength={2048}
                required
                onChange={(event) => update('sourceUrl', event.target.value)}
              />
            </label>
            {isSecureSource(draft.sourceUrl) && (
              <a className="admin-source-link" href={draft.sourceUrl} target="_blank" rel="noopener noreferrer">
                打开原文核对 <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
            <label className="admin-field">
              <span>原文发布日期</span>
              <input
                className="admin-input"
                type="date"
                value={draft.publishDate ?? ''}
                onChange={(event) => update('publishDate', event.target.value || null)}
              />
            </label>
          </fieldset>
          <fieldset className="admin-editor__fields" disabled={busy}>
            <legend>资料内容</legend>
            {longFields.map((item) => (
              <label className="admin-field admin-field--wide" key={item.key}>
                <span>{item.label}</span>
                <textarea
                  className="admin-input"
                  rows={item.rows}
                  value={draft[item.key]}
                  maxLength={item.max}
                  onChange={(event) => update(item.key, event.target.value)}
                />
              </label>
            ))}
          </fieldset>
        </div>
        <div className="admin-modal__footer">
          {(validation || error) && <p className="admin-error" role="alert">{validation || error}</p>}
          <div className="admin-modal__buttons">
            <button type="button" className="admin-button" onClick={onClose} disabled={busy}>取消</button>
            <button className="admin-button admin-button--primary" type="submit" disabled={busy}>
              {busy ? <LoaderCircle size={16} className="admin-spin" aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}
              {busy ? '正在保存' : editor.mode === 'edit' ? '保存修改' : '保存为草稿'}
            </button>
          </div>
        </div>
      </form>
    </AdminModal>
  )
}
