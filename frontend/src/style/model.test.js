import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_ITEMS, newLook, remix, safeDraft } from './model.js';
test('remix uses each actual owned item once and leaves missing categories as samples', () => {
  const source=newLook([SAMPLE_ITEMS[0], {...SAMPLE_ITEMS[0],id:"second-shirt"}, SAMPLE_ITEMS[1], SAMPLE_ITEMS[2]]);
  const owned=[{id:'my-shirt',category:'상의',name:'내 셔츠',img:'/prototype-assets/shirt.webp'}];
  const result=remix(source,owned);
  assert.equal(result.matched,1);
  assert.equal(result.items.filter(x=>x.kind==='owned').length,1);
  assert.equal(result.items.filter(x=>x.kind==='sample').length,3);
  assert.equal(source.items[0].kind,'sample');
  assert.equal(owned.length,1);
  assert.equal(result.privacy,'public');
  assert.equal(result.origin.id,source.id);
});
test('starting a new version removes sharing and photo publication', () => {
  const draft=safeDraft({privacy:'public',share:'secret',includePhoto:true,photo:'private-photo'});
  assert.equal(draft.privacy,'private');
  assert.equal(draft.share,null);
  assert.equal(draft.includePhoto,false);
  assert.equal(draft.photo,'private-photo');
});

test('new feed defaults to public while photo publication stays disabled', () => {
  const look=newLook();
  assert.equal(look.privacy,'public');
  assert.equal(look.includePhoto,false);
});
