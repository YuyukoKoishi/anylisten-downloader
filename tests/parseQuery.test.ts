import test from 'node:test'
import assert from 'node:assert/strict'

import { parseQuery } from '../src/main/download/parseQuery.ts'

test('splits name and singer on hyphen', () => {
  assert.deepEqual(parseQuery('晴天 - 周杰伦'), { name: '晴天', singer: '周杰伦' })
  assert.deepEqual(parseQuery('晴天-周杰伦'), { name: '晴天', singer: '周杰伦' })
  assert.deepEqual(parseQuery('晴天 — 周杰伦'), { name: '晴天', singer: '周杰伦' })
})

test('name only yields empty singer', () => {
  assert.deepEqual(parseQuery('晴天'), { name: '晴天', singer: '' })
})

test('blank input returns null', () => {
  assert.equal(parseQuery(''), null)
  assert.equal(parseQuery('   '), null)
  assert.equal(parseQuery('\n\t'), null)
})
