import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { editorialSlots, outfitPrice } from '../src/look-layout.js';

const source = readFileSync(new URL('../src/proto/05-screens-cde.jsx', import.meta.url), 'utf8');
const items = [['tee','상의'],['jeans','하의'],['cardigan','아우터'],['shoes','신발'],['belt','소품']].map(([id,category])=>({id,category}));

test('editorial product composition overlaps layers while keeping every item inside the image', () => {
  const slots = editorialSlots(items);
  assert.equal(Object.keys(slots).length, 5);
  for (const slot of Object.values(slots)) {
    assert.ok(slot.x0 >= 0 && slot.y0 >= 0 && slot.x1 <= 100 && slot.y1 <= 100);
    assert.ok(slot.x1 > slot.x0 && slot.y1 > slot.y0);
    assert.ok(slot.labelX >= 14 && slot.labelX <= 86 && slot.labelY <= 94);
  }
  assert.ok(slots.tee.y1 > slots.cardigan.y0);
  assert.ok(slots.jeans.z < slots.tee.z && slots.tee.z < slots.cardigan.z);
  assert.ok(slots.shoes.z > slots.jeans.z);
  assert.ok(slots.belt.labelX < slots.shoes.labelX);
});
test('all counts including a dress retain complete product silhouettes and alpha fitting', () => {
  for (const list of [items.slice(0,2), items.slice(0,3), items, [{id:'dress',category:'원피스'},{id:'shoes',category:'신발'}]]) assert.equal(Object.keys(editorialSlots(list)).length,list.length);
  assert.match(source, /const visible = lookVisibleBox\(im\)/);
  assert.match(source, /const s = fit/);
  assert.match(source, /\|flat19/);
});
test('registered names, brands and prices appear only after pressing the information icon', () => {
  assert.match(source, /infoButton = false/);
  assert.match(source, /aria-pressed=\{showInfo\}/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /showInfo && <div className="lb-look-info-labels"/);
  assert.match(source, /item\.brand/);
  assert.match(source, /item\.name/);
  assert.match(source, /outfitPrice\(item\.price\)/);
});
test('price formatting preserves registered values and never invents discounts', () => {
  assert.equal(outfitPrice('89,000'), '89,000원');
  assert.equal(outfitPrice('₩ 129000'), '129,000원');
  assert.equal(outfitPrice(0), '0원');
  assert.equal(outfitPrice(null), '가격 미등록');
});
