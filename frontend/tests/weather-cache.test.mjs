import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/proto/09-app.jsx', import.meta.url), 'utf8');
const todaySource = readFileSync(new URL('../src/proto/06-today.jsx', import.meta.url), 'utf8');

test('daily recommendations do not wait for a fresh location lookup', () => {
  const start = source.indexOf('const requestDailyOutfits');
  const chunk = source.slice(start, start + 2600);

  assert.match(chunk, /void refreshDeviceWeather\(\)/);
  assert.doesNotMatch(chunk, /await refreshDeviceWeather\(\)/);
});

test('device weather is cached for the local day', () => {
  assert.match(source, /const DEVICE_WEATHER_CACHE_BASE = 'lb_device_weather_v4'/);
  assert.match(source, /cached\.date === localYmd\(\)/);
  assert.match(source, /cached\.weather\.city !== '현재 위치'/);
  assert.match(source, /maximumAge: 24 \* 60 \* 60 \* 1000/);
});

test('hosted pages do not request a local-only order cancellation endpoint', () => {
  const start = source.indexOf('function liveOrderCancel()');
  const chunk = source.slice(start, start + 500);
  assert.match(chunk, /if \(!\/\^\(localhost\|127\\\.0\\\.0\\\.1/);
  assert.match(chunk, /return Promise\.resolve\(null\)/);
});

test('mobile daily cards use the product composition and omit the image copy control', () => {
  assert.match(todaySource, /const displayOutfit = !showModelLook/);
  assert.match(todaySource, /showModelLook=\{wide\}/);
  assert.doesNotMatch(todaySource, /<LookComposite outfit=\{outfit\} items=\{items\} ratio="4 \/ 5" looking=\{looking\} copyButton/);
});

test('new-item recommendations can be disabled', () => {
  assert.match(source, /const wishCount = Math\.max\(0, Math\.min\(dailyCount/);
  assert.match(source, /wishCount: Math\.max\(0, Math\.min\(dailyCount/);
});

test('daily recommendations are not cut off while the server is still generating', () => {
  const start = source.indexOf('async function readProgressStream');
  const stream = source.slice(start, source.indexOf('function formatTryOnErr', start));
  const liveJsonStart = source.indexOf('async function liveJSON');
  const liveJson = source.slice(liveJsonStart, source.indexOf('function formatTryOnErr', liveJsonStart));

  assert.match(stream, /const deadline = timeoutMs \? Date\.now\(\) \+ timeoutMs : 0/);
  assert.match(liveJson, /const streamTimeoutMs = options\.streamTimeoutMs \|\| 0/);
  assert.match(liveJson, /onEmbed, streamTimeoutMs\)/);
});

test('daily cards are revealed one at a time at a steady cadence', () => {
  assert.match(source, /const DAILY_REVEAL_INTERVAL_MS = 360/);
  assert.match(source, /dailyRevealQueue\.push\(\{ outfits: \[outfit\]/);
  assert.match(source, /setTimeout\(revealNextDaily, DAILY_REVEAL_INTERVAL_MS\)/);
  assert.match(source, /await waitForDailyReveal\(\)/);
});
