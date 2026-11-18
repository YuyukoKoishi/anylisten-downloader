import type { SearchCandidate } from './types'

export const PAGE_SIZE = 5

// —— 字符契合度排序（移植自宿主 resources/search/music.ts 的 findMusic 算法）——

const SINGERS_RXP = /[,、，;；\/]/u

const normalize = (text: string): string => text.normalize('NFKC').toLowerCase()

// 去掉空格/符号/标点，仅保留可比较的字符
const filterStr = (str?: string): string =>
  typeof str === 'string'
    ? str.normalize('NFKC').replace(/\s|'|\.|,|，|&|"|、|\(|\)|（|）|`|~|-|<|>|\||\/|\]|\[|!|！/g, '')
    : String(str || '')

// 版本字符：歌名带这些词说明是伴奏/翻唱/remix 等衍生版本，不是原曲
const versionChars = [
  'instrumental', 'inst', 'karaoke', 'backing track', 'minus one', 'minus vocal',
  'no vocal', 'off vocal', 'vocal removed', '伴奏', '伴唱', '卡拉ok', '纯音乐', '无人声',
  '去人声', '消音', 'オフボーカル', 'インスト', '반주', '노래방',
  'live', 'concert', 'tour', 'festival', 'stage', 'session', '现场', '演唱会', '巡演',
  '音乐会', 'ライブ', '공연', '라이브',
  'cover', 'tribute', 'rendition', 'remake', '翻唱', '致敬', '改编', 'カバー', '커버',
  'remix', 'mix', 'club', 'dance', 'extended', 'house', 'edm', 'dj', 'dub', 'trap',
  '混音', '重混', '电音', 'リミックス', '리믹스',
  'acoustic', 'unplugged', 'stripped', '原声', '不插电', 'アコースティック', '어쿠스틱',
  'demo', '小样', '试听', 'デモ', '데모',
  'slowed', 'slowed reverb', 'sped up', 'speed up', 'nightcore', '慢速', '加速', '变速', 'ナイトコア',
  'piano', 'guitar', 'orchestra', 'symphony', 'violin', '钢琴', '吉他', '管弦乐', '小提琴',
  'ピアノ', 'ギター', '피아노', '기타',
]

// 多歌手：拆分后排序再拼接，保证「周杰伦/蔡依林」与「蔡依林/周杰伦」视为同一歌手
const sortSingle = (singer: string): string =>
  SINGERS_RXP.test(singer)
    ? singer
        .split(SINGERS_RXP)
        .map((s) => s.trim())
        .filter((s) => s)
        .sort((a, b) => a.localeCompare(b))
        .join('、')
    : singer || ''

interface Rankable {
  id: string
  name: string
  artist: string[]
  album: string
}

interface Scored extends Rankable {
  fMusicName: string
  fSinger: string
  fAlbumName: string
  score: number
}

/**
 * 按「歌名 + 歌手 + 专辑」与输入的多级契合度排序。
 * 契合度越高的排在越前；完全匹配（歌名=输入歌名 且 歌手包含输入歌手 且 无版本字符）得分最高。
 * 输入未指定歌手时退化为仅按歌名匹配。
 */
export const rankCandidates = (
  list: SearchCandidate[],
  query: { name: string; singer: string }
): SearchCandidate[] => {
  const fMusicName = filterStr(query.name).toLowerCase()
  const fSinger = filterStr(sortSingle(query.singer.trim())).toLowerCase()

  const scored: Scored[] = list.map((item) => {
    const itemSinger = item.artist.join('/')
    const fItemSinger = filterStr(sortSingle(itemSinger)).toLowerCase()
    const fItemName = filterStr(item.name).toLowerCase()
    const fItemAlbum = filterStr(item.album).toLowerCase()

    let score = 0
    // 歌名完全相等（且无版本字符污染）权重最高
    const nameExact = fItemName === fMusicName
    const hasVersionChar = versionChars.some((c) => item.name.toLowerCase().includes(c) !== query.name.toLowerCase().includes(c))
    if (nameExact && !hasVersionChar) score += 100
    // 歌手匹配
    if (fSinger && fItemSinger.includes(fSinger)) score += 40
    // 歌名互相包含
    if (nameExact) score += 20
    else if (fItemName.includes(fMusicName) || fMusicName.includes(fItemName)) score += 10
    // 专辑匹配（用户输入未含专辑，此项仅当完全一致时微调）
    if (fItemAlbum && fItemAlbum === fMusicName) score += 5

    return {
      ...item,
      fMusicName: fItemName,
      fSinger: fItemSinger,
      fAlbumName: fItemAlbum,
      score,
    }
  })

  // 稳定排序：分数降序，同分保持原顺序
  return scored
    .map(({ fMusicName: _fmn, fSinger: _fs, fAlbumName: _fan, score: _s, ...item }) => item)
    .sort((a, b) => {
      const sa = scored.find((x) => x.id === a.id)!.score
      const sb = scored.find((x) => x.id === b.id)!.score
      return sb - sa
    })
}

export interface PageResult<T> {
  items: T[]
  page: number
  totalPages: number
  total: number
}

export const paginate = <T>(list: T[], page: number): PageResult<T> => {
  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(Math.max(page, 0), totalPages - 1)
  const start = safePage * PAGE_SIZE
  return {
    items: list.slice(start, start + PAGE_SIZE),
    page: safePage,
    totalPages,
    total,
  }
}

export const describeCandidate = (candidate: SearchCandidate, index: number): string => {
  const singers = candidate.artist.filter((name) => name.length > 0).join('/')
  const base = `${index + 1}. ${candidate.name} - ${singers}`
  return candidate.album ? `${base}（${candidate.album}）` : base
}
