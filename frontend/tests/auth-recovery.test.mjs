import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/live-bridge.js', import.meta.url), 'utf8');
function setup(methods = {}, href = 'https://realcloset.vercel.app/') {
  let listener;
  const storage = new Map();
  const window = Object.assign(new EventTarget(), { location: new URL(href), history: { replaceState() {} } });
  const context = vm.createContext({
    window, Event, URL, URLSearchParams, console,
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    createClient: () => ({ auth: { onAuthStateChange(fn) { listener = fn; }, ...methods } }),
  });
  vm.runInContext(source.slice(source.indexOf('const API_BASE'), source.indexOf('// Warm up TCP/TLS')).replaceAll('import.meta.env.', 'testEnv.'), vm.createContext(Object.assign(context, { testEnv: { VITE_API_BASE_URL: 'https://api.example', VITE_SUPABASE_URL: 'https://auth.example', VITE_SUPABASE_ANON_KEY: 'public-test-key' } })));
  return { auth: window.LB_AUTH, emit: (event, session) => listener(event, session), storage };
}

test('sign-in translates returned and thrown network failures', async () => {
  for (const signInWithPassword of [async () => ({ error: new Error('Failed to fetch') }), async () => { throw new TypeError('Failed to fetch'); }]) {
    const { auth } = setup({ signInWithPassword });
    const result = await auth.signIn('person@example.com', 'secret');
    assert.match(result.error, /인증 서버에 연결하지 못했어요/);
  }
});

test('reset request uses clean same-origin recovery URL and trims email', async () => {
  let args;
  const { auth } = setup({ resetPasswordForEmail: async (...value) => { args = value; return {}; } }, 'https://realcloset.vercel.app/?debug=1');
  assert.equal((await auth.requestPasswordReset(' person@example.com ')).error, '');
  assert.equal(args[0], 'person@example.com');
  assert.equal(args[1].redirectTo, 'https://realcloset.vercel.app/?reset=1');
});

test('reset failures stay actionable; invalid credentials remain distinct', async () => {
  const { auth } = setup({ resetPasswordForEmail: async () => { throw new Error('Failed to fetch'); }, signInWithPassword: async () => ({ error: new Error('Invalid login credentials') }) });
  assert.match((await auth.requestPasswordReset('person@example.com')).error, /인증 서버/);
  assert.match((await auth.signIn('person@example.com', 'secret')).error, /이메일 또는 비밀번호/);
});

test('query alone cannot turn an ordinary session into verified recovery', async () => {
  const session = { user: { id: 'owner' } };
  const { auth, emit, storage } = setup({ getSession: async () => ({ data: { session } }) }, 'https://realcloset.vercel.app/?reset=1');
  assert.equal(auth.recoveryActive, true);
  assert.equal(await auth.recoveryStatus(), 'expired');
  emit('PASSWORD_RECOVERY', session);
  assert.equal(await auth.recoveryStatus(), 'ready');
  assert.equal(storage.get('lb-password-recovery'), 'owner');
  auth.finishRecovery();
  assert.equal(auth.recoveryActive, false);
  assert.equal(storage.has('lb-password-recovery'), false);
});

test('expired recovery without session does not show password form', async () => {
  const { auth } = setup({ getSession: async () => ({ data: { session: null } }) }, 'https://realcloset.vercel.app/?reset=1#error=access_denied');
  assert.equal(await auth.recoveryStatus(), 'expired');
});
