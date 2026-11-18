import type { SearchCandidate } from './types'

export type Fetcher = (url: string) => Promise<{ statusCode?: number; body: unknown }>

export interface SearchOptions {
  apiBase: string
  source: string
  keyword: string
  count?: number
  /** 结果页码，从 1 开始 */
  pages?: number
  fetcher: Fetcher
  sleep?: (ms: number) => Promise<void>
}

// PRD FR-3：失败后最多重试 3 次，指数退避 1s / 2s / 4s。
// 首次尝试 + 3 次重试 = 4 次请求。
const MAX_ATTEMPTS = 4
const BACKOFF_BASE_MS = 1000
const DEFAULT_COUNT = 20
const OK_STATUS = 200

const defaultSleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

const toText = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

const parseBody = (body: unknown): SearchCandidate[] => {
  let data: unknown = body
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data) as unknown
    } catch {
      return []
    }
  }
  if (!Array.isArray(data)) return []
  return (data as unknown[]).map((item) => {
    const raw = (item ?? {}) as Record<string, unknown>
    const artistRaw = raw.artist
    const artist = Array.isArray(artistRaw)
      ? (artistRaw as unknown[]).map(toText).filter((name) => name.length > 0)
      : toText(artistRaw)
        ? [toText(artistRaw)]
        : []
    return {
      id: toText(raw.id),
      name: toText(raw.name),
      artist,
      album: toText(raw.album),
      source: toText(raw.source),
      picId: toText(raw.pic_id) || undefined,
      lyricId: toText(raw.lyric_id) || undefined,
    }
  })
}

const buildUrl = (opts: SearchOptions): string => {
  const parts = [
    ['types', 'search'],
    ['source', opts.source],
    ['name', opts.keyword],
    ['count', String(opts.count ?? DEFAULT_COUNT)],
    ['pages', String(opts.pages ?? 1)],
  ]
  const query = parts.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')
  return `${opts.apiBase}?${query}`
}

export const searchMusic = async (opts: SearchOptions): Promise<SearchCandidate[]> => {
  const sleep = opts.sleep ?? defaultSleep
  const url = buildUrl(opts)
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await opts.fetcher(url)
      if (resp.statusCode != null && resp.statusCode !== OK_STATUS) {
        throw new Error(`search request failed: ${resp.statusCode}`)
      }
      return parseBody(resp.body)
    } catch (error) {
      lastError = error
      // 每次失败后都退避，最后一次失败不再等待
      if (attempt < MAX_ATTEMPTS - 1) await sleep(BACKOFF_BASE_MS * 2 ** attempt)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('search request failed')
}
