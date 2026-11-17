import type { EmbedCover } from './types'
import { concat, utf8Encode } from './util.ts'

const BLOCK_STREAMINFO = 0
const BLOCK_VORBIS_COMMENT = 4
const BLOCK_PICTURE = 6

const buildBlock = (type: number, payload: Uint8Array, isLast: boolean): Uint8Array => {
  const header = new Uint8Array(4)
  header[0] = (isLast ? 0x80 : 0x00) | (type & 0x7f)
  const len = payload.length
  header[1] = (len >>> 16) & 0xff
  header[2] = (len >>> 8) & 0xff
  header[3] = len & 0xff
  return concat([header, payload])
}

const leUint32 = (value: number): Uint8Array => {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ])
}

const buildVorbisComment = (entries: Array<[string, string]>): Uint8Array => {
  // vendor length (LE) + vendor + comment count (LE) + each comment
  const vendor = utf8Encode('any-listen-lx-downloader')
  const parts: Uint8Array[] = [leUint32(vendor.length), vendor, leUint32(entries.length)]
  for (const [key, value] of entries) {
    const comment = utf8Encode(`${key}=${value}`)
    parts.push(leUint32(comment.length), comment)
  }
  return concat(parts)
}

const buildPicture = (cover: EmbedCover): Uint8Array => {
  const mime = utf8Encode(cover.mime)
  const description = utf8Encode('')
  return concat([
    new Uint8Array([0, 0, 0, 3]), // picture type 3 = front cover (BE)
    leUint32(mime.length),
    mime,
    leUint32(description.length),
    description,
    leUint32(0), leUint32(0), leUint32(0), leUint32(0), // width/height/depth/colors
    leUint32(cover.data.length),
    cover.data,
  ])
}

/**
 * 在 FLAC 中追加元数据块。
 * 保留原有块（含 STREAMINFO），清除原最后块的 isLast，再追加新块。
 * 音频帧区必须原样保留。
 */
export const writeFlac = (
  data: Uint8Array,
  payload: { cover?: EmbedCover | null; lyric?: string | null; translatedLyric?: string | null }
): { data: Uint8Array; applied: string[] } => {
  const applied: string[] = []
  const newBlocks: Uint8Array[] = []

  const commentEntries: Array<[string, string]> = []
  if (payload.lyric) {
    commentEntries.push(['LYRICS', payload.lyric])
    applied.push('lyric')
  }
  if (payload.translatedLyric) {
    commentEntries.push(['LYRICS_TRANSLATED', payload.translatedLyric])
    applied.push('translatedLyric')
  }
  if (commentEntries.length > 0) {
    newBlocks.push(buildBlock(BLOCK_VORBIS_COMMENT, buildVorbisComment(commentEntries), false))
  }
  if (payload.cover) {
    newBlocks.push(buildBlock(BLOCK_PICTURE, buildPicture(payload.cover), false))
    applied.push('cover')
  }
  if (newBlocks.length === 0) return { data, applied }

  // 解析现有块链
  let offset = 4 // skip 'fLaC'
  const existingBlocks: Array<{ type: number; isLast: boolean; payload: Uint8Array }> = []
  while (offset + 4 <= data.length) {
    const first = data[offset]
    const isLast = (first & 0x80) !== 0
    const type = first & 0x7f
    const len = (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]
    const start = offset + 4
    const end = start + len
    if (end > data.length) break
    existingBlocks.push({ type, isLast, payload: data.slice(start, end) })
    offset = end
    if (isLast) break
  }

  if (existingBlocks.length === 0) return { data, applied: [] }

  const audioFrames = data.slice(offset)
  const rebuilt: Uint8Array[] = [data.slice(0, 4)]

  // 原有块全部改为非 last
  for (const block of existingBlocks) {
    rebuilt.push(buildBlock(block.type, block.payload, false))
  }
  // 追加新块，最后一个新块标记为 last
  for (let i = 0; i < newBlocks.length; i++) {
    const block = newBlocks[i]
    const payloadBody = block.slice(4)
    rebuilt.push(buildBlock(payloadBody.length ? (block[0] & 0x7f) : BLOCK_STREAMINFO, payloadBody, i === newBlocks.length - 1))
  }
  rebuilt.push(audioFrames)

  return { data: concat(rebuilt), applied }
}
