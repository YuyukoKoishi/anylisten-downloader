export const QUALITY_OPTIONS = ['128k', '320k', 'flac', 'flac24bit'] as const

const LABELS: Record<string, string> = {
  '128k': '128K',
  '192k': '192K',
  '320k': '320K',
  flac: 'FLAC',
  flac24bit: 'FLAC 24bit',
  wav: 'WAV',
}

export const qualityLabel = (quality: string): string => {
  if (!quality) return '未知'
  return LABELS[quality] ?? quality.toUpperCase()
}
