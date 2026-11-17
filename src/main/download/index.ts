import { app, command, configuration, console, request, t } from '../shared/hostAPI'
import { getMusicUrlWithQuality } from '../isolate'
import { paginate, describeCandidate, rankCandidates, PAGE_SIZE } from './candidates'
import { buildFileName, formatSize, inferExtension } from './fileName'
import { fetchCoverFromApi, fetchLyricFromApi } from './media'
import { embedTags } from './tags/index.ts'
import type { EmbedPayload } from './tags/types.ts'
import { parseQuery } from './parseQuery'
import { qualityLabel } from './quality'
import { searchMusic } from './search'
import { toMusicInfo } from './toMusicInfo'
import type { SearchCandidate } from './types'

const DEFAULT_API_BASE = 'https://music-api.gdstudio.xyz/api.php'
const DEFAULT_QUALITY = '320k'
const DEFAULT_TEMPLATE = '{name} - {singer}'
const DEFAULT_SOURCE = 'netease'
const DEFAULT_COUNT = 20
const DOWNLOAD_TIMEOUT_MS = 300_000

interface DownloadConfig {
  apiBase: string
  searchSource: string
  quality: string
  fileNameTemplate: string
  embedCover: boolean
  embedLyric: boolean
  embedTranslatedLyric: boolean
  hasEnabledScript: boolean
}

const readConfig = async (): Promise<DownloadConfig> => {
  const [enabledScripts, apiBase, searchSource, quality, fileNameTemplate, embedCover, embedLyric, embedTranslatedLyric] =
    await configuration.getConfigs<
      [
        string[] | null,
        string | null,
        string | null,
        string | null,
        string | null,
        boolean | null,
        boolean | null,
        boolean | null,
      ]
    >([
      'enabledScripts',
      'apiBase',
      'searchSource',
      'quality',
      'fileNameTemplate',
      'embedCover',
      'embedLyric',
      'embedTranslatedLyric',
    ])

  return {
    apiBase: (apiBase || DEFAULT_API_BASE).trim(),
    searchSource: searchSource || DEFAULT_SOURCE,
    quality: quality || DEFAULT_QUALITY,
    fileNameTemplate: fileNameTemplate || DEFAULT_TEMPLATE,
    embedCover: embedCover !== false,
    embedLyric: embedLyric === true,
    embedTranslatedLyric: embedTranslatedLyric === true,
    hasEnabledScript: Array.isArray(enabledScripts) && enabledScripts.length > 0,
  }
}

const buildKeyword = (name: string, singer: string): string => (singer ? `${name} ${singer}` : name)

const pickCandidate = async (list: SearchCandidate[], initialPage = 0): Promise<SearchCandidate | null> => {
  let page = initialPage
  for (;;) {
    const view = paginate(list, page)
    const from = view.page * PAGE_SIZE + 1
    const to = view.page * PAGE_SIZE + view.items.length
    const buttons = view.items.map((item, index) => ({
      text: describeCandidate(item, view.page * PAGE_SIZE + index),
    }))

    const navStart = buttons.length
    const hasPrev = view.page > 0
    const hasNext = view.page < view.totalPages - 1
    if (hasPrev) buttons.push({ text: t('download.prevPage') })
    if (hasNext) buttons.push({ text: t('download.nextPage') })
    buttons.push({ text: t('download.cancel') })

    const selected = await app.showMessage(t('download.pickRange', { from, to, total: view.total }), {
      title: t('download.pickTitle'),
      modal: true,
      buttons,
    })

    if (selected == null || selected < 0) return null
    if (selected < navStart) return view.items[selected]

    let cursor = navStart
    if (hasPrev) {
      if (selected === cursor) {
        page = view.page - 1
        continue
      }
      cursor++
    }
    if (hasNext && selected === cursor) {
      page = view.page + 1
      continue
    }
    return null
  }
}

const collectMetadata = async (
  candidate: SearchCandidate,
  config: DownloadConfig
): Promise<{ payload: EmbedPayload; notes: string[] }> => {
  const payload: EmbedPayload = {}
  const notes: string[] = []

  // 必须用 pic_id / lyric_id：用歌曲 id 取封面会拿到失效链接
  const picId = candidate.picId || candidate.id
  const lyricId = candidate.lyricId || candidate.id
  const apiFetcher = async (url: string) => request(url, { needRaw: true, timeout: 30_000 })

  if (config.embedCover) {
    // 直接走聚合 API 的 pic 端点，不依赖音源脚本是否实现 pic 动作
    const result = await fetchCoverFromApi(config.apiBase, config.searchSource, picId, apiFetcher)
    if (result.kind === 'ok') {
      payload.cover = result.cover
    } else if (result.reason === 'tooLarge') {
      notes.push(t('download.coverSkipped'))
    } else {
      notes.push(t('download.coverMissing'))
    }
  }

  if (config.embedLyric) {
    const lyric = await fetchLyricFromApi(config.apiBase, config.searchSource, lyricId, apiFetcher)
    if (lyric == null) {
      notes.push(t('download.lyricMissing'))
    } else {
      if (lyric.lyric) payload.lyric = lyric.lyric
      // 翻译开关独立生效；无原文时也允许单独写翻译
      if (config.embedTranslatedLyric && lyric.tlyric) payload.translatedLyric = lyric.tlyric
    }
  }

  return { payload, notes }
}

const downloadAndSave = async (
  candidate: SearchCandidate,
  config: DownloadConfig,
): Promise<void> => {
  const musicInfo = toMusicInfo(candidate)
  const { url, quality: actualQuality } = await getMusicUrlWithQuality(musicInfo, config.quality)

  const ext = inferExtension(actualQuality)
  const baseName = buildFileName(config.fileNameTemplate, {
    name: candidate.name,
    singer: candidate.artist.join('/'),
    album: candidate.album,
    quality: actualQuality,
    source: candidate.source,
  })
  const fileName = `${baseName}.${ext}`

  // 用真正的「另存为」文件窗口：canSelectFolder 会让窗口退化为选择文件夹，
  // 并把 defaultFileName 当成要进入的目录，导致「文件夹不存在」。
  // 非文件夹模式下返回的是完整文件路径，写入时 name 传空串即按该路径落盘。
  const filePath = await app.showSaveDialog({
    title: t('download.saveTitle'),
    defaultFileName: fileName,
  })
  if (!filePath) return

  // 显式超时而非依赖 timeout:0 的未定义语义；大文件留足余量
  const resp = await request(url, { needRaw: true, timeout: DOWNLOAD_TIMEOUT_MS })
  if (resp.statusCode != null && resp.statusCode !== 200) {
    throw new Error(`HTTP ${resp.statusCode}`)
  }
  const raw = resp.raw
  if (!raw || raw.length === 0) throw new Error('empty response')

  // 元数据：任何失败都降级为写原始音频，绝不让用户拿不到文件
  const { payload, notes } = await collectMetadata(candidate, config)
  const tagged = embedTags(raw, payload)
  const output = tagged.data.length > 0 ? tagged.data : raw
  if (payload.cover || payload.lyric || payload.translatedLyric) {
    if (tagged.applied.length === 0) notes.push(t('download.tagFailed'))
  }

  const savedPath = await app.writeSaveDialogFile(filePath, '', output)
  const savedName = savedPath.split(/[/\\]/).pop() || fileName
  console.log(
    `[download] saved ${savedPath} (${actualQuality}, ${output.length} bytes, tags: ${tagged.applied.join('|') || 'none'})`,
  )

  const doneText = t('download.done', {
    fileName: savedName,
    quality: qualityLabel(actualQuality),
    size: formatSize(output.length),
  })
  void app.showMessage(notes.length > 0 ? `${doneText}\n${notes.join('\n')}` : doneText, { type: 'info' })
}

export const downloadMusic = async (): Promise<void> => {
  const config = await readConfig()
  if (!config.hasEnabledScript) {
    void app.showMessage(t('download.noScript'), { type: 'warning' })
    return
  }

  const input = await app.showInputDialog({
    title: t('download.inputTitle'),
    placeholder: t('download.inputPlaceholder'),
  })
  const query = parseQuery(input ?? '')
  if (query == null) return

  let candidates: SearchCandidate[]
  try {
    candidates = await searchMusic({
      apiBase: config.apiBase,
      source: config.searchSource,
      keyword: buildKeyword(query.name, query.singer),
      count: DEFAULT_COUNT,
      fetcher: async (url) => request(url),
    })
  } catch (error) {
    console.error(`[download] search failed: ${(error as Error).message}`)
    void app.showMessage(t('download.searchFailed'), { type: 'error' })
    return
  }

  const ranked = rankCandidates(candidates, query.singer)
  if (ranked.length === 0) {
    void app.showMessage(t('download.noResult'), { type: 'info' })
    return
  }

  const picked = await pickCandidate(ranked)
  if (picked == null) return

  try {
    await downloadAndSave(picked, config)
  } catch (error) {
    const message = (error as Error).message
    console.error(`[download] failed: ${message}`)
    void app.showMessage(t('download.downloadFailed', { message }), { type: 'error' })
  }
}

export const initDownload = async (): Promise<void> => {
  await command.registerCommand('downloadMusic', downloadMusic)
}
