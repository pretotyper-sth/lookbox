export function validWeather(weather) {
  return !!weather && ['temp', 'hi', 'lo'].every(key => weather[key] != null && Number.isFinite(Number(weather[key])))
    && !!weather.cond && weather.cond !== '날씨 정보' && weather.status !== 'error';
}

export function currentPosition(geolocation, timeoutMs = 3000) {
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    if (!geolocation) { finish(null); return; }
    try {
      geolocation.getCurrentPosition(value => {
        const coords = value && value.coords;
        finish(coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude) ? coords : null);
      }, () => finish(null), { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 24 * 60 * 60 * 1000 });
    } catch { finish(null); }
  });
}

async function weatherJSON(url, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(url, { signal: controller.signal, credentials: 'omit' });
        if (!response.ok) throw new Error('Weather unavailable');
        return response.json();
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Weather timeout')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); controller.abort(); }
}

function condition(code) {
  if (code === 0) return '맑음';
  if (code === 1) return '대체로 맑음';
  if (code === 2) return '구름 조금';
  if (code === 3) return '흐림';
  if (code === 45 || code === 48) return '안개';
  if (code >= 51 && code <= 57) return '이슬비';
  if (code >= 61 && code <= 67) return '비';
  if (code >= 71 && code <= 77) return '눈';
  if (code >= 80 && code <= 82) return '소나기';
  if (code === 85 || code === 86) return '눈';
  if (code >= 95 && code <= 99) return '뇌우';
  return '날씨 정보';
}

export async function loadCurrentWeather({ geolocation, fetchImpl = fetch, timeoutMs = 10000, locationTimeoutMs = 3000 }) {
  const position = await currentPosition(geolocation, locationTimeoutMs);
  const latitude = position ? position.latitude : 37.5665;
  const longitude = position ? position.longitude : 126.9780;
  const query = position ? `?lat=${latitude.toFixed(4)}&lon=${longitude.toFixed(4)}` : '';
  const checked = weather => {
    if (!validWeather(weather)) throw new Error('Weather has no observation');
    return { ...weather, city: weather.cityResolved === false || !weather.city ? (position ? '현재 위치' : '서울') : weather.city, status: 'ready', cityResolved: true };
  };
  const server = weatherJSON('/api/live/weather' + query, fetchImpl, timeoutMs).then(checked);
  const direct = weatherJSON(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}`
    + '&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul&forecast_days=1',
    fetchImpl, timeoutMs,
  ).then(raw => {
    const current = raw.current || {}, daily = raw.daily || {};
    const rounded = value => value == null ? null : Math.round(Number(value));
    return checked({
      city: position ? '현재 위치' : '서울', cityResolved: true,
      temp: rounded(current.temperature_2m), feels: rounded(current.apparent_temperature ?? current.temperature_2m),
      hi: rounded(daily.temperature_2m_max?.[0]), lo: rounded(daily.temperature_2m_min?.[0]),
      cond: condition(current.weather_code), source: position ? 'device' : 'fallback',
    });
  });
  return Promise.any([server, direct]);
}
