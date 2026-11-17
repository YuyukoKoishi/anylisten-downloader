import { app, command, configuration, console, request, t } from '../shared/hostAPI'
import { getMusicUrlWithQuality } from '../isolate'
import { paginate, describeCandidate, rankCandidates, PAGE_SIZE } from './candidates'
import { buildFileName, formatSize, inferExtension } from './fileName'
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

interface DownloadConfig {
  apiBase: string
  searchSource: string
  quality: string
  fileNameTemplate: string
  hasEnabledScript: boolean
}

const readConfig = async (): Promise<DownloadConfig> => {
  const [enabledScripts, apiBase, searchSource, quality, fileNameTemplate] = await configuration.getConfigs<
    [string[] | null, string | null, string | null, string | null, string | null]
  >(['enabledScripts', 'apiBase', 'searchSource', 'quality', 'fileNameTemplate'])

  return {
    apiBase: (apiBase || DEFAULT_API_BASE).trim(),
    searchSource: searchSource || DEFAULT_SOURCE,
    quality: quality || DEFAULT_QUALITY,
    fileNameTemplate: fileNameTemplate || DEFAULT_TEMPLATE,
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

  const dir = await app.showSaveDialog({
    title: t('download.saveTitle'),
    defaultFileName: fileName,
    canSelectFolder: true,
  })
  if (!dir) return

  const resp = await request(url, { needRaw: true, timeout: 0 })
  if (resp.statusCode != null && resp.statusCode !== 200) {
    throw new Error(`HTTP ${resp.statusCode}`)
  }
  const raw = resp.raw
  if (!raw || raw.length === 0) throw new Error('empty response')

  await app.writeSaveDialogFile(dir, fileName, raw)
  console.log(`[download] saved ${fileName} (${actualQuality}, ${raw.length} bytes)`)

  void app.showMessage(
    t('download.done', {
      fileName,
      quality: qualityLabel(actualQuality),
      size: formatSize(raw.length),
    }),
    { type: 'info' },
  )
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
