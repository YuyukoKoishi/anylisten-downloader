import fs from 'node:fs'
import { embedTags, detectFormat } from './src/main/download/tags/index.ts'

const url = 'https://music-api.gdstudio.xyz/api.php?types=url&source=netease&id=2668397359&br=320'
const meta = await (await fetch(url)).json()
const raw = new Uint8Array(await (await fetch(meta.url)).arrayBuffer())
console.log('downloaded:', raw.length, 'format:', detectFormat(raw))

const withTags = embedTags(raw, {
  cover: { data: new Uint8Array(2048).fill(0x41), mime: 'image/jpeg' },
  lyric: '[00:01.00]第一行\n[00:05.00]第二行',
  translatedLyric: '[00:01.00]line one',
})
console.log('after embed:', withTags.data.length, 'applied:', JSON.stringify(withTags.applied))
console.log('grew by:', withTags.data.length - raw.length)

const tailLen = Math.min(65536, raw.length)
console.log('tail identical:', Buffer.from(raw).subarray(raw.length - tailLen).equals(Buffer.from(withTags.data).subarray(withTags.data.length - tailLen)))
console.log('head:', Buffer.from(withTags.data).subarray(0, 3).toString('hex'))
console.log('has LYRICS text:', Buffer.from(withTags.data).toString('latin1').includes('第一行') || Buffer.from(withTags.data).toString('utf8').includes('第一行'))
process.exit(0)
