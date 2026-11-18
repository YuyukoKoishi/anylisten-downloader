import test from 'node:test'
import assert from 'node:assert/strict'

import { API_TO_LX_SOURCE, LX_TO_API_SOURCE, toLxSource, toApiSource } from '../src/main/download/platforms.ts'

test('API_TO_LX_SOURCE maps netease to wy', () => {
  assert.equal(API_TO_LX_SOURCE['netease'], 'wy')
  assert.equal(API_TO_LX_SOURCE['tencent'], 'tx')
  assert.equal(API_TO_LX_SOURCE['kugou'], 'kg')
  assert.equal(API_TO_LX_SOURCE['kuwo'], 'kw')
  assert.equal(API_TO_LX_SOURCE['migu'], 'mg')
})

test('LX_TO_API_SOURCE is the inverse', () => {
  assert.equal(LX_TO_API_SOURCE['wy'], 'netease')
  assert.equal(LX_TO_API_SOURCE['tx'], 'tencent')
  assert.equal(LX_TO_API_SOURCE['kg'], 'kugou')
  assert.equal(LX_TO_API_SOURCE['kw'], 'kuwo')
  assert.equal(LX_TO_API_SOURCE['mg'], 'migu')
})

test('toLxSource maps known and passes unknown through', () => {
  assert.equal(toLxSource('netease'), 'wy')
  assert.equal(toLxSource('unknown'), 'unknown')
})

test('toApiSource maps known and passes unknown through', () => {
  assert.equal(toApiSource('wy'), 'netease')
  assert.equal(toApiSource('unknown'), 'unknown')
})
