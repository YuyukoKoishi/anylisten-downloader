const ILLEGAL_RXP = /[\\/:*?"<>|]/g
// 控制字符用码点判断，避免在正则里直接写控制字符
const isControlChar = (code: number): boolean => code < 0x20 || code === 0x7f
const TRAILING_RXP = /[. ]+$/
const MULTI_SPACE_RXP = /\s+/g
const MAX_LENGTH = 120
const SIZE_UNITS = ['B', 'KB', 'MB', 'GB']

// Windows 保留设备名（不区分大小写），作为文件名会导致写入失败
const RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
])

export const sanitizeFileName = (name: string): string => {
  let stripped = ''
  for (const char of name) {
    stripped += isControlChar(char.codePointAt(0) ?? 0) ? ' ' : char
  }
  const cleaned = stripped
    .replace(ILLEGAL_RXP, ' ')
    .replace(MULTI_SPACE_RXP, ' ')
    .trim()
    .slice(0, MAX_LENGTH)
    .replace(TRAILING_RXP, '')
    .trim()
  if (!cleaned) return 'unknown'
  if (RESERVED_NAMES.has(cleaned.toUpperCase())) return `${cleaned}_`
  return cleaned
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

export const formatSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${SIZE_UNITS[unit]}`
}
