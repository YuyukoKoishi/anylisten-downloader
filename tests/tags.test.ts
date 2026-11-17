import test from 'node:test'
import assert from 'node:assert/strict'

import { detectFormat, embedTags } from '../src/main/download/tags/index.ts'

const mp3 = () => {
  // 'ID3' + v2.4 header + 10 字节空元数据 + 伪音频帧
  const id3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
  const audio = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x11, 0x22, 0x33, 0x44])
  return new Uint8Array([...id3, ...audio])
}
const flac = () => {
  const magic = [0x66, 0x4c, 0x61, 0x43]
  // STREAMINFO: 34 字节载荷，header = 0x00 (last=0? 用 0x00 => not last) | type 0
  const block = [0x00, 0x00, 0x00, 0x22, ...new Array(34).fill(0x00)]
  const frames = [0xff, 0xf8, 0x69, 0x08, 0x00, 0x01]
  return new Uint8Array([...magic, ...block, ...frames])
}

test('detects mp3 by ID3 header', () => {
  assert.equal(detectFormat(new Uint8Array([0x49, 0x44, 0x33, 0x03])), 'mp3')
})

test('detects flac by fLaC magic', () => {
  assert.equal(detectFormat(new Uint8Array([0x66, 0x4c, 0x61, 0x43])), 'flac')
})

test('detects unknown for random bytes', () => {
  assert.equal(detectFormat(new Uint8Array([0x00, 0x01, 0x02, 0x03])), 'unknown')
})

test('unknown format returns original bytes untouched', () => {
  const raw = new Uint8Array([1, 2, 3, 4])
  const out = embedTags(raw, { lyric: 'hello' })
  assert.deepEqual(Array.from(out.data), [1, 2, 3, 4])
  assert.deepEqual(out.applied, [])
})

test('mp3 keeps audio bytes identical after embedding lyric', () => {
  const raw = mp3()
  const audioTail = Array.from(raw.slice(raw.length - 8))
  const out = embedTags(raw, { lyric: '[00:01.00]hello' })
  assert.ok(out.data.length > raw.length, 'data should grow')
  assert.deepEqual(Array.from(out.data.slice(out.data.length - 8)), audioTail)
  assert.ok(out.applied.includes('lyric'))
})

test('flac keeps audio frames identical after embedding lyric', () => {
  const raw = flac()
  const tail = Array.from(raw.slice(raw.length - 6))
  const out = embedTags(raw, { lyric: '[00:01.00]hello' })
  assert.ok(out.data.length > raw.length, 'data should grow')
  assert.deepEqual(Array.from(out.data.slice(out.data.length - 6)), tail)
  assert.ok(out.applied.includes('lyric'))
})

test('cover is embedded and mime preserved', () => {
  const raw = mp3()
  const cover = { data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), mime: 'image/jpeg' }
  const out = embedTags(raw, { cover })
  assert.ok(out.applied.includes('cover'))
  const asText = Buffer.from(out.data).toString('latin1')
  assert.ok(asText.includes('image/jpeg'), 'mime should appear in APIC frame')
})

test('translated lyric produces a second field', () => {
  const raw = mp3()
  const out = embedTags(raw, { lyric: '[00:01.00]a', translatedLyric: '[00:01.00]b' })
  assert.ok(out.applied.includes('lyric'))
  assert.ok(out.applied.includes('translatedLyric'))
})

test('translated lyric alone does not create a lyric field', () => {
  const raw = mp3()
  const out = embedTags(raw, { translatedLyric: '[00:01.00]b' })
  assert.ok(!out.applied.includes('lyric'), 'lyric must stay absent')
})

test('empty payload leaves data unchanged', () => {
  const raw = mp3()
  const out = embedTags(raw, {})
  assert.deepEqual(Array.from(out.data), Array.from(raw))
  assert.deepEqual(out.applied, [])
})
