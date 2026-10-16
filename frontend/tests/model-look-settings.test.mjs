import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../src/proto/09-app.jsx', import.meta.url), 'utf8');
function handler(name, end) {
  const start = source.indexOf(`  const ${name} =`);
  return source.slice(start, source.indexOf(end, start)) + `\n${name}`;
}
for (const change of ['account', 'off', 'on', 'setup']) {
  test(`${change} preserves completed images and saves settings for the next request`, () => {
    const outfit = { id: 'existing', lookImg: 'saved-image.png', itemIds: ['shirt'] };
    let saved;
    const context = {
      prefs: { personalModelLook: true, personalModelLookDontAsk: true, avatar: 'old', height: '178', weight: '74' },
      LB_DATA: { DAILY: [outfit] },
      setPrefs: value => { saved = value; }, persistPrefs: () => {},
      setAccountSheet: () => {}, setPersonalSetupOpen: () => {}, showToast: () => {},
      emptyTryOnAssets: () => ({}),
    };
    const name = change === 'account' ? 'saveAccount' : change === 'setup' ? 'savePersonalModelLook' : 'onTogglePersonalModelLook';
    const end = change === 'account' ? '  const logout' : change === 'setup' ? '  const requestDailyOutfits' : '  const savePersonalModelLook';
    const fn = vm.runInNewContext(handler(name, end), context);
    fn(change === 'off' ? false : change === 'on' ? true : { avatar: 'new', height: '182', weight: '80' });
    assert.equal(outfit.lookImg, 'saved-image.png');
    assert.ok(saved);
    if (change === 'account' || change === 'setup') assert.equal(saved.height, '182');
    else assert.equal(saved.personalModelLook, change === 'on');
  });
}
test('prompt revision changes cannot invalidate completed images', () => {
  assert.doesNotMatch(source, /delete\s+\w+\.lookImg/);
  const start = source.indexOf('const applyModelLooks =');
  assert.match(source.slice(start, start + 500), /!o\.lookImg/);
});
