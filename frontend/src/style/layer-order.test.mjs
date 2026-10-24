import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasElements, moveCanvasElement } from './layer-order.js';

const order = look => canvasElements(look).map(x => x.key);
const example = () => ({ items: [{ id: 'shirt', z: 1, x: 30, scale: 28 }], decorations: [{ id: 'photo', type: 'image', z: 2 }, { id: 'title', type: 'text', z: 20 }] });

test('new clothes are placed above existing feed images and text, even with an inherited low rank', () => {
  const original = example();
  const look = { ...original, items: [...original.items, { id: 'new-coat', z: 0, x: 70, rotation: 12 }] };
  const result = moveCanvasElement(look, 'new-coat', 'front');
  assert.deepEqual(order(result), ['shirt', 'layer:photo', 'layer:title', 'new-coat']);
  assert.equal(result.items[1].x, 70);
  assert.equal(result.items[1].rotation, 12);
  assert.equal(look.items[1].z, 0);
  assert.equal(original.decorations[1].z, 20);
});

test('one-step order controls cross both clothes and image boundaries', () => {
  const look = example();
  const forward = moveCanvasElement(look, 'shirt', 'forward');
  assert.deepEqual(order(forward), ['layer:photo', 'shirt', 'layer:title']);
  const back = moveCanvasElement(forward, 'shirt', 'backward');
  assert.deepEqual(order(back), order(look));
  assert.deepEqual(order(moveCanvasElement(back, 'layer:title', 'backward')), ['shirt', 'layer:title', 'layer:photo']);
});

test('bounds and missing selections do not change the document', () => {
  const look = example();
  assert.equal(moveCanvasElement(look, 'shirt', 'backward'), look);
  assert.equal(moveCanvasElement(look, 'layer:title', 'forward'), look);
  assert.equal(moveCanvasElement(look, 'missing', 'forward'), look);
});

test('legacy fallback layers and high ranks remain ordered and compact after insertion', () => {
  const look = { items: [{ id: 'new', z: 0 }], decorations: [{ id: 'old' }, { id: 'high', z: 1500 }] };
  const moved = moveCanvasElement(look, 'new', 'front');
  assert.deepEqual(order(moved), ['layer:old', 'layer:high', 'new']);
  assert.equal(Math.max(...canvasElements(moved).map(x => x.z)), 3);
  assert.deepEqual(order(JSON.parse(JSON.stringify(moved))), order(moved));
});
