// 로컬 개발 전용 — 옷장·룩북 시드 토글.
//
// 로컬은 접속할 때마다 새 익명 Supabase 유저라 모든 탭이 비어 있다. 기준 계정의
// owned 아이템을 현재 유저 밑으로 복제하고(백엔드 /api/live/dev/wardrobe/*),
// 그 옷장으로 추천 API를 한 번 돌려 룩북 저장분을 만들어 둔다.
// 오늘 코디는 일부러 비워 둔다 — 실제 추천이 어떻게 불려오는지 그대로 보기 위해서다.
// 빈 화면 UX를 보고 싶을 때만 버튼으로 전부 비운다.
//
// LB_DATA에 직접 쓰므로 03-data.jsx 뒤, 09-app.jsx 앞에서 import해야 한다.
// 이 파일과 main.jsx의 import 한 줄, backend/app/main.py의 dev 블록만 지우면 제거된다.
// 프로덕션 번들에는 import.meta.env.DEV 가드 때문에 포함되지 않는다.

const FLAG = 'lb_dev_wardrobe';                 // 'seeded' | 'empty' — 없으면 첫 세션
const CONTENT_KEY = 'lb_dev_content';           // 시드로 만든 코디 재사용(리로드마다 재추천 방지)
// 09-app.jsx / 06-today.jsx와 같은 키
const APP_CACHES = ['lb_wardrobe_cache_v1', 'lb_daily_outfits_v3', 'lb_daily_history_v1', CONTENT_KEY];
const LOOK_COUNT = 3;                           // 룩북에 저장돼 있던 척할 코디

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* noop */ } };

function dropAppCaches() {
  APP_CACHES.forEach((key) => {
    try { localStorage.removeItem(key); } catch (e) { /* noop */ }
  });
}

async function api(path, init) {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

/** 룩북에 넣을 코디를 한 번 만들어 저장해 둔다. 이후 부팅은 이 캐시를 재사용. */
async function buildContent() {
  const cached = read(CONTENT_KEY);
  if (cached && cached.outfits && cached.outfits.length) return cached;

  const payload = await api('/api/live/coordinate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ max_combos: LOOK_COUNT, style: 'dandy' }),
  });
  const content = { outfits: payload.outfits || [], items: payload.items || [] };
  write(CONTENT_KEY, content);
  return content;
}

function applyContent(content) {
  const D = window.LB_DATA;
  if (!D || !content || !content.outfits.length) return;

  // 룩북 카드가 참조할 코디·아이템을 메모리에 올린다.
  content.items.forEach((it) => { D.ALL[it.id] = it; });
  content.outfits.forEach((o) => { D.OUTFIT_BY_ID[o.id] = o; });

  // 룩북 저장분은 서버·로컬 어디에도 남지 않아서(App state) 부팅마다 다시 꽂는다.
  D.SAVED.splice(0, D.SAVED.length, ...content.outfits.slice(0, LOOK_COUNT).map((o, i) => ({
    id: `dev-look-${i}`,
    outfitId: o.id,
    label: o.label || '저장한 코디',
    savedAt: '어제',
  })));

  // 오늘 코디는 기본 off라 안내 화면이 뜬다. 켜만 두고 코디는 채우지 않는다
  // — 탭에 들어갔을 때 실제 추천 요청이 도는 걸 그대로 보기 위해서다.
  const prefs = read('lb_prefs') || { ...(D.DEFAULT_PREFS || {}) };
  if (!prefs.dailyEnabled) write('lb_prefs', { ...prefs, dailyEnabled: true });
}

async function seed() {
  await api('/api/live/dev/wardrobe/seed', { method: 'POST' });
  dropAppCaches();
  write(FLAG, 'seeded');
}

async function clear() {
  await api('/api/live/dev/wardrobe/clear', { method: 'POST' });
  dropAppCaches();
  write(FLAG, 'empty');
}

function mountButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  Object.assign(btn.style, {
    // 하단 탭바 + 플로팅 CTA 위로 띄운다.
    position: 'fixed', left: '12px', bottom: '148px', zIndex: '2147483000',
    padding: '8px 12px', borderRadius: '999px', border: '0', cursor: 'pointer',
    font: '600 12px/1 ui-sans-serif, system-ui, sans-serif', letterSpacing: '-0.01em',
    background: 'rgba(24,22,18,0.82)', color: '#fff', opacity: '0.55',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)', transition: 'opacity .15s',
  });
  btn.onmouseenter = () => { btn.style.opacity = '1'; };
  btn.onmouseleave = () => { btn.style.opacity = '0.55'; };

  const isSeeded = () => read(FLAG) !== 'empty';
  const paint = () => { btn.textContent = isSeeded() ? 'DEV · 데이터 비우기' : 'DEV · 데이터 복구'; };
  paint();

  btn.onclick = async () => {
    const seeded = isSeeded();
    btn.disabled = true;
    btn.textContent = 'DEV · 적용 중…';
    try {
      if (seeded) await clear();
      else { await seed(); await buildContent(); }
      location.reload();
    } catch (e) {
      console.error('[dev-seed]', e);
      btn.disabled = false;
      paint();
    }
  };

  document.body.appendChild(btn);
}

// 앱이 옷장을 부르기 전에 미리 채운다(리로드 불필요).
// 백엔드에 DEV_SEED_SOURCE_USER가 없으면 404 → 버튼도 띄우지 않는다.
let enabled = true;
if (read(FLAG) !== 'empty') {
  try {
    if (read(FLAG) === null) await seed();
    applyContent(await buildContent());
  } catch (e) {
    enabled = false;
    console.warn('[dev-seed] 비활성 — backend .env의 DEV_SEED_SOURCE_USER를 확인하세요.', e.message);
  }
}

if (enabled) {
  if (document.body) mountButton();
  else document.addEventListener('DOMContentLoaded', mountButton, { once: true });
}
