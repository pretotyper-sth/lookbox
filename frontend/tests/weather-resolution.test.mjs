import test from 'node:test';
import assert from 'node:assert/strict';
import { currentPosition, loadCurrentWeather, validWeather } from '../src/weather.js';

const raw = { current: { temperature_2m: 18.4, apparent_temperature: 0, weather_code: 0 }, daily: { temperature_2m_max: [23.1], temperature_2m_min: [13.7] } };
const response = data => ({ ok: true, json: async () => data });

test('GPS without a callback or permission answer has a hard deadline', async () => {
  assert.equal(await currentPosition({ getCurrentPosition() {} }, 5), null);
});
test('denied or unavailable location resolves without stalling', async () => {
  assert.equal(await currentPosition(null, 5), null);
  assert.equal(await currentPosition({ getCurrentPosition(_, fail) { fail(); } }, 5), null);
});
test('failed backend placeholders are replaced by actual browser observations', async () => {
  const weather = await loadCurrentWeather({ geolocation: null, fetchImpl: async url => response(url.startsWith('/api/') ? { temp: 24, hi: 27, lo: 18, cond: '날씨 정보' } : raw) });
  assert.equal(weather.temp, 18);
  assert.equal(weather.hi, 23);
  assert.equal(weather.lo, 14);
  assert.equal(weather.feels, 0);
  assert.equal(weather.cond, '맑음');
  assert.equal(weather.city, '서울');
  assert.equal(weather.status, 'ready');
});
test('a stalled backend cannot hold up the direct weather result', async () => {
  const weather = await loadCurrentWeather({ geolocation: null, timeoutMs: 10, fetchImpl: url => url.startsWith('/api/') ? new Promise(() => {}) : Promise.resolve(response(raw)) });
  assert.equal(weather.temp, 18);
});
test('device coordinates are used by both recovery paths', async () => {
  const urls = [];
  const geolocation = { getCurrentPosition(ok) { ok({ coords: { latitude: 35.1796, longitude: 129.0756 } }); } };
  const weather = await loadCurrentWeather({ geolocation, fetchImpl: async url => { urls.push(url); return response(url.startsWith('/api/') ? {} : raw); } });
  assert.match(urls[0], /lat=35.1796&lon=129.0756/);
  assert.match(urls[1], /latitude=35.1796&longitude=129.0756/);
  assert.equal(weather.city, '현재 위치');
});
test('both sources failing finishes with an error, never fabricated temperatures', async () => {
  await assert.rejects(loadCurrentWeather({ geolocation: null, timeoutMs: 5, fetchImpl: () => new Promise(() => {}) }));
  assert.equal(validWeather({ temp: null, hi: null, lo: null, cond: '맑음' }), false);
  assert.equal(validWeather({ temp: 0, hi: 2, lo: -1, cond: '맑음' }), true);
});
