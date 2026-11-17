import { setupEnv } from './setupEnv'
import { setEnabledSourceLogout } from './utils'

let handler: (musicInfo: any, type: string) => Promise<string>
let picHandler: (musicInfo: any) => Promise<string | null>
let lyricHandler: (musicInfo: any) => Promise<LXMusicLyricResult | null>

export const setMusicUrlHandler = (_handler: (musicInfo: any, type: string) => Promise<string>) => {
  handler = _handler
}
export const setMusicPicHandler = (_handler: (musicInfo: any) => Promise<string | null>) => {
  picHandler = _handler
}
export const setMusicLyricHandler = (_handler: (musicInfo: any) => Promise<LXMusicLyricResult | null>) => {
  lyricHandler = _handler
}

export const exposeObject: IPCIsolateObject = {
  async getMusicUrl(musicInfo, type) {
    // console.log('getMusicUrl', musicInfo, type)
    if (!handler) {
      throw new Error('Handler not set')
    }
    return handler(musicInfo, type)
  },
  async getMusicPic(musicInfo) {
    if (!picHandler) return null
    return picHandler(musicInfo)
  },
  async getMusicLyric(musicInfo) {
    if (!lyricHandler) return null
    return lyricHandler(musicInfo)
  },
  async setupEnv(info, rawScript) {
    setupEnv(info, rawScript)
  },
  async setEnabledSourceLogout(enabled) {
    setEnabledSourceLogout(enabled)
  },
}
