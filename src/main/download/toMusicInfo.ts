import type { SearchCandidate } from './types'

const SOURCE_MAP: Record<string, string> = {
  netease: 'wy',
  tencent: 'tx',
  kugou: 'kg',
  kuwo: 'kw',
  migu: 'mg',
}

export const toMusicInfo = (candidate: SearchCandidate): AnyListen_API.MusicInfoOnline => {
  const source = SOURCE_MAP[candidate.source]
  if (source == null) throw new Error(`unsupported source: ${candidate.source}`)

  return {
    id: candidate.id,
    name: candidate.name,
    singer: candidate.artist.join('/'),
    interval: '00:00',
    meta: {
      source,
      musicId: candidate.id,
      albumName: candidate.album,
      albumId: '',
      qualitys: {},
    },
  } as unknown as AnyListen_API.MusicInfoOnline
}
