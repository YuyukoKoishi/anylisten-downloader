export interface DownloadQuery {
  name: string
  singer: string
}

export interface SearchCandidate {
  id: string
  name: string
  artist: string[]
  album: string
  source: string
  /** 封面图 ID，与歌曲 ID 不同，取封面必须用它 */
  picId?: string
  /** 歌词 ID */
  lyricId?: string
}
