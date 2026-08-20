// 옷 사진 전용 캐시. 스토리지가 Cache-Control: no-cache 로 내려주는 탓에 새로고침·재로그인
// 때마다 같은 이미지를 다시 받는다. 경로에 UUID가 들어가 내용이 바뀌지 않으므로
// 캐시 우선으로 두고, 앱 셸(HTML·JS·CSS)은 절대 건드리지 않는다(배포가 막히면 안 된다).
const CACHE = 'lb-img-v1';
const MAX_ENTRIES = 600;
const TARGET = /\/storage\/v1\/object\/public\/wardrobe\//;

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('lb-img-') && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !TARGET.test(req.url)) return;   // 이미지 외에는 개입하지 않는다
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreVary: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.status === 200) {
        cache.put(req, res.clone()).then(() => trim(cache)).catch(() => {});
      }
      return res;
    } catch (err) {
      const stale = await cache.match(req, { ignoreVary: true });
      if (stale) return stale;
      throw err;
    }
  })());
});
