import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/proto/05-screens-cde.jsx', import.meta.url), 'utf8');

test('every multi-item flatlay uses independent cells', () => {
  assert.match(source, /function layerSafeCells\(items\)/);
  assert.match(source, /if \(owned\.length < 2\) return null/);
  assert.match(source, /function lookRectInCell\(it, im, cell, w, h, scale\)/);
  assert.match(source, /const visible = lookVisibleBox\(im\)/);
  assert.match(source, /const safeCells = layerSafeCells\(items\)/);
  assert.match(source, /ordered\.length === 5/);
  assert.match(source, /\|flat17/);
});
