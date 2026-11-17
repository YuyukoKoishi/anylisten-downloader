import test from 'node:test'
import assert from 'node:assert/strict'

import { fetchCover, MAX_COVER_BYTES } from '../src/main/download/media.ts'

const ok = (len: number) => async () => ({ statusCode: 200, raw: new Uint8Array(len), headers: { 'content-type': 'image/png' } })

test('cover under 300KB is accepted', async () => {
  const r = await fetchCover('https://x/y.jpg', ok(1024))
  assert.equal(r.kind, 'ok')
  assert.equal(r.cover.mime, 'image/png')
  assert.equal(r.cover.data.length, 1024)
})

test('cover at exactly the limit is accepted', async () => {
  const r = await fetchCover('https://x/y.jpg', ok(MAX_COVER_BYTES))
  assert.equal(r.kind, 'ok')
})

test('cover over 300KB is skipped with tooLarge', async () => {
  const r = await fetchCover('https://x/y.jpg', ok(MAX_COVER_BYTES + 1))
  assert.equal(r.kind, 'skipped')
  assert.equal(r.reason, 'tooLarge')
})

test('missing url is skipped without calling fetcher', async () => {
  let called = false
  const r = await fetchCover(null, async () => { called = true; return { raw: new Uint8Array(1) } })
  assert.equal(r.kind, 'skipped')
  assert.equal(r.reason, 'missing')
  assert.equal(called, false)
})

test('empty response is skipped', async () => {
  const r = await fetchCover('https://x/y.jpg', async () => ({ statusCode: 200, raw: new Uint8Array(0) }))
  assert.equal(r.kind, 'skipped')
  assert.equal(r.reason, 'missing')
})

test('request failure is skipped and never throws', async () => {
  const r = await fetchCover('https://x/y.jpg', async () => { throw new Error('nope') })
  assert.equal(r.kind, 'skipped')
  assert.equal(r.reason, 'failed')
})

test('mime falls back to image/jpeg', async () => {
  const r = await fetchCover('https://x/y.jpg', async () => ({ statusCode: 200, raw: new Uint8Array(10), headers: {} }))
  assert.equal(r.kind, 'ok')
  assert.equal(r.cover.mime, 'image/jpeg')
})
