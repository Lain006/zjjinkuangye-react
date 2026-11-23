import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import { transaction } from './db.ts'
import { completeDocument } from './model.ts'
import type { Document, DocumentInput, DocumentStatus, Facet, Filters, ListFilters } from './model.ts'

type DocumentRow = {
  id: string
  title: string
  source_name: string
  source_url: string
  source_type: string
  region: string
  category: string
  publish_date: string | null
  collected_at: Date | string
  summary: string
  excerpt: string
  analysis: string
  status: DocumentStatus
  legacy_id: number | null
}

type Facets = { regions: Facet[]; categories: Facet[]; sourceTypes: Facet[] }
type Analytics = Omit<Facets, 'sourceTypes'> & {
  total: number
  latestCollectedAt: Date | string | null
  months: Facet[]
}

const pageSize = 20
const columns = `id, title, source_name, source_url, source_type, region, category,
  to_char(publish_date, 'YYYY-MM-DD') AS publish_date, collected_at, summary, excerpt, analysis, status, legacy_id`

function mapDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    title: row.title,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
    region: row.region,
    category: row.category,
    publishDate: row.publish_date,
    collectedAt: new Date(row.collected_at).toISOString(),
    summary: row.summary,
    excerpt: row.excerpt,
    analysis: row.analysis,
    status: row.status,
    legacyId: row.legacy_id,
  }
}

function baseFilter(filters: Filters, status?: DocumentStatus) {
  const values: (string | string[] | number)[] = []
  const param = (value: string | string[] | number) => `$${values.push(value)}`
  const where: string[] = []
  if (status) where.push(`status = ${param(status)}`)
  if (filters.dateFrom) where.push(`publish_date >= ${param(filters.dateFrom)}::date`)
  if (filters.dateTo) where.push(`publish_date <= ${param(filters.dateTo)}::date`)
  if (filters.q) {
    const terms = param(filters.q.toLowerCase().split(/\s+/))
    where.push(`NOT EXISTS (SELECT 1 FROM unnest(${terms}::text[]) term
      WHERE strpos(lower(concat_ws(' ', title, summary, excerpt, analysis, source_name, region, category)), term) = 0)`)
  }
  const dimensions = {
    region: filters.region ? `region = ${param(filters.region)}` : 'TRUE',
    category: filters.category ? `category = ${param(filters.category)}` : 'TRUE',
    source_type: filters.sourceType ? `source_type = ${param(filters.sourceType)}` : 'TRUE',
  }
  return { values, param, where: where.join(' AND ') || 'TRUE', dimensions }
}

export async function listDocuments(pool: Pool, filters: ListFilters, status?: DocumentStatus) {
  const { values, param, where, dimensions } = baseFilter(filters, status)
  const page = filters.page ?? 1
  const limit = param(pageSize)
  const offset = param((page - 1) * pageSize)
  const { region, category, source_type: sourceType } = dimensions

  const result = await pool.query<{ items: DocumentRow[]; total: number; facets: Facets }>(`WITH base AS (
    SELECT * FROM documents WHERE ${where}
  ), filtered AS (
    SELECT * FROM base WHERE ${region} AND ${category} AND ${sourceType}
  ), page_items AS (
    SELECT ${columns} FROM filtered ORDER BY collected_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}
  ) SELECT
    COALESCE((SELECT json_agg(page_items ORDER BY collected_at DESC, id DESC) FROM page_items), '[]') AS items,
    (SELECT count(*)::int FROM filtered) AS total,
    json_build_object(
      'regions', COALESCE((SELECT json_agg(f ORDER BY count DESC, label) FROM
        (SELECT region AS label, count(*)::int FROM base WHERE ${category} AND ${sourceType} GROUP BY region) f), '[]'),
      'categories', COALESCE((SELECT json_agg(f ORDER BY count DESC, label) FROM
        (SELECT category AS label, count(*)::int FROM base WHERE ${region} AND ${sourceType} GROUP BY category) f), '[]'),
      'sourceTypes', COALESCE((SELECT json_agg(f ORDER BY count DESC, label) FROM
        (SELECT source_type AS label, count(*)::int FROM base WHERE ${region} AND ${category} GROUP BY source_type) f), '[]')
    ) AS facets`, values)

  const row = result.rows[0]
  return { items: row.items.map(mapDocument), total: row.total, page, pageSize, facets: row.facets }
}

export async function getAnalytics(pool: Pool, filters: Filters): Promise<Analytics> {
  const { values, where, dimensions } = baseFilter(filters, 'published')
  const { region, category, source_type: sourceType } = dimensions
  const result = await pool.query<Analytics>(`WITH filtered AS (
    SELECT * FROM documents WHERE ${where} AND ${region} AND ${category} AND ${sourceType}
  ) SELECT
    count(*)::int AS total, max(collected_at) AS "latestCollectedAt",
    COALESCE((SELECT json_agg(b ORDER BY label) FROM (SELECT to_char(publish_date, 'YYYY-MM') AS label,
      count(*)::int FROM filtered WHERE publish_date IS NOT NULL GROUP BY 1) b), '[]') AS months,
    COALESCE((SELECT json_agg(b ORDER BY count DESC, label) FROM
      (SELECT region AS label, count(*)::int FROM filtered GROUP BY region) b), '[]') AS regions,
    COALESCE((SELECT json_agg(b ORDER BY count DESC, label) FROM
      (SELECT category AS label, count(*)::int FROM filtered GROUP BY category) b), '[]') AS categories
    FROM filtered`, values)
  const row = result.rows[0]
  return { ...row, latestCollectedAt: row.latestCollectedAt && new Date(row.latestCollectedAt).toISOString() }
}

export async function getDocument(pool: Pool, id: string, publishedOnly: boolean): Promise<Document | null> {
  const result = await pool.query<DocumentRow>(`SELECT ${columns} FROM documents
    WHERE id = $1 AND ($2::boolean = false OR status = 'published')`, [id, publishedOnly])
  return result.rows[0] ? mapDocument(result.rows[0]) : null
}

const documentValues = (doc: Document) => [
  doc.id, doc.title, doc.sourceName, doc.sourceUrl, doc.sourceType, doc.region, doc.category,
  doc.publishDate, doc.collectedAt, doc.summary, doc.excerpt, doc.analysis, doc.status, doc.legacyId,
]

export async function insertDocument(client: PoolClient, doc: Document, skipExisting = false) {
  const result = await client.query<DocumentRow>(`INSERT INTO documents (
      id, title, source_name, source_url, source_type, region, category, publish_date,
      collected_at, summary, excerpt, analysis, status, legacy_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
    return document
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
    if (change.action !== 'update' && before.status === status) return before
    const after: Document = change.action === 'update' ? { ...before, ...change.fields } : { ...before, status }

    await client.query(`UPDATE documents SET title=$2, source_name=$3, source_url=$4, source_type=$5,
      region=$6, category=$7, publish_date=$8, collected_at=$9, summary=$10, excerpt=$11,
      analysis=$12, status=$13, legacy_id=$14, updated_at=now() WHERE id=$1`, documentValues(after))
    await audit(client, change.action, before, after)
    return after
  })
}

export async function listAudit(pool: Pool) {
  const result = await pool.query<{ id: string; action: AuditAction; documentId: string; createdAt: Date }>(`
    SELECT id::text, action, document_id AS "documentId", created_at AS "createdAt"
    FROM document_audit ORDER BY document_audit.id DESC LIMIT 100`)
  return { items: result.rows }
}
