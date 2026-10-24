import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/proto/09-app.jsx', import.meta.url), 'utf8');
const guide = new Function(source.slice(source.indexOf('function pickedOutfitGuide'), source.indexOf('window.pickedOutfitGuide')) + ';return pickedOutfitGuide;')();
const missing = new Function(source.slice(source.indexOf('function pickedMissingCategories'), source.indexOf('window.pickedMissingCategories')) + ';return pickedMissingCategories;')();
const items = (...categories) => categories.map(category => ({category, name: '긴 상품명은 안내에 나오지 않아요'}));
test('duplicate instructions omit product names across all categories', () => {
 for (const category of ['상의','하의','모자','신발','가방','소품']) {
  assert.equal(guide(items(category, category)), `${category} 2개 중 1개만 남겨 주세요`);
 }
});
test('missing clothing instructions follow the selected base', () => {
 assert.deepEqual(missing(items('모자','hat')), ['상의','하의']);
 assert.deepEqual(missing(items('하의')), ['상의']);
 assert.deepEqual(missing(items('top')), ['하의']);
 assert.deepEqual(missing(items('outer','skirt')), []);
 assert.deepEqual(missing(items('dress')), []);
});
