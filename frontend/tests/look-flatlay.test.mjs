import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/proto/05-screens-cde.jsx', import.meta.url), 'utf8');

test('outerwear and tops use independent flatlay cells', () => {
  assert.match(source, /function layerSafeCells\(items\)/);
  assert.match(source, /if \(!outer\.length \|\| !top\.length\) return null/);
  assert.match(source, /function lookRectInCell\(it, im, cell, w, h, scale\)/);
  assert.match(source, /const visible = lookVisibleBox\(im\)/);
  assert.match(source, /const safeCells = layerSafeCells\(items\)/);
  assert.match(source, /\|flat16/);
});
