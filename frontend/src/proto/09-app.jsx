/* @prototype-ported */
const React = window.React;
const ReactDOM = window.ReactDOM;
const { BottomSheet, useEscapeClose } = window;
const { AccountEditSheet, AddSheet, BottomNav, Btn, DetailScreen, Eyebrow, Icon, ImageViewer, ItemDetailSheet, ItemRemoveSheet, LB_DATA, Landing, LookbookScreen, MyPageScreen, Onboarding, ResultsScreen, SAVED, TodayScreen, TweakColor, TweakRadio, TweakSection, TweakToggle, TweaksPanel, WARDROBE, WardrobeScreen, Wordmark, useTweaks } = window;

/* global React, ReactDOM, LB_DATA, useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakToggle,
   Wordmark, BottomNav, WardrobeScreen, AddSheet, ResultsScreen, LookbookScreen, DetailScreen, Btn, Icon, ItemDetailSheet */
// LOOKBOX — app shell: routing, state, responsive layout, tweaks.

const { useState, useEffect, useRef, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#1A1A1A",
  "wardrobeState": "full",
  "tone": "ivory",
  "autoAddDetails": false,
  "detectCount": "3",
  "dailyCount": "4"
}/*EDITMODE-END*/;

// A per-file global (window.LB_FORCE_DETECT) or ?detect= URL param seeds the INITIAL
// detect count — but the Tweaks panel stays the source of truth so it still reflects.
(function () {
  let forced = (typeof window !== 'undefined' && window.LB_FORCE_DETECT) || null;
  if (!forced) { try { forced = new URLSearchParams(location.search).get('detect'); } catch (e) { /* noop */ } }
  if (forced) TWEAK_DEFAULTS.detectCount = String(Math.max(1, parseInt(forced, 10) || 3));
})();

const TONES = {
  ivory: { '--ivory': '#EFEDE8', '--surface': '#F7F5F0', '--surface-2': '#FBFAF7', '--thumb-bg': '#E5E3DE', '--line': '#E0DCD2', '--line-2': '#D3CEC2', '--badge-bg': '#E6E2D9' },
  paper: { '--ivory': '#F2F1EE', '--surface': '#FBFAF8', '--surface-2': '#FFFFFF', '--thumb-bg': '#E6E4DF', '--line': '#E7E5DF', '--line-2': '#DAD7CF', '--badge-bg': '#ECEAE3' },
};

function param(name) {
  try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
}

const APP_TABS = ['wardrobe', 'lookbook', 'today', 'mypage'];
function readTabFromUrl() {
  const t = param('tab');
  return APP_TABS.includes(t) ? t : null;
}
function persistTab(id) {
  if (!APP_TABS.includes(id)) return;
  try {
    const u = new URL(location.href);
    // showcase (?screen=)는 캔버스용 — tab 파라미터로 덮지 않음
    if (u.searchParams.get('screen')) return;
    u.searchParams.set('tab', id);
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  } catch (e) { /* noop */ }
}

function seedItems(ws) {
  if (ws === 'empty') return [];
  if (ws === 'partial') return LB_DATA.WARDROBE.slice(0, 2);
  return LB_DATA.WARDROBE.slice();
}

// Cache the last-known wardrobe locally so a refresh paints the real list
// instantly (no empty-state flash) while the network fetch reconciles.
const WARDROBE_CACHE_KEY = 'lb_wardrobe_cache_v1';
function readWardrobeCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WARDROBE_CACHE_KEY) || 'null');
    if (!parsed || !Array.isArray(parsed.owned)) return null;
    return { owned: parsed.owned, archived: Array.isArray(parsed.archived) ? parsed.archived : [] };
  } catch (e) { return null; }
}
function writeWardrobeCache(owned, archived) {
  try { localStorage.setItem(WARDROBE_CACHE_KEY, JSON.stringify({ owned, archived })); } catch (e) { /* noop */ }
}

// 당일 추천 코디 캐시 — v3: owned-only 스냅샷(삭제·보관 아이템 재유입 방지)
const DAILY_CACHE_KEY = 'lb_daily_outfits_v3';
const DAILY_CACHE_LEGACY_KEYS = ['lb_daily_outfits_v2'];
function localYmd() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function wardrobeSigOf(list) {
  return (list || []).map((it) => it && it.id).filter(Boolean).map(String).sort().join(',');
}
function readDailyCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAILY_CACHE_KEY) || 'null');
    if (!parsed || parsed.date !== localYmd() || !Array.isArray(parsed.outfits) || !parsed.outfits.length) return null;
    return parsed;
  } catch (e) { return null; }
}
function writeDailyCache({ style, outfits, items, wardrobeSig, wardrobeCount }) {
  try {
    const sig = wardrobeSig != null ? wardrobeSig : wardrobeSigOf(items);
    localStorage.setItem(DAILY_CACHE_KEY, JSON.stringify({
      date: localYmd(),
      style: style || '',
      outfits: outfits || [],
      items: items || [],
      wardrobeSig: sig || '',
      wardrobeCount: wardrobeCount != null ? wardrobeCount : (items || []).length,
    }));
  } catch (e) { /* noop */ }
}
function clearDailyCache() {
  try {
    localStorage.removeItem(DAILY_CACHE_KEY);
    DAILY_CACHE_LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* noop */ }
}
function dailyWardrobeGrewSinceCache(ownedItems) {
  const cached = readDailyCache();
  if (!cached) return false;
  const nowSig = wardrobeSigOf(ownedItems);
  if (cached.wardrobeSig) return cached.wardrobeSig !== nowSig;
  if (typeof cached.wardrobeCount === 'number') return (ownedItems || []).length > cached.wardrobeCount;
  const used = new Set();
  (cached.outfits || []).forEach((o) => (o.itemIds || []).forEach((id) => used.add(String(id))));
  const owned = ownedItems || [];
  if (owned.some((it) => it && it.id && !used.has(String(it.id)))) return true;
  return owned.length > used.size;
}
const DAILY_APPEND_BATCH = 2;
function ownedIdSet(ownedItems) {
  return new Set((ownedItems || []).map((it) => it && (it.id || it.serverId)).filter(Boolean).map(String));
}
/** owned에 있는 id만 남긴 코디. 2개 미만·상의/하의 미달이면 버린다. */
function sanitizeDailyOutfit(outfit, owned) {
  if (!outfit) return null;
  const ids = (outfit.itemIds || []).map(String).filter((id) => owned.has(id));
  if (ids.length < 2) return null;
  if (ids.length === (outfit.itemIds || []).length) return outfit;
  return { ...outfit, itemIds: ids };
}
function outfitHasTopAndBottom(outfit, ownedItems) {
  const byId = {};
  (ownedItems || []).forEach((it) => {
    if (it && it.id != null) byId[String(it.id)] = it;
  });
  const buckets = (outfit.itemIds || []).map((id) => {
    const it = byId[String(id)] || LB_DATA.ALL[id];
    const cat = ((it && it.category) || '').toLowerCase();
    if (cat === '상의' || cat === '아우터' || cat === 'top' || cat === 'outer') return 'top';
    if (cat === '하의' || cat === 'bottom') return 'bottom';
    if (cat === '원피스' || cat === 'dress') return 'dress';
    return 'other';
  });
  if (buckets.includes('dress')) return true;
  return buckets.includes('top') && buckets.includes('bottom');
}
function filterDailyOutfitsByOwned(outfits, ownedItems) {
  const owned = ownedIdSet(ownedItems);
  const out = [];
  (outfits || []).forEach((o) => {
    const next = sanitizeDailyOutfit(o, owned);
    if (next && outfitHasTopAndBottom(next, ownedItems)) out.push(next);
  });
  return out;
}
function dailyCacheItemsFromOwned(ownedItems, outfits) {
  const used = new Set();
  (outfits || []).forEach((o) => (o.itemIds || []).forEach((id) => used.add(String(id))));
  return (ownedItems || []).filter((it) => it && used.has(String(it.id || it.serverId)));
}
/** LB_DATA.DAILY + 로컬 캐시를 현재 owned 옷장에 맞게 정리. 제거된 코디 수를 반환. */
function pruneDailyAgainstOwned(ownedItems) {
  const cached = readDailyCache();
  // 메모리가 비어 있어도 당일 캐시가 있으면 먼저 복원. (비어 있다고 캐시를 지우면 탭 재진입마다 재추천됨)
  if (!LB_DATA.DAILY.length && cached && cached.outfits && cached.outfits.length) {
    const hydrated = filterDailyOutfitsByOwned(cached.outfits, ownedItems);
    if (hydrated.length) {
      liveApplyPayload({
        outfits: hydrated,
        items: dailyCacheItemsFromOwned(ownedItems, hydrated),
      }, 'daily');
      if (hydrated.length !== cached.outfits.length) {
        writeDailyCache({
          style: cached.style || '',
          outfits: hydrated,
          items: dailyCacheItemsFromOwned(ownedItems, hydrated),
          wardrobeSig: cached.wardrobeSig,
          wardrobeCount: cached.wardrobeCount,
        });
      }
    } else {
      clearDailyCache();
      return 0;
    }
  }
  const before = LB_DATA.DAILY.length;
  const kept = filterDailyOutfitsByOwned(LB_DATA.DAILY, ownedItems);
  const removed = before - kept.length;
  if (removed) LB_DATA.DAILY.splice(0, LB_DATA.DAILY.length, ...kept);
  if (!kept.length) {
    // 실제로 무효화된 코디가 있을 때만 캐시 삭제 (메모리만 비어 있던 경우는 위에서 처리)
    if (before > 0) clearDailyCache();
    return removed;
  }
  const latestCache = readDailyCache();
  if (removed) {
    // 옷 삭제로 코디가 줄었을 때만 캐시 갱신. wardrobeSig는 유지해 '옷장 증가' CTA가 살아있게.
    writeDailyCache({
      style: (latestCache && latestCache.style) || '',
      outfits: kept,
      items: dailyCacheItemsFromOwned(ownedItems, kept),
      wardrobeSig: (latestCache && latestCache.wardrobeSig) || wardrobeSigOf(ownedItems),
      wardrobeCount: latestCache && latestCache.wardrobeCount != null
        ? latestCache.wardrobeCount
        : (ownedItems || []).length,
    });
  } else if (!latestCache) {
    writeDailyCache({
      style: '',
      outfits: kept,
      items: dailyCacheItemsFromOwned(ownedItems, kept),
      wardrobeSig: wardrobeSigOf(ownedItems),
      wardrobeCount: (ownedItems || []).length,
    });
  }
  return removed;
}
/** owned + archived만 LB_DATA.ALL에 남기고 데일리 잔상 아이템 제거 */
function syncAllFromWardrobe(ownedItems, archivedItems) {
  const keep = ownedIdSet([...(ownedItems || []), ...(archivedItems || [])]);
  if (LB_DATA.ANCHOR && LB_DATA.ANCHOR.id) keep.add(String(LB_DATA.ANCHOR.id));
  Object.keys(LB_DATA.ALL || {}).forEach((id) => {
    if (!keep.has(String(id))) delete LB_DATA.ALL[id];
  });
  (ownedItems || []).forEach(liveRememberItem);
  (archivedItems || []).forEach(liveRememberItem);
}

function liveRememberItem(item) {
  if (!item) return null;
  LB_DATA.ALL[item.id] = item;
  return item;
}

function liveApplyPayload(payload, target = 'outfits') {
  (payload.items || []).forEach(liveRememberItem);
  if (payload.anchor) {
    Object.assign(LB_DATA.ANCHOR, payload.anchor, { inWardrobe: false, isAnchor: true });
    liveRememberItem(LB_DATA.ANCHOR);
  }
  const list = payload.outfits || [];
  const bucket = target === 'daily' ? LB_DATA.DAILY : LB_DATA.OUTFITS;
  bucket.splice(0, bucket.length, ...list);
  list.forEach((o) => { LB_DATA.OUTFIT_BY_ID[o.id] = o; });
  return list;
}

function liveAppendOutfits(payload) {
  (payload.items || []).forEach(liveRememberItem);
  const seen = new Set(
    LB_DATA.OUTFITS.map((o) => [...(o.itemIds || [])].map(String).sort().join('|'))
  );
  const added = [];
  for (const o of payload.outfits || []) {
    const k = [...(o.itemIds || [])].map(String).sort().join('|');
    if (seen.has(k)) continue;
    seen.add(k);
    LB_DATA.OUTFITS.push(o);
    LB_DATA.OUTFIT_BY_ID[o.id] = o;
    added.push(o);
  }
  return added;
}

function liveAppendDaily(payload, ownedItems) {
  const owned = ownedIdSet(ownedItems);
  (payload.items || []).forEach((it) => {
    if (it && owned.has(String(it.id || it.serverId))) liveRememberItem(it);
  });
  const seen = new Set(
    LB_DATA.DAILY.map((o) => [...(o.itemIds || [])].map(String).sort().join('|'))
  );
  const added = [];
  for (const raw of payload.outfits || []) {
    const o = sanitizeDailyOutfit(raw, owned);
    if (!o) continue;
    const k = [...(o.itemIds || [])].map(String).sort().join('|');
    if (seen.has(k)) continue;
    seen.add(k);
    LB_DATA.DAILY.push(o);
    LB_DATA.OUTFIT_BY_ID[o.id] = o;
    added.push(o);
  }
  return added;
}

async function liveJSON(url, options = {}) {
  // 안전망 타임아웃: 서버가 오래 걸려도 무한 대기하지 않고 명확한 메시지로 실패.
  // high 품질 추출은 OpenAI 쪽에서만 2분 가까이 걸릴 수 있어 서버 예산(130s+분류)보다 여유 있게.
  const timeoutMs = options.timeoutMs || 210000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      ...options,
      signal: ctrl.signal,
      headers: options.body instanceof FormData ? (options.headers || {}) : { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch (e) {
    clearTimeout(timer);
    if (e && e.name === 'AbortError') {
      throw new Error('시간이 너무 오래 걸려 중단했어요. 잠시 후 다시 시도해 주세요.');
    }
    throw new Error('네트워크 연결이 불안정해요. 잠시 후 다시 시도해 주세요.');
  }
  clearTimeout(timer);
  // keep-alive 스트리밍은 헤더가 먼저 오고 본문이 늦게 끝난다 — 본문이 중간에
  // 끊기거나 공백만 오면(서버 재시작 등) 성공으로 오인하지 말고 명확히 실패 처리.
  let text = '';
  try {
    text = await res.text();
  } catch (e) {
    throw new Error('서버와 연결이 끊겼어요. 잠시 후 다시 시도해 주세요.');
  }
  const trimmed = text.trim();
  let data = {};
  let parsed = false;
  if (trimmed) {
    try { data = JSON.parse(trimmed); parsed = true; } catch (e) { parsed = false; }
  }
  if (!res.ok) throw new Error((parsed && data.error) || '요청에 실패했어요');
  // keep-alive 스트리밍 응답은 항상 200이므로 본문의 error 필드로 실패를 전달한다
  if (parsed && data && data.error) throw new Error(data.error);
  if (!parsed) throw new Error('서버와 연결이 끊겼어요. 잠시 후 다시 시도해 주세요.');
  return data;
}

async function liveImportSource({ sourceType, file, url, status, extractHint }) {
  const hint = (extractHint || '').trim();
  if (sourceType === 'url') {
    if (!url || !url.trim()) throw new Error('상품 URL을 입력해주세요');
    return liveJSON('/api/live/import/url', {
      method: 'POST',
      body: JSON.stringify({ url, status, extract_hint: hint }),
    });
  }
  if (!file) throw new Error('사진 파일을 선택해주세요');
  const fd = new FormData();
  fd.append('image', file);
  fd.append('status', status || 'owned');
  fd.append('extract_hint', hint);
  return liveJSON('/api/live/import/photo', { method: 'POST', body: fd });
}

let _newId = 100;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // ---- initial state (URL params let the canvas open a specific state) ----
  const pScreen = param('screen');          // wardrobe|lookbook|results|detail|add
  const pWs = param('ws');                  // empty|partial|full
  const pSaved = param('saved');            // empty|filled
  const pLoading = param('loading') === '1';
  const pSheet = param('sheet');            // wardrobe|anchor
  const isShowcase = !!pScreen;             // URL drives state → ignore tweak reseeds

  const initialTab = (
    pScreen === 'lookbook' || pScreen === 'detail' ? 'lookbook'
    : pScreen === 'mypage' ? 'mypage'
    : pScreen === 'today' ? 'today'
    : pScreen ? 'wardrobe'   // 그 외 쇼케이스(wardrobe/results/add)
    : (readTabFromUrl() || 'wardrobe')  // 실서비스: URL ?tab= 유지
  );
  const [tab, setTab] = useState(initialTab);
  // 탭 전환 시 언마운트하면 이미지가 다시 디코드되며 깜빡임 → 한 번 연 탭은 유지
  const [mountedTabs, setMountedTabs] = useState(() => ({
    wardrobe: initialTab === 'wardrobe',
    lookbook: initialTab === 'lookbook',
    today: initialTab === 'today',
    mypage: initialTab === 'mypage',
  }));
  useEffect(() => {
    setMountedTabs((m) => (m[tab] ? m : { ...m, [tab]: true }));
  }, [tab]);
  const [view, setView] = useState(pScreen === 'results' ? 'results' : pScreen === 'detail' ? 'detail' : null);
  const [items, setItems] = useState(() => {
    if (!isShowcase) { const c = readWardrobeCache(); if (c) return c.owned.map(liveRememberItem); }
    return seedItems(pWs || TWEAK_DEFAULTS.wardrobeState);
  });
  const [archived, setArchived] = useState(() => {
    if (!isShowcase) { const c = readWardrobeCache(); if (c) return c.archived.map(liveRememberItem); }
    return [];
  });
  // true only until the first live wardrobe fetch settles AND there was no cache
  // to paint — lets us show a skeleton instead of flashing the empty state.
  const [wardrobeLoading, setWardrobeLoading] = useState(() => !isShowcase && !readWardrobeCache());
  const [savedLooks, setSavedLooks] = useState(() => pSaved === 'empty' ? [] : LB_DATA.SAVED.slice());
  const [addSheet, setAddSheet] = useState({ open: pScreen === 'add' || !!pSheet, mode: pSheet || 'wardrobe' });
  const [loading, setLoading] = useState(pLoading);
  const [moreLoading, setMoreLoading] = useState(false);
  const [comboRev, setComboRev] = useState(0);
  const [detailLook, setDetailLook] = useState(pSaved === 'empty' ? null : LB_DATA.SAVED[0]);
  const [addedItemIds, setAddedItemIds] = useState([]);
  const [itemSheet, setItemSheet] = useState({ open: false, item: null });
  const [imageViewer, setImageViewer] = useState({ open: false, item: null, outfit: null, items: null });
  const [wornToday, setWornToday] = useState([]);   // 오늘 입은 데일리 코디 id들
  const [dailyAllowed, setDailyAllowed] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyStyle, setDailyStyle] = useState('dandy');
  const [dailyTick, setDailyTick] = useState(0);
  const bumpDaily = useCallback(() => setDailyTick((n) => n + 1), []);
  const [comboPrompt, setComboPrompt] = useState(false);
  // 구버전 데일리 캐시(삭제 아이템 잔상) 1회 제거
  useEffect(() => {
    try {
      DAILY_CACHE_LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* noop */ }
  }, []);
  const [tutorialDone, setTutorialDone] = useState(() => {
    if (isShowcase) return true;
    try { return localStorage.getItem('lb_tutorial_done') === '1'; } catch (e) { return false; }
  });
  const [toast, setToast] = useState(null);
  const toastT = useRef(0);

  // ---- 회원가입 / 선호 정보 ----
  const forceOnb = param('onboarding') === '1';
  const [onboarded, setOnboarded] = useState(() => {
    if (forceOnb) return false;
    if (isShowcase) return true;            // 캔버스 쇼케이스는 온보딩 건너뜀
    try { return localStorage.getItem('lb_onboarded') === '1'; } catch (e) { return false; }
  });
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lb_prefs') || 'null') || LB_DATA.DEFAULT_PREFS; } catch (e) { return LB_DATA.DEFAULT_PREFS; }
  });
  const [editPrefs, setEditPrefs] = useState(false);
  const [accountSheet, setAccountSheet] = useState(false);
  const [phase, setPhase] = useState('landing');   // landing → onboarding → (app)
  const persistPrefs = (p) => { try { localStorage.setItem('lb_prefs', JSON.stringify(p)); localStorage.setItem('lb_onboarded', '1'); } catch (e) { /* noop */ } };
  const completeOnboarding = (p) => { setPrefs(p); persistPrefs(p); setOnboarded(true); };
  const saveEditedPrefs = (p) => { setPrefs(p); persistPrefs(p); setEditPrefs(false); showToast('선호 정보를 저장했어요', 'check'); };
  const openPrefs = () => setEditPrefs(true);
  const openAccount = () => setAccountSheet(true);
  const setAvatar = (dataUrl) => {
    const np = { ...prefs, avatar: dataUrl || '' };
    setPrefs(np);
    persistPrefs(np);
    showToast(dataUrl ? '프로필 사진을 바꿨어요' : '프로필 사진을 지웠어요', 'check');
  };
  const saveAccount = (draft) => { const np = { ...prefs, ...draft }; setPrefs(np); persistPrefs(np); setAccountSheet(false); showToast('개인 정보를 저장했어요', 'check'); };
  const logout = () => { try { localStorage.setItem('lb_onboarded', '0'); } catch (e) { /* noop */ } setOnboarded(false); setPhase('landing'); setTab('wardrobe'); };

  // ---- responsive (window-width based; reliable inside fixed iframes) ----
  const shellRef = useRef(null);
  const [wide, setWide] = useState(typeof window !== 'undefined' && window.innerWidth >= 760);
  useEffect(() => {
    const measure = () => setWide(window.innerWidth >= 760);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // ---- tweak: reseed wardrobe (skipped in URL-driven showcase) ----
  const firstWs = useRef(true);
  useEffect(() => { if (isShowcase || firstWs.current) { firstWs.current = false; return; } setItems(seedItems(t.wardrobeState)); }, [t.wardrobeState]);
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty('--accent', t.accent);
    r.setProperty('--accent-ink', '#FFFFFF');
    const tone = TONES[t.tone] || TONES.ivory;
    Object.entries(tone).forEach(([k, v]) => r.setProperty(k, v));
  }, [t.accent, t.tone]);

  const showToast = useCallback((msg, icon) => {
    setToast({ msg, icon });
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 1900);
  }, []);

  const putLiveItems = useCallback((list, prepend = false) => {
    const normalized = (list || []).filter(Boolean).map(liveRememberItem);
    setItems((arr) => {
      const byId = {};
      (prepend ? [...normalized, ...arr] : [...arr, ...normalized]).forEach((it) => { byId[it.id] = it; });
      return Object.values(byId);
    });
    return normalized;
  }, []);

  useEffect(() => {
    if (isShowcase) return;
    let dead = false;
    Promise.all([
      liveJSON('/api/live/wardrobe'),
      liveJSON('/api/live/wardrobe?status=archived').catch(() => ({ items: [] })),
    ])
      .then(([ownedData, archData]) => {
        if (dead) return;
        const liveItems = (ownedData.items || []).map(liveRememberItem);
        const archItems = (archData.items || []).map(liveRememberItem);
        setItems(liveItems);
        setArchived(archItems);
        syncAllFromWardrobe(liveItems, archItems);
        const removed = pruneDailyAgainstOwned(liveItems);
        if (LB_DATA.DAILY.length) setDailyAllowed(true);
        else if (removed) setDailyAllowed(false);
        bumpDaily();
      })
      .catch((e) => showToast(e.message || '옷장을 불러오지 못했어요'))
      .finally(() => { if (!dead) setWardrobeLoading(false); });
    return () => { dead = true; };
  }, [isShowcase, putLiveItems, showToast, bumpDaily]);

  // 기존 흰/연회색 판 제품 컷 → 투명 컷아웃으로 1회 정규화
  useEffect(() => {
    if (isShowcase) return;
    const key = 'lb_bg_norm_cutout_v7'; // v7: 알파 노이즈 bbox 수정 — 기존 아이템 1회 재정규화
    try { if (localStorage.getItem(key) === '1') return; } catch (e) { /* noop */ }
    let dead = false;
    liveJSON('/api/live/wardrobe/normalize-bg', { method: 'POST', body: '{}' })
      .then((res) => {
        if (dead) return;
        try { localStorage.setItem(key, '1'); } catch (e) { /* noop */ }
        if (!res || !res.updated) return;
        return Promise.all([
          liveJSON('/api/live/wardrobe'),
          liveJSON('/api/live/wardrobe?status=archived'),
        ]).then(([owned, arch]) => {
          if (dead) return;
          const liveItems = (owned.items || []).map(liveRememberItem);
          const archItems = (arch.items || []).map(liveRememberItem);
          setItems(liveItems);
          setArchived(archItems);
          syncAllFromWardrobe(liveItems, archItems);
          pruneDailyAgainstOwned(liveItems);
          bumpDaily();
        });
      })
      .catch(() => {});
    return () => { dead = true; };
  }, [isShowcase, bumpDaily]);

  // 기존 이미지 오브젝트에 장기 캐시 헤더 1회 백필 → 새로고침 깜빡임 방지
  useEffect(() => {
    if (isShowcase) return;
    const key = 'lb_img_cache_hdr_v2';
    try { if (localStorage.getItem(key) === '1') return; } catch (e) { /* noop */ }
    liveJSON('/api/live/wardrobe/refresh-cache', { method: 'POST', body: '{}' })
      .then((res) => {
        try { localStorage.setItem(key, '1'); } catch (e) { /* noop */ }
        if (!res || !res.updated) return;
        // WebP로 경로가 바뀌었으므로 목록을 다시 불러와 새 URL 반영
        return Promise.all([
          liveJSON('/api/live/wardrobe'),
          liveJSON('/api/live/wardrobe?status=archived').catch(() => ({ items: [] })),
        ]).then(([owned, arch]) => {
          const liveItems = (owned.items || []).map(liveRememberItem);
          const archItems = (arch.items || []).map(liveRememberItem);
          setItems(liveItems);
          setArchived(archItems);
          syncAllFromWardrobe(liveItems, archItems);
          bumpDaily();
        });
      })
      .catch(() => {});
  }, [isShowcase]);

  // Persist the wardrobe locally so the next load paints instantly.
  useEffect(() => {
    if (isShowcase) return;
    writeWardrobeCache(items, archived);
  }, [items, archived, isShowcase]);

  // 이미지 프리로드: 목록이 생기는 즉시(상호작용 없이) 브라우저 캐시로 미리 받아 디코드해 둔다.
  // → 그리드가 그려질 때 캐시에서 바로 페인트되어 '클릭해야 뜨는' 지연을 없앰.
  useEffect(() => {
    if (isShowcase) return;
    const urls = [...(items || []), ...(archived || [])]
      .map((it) => it && it.img)
      .filter(Boolean);
    urls.forEach((u) => {
      const im = new Image();
      im.decoding = 'async';
      im.src = u;
      // decode()로 디코딩까지 미리 끝내 페인트를 즉시화 (실패 무시)
      if (im.decode) im.decode().catch(() => {});
    });
  }, [items, archived, isShowcase]);

  // ---- actions ----
  const savedOutfitIds = savedLooks.map((l) => l.outfitId);
  const go = (id) => { setView(null); setTab(id); if (!isShowcase) persistTab(id); };
  const back = () => setView(null);

  const openAdd = (mode, extra = {}) => setAddSheet({ open: true, mode, ...extra });
  const closeAdd = () => setAddSheet((s) => ({ ...s, open: false, replaceItem: null }));
  const startCombo = () => openAdd('anchor');
  const comboTops = items.filter((it) => it.category === '상의' || it.category === '원피스').length;
  const comboBottoms = items.filter((it) => it.category === '하의' || it.category === '스커트' || it.category === '원피스').length;
  // 조합 추천은 최소 상의 2벌 + 하의 2벌(총 4벌) 필요.
  const comboTopsNeed = Math.max(0, 2 - comboTops);
  const comboBottomsNeed = Math.max(0, 2 - comboBottoms);
  const comboReady = comboTopsNeed === 0 && comboBottomsNeed === 0;
  const comboProgress = Math.min(comboTops, 2) + Math.min(comboBottoms, 2);
  const comboNeed = [comboTopsNeed ? `상의 ${comboTopsNeed}개` : '', comboBottomsNeed ? `하의 ${comboBottomsNeed}개` : ''].filter(Boolean).join(', ');
  const comboGate = () => { if (comboReady) return startCombo(); setComboPrompt(true); };
  const finishTutorial = () => { try { localStorage.setItem('lb_tutorial_done', '1'); } catch (e) { /* noop */ } setTutorialDone(true); };
  const tutorialAddWardrobe = () => { finishTutorial(); go('wardrobe'); openAdd('wardrobe'); };
  const tutorialTryCombo = () => { finishTutorial(); openAdd('anchor'); };

  const preferredDailyStyle = (prefs.styles && prefs.styles[0]) || 'dandy';
  const preferredDailyStyleName = ((LB_DATA.STYLES || []).find((s) => s.id === preferredDailyStyle) || {}).name || preferredDailyStyle;
  const preferredStyles = (prefs.styles && prefs.styles.length)
    ? prefs.styles.slice()
    : [preferredDailyStyle];
  const preferredStyleLabel = preferredStyles
    .map((id) => ((LB_DATA.STYLES || []).find((s) => s.id === id) || {}).name || id)
    .filter(Boolean)
    .join(' · ') || preferredDailyStyleName;
  const dailyEnabled = !!prefs.dailyEnabled;

  const stampOutfitStyle = (list) => {
    const nameOf = (id) => ((LB_DATA.STYLES || []).find((s) => s.id === id) || {}).name || id;
    (list || []).forEach((o, i) => {
      const ids = (o.styles && o.styles.length)
        ? o.styles
        : [preferredStyles[i % preferredStyles.length] || preferredDailyStyle];
      o.styles = ids;
      o.styleLabel = ids.map(nameOf).filter(Boolean).join(' · ');
    });
    return list;
  };

  const setDailyEnabled = (on) => {
    const np = { ...prefs, dailyEnabled: !!on };
    setPrefs(np);
    persistPrefs(np);
    if (!on) {
      setDailyAllowed(false);
      LB_DATA.DAILY.splice(0, LB_DATA.DAILY.length);
      clearDailyCache();
      showToast('오늘의 추천 코디를 껐어요');
    }
  };

  const requestDailyOutfits = async (style = preferredDailyStyle, opts = {}) => {
    const force = !!(opts && opts.force);
    const quiet = !!(opts && opts.quiet);
    if (!prefs.dailyEnabled) return { added: 0, wardrobeGrew: false };
    // 캐시/메모리에 남은 삭제·보관 아이템 코디를 먼저 걷어낸다.
    syncAllFromWardrobe(items, archived);
    pruneDailyAgainstOwned(items);
    const wardrobeGrew = dailyWardrobeGrewSinceCache(items);
    if (!force) {
      // 오늘 이미 추천한 이력이 있으면 API 없이 기존 코디만 보여준다.
      if (LB_DATA.DAILY.length > 0) {
        const cached = readDailyCache();
        setDailyStyle((cached && cached.style) || style);
        setDailyAllowed(true);
        bumpDaily();
        return { added: 0, wardrobeGrew, fromCache: true };
      }
      const cached = readDailyCache();
      if (cached) {
        const outfits = filterDailyOutfitsByOwned(cached.outfits, items);
        if (outfits.length) {
          stampOutfitStyle(outfits);
          liveApplyPayload({
            outfits,
            items: dailyCacheItemsFromOwned(items, outfits),
          }, 'daily');
          // wardrobeSig는 추천 시점 값을 유지 → 옷 추가 후 CTA만 뜨고 자동 재추천 안 함
          writeDailyCache({
            style: cached.style || style,
            outfits,
            items: dailyCacheItemsFromOwned(items, outfits),
            wardrobeSig: cached.wardrobeSig,
            wardrobeCount: cached.wardrobeCount != null ? cached.wardrobeCount : items.length,
          });
          setDailyStyle(cached.style || style);
          setDailyAllowed(true);
          bumpDaily();
          return { added: 0, wardrobeGrew, fromCache: true };
        }
        clearDailyCache();
      }
    }
    setDailyStyle(style);
    setDailyAllowed(true);
    setDailyLoading(true);
    try {
      const baseCount = Math.max(1, parseInt(t.dailyCount, 10) || 4);
      const ownedSig = wardrobeSigOf(items);
      if (force && LB_DATA.DAILY.length > 0) {
        // 첫 줄(4) 미달이면 나머지만, 찼으면 2개씩 추가(리셋 아님).
        const need = Math.max(0, baseCount - LB_DATA.DAILY.length);
        const maxCombos = need > 0 ? need : DAILY_APPEND_BATCH;
        const payload = await liveJSON('/api/live/coordinate', {
          method: 'POST',
          body: JSON.stringify({
            max_combos: maxCombos,
            style,
            styles: preferredStyles,
            exclude_item_ids: LB_DATA.DAILY.map((o) => o.itemIds || []),
          }),
        });
        stampOutfitStyle(payload.outfits);
        const added = liveAppendDaily(payload, items);
        pruneDailyAgainstOwned(items);
        writeDailyCache({
          style,
          outfits: LB_DATA.DAILY.slice(),
          items: dailyCacheItemsFromOwned(items, LB_DATA.DAILY),
          wardrobeSig: ownedSig,
          wardrobeCount: items.length,
        });
        bumpDaily();
        if (added.length) showToast(`${added.length}개 더 가져왔어요`, 'sparkle');
        else if (!quiet) showToast('더 추천할 조합이 없어요');
        return { added: added.length, wardrobeGrew };
      }
      // force여도 당일 이력이 있으면 전체 리셋 대신 추가만 (위에서 처리). 여기 도달 = 오늘 첫 추천.
      if (!force && LB_DATA.DAILY.length > 0) {
        setDailyAllowed(true);
        return { added: 0, wardrobeGrew, fromCache: true };
      }
      const payload = await liveJSON('/api/live/coordinate', {
        method: 'POST',
        body: JSON.stringify({
          max_combos: baseCount,
          style,
          styles: preferredStyles,
        }),
      });
      stampOutfitStyle(payload.outfits);
      // 첫 요청은 최대 baseCount개만 (버튼으로 2개씩 추가)
      const outfits = filterDailyOutfitsByOwned(payload.outfits || [], items).slice(0, baseCount);
      liveApplyPayload({ outfits, items: dailyCacheItemsFromOwned(items, outfits) }, 'daily');
      writeDailyCache({
        style,
        outfits: LB_DATA.DAILY.slice(),
        items: dailyCacheItemsFromOwned(items, LB_DATA.DAILY),
        wardrobeSig: ownedSig,
        wardrobeCount: items.length,
      });
      bumpDaily();
      if (!quiet) showToast('오늘의 코디를 만들었어요', 'sparkle');
      return { added: outfits.length, wardrobeGrew: false };
    } catch (e) {
      setDailyAllowed(false);
      showToast(e.message || '오늘의 코디 추천에 실패했어요');
      return { added: 0, wardrobeGrew, error: true };
    } finally {
      setDailyLoading(false);
    }
  };

  const confirmAdd = async (mode, details) => {
    closeAdd();
    if (mode === 'anchor') {
      setTab('wardrobe'); if (!isShowcase) persistTab('wardrobe'); setView('results'); setLoading(true);
      try {
        let anchorItem = details?.anchorItem || null;
        if (!anchorItem?.serverId) {
          const imported = await liveImportSource({ ...(details || {}), status: 'considering' });
          anchorItem = (imported.items || [])[imported.primary_idx || 0] || (imported.items || [])[0];
        }
        if (!anchorItem) throw new Error('고민 중인 옷을 인식하지 못했어요');
        Object.assign(LB_DATA.ANCHOR, anchorItem, { inWardrobe: false, isAnchor: true });
        liveRememberItem(LB_DATA.ANCHOR);
        const payload = await liveJSON('/api/live/coordinate', {
          method: 'POST',
          body: JSON.stringify({
            anchor_id: anchorItem.serverId,
            max_combos: 4,
            style: preferredDailyStyle,
            styles: preferredStyles,
          }),
        });
        stampOutfitStyle(payload.outfits);
        liveApplyPayload({ ...payload, anchor: LB_DATA.ANCHOR }, 'outfits');
        setComboRev((n) => n + 1);
        showToast(`${preferredStyleLabel} 무드로 코디를 추천했어요`, 'sparkle');
      } catch (e) {
        showToast(e.message || '코디 추천에 실패했어요');
      } finally {
        setLoading(false);
      }
    } else {
      const cats = ['상의', '하의', '아우터', '원피스', '스커트', '신발', '가방', '모자', '소품'];
      const clean = details ? Object.fromEntries(Object.entries(details).filter(([, v]) => v && String(v).trim())) : {};
      const it = { id: 'n' + (_newId++), name: clean.brand ? clean.brand + ' 아이템' : '새로 담은 옷', category: cats[items.length % cats.length], color: '뉴트럴', img: null, ...clean };
      putLiveItems([it], true);
      showToast('옷장에 담았어요', 'check');
    }
  };

  const loadMoreCombos = async () => {
    if (moreLoading || loading) return;
    const anchorId = LB_DATA.ANCHOR?.serverId;
    if (!anchorId) {
      showToast('고민 중인 옷을 다시 불러와 주세요');
      return;
    }
    setMoreLoading(true);
    try {
      const payload = await liveJSON('/api/live/coordinate', {
        method: 'POST',
        body: JSON.stringify({
          anchor_id: anchorId,
          max_combos: 2,
          style: preferredDailyStyle,
          styles: preferredStyles,
          exclude_item_ids: LB_DATA.OUTFITS.map((o) => o.itemIds || []),
        }),
      });
      stampOutfitStyle(payload.outfits);
      const added = liveAppendOutfits(payload);
      setComboRev((n) => n + 1);
      if (!added.length) showToast('더 추천할 조합이 없어요');
      else showToast(`${added.length}개 더 가져왔어요`, 'sparkle');
    } catch (e) {
      showToast(e.message || '추가 추천에 실패했어요');
    } finally {
      setMoreLoading(false);
    }
  };

  const saveOutfit = (outfitId) => {
    setSavedLooks((arr) => {
      if (arr.some((l) => l.outfitId === outfitId)) { showToast('룩북에서 해제했어요'); return arr.filter((l) => l.outfitId !== outfitId); }
      const o = LB_DATA.OUTFIT_BY_ID[outfitId];
      showToast('룩북에 저장했어요', 'bookmark');
      return [{ id: 'live-' + outfitId, outfitId, label: o ? o.label : '저장한 코디', savedAt: '방금' }, ...arr];
    });
  };
  // 룩북 저장된 코디를 해제할 때는 확인을 받는다 (룩북에서도 사라지므로)
  const [unsaveTarget, setUnsaveTarget] = useState(null);
  const requestUnsave = (outfitId) => setUnsaveTarget(outfitId);
  const confirmUnsave = () => { if (unsaveTarget) saveOutfit(unsaveTarget); setUnsaveTarget(null); };
  // 저장/해제 토글 — 저장 안 됬으면 바로 저장, 저장된 건 확인 후 해제
  const toggleSaveOutfit = (outfitId) => {
    if (savedLooks.some((l) => l.outfitId === outfitId)) requestUnsave(outfitId);
    else saveOutfit(outfitId);
  };

  const openItem = (item) => setItemSheet({ open: true, item });
  const closeItem = () => setItemSheet((s) => ({ ...s, open: false }));
  const openImageViewer = (item) => {
    if (item && item.img) setImageViewer({ open: true, item, outfit: null, items: null });
  };
  const openOutfitViewer = (outfit, outfitItems) => {
    if (!outfit) return;
    const list = outfitItems || (outfit.itemIds || []).map((id) => LB_DATA.ALL[id]).filter(Boolean);
    setImageViewer({ open: true, item: null, outfit, items: list });
  };
  const closeImageViewer = () => setImageViewer({ open: false, item: null, outfit: null, items: null });

  const requestReextract = (item) => {
    if (!item) return;
    closeRemove();
    closeItem();
    openAdd('reextract', { replaceItem: item });
  };
  const applyReextractItem = (next) => {
    if (!next) return;
    const merged = liveRememberItem(next);
    setItems((arr) => arr.map((it) => (it.id === merged.id || it.serverId === merged.id ? { ...it, ...merged } : it)));
    setArchived((arr) => arr.map((it) => (it.id === merged.id || it.serverId === merged.id ? { ...it, ...merged } : it)));
    setItemSheet((s) => (s.item && (s.item.id === merged.id || s.item.serverId === merged.id)
      ? { ...s, item: { ...s.item, ...merged } }
      : s));
    showToast('이미지를 바꿨어요', 'sparkle');
  };
  const liveReplaceItemImage = async ({ itemId, sourceType, file, url, extractHint, commit = true }) => {
    const fd = new FormData();
    if (sourceType === 'url') fd.append('url', url);
    else fd.append('image', file);
    fd.append('extract_hint', (extractHint || '').trim());
    fd.append('commit', commit ? 'true' : 'false');
    const data = await liveJSON(`/api/live/items/${encodeURIComponent(itemId)}/replace-image`, {
      method: 'POST',
      body: fd,
    });
    if (!data || !data.item) return null;
    // commit=false면 아직 DB에 반영 안 된 미리보기라, 나중에 confirm할 때 필요한
    // pending(storage 경로 등)까지 같이 돌려준다.
    return commit ? data.item : { item: data.item, pending: data.pending };
  };
  // 미리보기(commit=false)로 받은 결과를 실제로 반영
  const liveConfirmReplaceImage = async (itemId, pending) => {
    if (!pending) return null;
    const data = await liveJSON(`/api/live/items/${encodeURIComponent(itemId)}/replace-image/confirm`, {
      method: 'POST',
      body: JSON.stringify({
        storage_path: pending.storagePath,
        image_url: pending.imageUrl,
        metadata: pending.metadata || {},
      }),
    });
    return data && data.item ? data.item : null;
  };

  useEscapeClose(!tutorialDone && onboarded, finishTutorial);
  useEscapeClose(!!unsaveTarget, () => setUnsaveTarget(null));
  useEscapeClose(editPrefs, () => setEditPrefs(false));

  // 옷 카드 우상단 X → 보관(archived) / 삭제(delete), 보관 탭에서는 꺼내기(owned) / 삭제
  const [removeSheet, setRemoveSheet] = useState({ open: false, item: null });
  const requestRemove = (item) => setRemoveSheet({ open: true, item });
  const closeRemove = () => setRemoveSheet((s) => ({ ...s, open: false }));
  const setItemStatus = (ids, status) => {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) return;
    liveJSON('/api/live/items/status', { method: 'POST', body: JSON.stringify({ ids: list, status }) }).catch(() => {});
  };
  const syncDailyAfterWardrobeChange = (nextOwned, nextArchived) => {
    syncAllFromWardrobe(nextOwned, nextArchived != null ? nextArchived : archived);
    const removed = pruneDailyAgainstOwned(nextOwned);
    if (LB_DATA.DAILY.length) setDailyAllowed(true);
    else if (removed > 0 && prefs.dailyEnabled) setDailyAllowed(false);
    bumpDaily();
  };
  const archiveItem = () => {
    const t = removeSheet.item;
    if (!t) return;
    closeRemove();
    const nextOwned = items.filter((it) => it.id !== t.id);
    const nextArchived = [{ ...t, status: 'archived' }, ...archived.filter((it) => it.id !== t.id)];
    setItems(nextOwned);
    setArchived(nextArchived);
    syncDailyAfterWardrobeChange(nextOwned, nextArchived);
    showToast('보관함으로 옮겼어요', 'archive');
    setItemStatus(t.id, 'archived');
  };
  const restoreItem = () => {
    const t = removeSheet.item;
    if (!t) return;
    closeRemove();
    const nextArchived = archived.filter((it) => it.id !== t.id);
    const nextOwned = [{ ...t, status: 'owned' }, ...items.filter((it) => it.id !== t.id)];
    setArchived(nextArchived);
    setItems(nextOwned);
    syncAllFromWardrobe(nextOwned, nextArchived);
    bumpDaily();
    showToast('옷장으로 꺼냈어요', 'check');
    setItemStatus(t.id, 'owned');
  };
  const deleteItem = () => {
    const t = removeSheet.item;
    if (!t) return;
    closeRemove();
    const nextOwned = items.filter((it) => it.id !== t.id);
    const nextArchived = archived.filter((it) => it.id !== t.id);
    setItems(nextOwned);
    setArchived(nextArchived);
    syncDailyAfterWardrobeChange(nextOwned, nextArchived);
    showToast('옷장에서 삭제했어요', 'check');
    setItemStatus(t.id, 'delete');
  };
  const bulkArchive = (ids) => {
    const idSet = new Set(ids || []);
    if (!idSet.size) return;
    const moved = [];
    const nextOwned = [];
    items.forEach((it) => {
      if (idSet.has(it.id)) moved.push({ ...it, status: 'archived' });
      else nextOwned.push(it);
    });
    const nextArchived = [...moved, ...archived.filter((it) => !idSet.has(it.id))];
    setItems(nextOwned);
    setArchived(nextArchived);
    syncDailyAfterWardrobeChange(nextOwned, nextArchived);
    showToast(idSet.size + '개를 보관함으로 옮겼어요', 'archive');
    setItemStatus([...idSet], 'archived');
  };
  const bulkRestore = (ids) => {
    const idSet = new Set(ids || []);
    if (!idSet.size) return;
    const moved = [];
    const nextArchived = [];
    archived.forEach((it) => {
      if (idSet.has(it.id)) moved.push({ ...it, status: 'owned' });
      else nextArchived.push(it);
    });
    const nextOwned = [...moved, ...items.filter((it) => !idSet.has(it.id))];
    setArchived(nextArchived);
    setItems(nextOwned);
    syncAllFromWardrobe(nextOwned, nextArchived);
    bumpDaily();
    showToast(idSet.size + '개를 옷장으로 꺼냈어요', 'check');
    setItemStatus([...idSet], 'owned');
  };
  const bulkDelete = (ids) => {
    const idSet = new Set(ids || []);
    if (!idSet.size) return;
    const nextOwned = items.filter((it) => !idSet.has(it.id));
    const nextArchived = archived.filter((it) => !idSet.has(it.id));
    setItems(nextOwned);
    setArchived(nextArchived);
    syncDailyAfterWardrobeChange(nextOwned, nextArchived);
    showToast(idSet.size + '개를 삭제했어요', 'check');
    setItemStatus([...idSet], 'delete');
  };

  // 오늘의 코디 — '오늘 입기' 착장 기록 (룩북 저장과는 별개)
  const wearToday = (outfitId) => {
    setWornToday((arr) => {
      if (arr.includes(outfitId)) { showToast('오늘 입기를 취소했어요'); return arr.filter((x) => x !== outfitId); }
      showToast('오늘의 코디로 기록했어요', 'check');
      return [outfitId, ...arr];
    });
  };
  const saveItemDetails = async (itemId, draft) => {
    const patch = {
      name: (draft.name || '').trim() || '옷',
      brand: draft.brand || '',
      size: draft.size || '',
      color: draft.color || '',
      store: draft.store || '',
      note: draft.note || '',
      seasons: draft.seasons || [],
    };
    setItems((arr) => arr.map((it) => it.id === itemId ? { ...it, ...patch } : it));
    setArchived((arr) => arr.map((it) => it.id === itemId ? { ...it, ...patch } : it));
    closeItem();
    showToast('상세 정보를 저장했어요', 'check');
    try {
      const res = await liveJSON('/api/live/items/' + itemId, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      if (res && res.item) {
        liveRememberItem(res.item);
        setItems((arr) => arr.map((it) => it.id === itemId ? { ...it, ...res.item } : it));
        setArchived((arr) => arr.map((it) => it.id === itemId ? { ...it, ...res.item } : it));
      }
    } catch (e) { /* optimistic local save kept */ }
  };

  const openDetail = (look) => { setDetailLook(look); setView('detail'); };
  const gotoLook = (dir) => {
    setDetailLook((cur) => {
      const list = savedLooks;
      if (!list.length) return cur;
      const i = Math.max(0, list.findIndex((l) => l.id === (cur ? cur.id : '')));
      const next = (i + dir + list.length) % list.length;
      return list[next];
    });
  };
  const addToWardrobe = (itemId) => {
    setAddedItemIds((a) => a.includes(itemId) ? a : [...a, itemId]);
    showToast('옷장에 추가됨', 'check');
  };

  // Commit a batch of garments separated from one photo/URL (sequential add flow).
  const discardLiveItems = (ids) => {
    const clean = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!clean.length) return;
    liveJSON('/api/live/items/status', {
      method: 'POST',
      body: JSON.stringify({ ids: clean, status: 'delete' }),
    }).catch(() => {});
  };

  const addItemsBatch = async (list, skippedIds = []) => {
    closeAdd();
    if (skippedIds && skippedIds.length) {
      discardLiveItems(skippedIds);
    }
    if (!list || !list.length) return;
    // 1) pending → owned
    try {
      await liveJSON('/api/live/items/status', {
        method: 'POST',
        body: JSON.stringify({ ids: list.map((it) => it.id), status: 'owned' }),
      });
    } catch (e) {
      showToast(e.message || '저장은 됐지만 서버 반영 확인에 실패했어요');
    }
    // 2) 등록 화면에서 고친 이름·분류·상세를 서버에 반영 (status만 바꾸면 AI 초깃값으로 덮임)
    const finalList = await Promise.all(list.map(async (it) => {
      const id = it.serverId || it.id;
      const patch = {
        name: (it.name || '').trim() || '옷',
        category: it.category || it.cat || '',
        color: it.color || '',
        brand: it.brand || '',
        size: it.size || '',
        store: it.store || '',
        note: it.note || '',
      };
      try {
        const res = await liveJSON('/api/live/items/' + id, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        });
        if (res && res.item) return liveRememberItem({ ...it, ...res.item });
      } catch (e) { /* keep local edits */ }
      return liveRememberItem({ ...it, ...patch });
    }));
    putLiveItems(finalList, true);
    showToast(finalList.length + '개 담았어요', 'check');
  };

  const ctx = {
    wide, items, archived, savedLooks, saved: savedLooks, savedOutfitIds, anchor: LB_DATA.ANCHOR, loading,
    moreLoading, loadMoreCombos, comboRev,
    addSheet, detailLook: detailLook || LB_DATA.SAVED[0], addedItemIds, tab,
    detailIndex: savedLooks.findIndex((l) => l.id === (detailLook ? detailLook.id : '')),
    detailTotal: savedLooks.length, gotoLook,
    hasWardrobe: comboReady,
    comboReady, comboGate, comboNeed, comboProgress, wardrobeLoading,
    autoAddDetails: t.autoAddDetails,
    detectCount: Math.max(1, parseInt(t.detectCount, 10) || 3),
    dailyCount: Math.max(1, parseInt(t.dailyCount, 10) || 4),
    dailyAllowed, dailyLoading, dailyStyle, setDailyStyle, requestDailyOutfits,
    dailyEnabled, setDailyEnabled,
    dailyWardrobeGrew: dailyWardrobeGrewSinceCache(items),
    dailyTick,
    preferredDailyStyle, preferredDailyStyleName, preferredStyleLabel,
    wornToday, wearToday,
    addItemsBatch, discardLiveItems, liveImportSource, showToast,
    openAdd, closeAdd, confirmAdd, startCombo, saveOutfit, toggleSaveOutfit, requestUnsave, openDetail, addToWardrobe, back,
    openItem, openImageViewer, openOutfitViewer, requestRemove, bulkArchive, bulkRestore, bulkDelete, openPrefs, openAccount, setAvatar, logout, prefs, go,
    liveReplaceItemImage, liveConfirmReplaceImage, applyReextractItem,
    startComboOrWardrobe: () => comboReady ? startCombo() : (go('wardrobe'), openAdd('wardrobe')),
  };

  // ---- 온보딩 게이트: 가입 전이면 홈(랜딩) → 회원가입 단계 ----
  if (!onboarded) {
    if (phase === 'onboarding') {
      return <Onboarding mode="signup" onDone={completeOnboarding} onCancel={() => setPhase('landing')} />;
    }
    return <Landing onStart={() => setPhase('onboarding')} />;
  }

  // ---- which screen ----
  const focused = view === 'results' || view === 'detail';
  const focusedScreen = view === 'results'
    ? <ResultsScreen ctx={ctx} />
    : view === 'detail'
      ? <DetailScreen ctx={ctx} />
      : null;

  const tabPane = (id, node) => (
    mountedTabs[id] ? (
      <div
        key={id}
        style={{
          flex: 1,
          minHeight: 0,
          display: (!focused && tab === id) ? 'flex' : 'none',
          flexDirection: 'column',
        }}
        aria-hidden={focused || tab !== id}
      >
        {node}
      </div>
    ) : null
  );

  const mainTabs = (
    <>
      {tabPane('wardrobe', <WardrobeScreen ctx={ctx} />)}
      {tabPane('lookbook', <LookbookScreen ctx={ctx} />)}
      {tabPane('today', <TodayScreen ctx={ctx} />)}
      {tabPane('mypage', <MyPageScreen ctx={ctx} />)}
    </>
  );

  return (
    <div ref={shellRef} className={'lb-app' + (wide ? ' lb-shell-wide' : '')}>
      {wide ? (
        <>
          <aside className="lb-sidebar">
            <div style={{ padding: '4px 8px 22px' }}><Wordmark size={22} /></div>
            <button className={'lb-navitem' + (tab === 'wardrobe' && !focused ? ' on' : '')} onClick={() => go('wardrobe')}>
              <Icon name="hanger" size={20} fill={tab === 'wardrobe' && !focused ? 'currentColor' : 'none'} stroke={tab === 'wardrobe' && !focused ? 0 : 1.7} /> 옷장
            </button>
            <button className={'lb-navitem' + (tab === 'lookbook' && !focused ? ' on' : '')} onClick={() => go('lookbook')}>
              <Icon name="bookmark" size={20} fill={tab === 'lookbook' && !focused ? 'currentColor' : 'none'} stroke={tab === 'lookbook' && !focused ? 0 : 1.7} /> 룩북
            </button>
            <button className={'lb-navitem' + (tab === 'today' && !focused ? ' on' : '')} onClick={() => go('today')}>
              <Icon name="sparkle" size={20} fill={tab === 'today' && !focused ? 'currentColor' : 'none'} stroke={tab === 'today' && !focused ? 0 : 1.7} /> 오늘의 추천 코디
            </button>
            <button className={'lb-navitem' + (tab === 'mypage' && !focused ? ' on' : '')} onClick={() => go('mypage')}>
              <Icon name="user" size={20} fill={tab === 'mypage' && !focused ? 'currentColor' : 'none'} stroke={tab === 'mypage' && !focused ? 0 : 1.7} /> 마이페이지
            </button>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Btn full icon="sparkle" variant={comboReady ? 'primary' : 'soft'} style={comboReady ? undefined : { opacity: 0.55 }} onClick={comboGate}>조합 추천받기</Btn>
              <Btn full variant="soft" icon="plus" onClick={() => openAdd('wardrobe')}>아이템 추가</Btn>
            </div>
          </aside>
          <main className="lb-wide-main">
            {mainTabs}
            {focused && (
              <div style={{
                width: '100%',
                maxWidth: view === 'results' ? 820 : 460,
                margin: '0 auto',
                flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
              }}>{focusedScreen}</div>
            )}
          </main>
        </>
      ) : (
        <>
          <div className="lb-scroll" style={{ display: 'flex', flexDirection: 'column' }}>
            {mainTabs}
            {focused ? focusedScreen : null}
          </div>
          {!focused && <BottomNav tab={tab} go={go} />}
        </>
      )}

      {!tutorialDone && onboarded && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22, background: 'rgba(30,27,21,0.42)' }}>
          <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--pop-shadow)', padding: '24px 22px 22px' }}>
            <Eyebrow>처음 시작하기</Eyebrow>
            <h2 style={{ margin: '9px 0 0', fontSize: 22, lineHeight: 1.25, fontWeight: 800, letterSpacing: '-0.04em' }}>옷을 먼저 추가해 주세요</h2>
            <p style={{ margin: '9px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--ink-2)' }}>
              LOOKBOX는 내 옷장에 있는 아이템을 기준으로 조합을 보여줘요. 아이템이 몇 개 모여야 추천이 정확해집니다.
            </p>
            <div style={{ display: 'grid', gap: 0, marginTop: 18 }}>
              {[
                ['1', '사진으로 아이템 추가', '사진을 올리면 상의·하의·신발을 자동으로 나눠 담아요.'],
                ['2', '옷장 확인', '분류와 색상이 맞는지 보고 필요한 정보만 간단히 고쳐요.'],
                ['3', '추천 사용', '옷이 모이면 구매 전 조합과 오늘 코디를 볼 수 있어요.'],
              ].map(([n, title, desc]) => (
                <div key={n} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', columnGap: 12, alignItems: 'start', padding: '10px 0', borderTop: n === '1' ? 'none' : '1px solid color-mix(in srgb, var(--line) 72%, transparent)' }}>
                  <span className="tnum" style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--ivory)', display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 800, marginTop: 1 }}>{n}</span>
                  <span style={{ minWidth: 0 }}><b style={{ display: 'block', fontSize: 14.5, lineHeight: 1.25 }}>{title}</b><span style={{ display: 'block', marginTop: 4, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.38 }}>{desc}</span></span>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 20 }}>
              <Btn full size="lg" icon="plus" onClick={tutorialAddWardrobe}>아이템 추가하기</Btn>
              {comboReady && <Btn full variant="soft" icon="sparkle" onClick={tutorialTryCombo}>구매 전 조합 보기</Btn>}
              <Btn full variant="ghost" onClick={finishTutorial}>나중에 할게요</Btn>
            </div>
          </div>
        </div>
      )}

      <AddSheet ctx={ctx} />
      <BottomSheet open={comboPrompt} onClose={() => setComboPrompt(false)}>
        <div style={{ padding: '28px 24px 26px', textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>조합 추천을 받으려면 옷이 필요해요</h3>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>{comboNeed}를 추가로 담으면<br />어울리는 조합을 추천해드려요.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 20 }}>
            <Btn full size="lg" icon="plus" onClick={() => { setComboPrompt(false); go('wardrobe'); openAdd('wardrobe'); }}>아이템 추가</Btn>
            <Btn full variant="ghost" onClick={() => setComboPrompt(false)}>취소</Btn>
          </div>
        </div>
      </BottomSheet>
      <ItemDetailSheet
        open={itemSheet.open}
        item={itemSheet.item}
        onClose={closeItem}
        onSave={saveItemDetails}
        onViewImage={openImageViewer}
      />
      <ImageViewer
        open={imageViewer.open}
        item={imageViewer.item}
        outfit={imageViewer.outfit}
        items={imageViewer.items}
        onClose={closeImageViewer}
      />
      <ItemRemoveSheet
        open={removeSheet.open}
        item={removeSheet.item}
        onClose={closeRemove}
        onArchive={archiveItem}
        onRestore={restoreItem}
        onDelete={deleteItem}
        onReextract={requestReextract}
        onExpand={() => {
          const t = removeSheet.item;
          closeRemove();
          if (t && t.img) openImageViewer(t);
        }}
      />
      <AccountEditSheet open={accountSheet} prefs={prefs} onClose={() => setAccountSheet(false)} onSave={saveAccount} />

      {unsaveTarget && (
          <div onClick={() => setUnsaveTarget(null)} style={{ position: 'absolute', inset: 0, zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(30,27,21,0.45)' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 340, background: 'var(--surface)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--pop-shadow)', padding: '24px 22px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--ivory)', display: 'grid', placeItems: 'center', margin: '0 auto 14px', color: 'var(--accent)' }}>
                <Icon name="heart" size={22} fill="currentColor" stroke={0} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>룩북에서 해제할까요?</div>
              <p style={{ margin: '9px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                좋아요를 해제하면 룩북 목록에서도 사라져요.
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <Btn variant="soft" onClick={() => setUnsaveTarget(null)} style={{ flex: 1 }}>유지</Btn>
                <Btn icon="heart" onClick={confirmUnsave} style={{ flex: 1 }}>해제하기</Btn>
              </div>
            </div>
          </div>
      )}

      {editPrefs && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'var(--ivory)' }}>
          <Onboarding mode="edit" initial={prefs} onDone={saveEditedPrefs} onCancel={() => setEditPrefs(false)} />
        </div>
      )}

      {toast && (
        <div className={'lb-toast show'}>
          {toast.icon && <Icon name={toast.icon} size={15} stroke={2.4} fill={toast.icon === 'bookmark' ? 'currentColor' : 'none'} />}
          {toast.msg}
        </div>
      )}

      <TweaksPanel>
        <TweakSection label="브랜드" />
        <TweakColor label="포인트 컬러" value={t.accent}
          options={['#1A1A1A', '#A6803E', '#1F3A2E', '#B0573C']}
          onChange={(v) => setTweak('accent', v)} />
        <TweakRadio label="전체 톤" value={t.tone} options={['ivory', 'paper']}
          onChange={(v) => setTweak('tone', v)} />
        <TweakSection label="상태" />
        <TweakRadio label="옷장 상태" value={t.wardrobeState} options={['empty', 'partial', 'full']}
          onChange={(v) => setTweak('wardrobeState', v)} />
        <TweakSection label="옷 추가" />
        <TweakRadio label="사진에서 감지되는 옷 수" value={t.detectCount} options={['1', '3', '4']}
          onChange={(v) => setTweak('detectCount', v)} />
        <TweakToggle label="등록 단계에서 상세 정보 자동 펼침" value={t.autoAddDetails}
          onChange={(v) => setTweak('autoAddDetails', v)} />
        <TweakSection label="오늘의 코디" />
        <TweakRadio label="데일리 추천 개수" value={t.dailyCount} options={['2', '3', '4']}
          onChange={(v) => setTweak('dailyCount', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
