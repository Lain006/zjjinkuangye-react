import {
  ArrowLeft, Archive, CircleAlert, CircleCheck, ClipboardList, ExternalLink,
  FilePlus2, Link2, LoaderCircle, LockKeyhole, LogOut, RefreshCw, Search,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import DocumentEditor, { AdminModal, emptyDraft, isSecureSource, type EditorState } from './DocumentEditor'
import DocumentsTable, { statusLabels, type StatusAction } from './DocumentsTable'
import { adminApi, AdminApiError, changedDraftFields, explainError, type AdminDocument, type AuditEntry, type DocumentStatus, type DraftInput, type Source } from './api'
import './admin.css'

type Resource<T> = { kind: 'loading' } | { kind: 'ready'; value: T } | { kind: 'error'; error: unknown }
type Loader<T> = (signal: AbortSignal) => Promise<T>

function useResource<T>(load: Loader<T>, version: number, expired?: () => void): Resource<T> {
  const [result, setResult] = useState<{ load: Loader<T>; version: number; state: Resource<T> }>()

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal).then((value) => {
      if (!controller.signal.aborted) setResult({ load, version, state: { kind: 'ready', value } })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      if (expired && error instanceof AdminApiError && error.status === 401) {
        expired()
        return
      }
      setResult({ load, version, state: { kind: 'error', error } })
    })
    return () => controller.abort()
  }, [expired, load, version])

  return result?.load === load && result.version === version ? result.state : { kind: 'loading' }
}

function Loading({ message }: { message: string }) {
  return (
    <div className="admin-loading" role="status">
      <LoaderCircle className="admin-spin" size={18} aria-hidden="true" /> {message}
    </div>
  )
}

function ErrorMessage({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="admin-inline-error">
      <p className="admin-error" role="alert"><CircleAlert size={17} aria-hidden="true" /> {message}</p>
      {retry && (
        <button className="admin-button" type="button" onClick={retry}>
          <RefreshCw size={15} aria-hidden="true" /> 重试
        </button>
      )}
    </div>
  )
}

function AdminLogin({ expired, onSuccess }: { expired: boolean; onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    try {
      if (await adminApi.signIn(password)) onSuccess()
      else setError('维护密码验证失败，请重新输入。')
    } catch (failure) {
      setError(failure instanceof AdminApiError && failure.status === 401
        ? '维护密码不正确，请重新输入。'
        : explainError(failure))
    } finally {
      setPassword('')
      setPending(false)
    }
  }

  return (
    <div className="admin-console admin-login-layout">
      <div className="admin-login-intro">
        <Link className="admin-back-link" to="/"><ArrowLeft size={17} aria-hidden="true" /> 返回公开站点</Link>
        <h1>采集与发布</h1>
        <p>维护资料出处、整理采集草稿，核对后发布到公开资料库。</p>
      </div>
      <form className="admin-login-form" onSubmit={(event) => void submit(event)}>
        <div className="admin-login-icon"><LockKeyhole size={23} strokeWidth={1.65} aria-hidden="true" /></div>
        <h2>维护员登录</h2>
        {expired && <p className="admin-login-notice" role="status">登录已过期，请重新登录。</p>}
        <label className="admin-field">
          <span>维护密码</span>
          <input
            className="admin-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            readOnly={pending}
            maxLength={256}
            required
          />
        </label>
        {error && <ErrorMessage message={error} />}
        <button className="admin-button admin-button--primary" type="submit" disabled={pending}>
          {pending && <LoaderCircle size={16} className="admin-spin" aria-hidden="true" />}
          {pending ? '正在登录' : '登录维护台'}
        </button>
      </form>
    </div>
  )
}

const actionLabels: Record<string, string> = {
  create: '录入草稿',
  update: '编辑资料',
  publish: '发布资料',
  archive: '归档资料',
}

const actionTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

function AuditPanel({ data, retry }: { data: Resource<AuditEntry[]>; retry: () => void }) {
  const [showAll, setShowAll] = useState(false)
  const visible = data.kind === 'ready' ? data.value.slice(0, showAll ? data.value.length : 12) : []
  return (
    <aside className="admin-audit" aria-labelledby="admin-audit-heading">
      <div className="admin-audit__heading">
        <ClipboardList size={20} strokeWidth={1.7} aria-hidden="true" />
        <h2 id="admin-audit-heading">操作记录</h2>
      </div>
      {data.kind === 'loading' && <Loading message="正在读取操作记录" />}
      {data.kind === 'error' && <ErrorMessage message={explainError(data.error)} retry={retry} />}
      {data.kind === 'ready' && data.value.length === 0 && <p className="admin-audit__empty">暂无操作记录。</p>}
      {visible.length > 0 && (
        <ol className="admin-audit__feed" id="admin-audit-entries">
          {visible.map((entry) => {
            const date = new Date(entry.createdAt)
            return (
              <li key={entry.id}>
                <strong>{actionLabels[entry.action] ?? '资料操作'}</strong>
                {!Number.isNaN(date.valueOf()) && <time dateTime={entry.createdAt}>{actionTime.format(date)}</time>}
                <span title={entry.documentId}>记录 {entry.documentId}</span>
              </li>
            )
          })}
        </ol>
      )}
      {data.kind === 'ready' && data.value.length > 12 && (
        <button className="admin-clear admin-audit__expand" type="button" aria-controls="admin-audit-entries" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
          {showAll ? '收起较早记录' : `查看全部 ${data.value.length} 条记录`}
        </button>
      )}
    </aside>
  )
}

type IntakePanelProps = {
  data: Resource<Source[]>
  pending: boolean
  disabled: boolean
  retry: () => void
  create: (source: Source, trigger: HTMLElement | null) => void
}

function IntakePanel({ data, pending, disabled, retry, create }: IntakePanelProps) {
  const [sourceId, setSourceId] = useState('')
  const startButton = useRef<HTMLButtonElement>(null)
  const source = data.kind === 'ready' ? data.value.find((item) => item.id === sourceId) : undefined

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (source && !disabled) create(source, startButton.current)
  }

  return (
    <section className="admin-intake" aria-labelledby="admin-intake-heading">
      <div className="admin-intake__heading">
        <div className="admin-intake__icon"><Link2 size={24} strokeWidth={1.6} aria-hidden="true" /></div>
        <div>
          <h2 id="admin-intake-heading">从来源采集</h2>
          <p>读取公开页面并生成可编辑草稿。</p>
        </div>
      </div>
      {data.kind === 'loading' && <Loading message="正在读取来源" />}
      {data.kind === 'error' && <ErrorMessage message={explainError(data.error)} retry={retry} />}
      {data.kind === 'ready' && data.value.length === 0 && <p>暂无可采集来源，可使用手动录入。</p>}
      {data.kind === 'ready' && data.value.length > 0 && (
        <form className="admin-intake__form" onSubmit={submit}>
          <div className="admin-field">
            <label htmlFor="admin-intake-source">采集来源</label>
            <select
              className="admin-input"
              id="admin-intake-source"
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              disabled={disabled}
              required
            >
              <option value="">选择预设来源</option>
              {data.value.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          <button ref={startButton} className="admin-button admin-button--forest" type="submit" disabled={!source || disabled}>
            {pending && <LoaderCircle size={17} className="admin-spin" aria-hidden="true" />}
            {pending ? '正在采集' : '读取来源'}
          </button>
          {source && isSecureSource(source.url) && (
            <a className="admin-source-link" href={source.url} target="_blank" rel="noopener noreferrer">
              查看来源页面 <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}
        </form>
      )}
    </section>
  )
}

const filters: { status: DocumentStatus | ''; label: string }[] = [
  { status: '', label: '全部' },
  { status: 'draft', label: statusLabels.draft },
  { status: 'published', label: statusLabels.published },
  { status: 'archived', label: statusLabels.archived },
]

type Notice = { kind: 'success' | 'error'; text: string }
type Confirmation = { document: AdminDocument; action: StatusAction }

function AdminWorkspace({ expired, signedOut }: { expired: () => void; signedOut: () => void }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<DocumentStatus | ''>('')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [sourcesRefresh, setSourcesRefresh] = useState(0)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [confirm, setConfirm] = useState<Confirmation | null>(null)
  const [working, setWorking] = useState<'intake' | 'edit' | 'logout' | ''>('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const lastTrigger = useRef<HTMLElement | null>(null)
  const listHeading = useRef<HTMLHeadingElement>(null)
  const activeRead = useRef<AbortController | null>(null)

  const loadDocuments = useCallback((signal: AbortSignal) => adminApi.documents(page, query, filter, signal), [filter, page, query])
  const documents = useResource(loadDocuments, refresh, expired)
  const audit = useResource(adminApi.audit, refresh, expired)
  const sources = useResource(adminApi.sources, sourcesRefresh, expired)

  useEffect(() => () => activeRead.current?.abort(), [])

  function refreshData() {
    setRefresh((value) => value + 1)
  }

  function restoreFocus() {
    const trigger = lastTrigger.current
    if (trigger?.isConnected && !trigger.matches(':disabled')) trigger.focus()
    else listHeading.current?.focus()
    lastTrigger.current = null
  }

  function expiredOrExplain(error: unknown) {
    if (error instanceof AdminApiError && error.status === 401) {
      expired()
      return ''
    }
    return explainError(error)
  }

  function showRequestError(error: unknown) {
    const text = expiredOrExplain(error)
    if (text) setNotice({ kind: 'error', text })
  }

  function selectEditor(next: EditorState, trigger: HTMLElement | null) {
    lastTrigger.current = trigger
    setActionError('')
    setNotice(null)
    setEditor(next)
  }

  async function readBeforeEdit(
    kind: 'intake' | 'edit',
    read: (signal: AbortSignal) => Promise<EditorState>,
    trigger: HTMLElement | null,
  ) {
    if (activeRead.current || working) return
    const controller = new AbortController()
    activeRead.current = controller
    setWorking(kind)
    setNotice(null)
    try {
      const next = await read(controller.signal)
      if (!controller.signal.aborted) selectEditor(next, trigger)
    } catch (error) {
      if (!controller.signal.aborted) showRequestError(error)
    } finally {
      if (!controller.signal.aborted) {
        activeRead.current = null
        setWorking('')
      }
    }
  }

  function startIntake(source: Source, trigger: HTMLElement | null) {
    void readBeforeEdit('intake', async (signal) => ({
      mode: 'intake', initial: await adminApi.intake(source.id, signal),
    }), trigger)
  }

  function openDocument(id: string, trigger: HTMLElement) {
    void readBeforeEdit('edit', async (signal) => {
      const document = await adminApi.document(id, signal)
      return { mode: 'edit', initial: document, document }
    }, trigger)
  }

  function confirmAction(document: AdminDocument, action: StatusAction, trigger: HTMLElement) {
    lastTrigger.current = trigger
    setActionError('')
    setNotice(null)
    setConfirm({ document, action })
  }

  async function save(draft: DraftInput) {
    if (!editor || saving) return
    setSaving(true)
    setActionError('')
    try {
      if (editor.document) {
        const changes = changedDraftFields(editor.document, draft)
        if (!Object.keys(changes).length) {
          setEditor(null)
          setNotice({ kind: 'success', text: '没有需要保存的修改。' })
          return
        }
        await adminApi.update(editor.document.id, changes)
        setNotice({ kind: 'success', text: '已保存资料修改。' })
      } else {
        await adminApi.create(draft)
        setFilter('draft')
        setSearch('')
        setQuery('')
        setPage(1)
        setNotice({ kind: 'success', text: '已存为草稿，可在目录中检查并发布。' })
      }
      setEditor(null)
      refreshData()
    } catch (error) {
      setActionError(expiredOrExplain(error))
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus() {
    if (!confirm || saving) return
    setSaving(true)
    setActionError('')
    try {
      await adminApi.setStatus(confirm.document.id, confirm.action)
      setNotice({ kind: 'success', text: confirm.action === 'publish' ? '资料已发布，访客现在可以查看。' : '资料已归档。' })
      setConfirm(null)
      setPage(1)
      refreshData()
    } catch (error) {
      setActionError(expiredOrExplain(error))
    } finally {
      setSaving(false)
    }
  }

  async function logout() {
    if (working) return
    setWorking('logout')
    try {
      await adminApi.signOut()
      signedOut()
    } catch (error) {
      showRequestError(error)
    } finally {
      setWorking('')
    }
  }

  function searchDocuments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setQuery(search.trim())
  }

  function clearSearch() {
    setSearch('')
    setQuery('')
    setPage(1)
  }

  function changePage(next: number) {
    setPage(next)
    listHeading.current?.focus()
  }

  const isPublishing = confirm?.action === 'publish'
  const busy = Boolean(working) || saving

  return (
    <div className="admin-console">
      <header className="admin-header">
        <div>
          <Link className="admin-back-link" to="/"><ArrowLeft size={17} aria-hidden="true" /> 返回公开站点</Link>
          <h1>采集与发布</h1>
          <p>维护公开资料库的来源、草稿与发布状态。</p>
        </div>
        <div className="admin-header__actions">
          <button
            className="admin-button admin-button--primary"
            type="button"
            disabled={busy}
            onClick={(event) => selectEditor({ mode: 'manual', initial: emptyDraft }, event.currentTarget)}
          >
            <FilePlus2 size={18} aria-hidden="true" /> 手动录入
          </button>
          <button className="admin-button" type="button" onClick={() => void logout()} disabled={busy}>
            <LogOut size={16} aria-hidden="true" /> {working === 'logout' ? '正在退出' : '退出登录'}
          </button>
        </div>
      </header>

      <IntakePanel
        data={sources}
        pending={working === 'intake'}
        disabled={busy}
        retry={() => setSourcesRefresh((value) => value + 1)}
        create={startIntake}
      />

      {notice && (
        <div className={`admin-notice admin-notice--${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          {notice.kind === 'error' ? <CircleAlert size={18} aria-hidden="true" /> : <CircleCheck size={18} aria-hidden="true" />}
          {notice.text}
        </div>
      )}

      <div className="admin-workgrid">
        <section className="admin-library" aria-labelledby="admin-documents-heading" aria-busy={documents.kind === 'loading'}>
          <div className="admin-library__heading">
            <h2 ref={listHeading} id="admin-documents-heading" tabIndex={-1}>资料目录</h2>
            <button type="button" className="admin-icon-button" aria-label="刷新资料与操作记录" onClick={refreshData} disabled={busy || documents.kind === 'loading'}>
              <RefreshCw size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="admin-library__toolbar">
            <div className="admin-filter" role="group" aria-label="按资料状态筛选">
              {filters.map((choice) => (
                <button
                  type="button"
                  key={choice.status}
                  aria-pressed={filter === choice.status}
                  onClick={() => {
                    setFilter(choice.status)
                    setPage(1)
                  }}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <form className="admin-search" role="search" aria-label="检索维护资料" onSubmit={searchDocuments}>
              <input
                className="admin-input"
                aria-label="检索关键词"
                value={search}
                maxLength={120}
                placeholder="查找资料"
                onChange={(event) => setSearch(event.target.value)}
              />
              <button type="submit" className="admin-icon-button" aria-label="检索资料">
                <Search size={17} aria-hidden="true" />
              </button>
              {query && <button className="admin-clear" type="button" onClick={clearSearch}>清除</button>}
            </form>
          </div>
          {documents.kind === 'loading' && <Loading message="正在读取资料" />}
          {working === 'edit' && <Loading message="正在打开资料" />}
          {documents.kind === 'error' && <ErrorMessage message={explainError(documents.error)} retry={refreshData} />}
          {documents.kind === 'ready' && (
            <DocumentsTable data={documents.value} actionBusy={busy} onEdit={openDocument} onAction={confirmAction} onPage={changePage} />
          )}
        </section>
        <AuditPanel data={audit} retry={refreshData} />
      </div>

      {editor && (
        <DocumentEditor editor={editor} busy={saving} error={actionError} onSave={(draft) => void save(draft)} onClose={() => setEditor(null)} restoreFocus={restoreFocus} />
      )}
      {confirm && (
        <AdminModal
          title={isPublishing ? '发布资料' : '归档资料'}
          description={isPublishing ? '发布后，访客可以通过公开资料库检索这条资料。' : '归档后，访客将无法在公开资料库中查看这条资料。'}
          busy={saving}
          onClose={() => setConfirm(null)}
          restoreFocus={restoreFocus}
        >
          <p className="admin-confirm-title">{confirm.document.title}</p>
          <div className="admin-modal__footer">
            {actionError && <ErrorMessage message={actionError} />}
            <div className="admin-modal__buttons">
              <button type="button" className="admin-button" onClick={() => setConfirm(null)} disabled={saving}>取消</button>
              <button type="button" className={`admin-button ${isPublishing ? 'admin-button--forest' : 'admin-button--danger'}`} disabled={saving} onClick={() => void changeStatus()}>
                {saving ? <LoaderCircle className="admin-spin" size={16} aria-hidden="true" /> : isPublishing ? <CircleCheck size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
                {isPublishing ? '确认发布' : '确认归档'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  )
}

export default function AdminPage() {
  const [session, setSession] = useState<'initial' | 'signed-in' | 'signed-out' | 'expired'>('initial')
  const [retry, setRetry] = useState(0)
  const check = useResource(adminApi.session, retry)
  const expire = useCallback(() => setSession('expired'), [])
  const signOut = useCallback(() => setSession('signed-out'), [])

  if (session === 'signed-in' || (session === 'initial' && check.kind === 'ready' && check.value)) {
    return <AdminWorkspace expired={expire} signedOut={signOut} />
  }
  if (session === 'initial' && check.kind === 'loading') {
    return <div className="admin-console admin-session-state"><Loading message="正在检查登录状态" /></div>
  }
  if (session === 'initial' && check.kind === 'error') {
    return <div className="admin-console admin-session-state"><ErrorMessage message={explainError(check.error)} retry={() => setRetry((value) => value + 1)} /></div>
  }
  return <AdminLogin expired={session === 'expired'} onSuccess={() => setSession('signed-in')} />
}
