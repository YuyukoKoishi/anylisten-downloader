import test from 'node:test'
import assert from 'node:assert/strict'

import { sanitizeFileName, inferExtension } from '../src/main/download/fileName.ts'

// 缺陷 1：以点结尾的文件名在 Windows 上非法，sanitize 必须清掉
test('strips trailing dots which are illegal on windows', () => {
  assert.equal(sanitizeFileName('song.'), 'song')
  assert.equal(sanitizeFileName('song...'), 'song')
  assert.equal(sanitizeFileName('a. . '), 'a')
})

// 缺陷 2：Windows 保留设备名不能作为文件名
test('avoids windows reserved device names', () => {
  assert.notEqual(sanitizeFileName('CON'), 'CON')
  assert.notEqual(sanitizeFileName('nul'), 'nul')
  assert.notEqual(sanitizeFileName('COM1'), 'COM1')
  assert.ok(sanitizeFileName('console').startsWith('console'))
})

// 缺陷 3：扩展名推断对未知音质应回退到 mp3 而非空
test('unknown quality falls back to mp3', () => {
  assert.equal(inferExtension('hires'), 'mp3')
  assert.equal(inferExtension('atmos'), 'mp3')
  assert.equal(inferExtension(''), 'mp3')
})
