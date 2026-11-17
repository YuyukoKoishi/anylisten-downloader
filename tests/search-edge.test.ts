import test from 'node:test'
import assert from 'node:assert/strict'

import { searchMusic } from '../src/main/download/search.ts'

const base = { apiBase: 'https://x.test/api.php', source: 'netease', keyword: 'k' }
const noSleep = async () => {}

// 缺陷：非 200 状态码必须触发重试，而不是直接返回空数组
test('non-200 status triggers retry then throws', async () => {
  let calls = 0
  const fetcher = async () => { calls++; return { statusCode: 500, body: [] } }
  await assert.rejects(searchMusic({ ...base, fetcher, sleep: noSleep }))
  assert.equal(calls, 3)
})

// 缺陷：404 也应重试（不应当作空结果）
test('404 triggers retry', async () => {
  let calls = 0
  const fetcher = async () => { calls++; return { statusCode: 404, body: null } }
  await assert.rejects(searchMusic({ ...base, fetcher, sleep: noSleep }))
  assert.equal(calls, 3)
})

// 空数组是合法结果，不应重试
test('empty array is a valid result without retry', async () => {
  let calls = 0
  const fetcher = async () => { calls++; return { statusCode: 200, body: [] } }
  const out = await searchMusic({ ...base, fetcher, sleep: noSleep })
  assert.deepEqual(out, [])
  assert.equal(calls, 1)
})

// 字段缺失时应归一化而不是崩溃
test('missing fields are normalized', async () => {
  const fetcher = async () => ({ statusCode: 200, body: [{ id: 123, name: 'n' }] })
  const out = await searchMusic({ ...base, fetcher, sleep: noSleep })
  assert.equal(out[0].id, '123')
  assert.equal(out[0].album, '')
  assert.deepEqual(out[0].artist, [])
})

// artist 为字符串时应包成数组
test('string artist becomes array', async () => {
  const fetcher = async () => ({ statusCode: 200, body: [{ id: '1', name: 'n', artist: 'Solo' }] })
  const out = await searchMusic({ ...base, fetcher, sleep: noSleep })
  assert.deepEqual(out[0].artist, ['Solo'])
})
