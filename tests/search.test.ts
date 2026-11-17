import test from 'node:test'
import assert from 'node:assert/strict'

import { searchMusic } from '../src/main/download/search.ts'

const base = { apiBase: 'https://example.test/api.php', source: 'netease', keyword: '晴天 周杰伦' }
const noSleep = async () => {}

test('parses array body', async () => {
  const fetcher = async () => ({
    statusCode: 200,
    body: [{ id: '1', name: '晴天', artist: ['周杰伦'], album: '叶惠美', source: 'netease' }],
  })
  const out = await searchMusic({ ...base, fetcher, sleep: noSleep })
  assert.equal(out.length, 1)
  assert.equal(out[0].id, '1')
  assert.deepEqual(out[0].artist, ['周杰伦'])
})

test('parses string body', async () => {
  const fetcher = async () => ({
    statusCode: 200,
    body: JSON.stringify([{ id: '2', name: '晴天', artist: ['A'], album: '', source: 'netease' }]),
  })
  const out = await searchMusic({ ...base, fetcher, sleep: noSleep })
  assert.equal(out[0].id, '2')
})

test('returns empty array when body is a non-array object', async () => {
  const fetcher = async () => ({ statusCode: 200, body: { error: 'nope' } })
  assert.deepEqual(await searchMusic({ ...base, fetcher, sleep: noSleep }), [])
})

test('retries three times with backoff then throws', async () => {
  const waits: number[] = []
  let calls = 0
  const fetcher = async () => {
    calls++
    throw new Error('503')
  }
  await assert.rejects(searchMusic({ ...base, fetcher, sleep: async (ms) => { waits.push(ms) } }))
  assert.equal(calls, 3)
  assert.deepEqual(waits, [1000, 2000])
})

test('succeeds on second attempt without extra waits', async () => {
  let calls = 0
  const fetcher = async () => {
    calls++
    if (calls === 1) throw new Error('503')
    return { statusCode: 200, body: [{ id: '3', name: 'x', artist: [], album: '', source: 'netease' }] }
  }
  assert.equal((await searchMusic({ ...base, fetcher, sleep: noSleep }))[0].id, '3')
  assert.equal(calls, 2)
})
