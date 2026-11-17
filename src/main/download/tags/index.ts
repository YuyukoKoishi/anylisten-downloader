import { writeFlac } from './flac.ts'
import { writeId3v2 } from './id3v2.ts'
import type { AudioFormat, EmbedPayload, EmbedResult } from './types'

export type { AudioFormat, EmbedCover, EmbedPayload, EmbedResult } from './types'

export const detectFormat = (data: Uint8Array): AudioFormat => {
  if (data.length >= 3 && data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return 'mp3'
  if (data.length >= 4 && data[0] === 0x66 && data[1] === 0x4c && data[2] === 0x61 && data[3] === 0x43) return 'flac'
  return 'unknown'
}

/**
 * 向音频写入元数据。任何异常都降级为返回原始数据，
 * 保证嵌入失败不会导致用户拿不到音频。
 */
export const embedTags = (data: Uint8Array, payload: EmbedPayload): EmbedResult => {
  const format = detectFormat(data)
  if (format === 'unknown') return { data, applied: [] }

  const hasWork = !!(payload.cover || payload.lyric || payload.translatedLyric)
  if (!hasWork) return { data, applied: [] }

  try {
    const result = format === 'mp3' ? writeId3v2(data, payload) : writeFlac(data, payload)
    if (result.applied.length === 0) return { data, applied: [] }
    return result
  } catch {
    return { data, applied: [] }
  }
}
