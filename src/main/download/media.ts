import type { EmbedCover } from './tags/types.ts'

/** 300 KB */
export const MAX_COVER_BYTES = 307200

export type CoverFetcher = (url: string) => Promise<{ statusCode?: number; raw?: Uint8Array; headers?: Record<string, unknown> }>

export type CoverResult =
  | { kind: 'ok'; cover: EmbedCover }
  | { kind: 'skipped'; reason: 'missing' | 'tooLarge' | 'failed' }

const guessMime = (headers: Record<string, unknown> | undefined): string => {
  const raw = headers?.['content-type'] ?? headers?.['Content-Type']
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value === 'string' && value.startsWith('image/')) return value.split(';')[0].trim()
  return 'image/jpeg'
}

/**
 * 取封面并校验体积。任何失败都转为 skipped，绝不抛出，
 * 以保证下载主流程不被阻断。
 */
export const fetchCover = async (
  picUrl: string | null,
  fetcher: CoverFetcher
): Promise<CoverResult> => {
  if (!picUrl) return { kind: 'skipped', reason: 'missing' }
  try {
    const resp = await fetcher(picUrl)
    const raw = resp.raw
    if (!raw || raw.length === 0) return { kind: 'skipped', reason: 'missing' }
    if (raw.length > MAX_COVER_BYTES) return { kind: 'skipped', reason: 'tooLarge' }
    return { kind: 'ok', cover: { data: raw, mime: guessMime(resp.headers) } }
  } catch {
    return { kind: 'skipped', reason: 'failed' }
  }
}
