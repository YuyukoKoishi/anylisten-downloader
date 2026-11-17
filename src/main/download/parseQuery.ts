import type { DownloadQuery } from './types'

const SEPARATOR_RXP = /\s*[-–—－]\s*/

export const parseQuery = (input: string): DownloadQuery | null => {
  const text = input.trim()
  if (!text) return null

  const match = SEPARATOR_RXP.exec(text)
  if (match == null) return { name: text, singer: '' }

  const name = text.slice(0, match.index).trim()
  const singer = text.slice(match.index + match[0].length).trim()
  return { name, singer }
}
