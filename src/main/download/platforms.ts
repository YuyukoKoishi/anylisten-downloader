// 聚合 API source 与 LX 音源 source 的双向映射。
// 聚合 API 用 netease/tencent/kugou/kuwo/migu，LX 音源脚本用 wy/tx/kg/kw/mg。

export const API_TO_LX_SOURCE: Record<string, string> = {
  netease: 'wy',
  tencent: 'tx',
  kugou: 'kg',
  kuwo: 'kw',
  migu: 'mg',
}

export const LX_TO_API_SOURCE: Record<string, string> = {
  wy: 'netease',
  tx: 'tencent',
  kg: 'kugou',
  kw: 'kuwo',
  mg: 'migu',
}

/** API source 映射到 LX source；未知 source 原样返回 */
export const toLxSource = (apiSource: string): string => API_TO_LX_SOURCE[apiSource] ?? apiSource

/** LX source 映射到 API source；未知 source 原样返回 */
export const toApiSource = (lxSource: string): string => LX_TO_API_SOURCE[lxSource] ?? lxSource

// 本期可搜索的 API source 白名单：聚合 API 仅支持网易云搜索。
// 多平台搜索数据源接入后，把对应 source 加进来即可。
export const SEARCHABLE_API_SOURCES: string[] = ['netease']

/** 从启用的 LX source 集合里筛出本期可搜索的平台（映射回 API source） */
export const toSearchableApiSources = (lxSources: string[]): string[] =>
  lxSources.map(toApiSource).filter((api) => SEARCHABLE_API_SOURCES.includes(api))
