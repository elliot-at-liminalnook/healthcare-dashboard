import { useSearchParams } from 'react-router'
import { PatientSort, PatientStatus, SortOrder } from '../../api/generated/model'

export const PAGE_SIZES = [10, 20, 50]
const DEFAULTS = {
  page: 1,
  pageSize: 20,
  sortBy: PatientSort.name,
  sortOrder: SortOrder.asc,
}

export interface PatientListState {
  page: number
  pageSize: number
  search: string
  status: PatientStatus | null
  sortBy: PatientSort
  sortOrder: SortOrder
}

function oneOf<T extends string>(allowed: Record<string, T>, value: string | null): T | null {
  return Object.values(allowed).includes(value as T) ? (value as T) : null
}

/**
 * The patient list's page, search, filter and sort, held in the URL.
 * Views can be bookmarked and shared, and Back returns to the same view.
 * Anything missing or invalid in the URL falls back to its default.
 */
export function usePatientListState() {
  const [params, setParams] = useSearchParams()

  const pageSize = Number(params.get('size'))
  const state: PatientListState = {
    page: Math.max(1, Math.floor(Number(params.get('page'))) || DEFAULTS.page),
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULTS.pageSize,
    search: params.get('search') ?? '',
    status: oneOf(PatientStatus, params.get('status')),
    sortBy: oneOf(PatientSort, params.get('sort')) ?? DEFAULTS.sortBy,
    sortOrder: oneOf(SortOrder, params.get('order')) ?? DEFAULTS.sortOrder,
  }

  /** Apply changes. Anything other than a page change returns to the first page. */
  function update(changes: Partial<PatientListState>) {
    const next = { ...state, page: DEFAULTS.page, ...changes }
    const entries: [string, string | number | null, unknown][] = [
      ['page', next.page, DEFAULTS.page],
      ['size', next.pageSize, DEFAULTS.pageSize],
      ['search', next.search.trim(), ''],
      ['status', next.status, null],
      ['sort', next.sortBy, DEFAULTS.sortBy],
      ['order', next.sortOrder, DEFAULTS.sortOrder],
    ]
    // Only non-default values go in the URL, to keep it short.
    const query = new URLSearchParams()
    for (const [key, value, fallback] of entries) {
      if (value !== null && value !== fallback) query.set(key, String(value))
    }
    setParams(query, { replace: true })
  }

  return { state, update }
}
