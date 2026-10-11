import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/live-bridge.js', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('let refreshInFlight = null'), source.indexOf('async function renewAnonymousSession()'));
const setup = refreshSession => {
  const context = vm.createContext({ supabase: { auth: { refreshSession } } });
  vm.runInContext(helper, context);
  return () => vm.runInContext('refreshAccountToken()', context);
};

test('concurrent unauthorized requests share one account refresh and allow later refresh', async () => {
  let calls = 0;
  const refresh = setup(async () => { calls++; return { data: { session: { access_token: 'new-account-token' } } }; });
  assert.deepEqual(await Promise.all([refresh(), refresh()]), ['new-account-token', 'new-account-token']);
  assert.equal(calls, 1);
  assert.equal(await refresh(), 'new-account-token');
  assert.equal(calls, 2);
});

test('failed account refresh preserves the existing session', async () => {
  const refresh = setup(async () => ({ data: {}, error: new Error('expired refresh token') }));
  assert.equal(await refresh(), null);
});
