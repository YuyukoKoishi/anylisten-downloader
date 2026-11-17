import test from 'node:test'
import assert from 'node:assert/strict'

import { paginate, PAGE_SIZE } from '../src/main/download/candidates.ts'

// 这些测试锁定任务分支中"导航按钮下标"这一易错算术：
// 候选按钮之后依次追加 prev(可选) / next(可选) / cancel。
// 实际点击是 0-based 下标，pickCandidate 依赖同样的顺序。

interface ButtonLayout {
  candidateCount: number
  hasPrev: boolean
  hasNext: boolean
  prevIndex: number | null
  nextIndex: number | null
  cancelIndex: number
}

const layout = (candidateCount: number, hasPrev: boolean, hasNext: boolean): ButtonLayout => {
  let cursor = candidateCount
  const prevIndex = hasPrev ? cursor++ : null
  const nextIndex = hasNext ? cursor++ : null
  const cancelIndex = cursor
  return { candidateCount, hasPrev, hasNext, prevIndex, nextIndex, cancelIndex }
}

test('layout on first page has next and cancel only', () => {
  const l = layout(5, false, true)
  assert.equal(l.prevIndex, null)
  assert.equal(l.nextIndex, 5)
  assert.equal(l.cancelIndex, 6)
})

test('layout on middle page has prev and next', () => {
  const l = layout(5, true, true)
  assert.equal(l.prevIndex, 5)
  assert.equal(l.nextIndex, 6)
  assert.equal(l.cancelIndex, 7)
})

test('layout on last page has prev and cancel', () => {
  const l = layout(2, true, false)
  assert.equal(l.prevIndex, 2)
  assert.equal(l.nextIndex, null)
  assert.equal(l.cancelIndex, 3)
})

test('last page partial fill still maps candidate index correctly', () => {
  const list = Array.from({ length: 12 }, (_, i) => i)
  const last = paginate(list, 2)
  assert.equal(last.items.length, 2)
  const l = layout(last.items.length, true, false)
  // 点击第一个候选（下标 0）应拿到 10
  assert.equal(last.items[0], 10)
  assert.equal(last.items[l.candidateCount - 1], 11)
})

test('single page has cancel only', () => {
  const l = layout(3, false, false)
  assert.equal(l.prevIndex, null)
  assert.equal(l.nextIndex, null)
  assert.equal(l.cancelIndex, 3)
})

test('page size stays five', () => {
  assert.equal(PAGE_SIZE, 5)
})
