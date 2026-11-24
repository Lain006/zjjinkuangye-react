import { loadBuffer } from 'cheerio'
import { z } from 'zod'
import type { DocumentInput } from './model.ts'

export const sources = [
  {
    id: 'sanya-ctc-202607',
    label: '三亚市投资促进局 · 跨境资金集中运营中心座谈会',
    url: 'https://syipb.sanya.gov.cn/tzcjjsite/zyswj/202607/a43b92ed87604b95ae48cc78864830fd.shtml',
    category: '跨境资金',
  },
  {
    id: 'sanya-zijin-hq-202608',
    label: '三亚市投资促进局 · 紫金海南国际总部认定',
    url: 'https://syipb.sanya.gov.cn/tzcjjsite/zyswj/202608/a6cd984629d14f2db2d6eedf39e71475.shtml',
    category: '企业动态',
  },
  {
    id: 'sanya-global-service-202610',
    label: '三亚市投资促进局 · 出海专业服务与产业集聚',
    url: 'https://syipb.sanya.gov.cn/tzcjjsite/ywq/202610/a5a79e110983405783d2221f5a829e6a.shtml',
    category: '出海服务',
  },
  {
    id: 'sanya-cbd-202606',
    label: '三亚市投资促进局 · 三亚中央商务区外向型经济',
    url: 'https://syipb.sanya.gov.cn/tzcjjsite/zyswj/202606/d1c901a0937c4be7b7e02f7337877b73.shtml',
    category: '跨境资金',
  },
] as const

type Source = (typeof sources)[number]
const maxBytes = 512 * 1024
const normalize = (value: string) => value.replace(/\s+/gu, ' ').trim()

async function readHtml(response: Response) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const html = /^(text\/html|application\/xhtml\+xml)(?:\s*;|$)/.test(contentType)
  if (!response.ok || !response.body || !html || Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel()
    throw new Error('Expected a bounded HTML article')
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new Error('Source response exceeded the size limit')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  return Buffer.concat(chunks, size)
}

export async function collectDraft(source: Source, fetchArticle: typeof fetch = fetch): Promise<DocumentInput> {
  // The caller can select an approved ID. Only these built-in HTTPS URLs are fetched.
  const response = await fetchArticle(source.url, {
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
    headers: { accept: 'text/html, application/xhtml+xml' },
  })
  const $ = loadBuffer(await readHtml(response))
  const title = normalize($('meta[name=ArticleTitle i]').first().attr('content') ?? $('.article-top h1, .article-top h2').first().text())
  // The first CMS PubDate tag can describe a later edit, while the article shows its publication date.
  const visibleDate = $('.article-top p').text().match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]
  const date = visibleDate ?? $('meta[name=PubDate i]').last().attr('content')?.trim().slice(0, 10)
  const validatedDate = z.iso.date().safeParse(date)
  if (!title || !validatedDate.success) throw new Error('Official article metadata could not be identified')

  const paragraphs = $('.article-content p').map((_, el) => normalize($(el).text())).get().filter(Boolean)
  const paragraphIndex = paragraphs.findIndex(text => text.length >= 25)
  const paragraph = paragraphs[paragraphIndex] ?? ''
  const characters = Array.from(paragraph)
  const excerpt = characters.length > 72 ? `${characters.slice(0, 72).join('')}…` : paragraph

  return {
    title: title.slice(0, 200),
    sourceName: '三亚市投资促进局',
    sourceUrl: source.url,
    sourceType: '政务动态',
    region: '海南自贸港',
    category: source.category,
    publishDate: validatedDate.data,
    collectedAt: new Date().toISOString(),
    summary: '',
    excerpt,
    evidenceLocator: excerpt ? `原文正文第 ${paragraphIndex + 1} 段` : '',
    analysis: '',
  }
}
