import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/proto/09-app.jsx', import.meta.url), 'utf8');

test('daily recommendations do not wait for a fresh location lookup', () => {
  const start = source.indexOf('const requestDailyOutfits');
  const chunk = source.slice(start, start + 2600);

  assert.match(chunk, /void refreshDeviceWeather\(\)/);
  assert.doesNotMatch(chunk, /await refreshDeviceWeather\(\)/);
});

test('device weather is cached for the local day', () => {
  assert.match(source, /const DEVICE_WEATHER_CACHE_BASE = 'lb_device_weather_v2'/);
  assert.match(source, /cached\.date === localYmd\(\)/);
  assert.match(source, /maximumAge: 24 \* 60 \* 60 \* 1000/);
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
