import { getMusicUrl } from '../isolate'
import { configuration, console, musicUtils, registerResourceAction, request } from '../shared/hostAPI'
import { searchMusic } from '../download/search'
import { toLxSource, toApiSource } from '../download/platforms'

const DEFAULT_API_BASE = 'https://music-api.gdstudio.xyz/api.php'

// 搜索结果候选转宿主 MusicInfoOnline 形状。
// 宿主会按 meta.source 把后续 musicUrl 回调路由到本扩展。
const toHostMusicInfo = (candidate: { id: string; name: string; artist: string[]; album: string; source: string }) => ({
  id: candidate.id,
  name: candidate.name,
  singer: candidate.artist.join('/'),
  interval: null,
  isLocal: false,
  meta: {
    source: toLxSource(candidate.source),
    musicId: candidate.id,
    albumName: candidate.album,
    qualitys: {},
  },
})

export const initOnlineResource = async () => {
  registerResourceAction({
    async musicUrl(params) {
      const quality = params.quality || '128k'
      let url = await getMusicUrl(params.musicInfo, quality)
      console.log(`${params.musicInfo.name}, ${params.musicInfo.meta.source}, ${quality}: ${url}`)
      url = await musicUtils.createProxyUrl(url, {}, (await configuration.getConfigs<[boolean]>(['enabledCache']))[0])
      console.log(`proxy: ${url}`)
      return { quality, url }
    },

    // 宿主搜索（resources/musicSearch.ts）经 resourceAction('musicSearch') 转发到这里。
    // params: { extensionId, source, name, artist?, albumName?, page, limit? }
    async musicSearch(params) {
      const apiBase = (await configuration.getConfigs<[string | null]>(['apiBase']))[0] || DEFAULT_API_BASE
      // 宿主传的 source 是 LX source（wy/tx/...），映射回 API source（netease/...）
      const apiSource = toApiSource(params.source)
      const keyword = params.artist ? `${params.name} ${params.artist}` : params.name
      const limit = params.limit ?? 30

      const list = await searchMusic({
        apiBase: apiBase.trim(),
        source: apiSource,
        keyword,
        count: limit,
        pages: params.page ?? 1,
        fetcher: async (url) => request(url),
      })

      return {
        list: list.map(toHostMusicInfo),
        total: list.length,
        page: params.page ?? 1,
        limit,
      }
    },
  })
}
