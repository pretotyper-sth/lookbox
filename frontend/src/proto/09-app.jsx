/* @prototype-ported */
const React = window.React;
const ReactDOM = window.ReactDOM;
const { AccountEditSheet, AddSheet, BottomNav, Btn, DetailScreen, Eyebrow, Icon, ItemDetailSheet, LB_DATA, Landing, LookbookScreen, MyPageScreen, Onboarding, ResultsScreen, SAVED, TodayScreen, TweakColor, TweakRadio, TweakSection, TweakToggle, TweaksPanel, WARDROBE, WardrobeScreen, Wordmark, useTweaks } = window;

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
  ivory: { '--ivory': '#EFEDE8', '--surface': '#F7F5F0', '--surface-2': '#FBFAF7', '--line': '#E0DCD2', '--line-2': '#D3CEC2', '--badge-bg': '#E6E2D9' },
  paper: { '--ivory': '#F2F1EE', '--surface': '#FBFAF8', '--surface-2': '#FFFFFF', '--line': '#E7E5DF', '--line-2': '#DAD7CF', '--badge-bg': '#ECEAE3' },
};

function param(name) {
  try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
}

function seedItems(ws) {
  if (ws === 'empty') return [];
  if (ws === 'partial') return LB_DATA.WARDROBE.slice(0, 2);
  return LB_DATA.WARDROBE.slice();
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

async function liveJSON(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: options.body instanceof FormData ? (options.headers || {}) : { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청에 실패했어요');
  return data;
}

async function liveImportSource({ sourceType, file, url, status }) {
  if (sourceType === 'url') {
    if (!url || !url.trim()) throw new Error('상품 URL을 입력해주세요');
    return liveJSON('/api/live/import/url', { method: 'POST', body: JSON.stringify({ url, status }) });
  }
  if (!file) throw new Error('사진 파일을 선택해주세요');
  const fd = new FormData();
  fd.append('image', file);
  fd.append('status', status || 'owned');
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

  const [tab, setTab] = useState(
    pScreen === 'lookbook' || pScreen === 'detail' ? 'lookbook'
    : pScreen === 'mypage' ? 'mypage'
    : pScreen === 'today' ? 'today'
    : pScreen ? 'wardrobe'   // 그 외 쇼케이스(wardrobe/results/add)
    : 'wardrobe'             // 일반 진입 → 옷장
  );
  const [view, setView] = useState(pScreen === 'results' ? 'results' : pScreen === 'detail' ? 'detail' : null);
  const [items, setItems] = useState(() => seedItems(pWs || TWEAK_DEFAULTS.wardrobeState));
  const [savedLooks, setSavedLooks] = useState(() => pSaved === 'empty' ? [] : LB_DATA.SAVED.slice());
  const [addSheet, setAddSheet] = useState({ open: pScreen === 'add' || !!pSheet, mode: pSheet || 'wardrobe' });
  const [loading, setLoading] = useState(pLoading);
  const [detailLook, setDetailLook] = useState(pSaved === 'empty' ? null : LB_DATA.SAVED[0]);
  const [addedItemIds, setAddedItemIds] = useState([]);
  const [itemSheet, setItemSheet] = useState({ open: false, item: null });
  const [wornToday, setWornToday] = useState([]);   // 오늘 입은 데일리 코디 id들
  const [dailyAllowed, setDailyAllowed] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyStyle, setDailyStyle] = useState('dandy');
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
    liveJSON('/api/live/wardrobe')
      .then((data) => {
        if (dead) return;
        const liveItems = (data.items || []).map(liveRememberItem);
        setItems(liveItems);
      })
      .catch((e) => showToast(e.message || '옷장을 불러오지 못했어요'));
    return () => { dead = true; };
  }, [isShowcase, putLiveItems, showToast]);

  // ---- actions ----
  const savedOutfitIds = savedLooks.map((l) => l.outfitId);
  const go = (id) => { setView(null); setTab(id); };
  const back = () => setView(null);

  const openAdd = (mode) => setAddSheet({ open: true, mode });
  const closeAdd = () => setAddSheet((s) => ({ ...s, open: false }));
  const startCombo = () => openAdd('anchor');
  const comboReady = items.length >= 3;
  const comboGate = () => {
    if (comboReady) return startCombo();
    showToast('옷을 3벌 이상 담으면 조합을 추천받을 수 있어요');
    openAdd('wardrobe');
  };
  const finishTutorial = () => { try { localStorage.setItem('lb_tutorial_done', '1'); } catch (e) { /* noop */ } setTutorialDone(true); };
  const tutorialAddWardrobe = () => { finishTutorial(); go('wardrobe'); openAdd('wardrobe'); };
  const tutorialTryCombo = () => { finishTutorial(); openAdd('anchor'); };

  const requestDailyOutfits = async (style = dailyStyle) => {
    setDailyStyle(style);
    setDailyAllowed(true);
    setDailyLoading(true);
    try {
      const payload = await liveJSON('/api/live/coordinate', {
        method: 'POST',
        body: JSON.stringify({ max_combos: Math.max(1, parseInt(t.dailyCount, 10) || 3), style }),
      });
      liveApplyPayload(payload, 'daily');
      setItems((arr) => arr.slice());
      showToast('오늘의 코디를 만들었어요', 'sparkle');
    } catch (e) {
      setDailyAllowed(false);
      showToast(e.message || '오늘의 코디 추천에 실패했어요');
    } finally {
      setDailyLoading(false);
    }
  };

  const confirmAdd = async (mode, details) => {
    closeAdd();
    if (mode === 'anchor') {
      setTab('wardrobe'); setView('results'); setLoading(true);
      try {
        const imported = await liveImportSource({ ...(details || {}), status: 'considering' });
        const anchorItem = (imported.items || [])[imported.primary_idx || 0] || (imported.items || [])[0];
        if (!anchorItem) throw new Error('고민 중인 옷을 인식하지 못했어요');
        Object.assign(LB_DATA.ANCHOR, anchorItem, { inWardrobe: false, isAnchor: true });
        liveRememberItem(LB_DATA.ANCHOR);
        const payload = await liveJSON('/api/live/coordinate', {
          method: 'POST',
          body: JSON.stringify({ anchor_id: anchorItem.serverId, max_combos: 4 }),
        });
        liveApplyPayload({ ...payload, anchor: LB_DATA.ANCHOR }, 'outfits');
        showToast('GPT가 내 옷장 기준으로 코디를 추천했어요', 'sparkle');
      } catch (e) {
        showToast(e.message || '코디 추천에 실패했어요');
      } finally {
        setLoading(false);
      }
    } else {
      const cats = ['상의', '하의', '아우터', '신발', '액세서리'];
      const clean = details ? Object.fromEntries(Object.entries(details).filter(([, v]) => v && String(v).trim())) : {};
      const it = { id: 'n' + (_newId++), name: clean.brand ? clean.brand + ' 아이템' : '새로 담은 옷', category: cats[items.length % cats.length], color: '뉴트럴', img: null, ...clean };
      putLiveItems([it], true);
      showToast('옷장에 담았어요', 'check');
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

  // 오늘의 코디 — '오늘 입기' 착장 기록 (룩북 저장과는 별개)
  const wearToday = (outfitId) => {
    setWornToday((arr) => {
      if (arr.includes(outfitId)) { showToast('오늘 입기를 취소했어요'); return arr.filter((x) => x !== outfitId); }
      showToast('오늘의 코디로 기록했어요', 'check');
      return [outfitId, ...arr];
    });
  };
  const saveItemDetails = (itemId, draft) => {
    setItems((arr) => arr.map((it) => it.id === itemId ? { ...it, ...draft } : it));
    closeItem();
    showToast('상세 정보를 저장했어요', 'check');
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
  const addItemsBatch = async (list, skippedIds = []) => {
    closeAdd();
    if (skippedIds && skippedIds.length) {
      liveJSON('/api/live/items/status', { method: 'POST', body: JSON.stringify({ ids: skippedIds, status: 'delete' }) }).catch(() => {});
    }
    if (!list || !list.length) return;
    let finalList = list;
    try {
      const committed = await liveJSON('/api/live/items/status', {
        method: 'POST',
        body: JSON.stringify({ ids: list.map((it) => it.id), status: 'owned' }),
      });
      if (committed.items && committed.items.length) finalList = committed.items;
    } catch (e) {
      showToast(e.message || '저장은 됐지만 서버 반영 확인에 실패했어요');
    }
    putLiveItems(finalList, true);
    showToast(finalList.length + '벌을 옷장에 담았어요', 'check');
  };

  const ctx = {
    wide, items, savedLooks, saved: savedLooks, savedOutfitIds, anchor: LB_DATA.ANCHOR, loading,
    addSheet, detailLook: detailLook || LB_DATA.SAVED[0], addedItemIds, tab,
    detailIndex: savedLooks.findIndex((l) => l.id === (detailLook ? detailLook.id : '')),
    detailTotal: savedLooks.length, gotoLook,
    hasWardrobe: items.length >= 3,
    comboReady, comboGate,
    autoAddDetails: t.autoAddDetails,
    detectCount: Math.max(1, parseInt(t.detectCount, 10) || 3),
    dailyCount: Math.max(1, parseInt(t.dailyCount, 10) || 3),
    dailyAllowed, dailyLoading, dailyStyle, setDailyStyle, requestDailyOutfits,
    wornToday, wearToday,
    addItemsBatch, liveImportSource,
    openAdd, closeAdd, confirmAdd, startCombo, saveOutfit, toggleSaveOutfit, requestUnsave, openDetail, addToWardrobe, back,
    openItem, openPrefs, openAccount, logout, prefs,
    startComboOrWardrobe: () => items.length >= 3 ? startCombo() : (go('wardrobe'), openAdd('wardrobe')),
  };

  // ---- 온보딩 게이트: 가입 전이면 홈(랜딩) → 회원가입 단계 ----
  if (!onboarded) {
    if (phase === 'onboarding') {
      return <Onboarding mode="signup" onDone={completeOnboarding} onCancel={() => setPhase('landing')} />;
    }
    return <Landing onStart={() => setPhase('onboarding')} onBypass={() => completeOnboarding(LB_DATA.DEFAULT_PREFS)} />;
  }

  // ---- which screen ----
  let screen;
  if (view === 'results') screen = <ResultsScreen ctx={ctx} />;
  else if (view === 'detail') screen = <DetailScreen ctx={ctx} />;
  else if (tab === 'today') screen = <TodayScreen ctx={ctx} />;
  else if (tab === 'lookbook') screen = <LookbookScreen ctx={ctx} />;
  else if (tab === 'mypage') screen = <MyPageScreen ctx={ctx} />;
  else screen = <WardrobeScreen ctx={ctx} />;

  const focused = view === 'results' || view === 'detail';

  return (
    <div ref={shellRef} className={'lb-app' + (wide ? ' lb-shell-wide' : '')}>
      {wide ? (
        <>
          <aside className="lb-sidebar">
            <div style={{ padding: '4px 8px 22px' }}><Wordmark size={22} /></div>
            <button className={'lb-navitem' + (tab === 'wardrobe' && !focused ? ' on' : '')} onClick={() => go('wardrobe')}>
              <Icon name="hanger" size={20} fill={tab === 'wardrobe' && !focused ? 'currentColor' : 'none'} stroke={tab === 'wardrobe' && !focused ? 0 : 1.7} /> 옷장
            </button>
            <button className={'lb-navitem' + (tab === 'today' && !focused ? ' on' : '')} onClick={() => go('today')}>
              <Icon name="sparkle" size={20} fill={tab === 'today' && !focused ? 'currentColor' : 'none'} stroke={tab === 'today' && !focused ? 0 : 1.7} /> 오늘의 추천 코디
            </button>
            <button className={'lb-navitem' + (tab === 'lookbook' && !focused ? ' on' : '')} onClick={() => go('lookbook')}>
              <Icon name="bookmark" size={20} fill={tab === 'lookbook' && !focused ? 'currentColor' : 'none'} stroke={tab === 'lookbook' && !focused ? 0 : 1.7} /> 룩북
            </button>
            <button className={'lb-navitem' + (tab === 'mypage' && !focused ? ' on' : '')} onClick={() => go('mypage')}>
              <Icon name="user" size={20} fill={tab === 'mypage' && !focused ? 'currentColor' : 'none'} stroke={tab === 'mypage' && !focused ? 0 : 1.7} /> 마이페이지
            </button>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Btn full icon="sparkle" variant={comboReady ? 'primary' : 'soft'} style={comboReady ? undefined : { opacity: 0.55 }} onClick={comboGate}>조합 추천받기</Btn>
              <Btn full variant="soft" icon="plus" onClick={() => openAdd('wardrobe')}>옷 추가</Btn>
            </div>
          </aside>
          <main className="lb-wide-main">
            {focused
              ? <div style={{ width: '100%', maxWidth: 460, margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{screen}</div>
              : screen}
          </main>
        </>
      ) : (
        <>
          <div className="lb-scroll">{screen}</div>
          {!focused && <BottomNav tab={tab} go={go} />}
        </>
      )}

      {!tutorialDone && onboarded && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22, background: 'rgba(30,27,21,0.42)' }}>
          <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--pop-shadow)', padding: '24px 22px 22px' }}>
            <Eyebrow>처음 시작하기</Eyebrow>
            <h2 style={{ margin: '9px 0 0', fontSize: 22, lineHeight: 1.25, fontWeight: 800, letterSpacing: '-0.04em' }}>옷을 먼저 추가해 주세요</h2>
            <p style={{ margin: '9px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--ink-2)' }}>
              LOOKBOX는 내 옷장에 있는 옷을 기준으로 조합을 보여줘요. 옷이 몇 벌 들어가야 추천이 정확해집니다.
            </p>
            <div style={{ display: 'grid', gap: 0, marginTop: 18 }}>
              {[
                ['1', '사진으로 옷 추가', '옷 사진을 올리면 상의·하의·신발을 자동으로 나눠 담아요.'],
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
              <Btn full size="lg" icon="plus" onClick={tutorialAddWardrobe}>옷 추가하기</Btn>
              {items.length >= 3 && <Btn full variant="soft" icon="sparkle" onClick={tutorialTryCombo}>구매 전 조합 보기</Btn>}
              <Btn full variant="ghost" onClick={finishTutorial}>나중에 할게요</Btn>
            </div>
          </div>
        </div>
      )}

      <AddSheet ctx={ctx} />
      <ItemDetailSheet open={itemSheet.open} item={itemSheet.item} onClose={closeItem} onSave={saveItemDetails} />
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
