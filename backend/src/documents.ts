import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import { transaction } from './db.ts'
import { completeDocument } from './model.ts'
import { knownTopic, otherTopic, resolveTopic, topicAliases } from './topics.ts'
import type { Document, DocumentInput, DocumentStatus, Facet, Filters, ListFilters } from './model.ts'

type DocumentRow = {
  id: string
  title: string
  source_name: string
  source_url: string
  source_type: string
  region: string
  category: string
  topic: Document['topic']
  evidence_locator: string
  evidence_source_url: string | null
  publish_date: string | null
  collected_at: Date | string
  summary: string
  excerpt: string
  analysis: string
  status: DocumentStatus
  legacy_id: number | null
}

type Facets = { regions: Facet[]; categories: Facet[]; topics: Facet[]; sourceTypes: Facet[] }
type Analytics = Omit<Facets, 'sourceTypes'> & {
  total: number
  latestCollectedAt: Date | string | null
  months: Facet[]
}

const columns = `id, title, source_name, source_url, source_type, region, category,
  to_char(publish_date, 'YYYY-MM-DD') AS publish_date, collected_at, summary, excerpt, analysis, status, legacy_id, topic, evidence_locator, evidence_source_url`

function mapDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    title: row.title,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
    region: row.region,
    category: row.category,
    topic: row.topic,
    evidenceLocator: row.evidence_locator,
    evidenceSourceUrl: row.evidence_source_url,
    publishDate: row.publish_date,
    collectedAt: new Date(row.collected_at).toISOString(),
    summary: row.summary,
    excerpt: row.excerpt,
    analysis: row.analysis,
    status: row.status,
    legacyId: row.legacy_id,
  }
}

function present(doc: Document) {
  return { ...doc, topic: resolveTopic(doc.category, doc.topic), topicConfirmed: Boolean(doc.topic || knownTopic(doc.category)) }
}

export class IncompletePublication extends Error {}

const topicLookup = JSON.stringify(Object.fromEntries(topicAliases))

function baseFilter(filters: Filters, status?: DocumentStatus) {
  const values: (string | string[] | number)[] = []
  const param = (value: string | string[] | number) => `$${values.push(value)}`
  const where: string[] = []
  const topicColumn = `COALESCE(topic, (${param(topicLookup)}::jsonb ->> category), ${param(otherTopic)})`
  if (status) where.push(`status = ${param(status)}`)
  if (filters.dateFrom) where.push(`publish_date >= ${param(filters.dateFrom)}::date`)
  if (filters.dateTo) where.push(`publish_date <= ${param(filters.dateTo)}::date`)
  if (filters.q) {
    const terms = param(filters.q.toLowerCase().split(/\s+/))
    where.push(`NOT EXISTS (SELECT 1 FROM unnest(${terms}::text[]) term
      WHERE strpos(lower(concat_ws(' ', title, summary, excerpt, analysis, source_name, region, category, ${topicColumn})), term) = 0)`)
  }
  const dimensions = {
    topic: filters.topic ? `resolved_topic = ${param(filters.topic)}` : 'TRUE',
    region: filters.region ? `region = ${param(filters.region)}` : 'TRUE',
    category: filters.category ? `category = ${param(filters.category)}` : 'TRUE',
    source_type: filters.sourceType ? `source_type = ${param(filters.sourceType)}` : 'TRUE',
  }
  return { values, param, topicColumn, where: where.join(' AND ') || 'TRUE', dimensions }
}

export async function listDocuments(pool: Pool, filters: ListFilters, status?: DocumentStatus) {
  const { values, param, topicColumn, where, dimensions } = baseFilter(filters, status)
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 20
  const limit = param(pageSize)
  const offset = param((page - 1) * pageSize)
  const { region, category, topic, source_type: sourceType } = dimensions

  const result = await pool.query<{ items: DocumentRow[]; total: number; facets: Facets }>(`WITH base AS (
    SELECT *, ${topicColumn} AS resolved_topic FROM documents WHERE ${where}
  ), filtered AS (
    SELECT * FROM base WHERE ${region} AND ${category} AND ${topic} AND ${sourceType}
  ), page_items AS (
    SELECT ${columns} FROM filtered ORDER BY collected_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}
  ) SELECT
    COALESCE((SELECT json_agg(page_items ORDER BY collected_at DESC, id DESC) FROM page_items), '[]') AS items,
    (SELECT count(*)::int FROM filtered) AS total,
    json_build_object(
      'regions', COALESCE((SELECT json_agg(f ORDER BY count DESC, label) FROM
        (SELECT region AS label, count(*)::int FROM base WHERE ${category} AND ${topic} AND ${sourceType} GROUP BY region) f), '[]'),
      'categories', COALESCE((SELECT json_agg(f ORDER BY count DESC, label) FROM
        (SELECT category AS label, count(*)::int FROM base WHERE ${region} AND ${topic} AND ${sourceType} GROUP BY category) f), '[]'),
      'topics', COALESCE((SELECT json_agg(f ORDER BY count DESC, label) FROM
        (SELECT resolved_topic AS label, count(*)::int FROM base WHERE ${region} AND ${category} AND ${sourceType} GROUP BY resolved_topic) f), '[]'),
      'sourceTypes', COALESCE((SELECT json_agg(f ORDER BY count DESC, label) FROM
        (SELECT source_type AS label, count(*)::int FROM base WHERE ${region} AND ${category} AND ${topic} GROUP BY source_type) f), '[]')
    ) AS facets`, values)

  const row = result.rows[0]
  return { items: row.items.map(row => present(mapDocument(row))), total: row.total, page, pageSize, facets: row.facets }
}

export async function getAnalytics(pool: Pool, filters: Filters): Promise<Analytics> {
  const { values, topicColumn, where, dimensions } = baseFilter(filters, 'published')
  const { region, category, topic, source_type: sourceType } = dimensions
  const result = await pool.query<Analytics>(`WITH base AS (
    SELECT *, ${topicColumn} AS resolved_topic FROM documents WHERE ${where}
  ), filtered AS (
    SELECT * FROM base WHERE ${region} AND ${category} AND ${topic} AND ${sourceType}
  ) SELECT
    count(*)::int AS total, max(collected_at) AS "latestCollectedAt",
    COALESCE((SELECT json_agg(b ORDER BY label) FROM (SELECT to_char(publish_date, 'YYYY-MM') AS label,
      count(*)::int FROM filtered WHERE publish_date IS NOT NULL GROUP BY 1) b), '[]') AS months,
    COALESCE((SELECT json_agg(b ORDER BY count DESC, label) FROM
      (SELECT region AS label, count(*)::int FROM filtered GROUP BY region) b), '[]') AS regions,
    COALESCE((SELECT json_agg(b ORDER BY count DESC, label) FROM
      (SELECT category AS label, count(*)::int FROM filtered GROUP BY category) b), '[]') AS categories,
    COALESCE((SELECT json_agg(b ORDER BY count DESC, label) FROM
      (SELECT resolved_topic AS label, count(*)::int FROM filtered GROUP BY resolved_topic) b), '[]') AS topics
    FROM filtered`, values)
  const row = result.rows[0]
  return { ...row, latestCollectedAt: row.latestCollectedAt && new Date(row.latestCollectedAt).toISOString() }
}

export async function getDocument(pool: Pool, id: string, publishedOnly: boolean): Promise<Document | null> {
  const result = await pool.query<DocumentRow>(`SELECT ${columns} FROM documents
    WHERE id = $1 AND ($2::boolean = false OR status = 'published')`, [id, publishedOnly])
  return result.rows[0] ? present(mapDocument(result.rows[0])) : null
}

const documentValues = (doc: Document) => [
  doc.id, doc.title, doc.sourceName, doc.sourceUrl, doc.sourceType, doc.region, doc.category,
  doc.publishDate, doc.collectedAt, doc.summary, doc.excerpt, doc.analysis, doc.status, doc.legacyId, doc.topic, doc.evidenceLocator, doc.evidenceSourceUrl,
]

export async function insertDocument(client: PoolClient, doc: Document, skipExisting = false) {
  const result = await client.query<DocumentRow>(`INSERT INTO documents (
      id, title, source_name, source_url, source_type, region, category, publish_date,
      collected_at, summary, excerpt, analysis, status, legacy_id, topic, evidence_locator, evidence_source_url
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    ${skipExisting ? 'ON CONFLICT DO NOTHING' : ''} RETURNING ${columns}`, documentValues(doc))
  return result.rows[0] ? mapDocument(result.rows[0]) : null
}

type AuditAction = 'create' | 'update' | 'publish' | 'archive'

async function audit(client: PoolClient, action: AuditAction, before: Document | null, after: Document) {
  await client.query(`INSERT INTO document_audit(document_id, action, before_document, after_document)
    VALUES ($1,$2,$3,$4)`, [after.id, action, before, after])
}

export async function createDocument(pool: Pool, input: DocumentInput) {
  return transaction(pool, async (client) => {
    const document = completeDocument(input, randomUUID(), 'draft', null)
    await insertDocument(client, document)
    await audit(client, 'create', null, document)
    return present(document)
  })
}

export async function importDocuments(pool: Pool, inputs: DocumentInput[]) {
  return transaction(pool, async (client) => {
    let created = 0
    for (const input of inputs) {
      const draft = completeDocument(input, randomUUID(), 'draft', null)
      const inserted = await insertDocument(client, draft, true)
      if (!inserted) continue
      await audit(client, 'create', null, inserted)
      created += 1
    }
    return { created, skipped: inputs.length - created }
  })
}

export async function reviseDocument(
  pool: Pool,
  id: string,
  change: { action: 'update'; fields: Partial<DocumentInput> } | { action: 'publish' | 'archive' },
) {
  return transaction(pool, async (client) => {
    const current = await client.query<DocumentRow>(`SELECT ${columns} FROM documents WHERE id = $1 FOR UPDATE`, [id])
    if (!current.rows[0]) return null
    const before = mapDocument(current.rows[0])

    const status = change.action === 'publish' ? 'published' : change.action === 'archive' ? 'archived' : before.status
    if (change.action !== 'update' && before.status === status) return present(before)
    const after: Document = change.action === 'update' ? { ...before, ...change.fields } : { ...before, status }

    if (change.action === 'publish') {
      const missing = [
        !after.topic && !knownTopic(after.category) && '一级主题',
        !after.analysis.trim() && '课程分析',
        (!after.evidenceLocator.trim() || (!after.excerpt.trim() && !after.summary.trim())) && '原文摘录或核实摘要及出处定位',
      ].filter(Boolean)
      if (missing.length) throw new IncompletePublication(`发布前请补齐：${missing.join('、')}。`)
    }

    await client.query(`UPDATE documents SET title=$2, source_name=$3, source_url=$4, source_type=$5,
      region=$6, category=$7, publish_date=$8, collected_at=$9, summary=$10, excerpt=$11,
      analysis=$12, status=$13, legacy_id=$14, topic=$15, evidence_locator=$16, evidence_source_url=$17, updated_at=now() WHERE id=$1`, documentValues(after))
    await audit(client, change.action, before, after)
    return present(after)
  })
}


export async function listAudit(pool: Pool, page = 1, pageSize = 10) {
  const result = await pool.query<{ items: { id: string; action: AuditAction; documentId: string; documentTitle: string; createdAt: Date }[]; total: number }>(`
    WITH page_items AS (
      SELECT id, action, document_id AS "documentId", after_document->>'title' AS "documentTitle", created_at AS "createdAt"
      FROM document_audit ORDER BY id DESC LIMIT $1 OFFSET $2
    )
    SELECT COALESCE((SELECT json_agg(json_build_object(
      'id', id::text, 'action', action, 'documentId', "documentId", 'documentTitle', COALESCE("documentTitle", "documentId"), 'createdAt', "createdAt"
    ) ORDER BY id DESC) FROM page_items), '[]') AS items,
    (SELECT count(*)::int FROM document_audit) AS total`, [pageSize, (page - 1) * pageSize])
  return { ...result.rows[0], page, pageSize }
}

type EvidenceFields = Pick<Document, 'summary' | 'excerpt' | 'analysis' | 'evidenceLocator'>
type ReviewedEvidence = { id: string; sourceUrl: string; evidenceSourceUrl?: string | null } & EvidenceFields

function evidencePatch(doc: Document, evidence: ReviewedEvidence) {
  const patch: Partial<EvidenceFields & Pick<Document, 'evidenceSourceUrl'>> = {}
  if (!doc.analysis.trim() && evidence.analysis) patch.analysis = evidence.analysis
  if (!doc.summary.trim() && evidence.summary) patch.summary = evidence.summary

  // A locator must stay attached to the text it was checked against.
  if (evidence.excerpt && evidence.evidenceLocator && (!doc.excerpt.trim() || doc.excerpt === evidence.excerpt)
      && (!doc.evidenceLocator.trim() || doc.evidenceLocator === evidence.evidenceLocator)
      && (!doc.evidenceSourceUrl || doc.evidenceSourceUrl === evidence.evidenceSourceUrl)) {
    if (!doc.excerpt.trim()) patch.excerpt = evidence.excerpt
    if (!doc.evidenceLocator.trim()) patch.evidenceLocator = evidence.evidenceLocator
    if (!doc.evidenceSourceUrl && evidence.evidenceSourceUrl) patch.evidenceSourceUrl = evidence.evidenceSourceUrl
  } else if (!evidence.excerpt && !doc.excerpt.trim() && !doc.evidenceLocator.trim()
      && evidence.evidenceLocator && evidence.summary && (patch.summary || doc.summary === evidence.summary)) {
    patch.evidenceLocator = evidence.evidenceLocator
    if (!doc.evidenceSourceUrl && evidence.evidenceSourceUrl) patch.evidenceSourceUrl = evidence.evidenceSourceUrl
  }
  return patch
}

export async function backfillEvidence(pool: Pool, reviewed: ReviewedEvidence[], apply: boolean, all = false) {
  const byId = new Map(reviewed.map(item => [item.id, item]))
  return transaction(pool, async client => {
    const result = await client.query<DocumentRow>(`SELECT ${columns} FROM documents
      ${all ? '' : "WHERE status = 'published'"} ORDER BY id ${apply ? 'FOR UPDATE' : ''}`)
    const review = []
    for (const row of result.rows) {
      const before = mapDocument(row)
      const evidence = byId.get(before.id)
      const matched = evidence?.sourceUrl === before.sourceUrl
      const patch = matched ? evidencePatch(before, evidence) : {}
      const fields = Object.keys(patch)
      const after = { ...before, ...patch }
      if (apply && fields.length) {
        await client.query(`UPDATE documents SET summary=$2, excerpt=$3, analysis=$4,
          evidence_locator=$5, evidence_source_url=$6, updated_at=now() WHERE id=$1`,
        [after.id, after.summary, after.excerpt, after.analysis, after.evidenceLocator, after.evidenceSourceUrl])
        await audit(client, 'update', before, after)
      }
      const gaps = [
        !after.analysis.trim() && 'analysis',
        !after.excerpt.trim() && 'excerpt',
        !after.evidenceLocator.trim() && 'evidenceLocator',
      ].filter(Boolean)
      review.push({ id: before.id, status: before.status, verifiedSourceMatch: matched, fields, gaps })
    }
    return review
  })
}
