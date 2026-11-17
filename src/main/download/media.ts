import type { EmbedCover } from './tags/types.ts'

/** 300 KB */
export const MAX_COVER_BYTES = 307200

export type Fetcher = (url: string) => Promise<{ statusCode?: number; body?: unknown; raw?: Uint8Array; headers?: Record<string, unknown> }>

export type CoverResult =
  | { kind: 'ok'; cover: EmbedCover }
  | { kind: 'skipped'; reason: 'missing' | 'tooLarge' | 'failed' }

export interface LyricResult {
  lyric: string
  tlyric: string
}

// 图片魔数校验：pic 端点可能给出失效链接，返回的是 JSON 错误体
const isImageBytes = (data: Uint8Array): boolean => {
  if (data.length < 4) return false
  // JPEG
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return true
  // PNG
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return true
  // GIF
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return true
  // WEBP: RIFF....WEBP
  if (
    data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
    data.length >= 12 && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
  ) return true
  return false
}

const guessMime = (headers: Record<string, unknown> | undefined): string => {
  const raw = headers?.['content-type'] ?? headers?.['Content-Type']
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value === 'string' && value.startsWith('image/')) return value.split(';')[0].trim()
  return 'image/jpeg'
}

const asObject = (body: unknown): Record<string, unknown> | null => {
  if (body == null) return null
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as unknown
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  return typeof body === 'object' ? (body as Record<string, unknown>) : null
}

const buildApiUrl = (apiBase: string, params: Record<string, string>): string => {
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')
  return `${apiBase}?${query}`
}

/**
 * 通过聚合 API 直接取封面。
 * 先取 pic 端点拿图片 URL，再下载图片并校验 300 KB。
 * 任何失败都返回 skipped，绝不抛出。
 */
export const fetchCoverFromApi = async (
  apiBase: string,
  source: string,
  musicId: string,
  fetcher: Fetcher
): Promise<CoverResult> => {
  try {
    const picResp = await fetcher(
      buildApiUrl(apiBase, { types: 'pic', source, id: musicId, size: '300' })
    )
    const picBody = asObject(picResp.body)
    const picUrl = typeof picBody?.url === 'string' ? picBody.url : ''
    if (!picUrl) return { kind: 'skipped', reason: 'missing' }

    const imgResp = await fetcher(picUrl)
    const raw = imgResp.raw
    if (!raw || raw.length === 0) return { kind: 'skipped', reason: 'missing' }
    if (imgResp.statusCode != null && (imgResp.statusCode < 200 || imgResp.statusCode >= 300)) {
      return { kind: 'skipped', reason: 'missing' }
    }
    // 图片链接可能失效并返回 JSON 错误体，必须按魔数确认是图片
    if (!isImageBytes(raw)) return { kind: 'skipped', reason: 'missing' }
    if (raw.length > MAX_COVER_BYTES) return { kind: 'skipped', reason: 'tooLarge' }
    return { kind: 'ok', cover: { data: raw, mime: guessMime(imgResp.headers) } }
  } catch {
    return { kind: 'skipped', reason: 'failed' }
  }
}

/**
 * 通过聚合 API 直接取歌词。无歌词返回 null。
 */
export const fetchLyricFromApi = async (
  apiBase: string,
  source: string,
  musicId: string,
  fetcher: Fetcher
): Promise<LyricResult | null> => {
  try {
    const resp = await fetcher(buildApiUrl(apiBase, { types: 'lyric', source, id: musicId }))
    const body = asObject(resp.body)
    if (!body) return null
    const lyric = typeof body.lyric === 'string' ? body.lyric : ''
    const tlyric = typeof body.tlyric === 'string' ? body.tlyric : ''
    if (!lyric && !tlyric) return null
    return { lyric, tlyric }
  } catch {
    return null
  }
}
