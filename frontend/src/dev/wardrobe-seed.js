// 로컬 개발 전용 — 로그인 건너뛰기 + 옷장·룩북 시드 토글.
//
// 로컬은 접속할 때마다 새 익명 Supabase 유저라 모든 탭이 비어 있다. 기준 계정의
// owned 아이템을 현재 유저 밑으로 복제하고(백엔드 /api/live/dev/wardrobe/*),
// 그 옷장으로 추천 API를 한 번 돌려 룩북 저장분을 만들어 둔다.
// 오늘 코디는 일부러 비워 둔다 — 실제 추천이 어떻게 불려오는지 그대로 보기 위해서다.
//
// 화면 왼쪽 아래 버튼 하나가 지금 필요한 것만 보여준다.
//   가입 전 → 로그인 건너뛰기 / 로그인 후 → 데이터 채우기 ↔ 비우기
// 알아서 채우지 않는다. 눌러야 채워지고, 그래야 버튼 문구와 실제 상태가 어긋나지 않는다.
//
// LB_DATA에 직접 쓰므로 03-data.jsx 뒤, 09-app.jsx 앞에서 import해야 한다.
// 이 파일과 main.jsx의 import 한 줄, backend/app/main.py의 dev 블록만 지우면 제거된다.
// 프로덕션 번들에는 import.meta.env.DEV 가드 때문에 포함되지 않는다.

const FLAG = 'lb_dev_wardrobe';                 // 'seeded' | 그 외 = 비어 있음
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
  let res;
  try {
    res = await fetch(path, init);
  } catch (e) {
    throw new Error(
      '로컬 API(8123)에 연결하지 못했어요. backend에서 '
      + '`uvicorn app.main:app --host 127.0.0.1 --port 8123` 를 켠 뒤 다시 눌러주세요.',
    );
  }
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
  await buildContent();   // 룩북에 쓸 코디를 지금 만들어 둔다. 화면에 꽂는 건 리로드 후 부팅에서.
}

async function clear() {
  await api('/api/live/dev/wardrobe/clear', { method: 'POST' });
  dropAppCaches();
  write(FLAG, 'empty');
}

/** 가입·로그인 화면을 건너뛰고 바로 앱으로. 09-app.jsx의 completeLogin과 같은 결과. */
function bypassLogin() {
  const prefs = read('lb_prefs') || { ...((window.LB_DATA || {}).DEFAULT_PREFS || {}) };
  write('lb_prefs', { ...prefs, email: prefs.email || 'dev@lookbox.local' });
  // 앱이 문자열 '1'로 읽으므로 JSON으로 감싸지 않는다.
  try { localStorage.setItem('lb_onboarded', '1'); } catch (e) { /* noop */ }
}

const isOnboarded = () => {
  try { return localStorage.getItem('lb_onboarded') === '1'; } catch (e) { return false; }
};
const isSeeded = () => read(FLAG) === 'seeded';

function mountButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  Object.assign(btn.style, {
    // 하단 탭바 + 플로팅 CTA 위로 띄운다.
    // 팝업·시트(z-index 60+)를 가리지 않되 일반 화면 위에는 남는다.
    position: 'fixed', left: '12px', bottom: '148px', zIndex: '40',
    padding: '8px 12px', borderRadius: '999px', border: '0', cursor: 'pointer',
    font: '600 12px/1 ui-sans-serif, system-ui, sans-serif', letterSpacing: '-0.01em',
    background: 'rgba(24,22,18,0.82)', color: '#fff', opacity: '0.55',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)', transition: 'opacity .15s',
  });
  btn.onmouseenter = () => { btn.style.opacity = '1'; };
  btn.onmouseleave = () => { btn.style.opacity = '0.55'; };

  // 지금 상태에서 할 일 하나만 보여준다: 가입 전이면 로그인, 그다음은 데이터.
  const label = () => (!isOnboarded() ? 'DEV · 로그인 건너뛰기'
    : isSeeded() ? 'DEV · 데이터 비우기' : 'DEV · 데이터 채우기');
  const paint = () => { btn.textContent = label(); };
  paint();

  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = 'DEV · 적용 중…';
    try {
      if (!isOnboarded()) bypassLogin();
      else if (isSeeded()) await clear();
      else await seed();
      location.reload();
    } catch (e) {
      console.error('[dev-seed] 실패:', e.message);
      btn.textContent = e.message && e.message.indexOf('8123') >= 0
        ? 'DEV · API 꺼짐'
        : 'DEV · 실패 · 콘솔 확인';
      setTimeout(() => { btn.disabled = false; paint(); }, 2800);
    }
  };

  document.body.appendChild(btn);
}

// 룩북 저장분은 App state라 서버·로컬 어디에도 남지 않는다. 채워둔 상태면 부팅마다 다시 꽂는다.
//
// 단, 꽂기 전에 옷장이 정말 남아 있는지 본다. 백엔드 시드는 지난 익명 세션의 복제본을
// 함께 걷어내므로, 다른 로컬 탭·브라우저에서 한 번 채우면 이쪽 옷장은 비고 플래그만
// 'seeded'로 남는다. 그대로 룩북을 꽂으면 옷 없는 빈 카드가 뜨니, 비었으면 안 채운
// 상태로 되돌려 라이브와 같은 빈 화면을 보여준다.
if (isSeeded()) {
  try {
    const { items } = await api('/api/live/wardrobe');
    if (items && items.length) applyContent(await buildContent());
    else { dropAppCaches(); write(FLAG, 'empty'); }
  } catch (e) {
    console.warn('[dev-seed] 옷장 확인 실패 — 데이터를 다시 채워주세요.', e.message);
  }
}

if (document.body) mountButton();
else document.addEventListener('DOMContentLoaded', mountButton, { once: true });
