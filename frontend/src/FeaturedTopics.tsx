import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { topicOptions } from '../../backend/src/topics'
import { displayDate, useApi, withQuery, type ComplianceDocument, type DocumentList } from './api'
import { stageMotionState, useStageMotion } from './stageMotion'

const intervalMs = 5000
const storageKey = 'home-featured-topic'
const topicCount = topicOptions.length

function initialTopic() {
  try {
    const stored = sessionStorage.getItem(storageKey)
    if (stored !== null) {
      const previous = Number(stored)
      if (Number.isInteger(previous) && previous >= 0 && previous < topicCount) return (previous + 1) % topicCount
    }
  } catch { /* Storage is optional. */ }
  return Math.floor(Math.random() * topicCount)
}

const swayClass = 'index-topic--sway'

function swayNote(note: HTMLElement) {
  if (stageMotionState() !== 'running') return
  if (note.classList.contains(swayClass)) {
    note.classList.remove(swayClass)
    // Commit the removal before replaying the same CSS animation.
    void getComputedStyle(note).animationName
  }
  note.classList.add(swayClass)
}

function TopicRecord({ doc }: { doc: ComplianceDocument }) {
  return (
    <div className="index-topic-record">
      <h3><Link to={'/documents/' + encodeURIComponent(doc.id)}>{doc.title}</Link></h3>
      {doc.summary && <p>{doc.summary}</p>}
      <div className="index-byline">
        <span>{doc.sourceName || '来源待补充'}</span>
        {doc.publishDate && <time dateTime={doc.publishDate}>{displayDate(doc.publishDate)}</time>}
      </div>
    </div>
  )
}

function TopicPreview({ topic }: { topic: string }) {
  const preview = useApi<DocumentList>(withQuery('/documents', new URLSearchParams({ topic, pageSize: '1' })))
  if (preview.status === 'loading') return <p className="index-topic-status">正在翻找专题文献…</p>
  if (preview.status === 'error') return <p className="index-topic-status">暂时无法读取专题文献。 <button className="inline-button" type="button" onClick={preview.retry}>重试</button></p>
  const doc = preview.data.items[0]
  return doc ? <TopicRecord doc={doc} /> : <p className="index-topic-status">这个专题暂未收录公开文献。</p>
}

export default function FeaturedTopics({ latest }: { latest?: DocumentList }) {
  const card = useRef<HTMLElement>(null)
  const [index, setIndex] = useState(initialTopic)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const motion = useStageMotion()
  const playing = motion === 'running' && !paused
  const playbackLabel = paused ? '播放专题轮播' : '暂停专题轮播'
  const topic = topicOptions[index]
  const topicUrl = withQuery('/documents', new URLSearchParams({ topic }))
  const topicDocs = latest?.items.filter(doc => doc.topic === topic) ?? []
  const recent = latest?.items.slice(0, 3)
  const doc = topicDocs.find(item => !recent?.some(record => record.id === item.id)) ?? topicDocs[0]
  const empty = latest && !latest.facets.topics.some(item => item.label === topic && item.count > 0)

  useEffect(() => {
    try { sessionStorage.setItem(storageKey, String(index)) } catch { /* Rotation still works. */ }
  }, [index])

  useEffect(() => {
    const note = card.current
    if (!note || stageMotionState() !== 'running') return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      swayNote(note)
    })
    observer.observe(note)
    return () => observer.disconnect()
  }, [index])

  useEffect(() => {
    if (motion !== 'running') card.current?.classList.remove(swayClass)
  }, [motion])

  useEffect(() => {
    if (!playing || hovered || focused || !card.current) return
    let inView = false
    let timer: number | undefined
    function schedule() {
      window.clearTimeout(timer)
      if (!inView || document.hidden) return
      timer = window.setTimeout(() => setIndex(current => (current + 1) % topicCount), intervalMs)
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      schedule()
    })
    observer.observe(card.current)
    document.addEventListener('visibilitychange', schedule)
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
      document.removeEventListener('visibilitychange', schedule)
    }
  }, [focused, hovered, index, playing])

  return (
    <section ref={card} className="index-topic" aria-label="首页专题" aria-roledescription="轮播"
      onAnimationEnd={event => {
        if (event.target === event.currentTarget && event.animationName === 'paper-sway') event.currentTarget.classList.remove(swayClass)
      }}
      onPointerEnter={event => {
        if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
        setHovered(true)
        if (!event.currentTarget.classList.contains(swayClass)) swayNote(event.currentTarget)
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
      <div className="index-topic-slide" aria-live={playing && !hovered && !focused ? 'off' : 'polite'}>
        <h2>{topic}专题</h2>
        {doc ? <TopicRecord doc={doc} />
          : empty ? <p className="index-topic-status">这个专题暂未收录公开文献。</p>
            : <TopicPreview topic={topic} />}
      </div>
      <div className="index-topic-footer">
        <Link className="text-link index-topic-link" to={topicUrl} aria-label={'打开专题（' + topic + '）'}>打开专题 <ArrowRight size={17} aria-hidden /></Link>
        <div className="index-topic-controls" role="group" aria-label="专题轮播控制">
          <button className="icon-button" type="button" aria-label="上一个专题" title="上一个专题"
            onClick={() => setIndex(current => (current + topicCount - 1) % topicCount)}><ChevronLeft size={20} aria-hidden /></button>
          <span>{index + 1}/{topicCount}</span>
          <button className="icon-button" type="button" aria-label="下一个专题" title="下一个专题"
            onClick={() => setIndex(current => (current + 1) % topicCount)}><ChevronRight size={20} aria-hidden /></button>
          {motion === 'running' && <button className="icon-button" type="button"
            aria-label={playbackLabel} title={playbackLabel} onClick={() => setPaused(value => !value)}>
            {paused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
          </button>}
        </div>
      </div>
    </section>
  )
}
