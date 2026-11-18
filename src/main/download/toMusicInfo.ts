import type { SearchCandidate } from './types'
import { toLxSource, API_TO_LX_SOURCE } from './platforms.ts'

export const toMusicInfo = (candidate: SearchCandidate): AnyListen_API.MusicInfoOnline => {
  // API source（netease/tencent/...）映射到 LX source（wy/tx/...）；未映射的 source 报错
  if (API_TO_LX_SOURCE[candidate.source] == null) {
    throw new Error(`unsupported source: ${candidate.source}`)
  }
  const source = toLxSource(candidate.source)

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
