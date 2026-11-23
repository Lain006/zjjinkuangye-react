import { displayDate, type DocumentList, type Tally } from './api'

export const filterKeys = ['q', 'region', 'category', 'sourceType', 'dateFrom', 'dateTo'] as const
export type FilterKey = (typeof filterKeys)[number]
export type Facets = DocumentList['facets']

export const filterLabels: Record<FilterKey, string> = {
  q: '关键词',
  region: '地区',
  category: '主题',
  sourceType: '来源类型',
  dateFrom: '发布日期起',
  dateTo: '发布日期止',
}

export function readFilters(params: URLSearchParams) {
  const filters = new URLSearchParams()
  for (const key of filterKeys) {
    const value = params.get(key)?.trim()
    if (value) filters.set(key, value)
  }
  return filters
}

export function changeFilter(params: URLSearchParams, key: FilterKey, value: string) {
  const result = readFilters(params)
  if (value.trim()) result.set(key, value.trim())
  else result.delete(key)
  return result
}

export function filterValue(key: FilterKey, value: string) {
  return key === 'dateFrom' || key === 'dateTo' ? displayDate(value) : value
}

export function facetOptions(values: Tally[] | undefined, current: string) {
  const options = values ?? []
  if (!current || options.some(({ label }) => label === current)) return options
  return [{ label: current, count: 0 }, ...options]
}
