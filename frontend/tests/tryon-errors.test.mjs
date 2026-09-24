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
  const finish = source.indexOf('  useEffect(() => {', begin);
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
      prefs: { avatar: 'face' }, authUid: 'owner', tryOnMakingRef: { current: null },
      tryOnAccountRef: { current: 'owner' }, tryOnPrefsRef: { current: { avatar: 'face' } },
      crypto: { randomUUID: () => 'job' }, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
      setTryOnErrors: noop, tryOnProfileKey: (p) => p.avatar, waitTryOnJob: async () => response,
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

const waitStart = source.indexOf('async function waitTryOnJob');
const waitEnd = source.indexOf('async function uploadAvatarToAccount', waitStart);
function jobWait(liveJSON) {
  return vm.runInNewContext(source.slice(waitStart, waitEnd) + '; waitTryOnJob', {
    liveJSON, setTimeout: (fn) => fn(), Date,
  });
}

test('a dropped connection reconnects to the same job without duplicate generation', async () => {
  const calls = [];
  let read = 0;
  const wait = jobWait(async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'POST') return { status: 'running' };
    read++;
    if (read === 1) throw new Error('Failed to fetch');
    if (read === 2) return { status: 'missing' };
    return { status: 'succeeded', result: { imageUrl: 'ready' } };
  });
  const result = await wait({ jobId: 'same-job', profile: { avatar: 'face' } }, () => {});
  assert.equal(result.imageUrl, 'ready');
  const posts = calls.filter((call) => call.options.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(JSON.parse(posts[0].options.body).request_id, 'same-job');
  assert.equal(calls.filter((call) => call.url.endsWith('/same-job')).length, 3);
});

test('reopening resumes an existing job and receives its result without a new POST', async () => {
  let reads = 0;
  const wait = jobWait(async (url, options) => {
    assert.notEqual(options.method, 'POST');
    return ++reads === 1 ? { status: 'running' } : { status: 'succeeded', result: { imageUrl: 'ready' } };
  });
  assert.equal((await wait({ jobId: 'existing' }, () => {})).imageUrl, 'ready');
});

test('a failed quality check is terminal and never becomes a ready image', async () => {
  const wait = jobWait(async () => ({ status: 'failed', failure: '옷 경계를 정리하지 못했어요.' }));
  await assert.rejects(wait({ jobId: 'failed' }, () => {}), /옷 경계/);
});

test('rejected starts do not loop as connectivity failures', async () => {
  const wait = jobWait(async () => { const err = new Error('로그인이 필요해요.'); err.status = 401; throw err; });
  await assert.rejects(wait({ jobId: 'unauthorized' }, () => {}), /로그인/);
});

test('changing accounts stops polling without starting a job for the new account', async () => {
  let reads = 0;
  const wait = jobWait(async () => { reads++; return { status: 'missing' }; });
  await assert.rejects(wait({ jobId: 'old-account' }, () => {}, () => false), /로그인/);
  assert.equal(reads, 0);
});
