import test from 'node:test'
import assert from 'node:assert/strict'

import { rankCandidates, paginate, describeCandidate, PAGE_SIZE } from '../src/main/download/candidates.ts'

const make = (id: string, name: string, artist: string[], album = '') => ({
  id,
  name,
  artist,
  album,
  source: 'netease',
})

test('sorts matching singer first and keeps stable order otherwise', () => {
  const list = [make('1', '晴天', ['RyaVocal']), make('2', '晴天', ['周杰伦'], '叶惠美')]
  const out = rankCandidates(list, '周杰伦')
  assert.equal(out[0].id, '2')
  assert.equal(out[1].id, '1')
})

test('singer match is case insensitive and ignores full width', () => {
  const list = [make('1', 'x', ['ＡＢＣ']), make('2', 'x', ['abc'])]
  const out = rankCandidates(list, 'abc')
  assert.equal(out[0].id, '1')
})

test('keeps all candidates when singer is empty', () => {
  const list = [make('1', 'a', ['x']), make('2', 'b', ['y'])]
  assert.deepEqual(rankCandidates(list, '').map((c) => c.id), ['1', '2'])
})

test('paginates with page size five', () => {
  const list = Array.from({ length: 12 }, (_, i) => i)
  const p0 = paginate(list, 0)
  assert.equal(PAGE_SIZE, 5)
  assert.deepEqual(p0.items, [0, 1, 2, 3, 4])
  assert.equal(p0.totalPages, 3)
  assert.deepEqual(paginate(list, 2).items, [10, 11])
})

test('clamps out of range page', () => {
  const list = Array.from({ length: 12 }, (_, i) => i)
  assert.equal(paginate(list, 99).page, 2)
  assert.equal(paginate(list, -1).page, 0)
})

test('describes candidate with and without album', () => {
  assert.equal(
    describeCandidate(make('1', '晴天', ['周杰伦'], '叶惠美'), 0),
    '1. 晴天 - 周杰伦（叶惠美）'
  )
  assert.equal(describeCandidate(make('2', '晴天', ['A'], ''), 6), '7. 晴天 - A')
})
