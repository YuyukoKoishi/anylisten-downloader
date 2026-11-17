import test from 'node:test'
import assert from 'node:assert/strict'

import { sanitizeFileName, buildFileName, inferExtension, formatSize } from '../src/main/download/fileName.ts'

test('replaces illegal characters and collapses spaces', () => {
  assert.equal(sanitizeFileName('AC/DC: Live'), 'AC DC Live')
  assert.equal(sanitizeFileName('  a   b  '), 'a b')
  assert.equal(sanitizeFileName('x\u0000y'), 'x y')
})

test('truncates to 120 chars and falls back for empty', () => {
  assert.equal(sanitizeFileName('a'.repeat(200)).length, 120)
  assert.equal(sanitizeFileName('///'), 'unknown')
})

test('fills template vars and keeps unknown placeholders', () => {
  assert.equal(buildFileName('{name} - {singer}', { name: '晴天', singer: '周杰伦' }), '晴天 - 周杰伦')
  assert.equal(buildFileName('{name}-{album}', { name: '晴天', album: 'A/B' }), '晴天-A B')
  assert.equal(buildFileName('{name}{missing}', { name: '晴天' }), '晴天{missing}')
})

test('infers extension from quality', () => {
  assert.equal(inferExtension('flac'), 'flac')
  assert.equal(inferExtension('flac24bit'), 'flac')
  assert.equal(inferExtension('wav'), 'wav')
  assert.equal(inferExtension('320k'), 'mp3')
  assert.equal(inferExtension('128k'), 'mp3')
})
test('formats byte sizes', () => {
  assert.equal(formatSize(0), '0 B')
  assert.equal(formatSize(512), '512 B')
  assert.equal(formatSize(1536), '1.50 KB')
  assert.equal(formatSize(5 * 1024 * 1024), '5.00 MB')
})
