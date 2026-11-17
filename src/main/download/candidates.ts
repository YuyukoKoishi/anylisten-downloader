import type { SearchCandidate } from './types'

export const PAGE_SIZE = 5

const normalize = (text: string): string => text.normalize('NFKC').toLowerCase()

export const rankCandidates = (list: SearchCandidate[], singer: string): SearchCandidate[] => {
  const target = normalize(singer.trim())
  if (!target) return [...list]

  const matched: SearchCandidate[] = []
  const rest: SearchCandidate[] = []
  for (const item of list) {
    const hit = item.artist.some((name) => normalize(name).includes(target))
    ;(hit ? matched : rest).push(item)
  }
  return [...matched, ...rest]
}

export interface PageResult<T> {
  items: T[]
  page: number
  totalPages: number
  total: number
}

export const paginate = <T>(list: T[], page: number): PageResult<T> => {
  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(Math.max(page, 0), totalPages - 1)
  const start = safePage * PAGE_SIZE
  return {
    items: list.slice(start, start + PAGE_SIZE),
    page: safePage,
    totalPages,
    total,
  }
}

export const describeCandidate = (candidate: SearchCandidate, index: number): string => {
  const singers = candidate.artist.filter((name) => name.length > 0).join('/')
  const base = `${index + 1}. ${candidate.name} - ${singers}`
  return candidate.album ? `${base}（${candidate.album}）` : base
}
