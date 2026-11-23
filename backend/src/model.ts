import { z } from 'zod'

export const statuses = ['draft', 'published', 'archived'] as const
export type DocumentStatus = (typeof statuses)[number]
export type Facet = { label: string; count: number }

const noNullBytes = (value: string) => !value.includes('\u0000')
const shortText = (length: number) => z.string().trim().min(1).max(length).refine(noNullBytes)
const optionalText = (length: number) => z.string().trim().max(length).refine(noNullBytes).optional()
const httpsUrl = z.url({ protocol: /^https$/ }).max(2048).refine((value) => {
  const url = new URL(value)
  return !url.username && !url.password && noNullBytes(value)
}, '来源链接不能包含凭据')
const collectedAt = z.union([z.iso.date(), z.iso.datetime({ offset: true })])
  .transform((value) => new Date(value).toISOString())

export const documentInput = z.strictObject({
  title: shortText(200),
  sourceName: shortText(120),
  sourceUrl: httpsUrl,
  sourceType: shortText(80),
  region: shortText(80),
  category: shortText(80),
  publishDate: z.iso.date().nullable().optional(),
  collectedAt: collectedAt.optional(),
  summary: optionalText(1600),
  excerpt: optionalText(6000),
  analysis: optionalText(6000),
})

export const documentPatch = documentInput.partial().refine(
  (value) => Object.keys(value).length > 0,
  '请选择要修改的字段',
)
export const documentId = z.string().min(1).max(80).regex(/^[A-Za-z0-9-]+$/)
export const seedDocument = documentInput.extend({
  id: documentId.optional(),
  status: z.enum(statuses).optional(),
  legacyId: z.number().int().min(1).max(2_147_483_647).nullable().optional(),
})

const filters = z.strictObject({
  q: z.string().trim().max(160).refine(noNullBytes).optional(),
  region: shortText(80).optional(),
  category: shortText(80).optional(),
  sourceType: shortText(80).optional(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
})
const page = z.string().regex(/^[1-9][0-9]{0,5}$/).transform(Number).optional()
const validRange = (value: { dateFrom?: string; dateTo?: string }) => (
  !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo
)
const rangeMessage = '起始日期应早于或等于结束日期'

export const analyticsQuery = filters.refine(validRange, rangeMessage)
export const listQuery = filters.extend({ page }).refine(validRange, rangeMessage)
export const adminListQuery = filters.extend({ page, status: z.enum(statuses).optional() })
  .refine(validRange, rangeMessage)

export type Filters = z.infer<typeof filters>
export type ListFilters = Filters & { page?: number }
export type DocumentInput = z.infer<typeof documentInput>
export type Document = Required<DocumentInput> & {
  id: string
  status: DocumentStatus
  legacyId: number | null
}

export function completeDocument(
  input: DocumentInput,
  id: string,
  status: DocumentStatus,
  legacyId: number | null,
): Document {
  return {
    ...input,
    id,
    status,
    legacyId,
    publishDate: input.publishDate ?? null,
    collectedAt: input.collectedAt ?? new Date().toISOString(),
    summary: input.summary ?? '',
    excerpt: input.excerpt ?? '',
    analysis: input.analysis ?? '',
  }
}
