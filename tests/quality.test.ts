import test from 'node:test'
import assert from 'node:assert/strict'

import { qualityLabel, QUALITY_OPTIONS } from '../src/main/download/quality.ts'

test('maps quality codes to labels', () => {
  assert.equal(qualityLabel('128k'), '128K')
  assert.equal(qualityLabel('192k'), '192K')
  assert.equal(qualityLabel('320k'), '320K')
  assert.equal(qualityLabel('flac'), 'FLAC')
  assert.equal(qualityLabel('flac24bit'), 'FLAC 24bit')
  assert.equal(qualityLabel('wav'), 'WAV')
  assert.equal(qualityLabel(''), '未知')
})

test('quality options are the four supported values in order', () => {
  assert.deepEqual([...QUALITY_OPTIONS], ['128k', '320k', 'flac', 'flac24bit'])
})
