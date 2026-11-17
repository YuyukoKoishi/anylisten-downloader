import test from 'node:test'
import assert from 'node:assert/strict'

import { toMusicInfo } from '../src/main/download/toMusicInfo.ts'

const cand = (source: string, id = '123') => ({
  id,
  name: '晴天',
  artist: ['周杰伦'],
  album: '叶惠美',
  source,
})

test('maps api source to lx source', () => {
  assert.equal(toMusicInfo(cand('netease')).meta.source, 'wy')
  assert.equal(toMusicInfo(cand('tencent')).meta.source, 'tx')
  assert.equal(toMusicInfo(cand('kugou')).meta.source, 'kg')
  assert.equal(toMusicInfo(cand('kuwo')).meta.source, 'kw')
  assert.equal(toMusicInfo(cand('migu')).meta.source, 'mg')
})

test('fills common fields', () => {
  const info = toMusicInfo(cand('netease'))
  assert.equal(info.name, '晴天')
  assert.equal(info.singer, '周杰伦')
  assert.equal(info.meta.musicId, '123')
  assert.equal(info.meta.albumName, '叶惠美')
  assert.deepEqual(info.meta.qualitys, {})
})

test('joins multiple artists with slash', () => {
  const info = toMusicInfo({ ...cand('netease'), artist: ['A', 'B'] })
  assert.equal(info.singer, 'A/B')
})

test('throws on unsupported source', () => {
  assert.throws(() => toMusicInfo(cand('unknown')), /unsupported source/)
})
