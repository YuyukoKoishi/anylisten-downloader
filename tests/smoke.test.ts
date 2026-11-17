import test from 'node:test'
import assert from 'node:assert/strict'

test('test harness runs TypeScript directly', () => {
  const value: number = 1 + 1
  assert.equal(value, 2)
})
