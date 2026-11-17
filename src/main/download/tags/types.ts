export interface EmbedCover {
  data: Uint8Array
  mime: string
}

export interface EmbedPayload {
  /** 已保证 <= 300 KB */
  cover?: EmbedCover | null
  lyric?: string | null
  translatedLyric?: string | null
}

export type AudioFormat = 'mp3' | 'flac' | 'unknown'

export interface EmbedResult {
  data: Uint8Array
  /** 实际写入成功的项：cover / lyric / translatedLyric */
  applied: string[]
}
