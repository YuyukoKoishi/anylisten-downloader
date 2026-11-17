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
}
