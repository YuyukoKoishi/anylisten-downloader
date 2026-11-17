import type { EmbedCover } from './types'
import { concat, utf8Encode } from './util.ts'

// ID3v2.4 帧写入。只新增帧，不改动音频帧字节。
const ENCODING_UTF8 = 3
const PICTURE_TYPE_FRONT_COVER = 3
const LANG = 'eng'
const TRANSLATED_DESCRIPTOR = 'translation'

const syncSafe = (size: number): Uint8Array => {
  return new Uint8Array([
    (size >>> 21) & 0x7f,
    (size >>> 14) & 0x7f,
    (size >>> 7) & 0x7f,
    size & 0x7f,
  ])
}

const readSyncSafe = (buf: Uint8Array, offset: number): number => {
  return (
    ((buf[offset] & 0x7f) << 21) |
    ((buf[offset + 1] & 0x7f) << 14) |
    ((buf[offset + 2] & 0x7f) << 7) |
    (buf[offset + 3] & 0x7f)
  )
}

const frame = (id: string, body: Uint8Array): Uint8Array => {
  const header = new Uint8Array(10)
  for (let i = 0; i < 4; i++) header[i] = id.charCodeAt(i)
  // v2.4 帧长度使用 syncsafe
  header.set(syncSafe(body.length), 4)
  // flags 保持 0
  return concat([header, body])
}

const buildApicFrame = (cover: EmbedCover): Uint8Array => {
  const description = new Uint8Array(0)
  const separator = new Uint8Array([0])
  const mimeBytes = utf8Encode(cover.mime)
  const body = concat([
    new Uint8Array([ENCODING_UTF8]),
    mimeBytes,
    separator,
    new Uint8Array([PICTURE_TYPE_FRONT_COVER]),
    description,
    separator,
    cover.data,
  ])
  return frame('APIC', body)
}

const buildUsltFrame = (text: string, descriptor: string): Uint8Array => {
  const body = concat([
    new Uint8Array([ENCODING_UTF8]),
    utf8Encode(LANG),
    utf8Encode(descriptor),
    new Uint8Array([0]),
    utf8Encode(text),
  ])
  return frame('USLT', body)
}

/**
 * 在 MP3 数据中写入 ID3v2 帧。
 * 已有 ID3v2 标签时，把新帧插到旧标签之后并合并为一个标签；
 * 无标签时新建。
 */
export const writeId3v2 = (
  data: Uint8Array,
  payload: { cover?: EmbedCover | null; lyric?: string | null; translatedLyric?: string | null }
): { data: Uint8Array; applied: string[] } => {
  const newFrames: Uint8Array[] = []
  const applied: string[] = []

  if (payload.cover) {
    newFrames.push(buildApicFrame(payload.cover))
    applied.push('cover')
  }
  if (payload.lyric) {
    newFrames.push(buildUsltFrame(payload.lyric, ''))
    applied.push('lyric')
  }
  if (payload.translatedLyric) {
    newFrames.push(buildUsltFrame(payload.translatedLyric, TRANSLATED_DESCRIPTOR))
    applied.push('translatedLyric')
  }
  if (newFrames.length === 0) return { data, applied }

  const hasTag = data.length >= 10 && data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33
  let existingTagBody = new Uint8Array(0)
  let audioStart = 0

  if (hasTag) {
    const tagSize = readSyncSafe(data, 6)
    audioStart = 10 + tagSize
    existingTagBody = data.slice(10, audioStart)
  }

  const newBody = concat([existingTagBody, ...newFrames])
  const header = new Uint8Array(10)
  header[0] = 0x49
  header[1] = 0x44
  header[2] = 0x33
  header[3] = 0x04 // v2.4
  header[4] = 0x00
  header[5] = 0x00
  header.set(syncSafe(newBody.length), 6)

  const audio = data.slice(audioStart)
  return { data: concat([header, newBody, audio]), applied }
}

export { syncSafe, readSyncSafe }
