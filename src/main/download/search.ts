import type { SearchCandidate } from './types'

export type Fetcher = (url: string) => Promise<{ statusCode?: number; body: unknown }>

export interface SearchOptions {
  apiBase: string
  source: string
  keyword: string
  count?: number
  fetcher: Fetcher
  sleep?: (ms: number) => Promise<void>
}

const MAX_ATTEMPTS = 3
const BACKOFF_BASE_MS = 1000
const DEFAULT_COUNT = 20

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const parseBody = (body: unknown): SearchCandidate[] => {
  let data: unknown = body
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return []
    }
  }
  if (!Array.isArray(data)) return []
  return data.map((item): SearchCandidate => {
    const raw = (item ?? {}) as Record<string, unknown>
    const artistRaw = raw.artist
    const artist = Array.isArray(artistRaw)
      ? artistRaw.map((a) => String(a))
      : artistRaw == null || artistRaw === ''
        ? []
        : [String(artistRaw)]
    return {
      id: String(raw.id ?? ''),
      name: String(raw.name ?? ''),
      artist,
      album: String(raw.album ?? ''),
      source: String(raw.source ?? ''),
    }
  })
}

const buildUrl = (opts: SearchOptions): string => {
  const params = new URLSearchParams({
    types: 'search',
    source: opts.source,
    name: opts.keyword,
    count: String(opts.count ?? DEFAULT_COUNT),
    pages: '1',
  })
  return `${opts.apiBase}?${params.toString()}`
}

export const searchMusic = async (opts: SearchOptions): Promise<SearchCandidate[]> => {
  const sleep = opts.sleep ?? defaultSleep
  const url = buildUrl(opts)
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await opts.fetcher(url)
      if (resp.statusCode != null && resp.statusCode !== 200) {
        throw new Error(`search request failed: ${resp.statusCode}`)
      }
      return parseBody(resp.body)
    } catch (error) {
      lastError = error
      if (attempt < MAX_ATTEMPTS - 1) await sleep(BACKOFF_BASE_MS * 2 ** attempt)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('search request failed')
}
