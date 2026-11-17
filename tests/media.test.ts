import test from 'node:test'
import assert from 'node:assert/strict'

import { fetchCoverFromApi, fetchLyricFromApi, MAX_COVER_BYTES } from '../src/main/download/media.ts'

const API = 'https://x.test/api.php'

test('cover: resolves pic url then downloads image', async () => {
  const fetcher = async (url) => {
    if (url.includes('types=pic')) return { statusCode: 200, body: { url: 'https://img.test/a.jpg' } }
    return { statusCode: 200, raw: new Uint8Array([0x89,0x50,0x4e,0x47, ...new Array(1020).fill(0)]), headers: { 'content-type': 'image/png' } }
  }
  const r = await fetchCoverFromApi(API, 'netease', '123', fetcher)
  assert.equal(r.kind, 'ok')
  assert.equal(r.cover.mime, 'image/png')
  assert.equal(r.cover.data.length, 1024)
})

test('cover: over 300KB is skipped', async () => {
  const fetcher = async (url) => {
    if (url.includes('types=pic')) return { statusCode: 200, body: { url: 'https://img.test/a.jpg' } }
    return { statusCode: 200, raw: new Uint8Array([0xff,0xd8,0xff,0xe0, ...new Array(MAX_COVER_BYTES - 3).fill(0)]), headers: {} }
  }
  const r = await fetchCoverFromApi(API, 'netease', '123', fetcher)
  assert.equal(r.kind, 'skipped')
  assert.equal(r.reason, 'tooLarge')
})

test('cover: missing url is skipped without downloading', async () => {
  let imageCalls = 0
  const fetcher = async (url) => {
    if (url.includes('types=pic')) return { statusCode: 200, body: { url: '' } }
    imageCalls++
    return { statusCode: 200, raw: new Uint8Array(1) }
  }
  const r = await fetchCoverFromApi(API, 'netease', '123', fetcher)
  assert.equal(r.kind, 'skipped')
  assert.equal(r.reason, 'missing')
  assert.equal(imageCalls, 0)
})

test('cover: request failure is skipped, never throws', async () => {
  const r = await fetchCoverFromApi(API, 'netease', '123', async () => { throw new Error('x') })
  assert.equal(r.kind, 'skipped')
  assert.equal(r.reason, 'failed')
})

test('lyric: returns lyric and translation', async () => {
  const fetcher = async () => ({ statusCode: 200, body: { lyric: '[00:01.00]a', tlyric: '[00:01.00]b' } })
  const r = await fetchLyricFromApi(API, 'netease', '123', fetcher)
  assert.equal(r.lyric, '[00:01.00]a')
  assert.equal(r.tlyric, '[00:01.00]b')
})

test('lyric: accepts string json body', async () => {
  const fetcher = async () => ({ statusCode: 200, body: JSON.stringify({ lyric: '[00:01.00]a', tlyric: '' }) })
  const r = await fetchLyricFromApi(API, 'netease', '123', fetcher)
  assert.equal(r.lyric, '[00:01.00]a')
})

test('lyric: empty payload returns null', async () => {
  const fetcher = async () => ({ statusCode: 200, body: { lyric: '', tlyric: '' } })
  assert.equal(await fetchLyricFromApi(API, 'netease', '123', fetcher), null)
})

test('lyric: failure returns null', async () => {
  assert.equal(await fetchLyricFromApi(API, 'netease', '123', async () => { throw new Error('x') }), null)
})
test('cover: json error body is rejected as missing', async () => {
  const fetcher = async (url) => {
    if (url.includes('types=pic')) return { statusCode: 200, body: { url: 'https://img.test/dead.jpg' } }
    // 模拟失效链接返回的 JSON 错误体
    return { statusCode: 404, raw: new TextEncoder().encode('{"Code":"NoSuchKey"}'), headers: { 'content-type': 'image/jpg' } }
  }
  const r = await fetchCoverFromApi(API, 'netease', '123', fetcher)
  assert.equal(r.kind, 'skipped')
  assert.equal(r.reason, 'missing')
})

test('cover: non-image bytes with 200 are rejected', async () => {
  const fetcher = async (url) => {
    if (url.includes('types=pic')) return { statusCode: 200, body: { url: 'https://img.test/x.jpg' } }
    return { statusCode: 200, raw: new TextEncoder().encode('<html>nope</html>'), headers: {} }
  }
  const r = await fetchCoverFromApi(API, 'netease', '123', fetcher)
  assert.equal(r.kind, 'skipped')
})

test('cover: real jpeg magic bytes accepted', async () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
  const fetcher = async (url) => {
    if (url.includes('types=pic')) return { statusCode: 200, body: { url: 'https://img.test/a.jpg' } }
    return { statusCode: 200, raw: jpeg, headers: {} }
  }
  const r = await fetchCoverFromApi(API, 'netease', '123', fetcher)
  assert.equal(r.kind, 'ok')
  assert.equal(r.cover.data.length, 6)
})
