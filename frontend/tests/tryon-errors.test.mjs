import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/proto/09-app.jsx', import.meta.url), 'utf8');
const start = source.indexOf('function formatTryOnErr');
const end = source.indexOf('async function uploadAvatarToAccount', start);
const format = vm.runInNewContext(source.slice(start, end) + '; formatTryOnErr');

test('try-on errors never leak English codes or line breaks', () => {
  for (const raw of ['', 'Failed to fetch', 'TimeoutError', '이미지를 만들지 못했어요.\n(코드: APIError)', '옷 경계를 정리하지 못했어요.\n다시 시도해 주세요.', '사진 오류 APIError 다시 시도해 주세요.']) {
    const message = format(raw);
    assert.match(message, /[가-힣]/);
    assert.doesNotMatch(message, /[a-zA-Z\r\n]/);
  }
});

test('incomplete or unvalidated responses cannot save a successful result', async () => {
  const begin = source.indexOf('const makeTryOnBody = async');
  const finish = source.indexOf('const openTryOnSetup', begin);
  for (const response of [
    { imageUrl: 'body' },
    { imageUrl: 'body', validated: true, assets: { body: 'body', top: 'top' } },
    { imageUrl: 'body', assets: { body: 'body', top: 'top', bottom: 'bottom', full: 'full' } },
    { imageUrl: 'body', validated: true, assets: { body: 'body', top: 'top', bottom: 'bottom', full: 'full' } },
  ]) {
    let saved = false;
    let failed = false;
    const noop = () => {};
    const make = vm.runInNewContext(source.slice(begin, finish) + '; makeTryOnBody', {
      prefs: { avatar: 'face' }, tryOnMakingRef: { current: false },
      formatTryOnErr: format, setTryOnMakingSubject: noop, setTryOnMaking: noop,
      setTryOnProgress: noop, liveJSON: async () => response,
      setPrefs: () => { saved = true; }, reloadBilling: noop, showToast: noop,
    });
    const result = await make({ silent: true, onFail: () => { failed = true; } });
    const valid = response.validated === true && !!response.assets.full;
    assert.equal(saved, valid);
    assert.equal(failed, !valid);
    assert.equal(result, valid ? 'body' : '');
  }
});
