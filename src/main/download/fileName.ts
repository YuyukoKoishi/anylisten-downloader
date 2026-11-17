const ILLEGAL_RXP = /[\\/:*?"<>|\u0000-\u001f]/g
const TRAILING_RXP = /[. ]+$/
const MULTI_SPACE_RXP = /\s+/g
const MAX_LENGTH = 120

export const sanitizeFileName = (name: string): string => {
  const cleaned = name
    .replace(ILLEGAL_RXP, ' ')
    .replace(MULTI_SPACE_RXP, ' ')
    .trim()
    .slice(0, MAX_LENGTH)
    .replace(TRAILING_RXP, '')
    .trim()
  return cleaned || 'unknown'
}

export const buildFileName = (template: string, vars: Record<string, string>): string => {
  const filled = (template || '{name} - {singer}').replace(/\{(\w+)\}/g, (raw, key: string) => {
    const value = vars[key]
    return value == null ? raw : value
  })
  return sanitizeFileName(filled)
}

const FLAC_QUALITIES = new Set(['flac', 'flac24bit'])

export const inferExtension = (quality: string): string => {
  if (FLAC_QUALITIES.has(quality)) return 'flac'
  if (quality === 'wav') return 'wav'
  return 'mp3'
}
