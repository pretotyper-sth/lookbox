/* @prototype-ported */
const React = window.React;
const ReactDOM = window.ReactDOM;
const { BottomSheet, useEscapeClose } = window;
const { AccountEditSheet, AddSheet, BottomNav, Btn, DetailScreen, PickedOutfitsModal, Eyebrow, Icon, ImageViewer, ItemDetailSheet, ItemRemoveSheet, LB_DATA, Landing, Login, LookbookScreen, MyPageScreen, Onboarding, ResultsScreen, SAVED, TodayScreen, TryOnCameraOverlay, TryOnDesktopSheet, TryOnSetupOverlay, TweakColor, TweakRadio, TweakSection, TweaksPanel, WARDROBE, WardrobeScreen, Wordmark, useTweaks } = window;

/* global React, ReactDOM, LB_DATA, useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakToggle,
   Wordmark, BottomNav, WardrobeScreen, AddSheet, ResultsScreen, LookbookScreen, DetailScreen, Btn, Icon, ItemDetailSheet */
// LOOKBOX — app shell: routing, state, responsive layout, tweaks.

const { useState, useEffect, useRef, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#1A1A1A",
  "wardrobeState": "full",
  "tone": "ivory",
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
  ivory: { '--ivory': '#EFEDE8', '--surface': '#F7F5F0', '--surface-2': '#FBFAF7', '--thumb-bg': '#ACA7A4', '--line': '#E0DCD2', '--line-2': '#D3CEC2', '--badge-bg': '#E6E2D9' },
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
// 캐시는 계정별로 나눈다. 전역 키 하나면 다른 계정으로 로그인했을 때 첫 페인트에
// 남의 옷장이 보이고, 로그아웃 뒤에도 남는다. uid를 모르는 첫 순간에는 마지막으로
// 쓴 계정의 캐시를 쓴다 — 대개 같은 사람이 다시 들어오는 경우라 즉시 그려진다.
const WARDROBE_CACHE_KEY = 'lb_wardrobe_cache_v2';
const LAST_UID_KEY = 'lb_last_uid';
function cacheKeyFor(uid) {
  return WARDROBE_CACHE_KEY + ':' + (uid || (() => {
    try { return localStorage.getItem(LAST_UID_KEY) || 'anon'; } catch (e) { return 'anon'; }
  })());
}
function readWardrobeCache(uid) {
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKeyFor(uid)) || 'null');
    if (!parsed || !Array.isArray(parsed.owned)) return null;
    return { owned: parsed.owned, archived: Array.isArray(parsed.archived) ? parsed.archived : [] };
  } catch (e) { return null; }
}
function writeWardrobeCache(uid, owned, archived) {
  if (!uid) return;
  try {
    localStorage.setItem(LAST_UID_KEY, uid);
    localStorage.setItem(cacheKeyFor(uid), JSON.stringify({ owned, archived }));
  } catch (e) { /* noop */ }
}

// 사용량은 옷장과 같이 계정별 캐시를 먼저 그린다. 서버가 정본이라 받은 뒤에
// 덮어쓰고, 크레딧을 쓴 뒤에도 다시 읽어 숫자를 맞춘다.
const BILLING_CACHE_KEY = 'lb_billing_v1';
function billingCacheKey(uid) {
  return BILLING_CACHE_KEY + ':' + (uid || (() => {
    try { return localStorage.getItem(LAST_UID_KEY) || 'anon'; } catch (e) { return 'anon'; }
  })());
}
function readBillingCache(uid) {
  try {
    const parsed = JSON.parse(localStorage.getItem(billingCacheKey(uid)) || 'null');
    if (!parsed || typeof parsed.remaining !== 'number' || typeof parsed.granted !== 'number') return null;
    return parsed;
  } catch (e) { return null; }
}
function writeBillingCache(uid, data) {
  if (!uid || !data || typeof data.remaining !== 'number') return;
  try { localStorage.setItem(billingCacheKey(uid), JSON.stringify(data)); } catch (e) { /* noop */ }
}

// 당일 추천 코디 캐시 — v3: owned-only 스냅샷(삭제·보관 아이템 재유입 방지)
// 옷장 캐시와 같은 이유로 계정별로 나눈다. 호출부가 많아 uid를 인자로 돌리지 않고
// 로그인 시점에 스코프를 한 번 세팅한다.
const DAILY_CACHE_BASE = 'lb_daily_outfits_v3';
const DAILY_CACHE_LEGACY_KEYS = ['lb_daily_outfits_v2', 'lb_daily_outfits_v3'];
let dailyScopeUid = '';
function setDailyScope(uid) {
  dailyScopeUid = uid || '';
}
function dailyScope() {
  return dailyScopeUid || (() => {
    try { return localStorage.getItem(LAST_UID_KEY) || 'anon'; } catch (e) { return 'anon'; }
  })();
}
function localYmd() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function relativeSavedAt(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!then) return '';
  const min = Math.floor((Date.now() - then) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  if (min < 1440) return `${Math.floor(min / 60)}시간 전`;
  const day = Math.floor(min / 1440);
  return day < 30 ? `${day}일 전` : `${Math.floor(day / 30)}개월 전`;
}
// 코디 요청에 실어 보낼 취향값만 골라낸다 (이메일·아바타 같은 건 보내지 않는다).
function coordProfile(prefs) {
  const p = prefs || {};
  return {
    personal_color: p.personalColor || '',
    fit: p.fit || '',
    palettes: Array.isArray(p.palettes) ? p.palettes : [],
    gender: p.gender || '',
    age: p.age || '',
    height: p.height || '',
    weight: p.weight || '',
  };
}
function wardrobeSigOf(list) {
  return (list || []).map((it) => it && it.id).filter(Boolean).map(String).sort().join(',');
}
function readDailyCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAILY_CACHE_BASE + ':' + dailyScope()) || 'null');
    if (!parsed || parsed.date !== localYmd() || !Array.isArray(parsed.outfits) || !parsed.outfits.length) return null;
    return parsed;
  } catch (e) { return null; }
}
function writeDailyCache({ style, outfits, items, wardrobeSig, wardrobeCount }) {
  try {
    const sig = wardrobeSig != null ? wardrobeSig : wardrobeSigOf(items);
    localStorage.setItem(DAILY_CACHE_BASE + ':' + dailyScope(), JSON.stringify({
      date: localYmd(),
      style: style || '',
      outfits: outfits || [],
      items: items || [],
      wardrobeSig: sig || '',
      wardrobeCount: wardrobeCount != null ? wardrobeCount : (items || []).length,
    }));
    // 오늘 보여준 코디를 그대로 히스토리에도 남긴다. 아이템 스냅샷까지 함께 저장해야
    // 나중에 그 옷을 지워도 지난 기록이 깨지지 않는다.
    if ((outfits || []).length) {
      writeDailyRecord(localYmd(), { style: style || '', outfits, items: items || [] });
    }
  } catch (e) { /* noop */ }
}
function clearDailyCache() {
  try {
    localStorage.removeItem(DAILY_CACHE_BASE + ':' + dailyScope());
    DAILY_CACHE_LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* noop */ }
}

// 날짜별 추천 기록 — 당일 캐시는 하루가 지나면 무효가 되므로, 그날 실제로 보여준
// 코디를 따로 남겨 캘린더에서 되짚어볼 수 있게 한다. 정본은 서버 outfits(forDate)이고
// localStorage는 오프라인·즉시 페인트용이다.
const DAILY_HISTORY_BASE = 'lb_daily_history_v1';
function dailyHistoryKey(uid) { return DAILY_HISTORY_BASE + ':' + (uid || dailyScope()); }
const DAILY_HISTORY_MAX_DAYS = 120;
const serverDailyHistory = {};
function mergeDailyRecord(local, remote) {
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;
  const byId = {};
  (local.outfits || []).forEach((o) => { if (o && o.id) byId[o.id] = o; });
  (remote.outfits || []).forEach((o) => { if (o && o.id) byId[o.id] = o; });
  const itemsById = {};
  [...(local.items || []), ...(remote.items || [])].forEach((it) => {
    if (it && it.id != null) itemsById[it.id] = it;
  });
  return {
    style: remote.style || local.style || '',
    outfits: Object.values(byId),
    items: Object.values(itemsById),
    wornIds: remote.wornIds || local.wornIds || [],
  };
}
function readDailyHistory(uid) {
  try { return JSON.parse(localStorage.getItem(dailyHistoryKey(uid)) || 'null') || {}; } catch (e) { return {}; }
}
function readDailyRecord(dateKey) {
  const local = readDailyHistory()[dateKey];
  const remote = serverDailyHistory[dateKey];
  const rec = mergeDailyRecord(local, remote);
  return rec && rec.outfits && rec.outfits.length ? rec : null;
}
function writeDailyRecord(dateKey, patch) {
  try {
    const scope = dailyScope();
    const all = readDailyHistory(scope);
    const merged = mergeDailyRecord(all[dateKey], patch);
    all[dateKey] = merged || { ...(all[dateKey] || {}), ...patch };
    serverDailyHistory[dateKey] = all[dateKey];
    const keys = Object.keys(all).sort();
    keys.slice(0, Math.max(0, keys.length - DAILY_HISTORY_MAX_DAYS)).forEach((k) => delete all[k]);
    localStorage.setItem(dailyHistoryKey(scope), JSON.stringify(all));
  } catch (e) { /* noop */ }
}
function overwriteDailyRecord(dateKey, rec) {
  try {
    const scope = dailyScope();
    const all = readDailyHistory(scope);
    all[dateKey] = rec;
    serverDailyHistory[dateKey] = rec;
    localStorage.setItem(dailyHistoryKey(scope), JSON.stringify(all));
  } catch (e) { /* noop */ }
}
function migrateDailyHistory(fromScope, toScope) {
  if (!fromScope || !toScope || fromScope === toScope) return;
  try {
    const from = JSON.parse(localStorage.getItem(dailyHistoryKey(fromScope)) || '{}');
    const to = JSON.parse(localStorage.getItem(dailyHistoryKey(toScope)) || '{}');
    if (!Object.keys(from).length) return;
    const merged = { ...to };
    Object.keys(from).forEach((day) => {
      merged[day] = mergeDailyRecord(from[day], merged[day]) || from[day];
    });
    localStorage.setItem(dailyHistoryKey(toScope), JSON.stringify(merged));
    Object.entries(merged).forEach(([day, rec]) => {
      if (rec && rec.outfits && rec.outfits.length) serverDailyHistory[day] = rec;
    });
  } catch (e) { /* noop */ }
}
function snapshotItemsForOutfits(outfits, payloadItems, ownedItems) {
  const byId = {};
  (ownedItems || []).forEach((it) => { if (it && it.id != null) byId[String(it.id)] = it; });
  (payloadItems || []).forEach((it) => { if (it && it.id != null) byId[String(it.id)] = it; });
  const used = new Set();
  (outfits || []).forEach((o) => (o.itemIds || []).forEach((id) => used.add(String(id))));
  const out = [];
  used.forEach((id) => {
    const it = byId[id] || LB_DATA.ALL[id];
    if (it) out.push(it);
  });
  return out;
}
function hydrateDailyHistoryFromServer(data, ownedItems) {
  const list = data.outfits || [];
  const byDate = {};
  list.slice().reverse().forEach((o) => {
    if (!o.forDate) return;
    (byDate[o.forDate] = byDate[o.forDate] || []).push({
      id: o.id, label: o.label, mood: o.mood, styles: o.styles || [],
      itemIds: o.itemIds, lookImg: o.lookImg, wish: o.wish,
    });
  });
  Object.entries(byDate).forEach(([day, outfits]) => {
    writeDailyRecord(day, {
      outfits,
      items: snapshotItemsForOutfits(outfits, data.items || [], ownedItems),
    });
  });
  return byDate;
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
/** 옷장에 없는 게 정상인 id (AI가 제안한 '있으면 좋을 아이템'). 정리에서 지우지 않는다. */
function isWishId(id) {
  return String(id).startsWith('wish-');
}
/** owned에 있는 id만 남긴 코디. 2개 미만·상의/하의 미달이면 버린다. */
function sanitizeDailyOutfit(outfit, owned) {
  if (!outfit) return null;
  const ids = (outfit.itemIds || []).map(String).filter((id) => owned.has(id) || isWishId(id));
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
    if (cat === '하의' || cat === 'bottom' || cat === 'skirt') return 'bottom';
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
if (typeof window !== 'undefined') window.filterDailyOutfitsByOwned = filterDailyOutfitsByOwned;
function dailyCacheItemsFromOwned(ownedItems, outfits) {
  const used = new Set();
  (outfits || []).forEach((o) => (o.itemIds || []).forEach((id) => used.add(String(id))));
  const owned = (ownedItems || []).filter((it) => it && used.has(String(it.id || it.serverId)));
  // 제안 아이템은 옷장에 없으니 LB_DATA에 기억된 값으로 캐시에 함께 담는다.
  const wish = [...used].filter(isWishId).map((id) => LB_DATA.ALL[id]).filter(Boolean);
  return [...owned, ...wish];
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

/** 등록 중복 판정용 URL 정규화 — 추적 파라미터·해시·꼬리 슬래시를 떼고 상품 식별자만 남긴다. */
function normalizeProductUrl(raw) {
  const str = String(raw || '').trim();
  if (!str) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(str) ? str : 'https://' + str);
    const keep = [];
    u.searchParams.forEach((v, k) => {
      const nk = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (/^(goodsno|productno|itemid|prdno|productid)$/.test(nk)) keep.push(`${nk}=${v}`);
    });
    const path = u.pathname.replace(/\/+$/, '').toLowerCase();
    return u.hostname.replace(/^www\./, '').toLowerCase() + path + (keep.length ? '?' + keep.sort().join('&') : '');
  } catch (e) {
    return str.toLowerCase();
  }
}

/** 값이 '설정된' 것으로 볼 수 있는지. 빈 문자열·빈 배열은 미설정으로 본다. */
function prefsFilled(v) {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim() !== '';
  return v !== undefined && v !== null;
}

/**
 * 계정 설정과 이 기기 설정을 합친다.
 * - 계정에 값이 있으면 계정이 정본이다 (다른 기기에서 바꾼 게 반영돼야 하니까).
 * - 계정에 비어 있는 값만 이 기기 값으로 채운다 — 예전에 기기가 계정을 기본값으로
 *   덮어써 버린 적이 있어서, 값이 남아 있는 기기가 계정을 되살릴 수 있어야 한다.
 * - 프사는 data URL이 metadata에 안 들어가 기기마다 달랐다. 계정에 http URL이 있으면
 *   그걸 쓰고, 이 기기에만 data URL이 있으면 나중에 올려 계정을 채운다.
 */
function mergePrefs(local, account) {
  const base = { ...LB_DATA.DEFAULT_PREFS, ...(local || {}) };
  const acc = account || {};
  const out = { ...base };
  Object.keys(acc).forEach((k) => {
    if (k === 'avatar') return;
    if (prefsFilled(acc[k])) out[k] = acc[k];
  });
  if (Object.prototype.hasOwnProperty.call(acc, 'avatar')) {
    const accAv = String(acc.avatar || '');
    const locAv = String(out.avatar || '');
    if (/^https?:\/\//i.test(accAv)) out.avatar = accAv;
    else if (!accAv && !locAv.startsWith('data:')) out.avatar = '';
  }
  return out;
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
    if (it && (owned.has(String(it.id || it.serverId)) || isWishId(it.id))) liveRememberItem(it);
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

// SSE 한 줄에서 payload만 꺼낸다. `data: {…}` 와 옛 프로토콜의 맨 JSON 둘 다 받는다.
// `:` 로 시작하는 줄은 SSE 코멘트(패딩·keep-alive)이므로 버린다.
function streamPayload(line) {
  const s = String(line || '').trim();
  if (!s || s.charAt(0) === ':') return '';
  return s.indexOf('data:') === 0 ? s.slice(5).trim() : s;
}

// 진행 이벤트(_step)를 걸러내고 결과가 담긴 마지막 이벤트만 남긴다.
function lastResultLine(text) {
  const lines = String(text || '').split('\n').map(streamPayload).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    // 진행(_step)·착장 한 장(_look)은 결과가 아니다.
    if (lines[i].indexOf('"_step"') === -1 && lines[i].indexOf('"_look"') === -1) return lines[i];
  }
  return '';
}

// 스트림을 읽으면서 _step / _look 이벤트가 도착할 때마다 콜백. 전체 본문은
// 그대로 돌려주므로 이후 파싱 로직은 res.text()와 동일하게 동작한다.
async function readProgressStream(res, onProgress, onLook) {
  if (!res.body || !res.body.getReader) return res.text();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    text += chunk;
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const payload = streamPayload(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
      if (!payload) continue;
      const isStep = payload.indexOf('"_step"') !== -1;
      const isLook = payload.indexOf('"_look"') !== -1;
      if (!isStep && !isLook) continue;
      try {
        const row = JSON.parse(payload);
        if (row._step && onProgress) onProgress(row._step);
        if (row._look && onLook) onLook(row._look);
      } catch (e) { /* 부분 수신 줄은 무시 */ }
    }
  }
  return text;
}

async function liveJSON(url, options = {}) {
  // 일반 추출은 60초, 고난도만 120초다. 분류·업로드 여유를 포함해도 정상 요청이
  // 먼저 끊기지 않으면서, 비정상 요청을 4분 동안 붙잡지 않게 한다.
  const timeoutMs = options.timeoutMs || 165000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    const { timeoutMs: _t, onProgress: _p, onLook: _l, ...fetchOpts } = options;
    res = await fetch(url, {
      ...fetchOpts,
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
  // 본문은 줄 단위: {"_step":…} 진행 알림이 흐르고 마지막 줄이 결과다.
  let text = '';
  try {
    text = (options.onProgress || options.onLook)
      ? await readProgressStream(res, options.onProgress, options.onLook)
      : await res.text();
  } catch (e) {
    throw new Error('서버와 연결이 끊겼어요. 잠시 후 다시 시도해 주세요.');
  }
  const trimmed = lastResultLine(text);
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

async function uploadAvatarToAccount(dataUrl) {
  const res = await liveJSON('/api/live/profile/avatar', {
    method: 'POST',
    body: JSON.stringify({ image_data_url: dataUrl }),
  });
  return (res && res.avatarUrl) || '';
}

async function liveImportSource({ sourceType, file, url, status, extractHint, onProgress }) {
  const hint = (extractHint || '').trim();
  if (sourceType === 'url') {
    if (!url || !url.trim()) throw new Error('상품 URL을 입력해주세요');
    return liveJSON('/api/live/import/url', {
      method: 'POST',
      body: JSON.stringify({ url, status, extract_hint: hint }),
      onProgress,
    });
  }
  if (!file) throw new Error('사진 파일을 선택해주세요');
  const fd = new FormData();
  fd.append('image', file);
  fd.append('status', status || 'owned');
  fd.append('extract_hint', hint);
  return liveJSON('/api/live/import/photo', { method: 'POST', body: fd, onProgress });
}

async function liveCollectOrders({ platform, onProgress }) {
  return liveJSON('/api/live/orders/collect', {
    method: 'POST',
    body: JSON.stringify({ platform }),
    onProgress,
    timeoutMs: 210000,
  });
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
  // 옷장을 한 번이라도 받아 봤는지. 처음 안내 팝업은 이게 끝난 뒤에만 띄운다 —
  // 안 그러면 옷이 가득한 계정에서도 로딩 몇 백 ms 동안 팝업이 번쩍인다.
  const [wardrobeLoaded, setWardrobeLoaded] = useState(() => isShowcase || !!readWardrobeCache());
  const [savedLooks, setSavedLooks] = useState(() => pSaved === 'empty' ? [] : LB_DATA.SAVED.slice());
  const [addSheet, setAddSheet] = useState({ open: pScreen === 'add' || !!pSheet, mode: pSheet || 'wardrobe' });
  const [loading, setLoading] = useState(pLoading);
  const [moreLoading, setMoreLoading] = useState(false);
  const [comboRev, setComboRev] = useState(0);
  const [detailLook, setDetailLook] = useState(pSaved === 'empty' ? null : LB_DATA.SAVED[0]);
  // 상세는 룩북에서만 열렸는데, 오늘의 추천 코디에서도 같은 화면을 쓴다. 어느 목록에서
  // 들어왔는지에 따라 좌우 이동·옆 레일이 그 목록을 따라야 한다.
  const [detailList, setDetailList] = useState(null);
  const [addedItemIds, setAddedItemIds] = useState([]);
  const [itemSheet, setItemSheet] = useState({ open: false, item: null });
  const [imageViewer, setImageViewer] = useState({ open: false, item: null, outfit: null, items: null });
  // 오늘 입은 데일리 코디 id들 — 새로고침해도 그날 기록은 이어간다.
  const [wornToday, setWornToday] = useState(() => (readDailyRecord(localYmd()) || {}).wornIds || []);
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
  // 처음 안내 팝업은 계정에 한 번만 뜬다. 기기 플래그만 쓰면 다른 기기에서 로그인할 때
  // 옷장이 이미 가득한데도 '옷을 먼저 추가해 주세요'가 다시 뜬다.
  const [tutorialSeen, setTutorialSeen] = useState(() => {
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
  // 로그인한 계정 id. 옷장·코디 fetch가 이 값을 따라 돈다 — 예전에는 마운트 때 한 번만
  // 돌아서, 로그인 전 마운트에서 토큰 없이 401로 실패하고 로그인해도 재요청이 없었다.
  // 그래서 새로고침을 해야 데이터가 나왔다.
  const [authUid, setAuthUid] = useState(null);
  // 계정 설정(user_metadata.prefs)을 한 번이라도 읽었는지. 읽기 전에는 계정에 쓰지 않는다.
  const prefsSynced = useRef(false);
  // 계정 설정이 도착하기 전에 사용자가 바꾼 값은 계정 값으로 되돌리지 않는다.
  const prefsAtBoot = useRef(null);
  setDailyScope(authUid); // 코디 캐시 키를 현재 계정으로 고정 — 렌더 중 읽는 곳이 있어 effect보다 먼저 세팅한다
  const prevAuthUid = useRef('');
  useEffect(() => {
    Object.keys(serverDailyHistory).forEach((k) => { delete serverDailyHistory[k]; });
    if (!authUid) return;
    migrateDailyHistory('anon', authUid);
    if (prevAuthUid.current && prevAuthUid.current !== authUid) {
      migrateDailyHistory(prevAuthUid.current, authUid);
    }
    prevAuthUid.current = authUid;
    try { localStorage.setItem(LAST_UID_KEY, authUid); } catch (e) { /* noop */ }
  }, [authUid]);
  const [editPrefs, setEditPrefs] = useState(false);
  const [accountSheet, setAccountSheet] = useState(false);
  const [phase, setPhase] = useState('landing');   // landing → onboarding | login → (app)

  // 부팅 시 Supabase 세션을 복원한다. lb_onboarded는 이 기기의 플래그일 뿐이어서,
  // 로그인 계정이 살아 있으면 그 계정으로 바로 들어가고(다른 기기·캐시 삭제 후에도
  // 같은 옷장), 반대로 세션이 없는데 플래그만 남아 있으면 랜딩으로 되돌린다 —
  // 안 그러면 토큰 없이 빈 옷장을 자기 옷장인 줄 알고 보게 된다.
  useEffect(() => {
    if (isShowcase || forceOnb) return;
    let alive = true;
    if (!prefsAtBoot.current) prefsAtBoot.current = prefs;
    (async () => {
      if (!window.LB_AUTH) return;
      const me = await window.LB_AUTH.current();
      if (!alive) return;
      if (me) setAuthUid(me.id);
      if (me && !me.anonymous) {
        setPrefs((prev) => {
          const np = { ...mergePrefs(prev, me.prefs), email: me.email };
          // 계정 응답을 기다리는 동안 사용자가 만진 값은 그대로 둔다(껐다 켠 스위치가
          // 잠시 뒤 저절로 되돌아가면 고장 난 것처럼 보인다).
          const boot = prefsAtBoot.current || {};
          Object.keys(prev).forEach((k) => {
            if (JSON.stringify(prev[k]) !== JSON.stringify(boot[k])) np[k] = prev[k];
          });
          prefsSynced.current = true;
          // 합친 결과를 계정에도 되돌려 쓴다 — 계정에서 비어 있던 값이 이 기기에
          // 남아 있으면 그대로 복구된다.
          persistPrefs(np);
          return np;
        });
        setOnboarded(true);
      } else if (!me) {
        setOnboarded(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const persistPrefs = (p, opts) => {
    try { localStorage.setItem('lb_prefs', JSON.stringify(p)); localStorage.setItem('lb_onboarded', '1'); } catch (e) { /* noop */ }
    // 계정 설정을 아직 못 읽은 상태에서 계정에 쓰면, 이 기기의 기본값이 계정에 저장된
    // 진짜 설정을 지운다(다른 기기에서 스타일·퍼스널 컬러가 사라지던 원인). 한 번
    // 읽어 온 뒤에만 계정에 쓴다. 로컬 저장은 항상 한다.
    if (!prefsSynced.current) return;
    // email은 세션에서 온다. 프사 data URL은 metadata 한도를 넘기니 URL만 올린다.
    if (window.LB_AUTH && window.LB_AUTH.savePrefs) {
      const { email, avatar, ...rest } = p;
      if (typeof avatar === 'string' && /^https?:\/\//i.test(avatar)) rest.avatar = avatar;
      else if (opts && opts.clearAvatar) rest.avatar = '';
      window.LB_AUTH.savePrefs(rest);
    }
  };
  useEffect(() => {
    if (!authUid || !prefsSynced.current) return;
    const pending = prefs.avatar;
    if (!pending || !pending.startsWith('data:')) return;
    let alive = true;
    uploadAvatarToAccount(pending)
      .then((url) => {
        if (!alive || !url) return;
        setPrefs((prev) => {
          if (prev.avatar !== pending) return prev;
          const np = { ...prev, avatar: url };
          persistPrefs(np);
          return np;
        });
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUid, prefs.avatar]);
  const completeOnboarding = (p) => { prefsSynced.current = true; setPrefs(p); persistPrefs(p); setOnboarded(true); };
  // 가입 — 계정 단계를 넘어갈 때 실제 Supabase 계정을 만든다. 에러 문구를 돌려주면
  // 온보딩이 그 단계에 머문다. 여기서 계정을 만들어야 다음 방문에 같은 옷장이 열린다.
  const createAccount = async (email, pw) => {
    if (!window.LB_AUTH) return '서버 설정이 없어요.';
    const r = await window.LB_AUTH.signUp(email, pw);
    if (r.error) return r.error;
    const p = { ...prefs, email };
    prefsSynced.current = true;   // 방금 만든 계정이라 이 기기 설정이 정본이다
    setPrefs(p); persistPrefs(p);
    if (r.user) setAuthUid(r.user.id);
    return '';
  };
  // 로그인 — 성공하면 그 계정의 옷장을 새로 읽어온다. 기기에 남아 있던 선호 정보는
  // 이어 쓰되 이메일은 세션 값으로 맞춘다.
  const completeLogin = async (email, pw) => {
    if (!window.LB_AUTH) return '서버 설정이 없어요.';
    const r = await window.LB_AUTH.signIn(email, pw);
    if (r.error) return r.error;
    // 계정에 저장된 설정이 있으면 그걸 쓴다 (다른 기기에서 처음 로그인하는 경우)
    const p = { ...mergePrefs(prefs, r.user.prefs), email: r.user.email || email };
    prefsSynced.current = true;
    setPrefs(p); persistPrefs(p); setOnboarded(true);
    setAuthUid(r.user.id);
    return '';
  };
  const saveEditedPrefs = (p) => { setPrefs(p); persistPrefs(p); setEditPrefs(false); showToast('선호 정보를 저장했어요', 'check'); };
  const openPrefs = () => setEditPrefs(true);
  const openAccount = () => setAccountSheet(true);
  const setAvatar = (dataUrl) => {
    const np = {
      ...prefs,
      avatar: dataUrl || '',
      // 얼굴이 바뀌면 예전에 만든 전신 컷은 버린다. 다음 바로 보기에서 다시 만든다.
      tryOnBody: '',
      tryOnFrame: '',
      tryOnCut: '',
    };
    setPrefs(np);
    persistPrefs(np, { clearAvatar: !dataUrl });
    showToast(dataUrl ? '프로필 사진을 바꿨어요' : '프로필 사진을 지웠어요', 'check');
  };
  const setTryOnFrame = ({ body, frame, cut }) => {
    const np = {
      ...prefs,
      tryOnBody: body || '',
      tryOnFrame: frame || '',
      tryOnCut: cut || '',
    };
    setPrefs(np);
    persistPrefs(np);
    showToast(frame ? '바로 보기 사진을 저장했어요' : '사진을 지웠어요', 'check');
  };
  const [tryOnSetup, setTryOnSetup] = useState(false);
  const [tryOnSeedBody, setTryOnSeedBody] = useState('');
  const [tryOnCamera, setTryOnCamera] = useState(false);
  const [tryOnDesktopHint, setTryOnDesktopHint] = useState(false);
  const [tryOnSetupAsSettings, setTryOnSetupAsSettings] = useState(false);
  const [tryOnSetupMaking, setTryOnSetupMaking] = useState(false);
  // 프로필 사진 한 장으로 전신 이미지를 만든다(퍼스널 컬러와 같은 방식). 착장 컷은 얼굴을 쓰지 않는다.
  // 매장에서 쓰려면 전신 사진이 필요한데 미리 찍어 둔 사람은 드물다.
  const [tryOnMaking, setTryOnMaking] = useState(false);
  const makeTryOnBody = async (opts) => {
    const silent = !!(opts && opts.silent);
    if (tryOnMaking) return '';
    if (!prefs.avatar) { if (!silent) showToast('프로필 사진을 먼저 등록해 주세요'); return ''; }
    setTryOnMaking(true);
    try {
      const res = await liveJSON('/api/live/tryon/body', {
        method: 'POST',
        body: JSON.stringify({ face_data_url: prefs.avatar }),
      });
      const url = res && res.imageUrl;
      if (!url) throw new Error('바로 보기 이미지를 만들지 못했어요');
      const np = { ...prefs, tryOnBody: url, tryOnFrame: url, tryOnCut: 'auto' };
      setPrefs(np); persistPrefs(np);
      reloadBilling();
      if (!silent) showToast(res.cached ? '바로 보기 이미지를 불러왔어요' : '바로 보기 이미지를 만들었어요', 'check');
      return url;
    } catch (e) {
      if (!silent) showToast(e.message || '바로 보기 이미지를 만들지 못했어요');
      return '';
    } finally {
      setTryOnMaking(false);
    }
  };
  const openTryOnSetup = async (seed, opts) => {
    const settings = !!(opts && opts.settings);
    setTryOnSetupAsSettings(settings);
    let seedStr = typeof seed === 'string' ? seed : '';
    setTryOnSeedBody(seedStr);
    setTryOnSetup(true);
    if (settings && !seedStr && !prefs.tryOnBody && prefs.avatar) {
      setTryOnSetupMaking(true);
      const url = await makeTryOnBody({ silent: true });
      setTryOnSetupMaking(false);
      if (url) setTryOnSeedBody(url);
    }
  };
  // 전신 사진을 저장한 뒤 바로 카메라를 연다. 상의·하의 구멍을 손으로 지우는 시트는 거치지 않는다.
  const startTryOn = (payload) => {
    if (payload && (payload.body || payload.frame)) setTryOnFrame(payload);
    if (wide) { setTryOnDesktopHint(true); return; }
    setTryOnCamera(true);
  };
  const saveAccount = (draft) => { const np = { ...prefs, ...draft }; setPrefs(np); persistPrefs(np); setAccountSheet(false); showToast('개인 정보를 저장했어요', 'check'); };
  const logout = () => {
    prefsSynced.current = false;   // 다음 로그인에서 계정 설정을 읽기 전까지 계정에 쓰지 않는다
    if (window.LB_AUTH) window.LB_AUTH.signOut();
    try { localStorage.setItem('lb_onboarded', '0'); } catch (e) { /* noop */ }
    setAuthUid(null);
    setItems([]); setArchived([]);
    setBilling(null);
    setOnboarded(false); setPhase('landing'); setTab('wardrobe');
  };

  // ---- responsive (window-width based; reliable inside fixed iframes) ----
  const shellRef = useRef(null);
  const [wide, setWide] = useState(typeof window !== 'undefined' && window.innerWidth >= 760);
  useEffect(() => {
    const measure = () => setWide(window.innerWidth >= 760);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  // 옷장·마이에서 진입. 프레임 없으면 설정, 있으면 카메라(모바일). PC 카메라 시도는 안내 시트.
  const openTryOn = async () => {
    if (wide) { setTryOnDesktopHint(true); return; }
    if (!prefs.tryOnFrame) {
      // 프로필 사진이 있으면 만들어서 바로 연다. 없으면 예전처럼 바로 보기 탭에서 사진을 고른다.
      if (prefs.avatar) {
        const made = await makeTryOnBody();
        if (made) { setTryOnCamera(true); return; }
      }
      openTryOnTab();
      return;
    }
    setTryOnCamera(true);
  };
  // PC에서 모바일 폭을 미리 볼 때도 손가락처럼 마우스로 끌어 스크롤한다.
  // 기본 브라우저는 이미지 드래그/텍스트 선택을 먼저 시작해 "걸렸다가 움직이는" 느낌이
  // 나므로, 실제 스크롤 가능한 축을 찾은 뒤 6px 이상 움직였을 때만 드래그로 전환한다.
  // html/body·#root 가 overflow:hidden 이라 트랙패드/휠이 내부 overflow:auto 로
  // 안 전달되는 환경이 있어, wheel 도 같은 스크롤러에 직접 넘긴다.
  useEffect(() => {
    const root = shellRef.current;
    if (wide || !root) return undefined;
    let drag = null;
    let suppressClick = false;
    let raf = 0;
    let clickTimer = 0;

    const canScroll = (node, axis) => {
      const style = getComputedStyle(node);
      const overflow = axis === 'x' ? style.overflowX : style.overflowY;
      if (overflow !== 'auto' && overflow !== 'scroll' && overflow !== 'overlay') return false;
      return axis === 'x'
        ? node.scrollWidth > node.clientWidth + 1
        : node.scrollHeight > node.clientHeight + 1;
    };
    const findScroller = (start, axis) => {
      let node = start instanceof Element ? start : start.parentElement;
      while (node && root.contains(node)) {
        if (canScroll(node, axis)) return node;
        if (node === root) break;
        node = node.parentElement;
      }
      return null;
    };
    // 칩·탑바 위에서 휠해도 본문이 움직이도록, 타겟 경로에 없으면 보이는 탭의 세로 스크롤러를 찾는다.
    const findYScroller = (start) => {
      const hit = findScroller(start, 'y');
      if (hit) return hit;
      const pane = root.querySelector('.lb-scroll [aria-hidden="false"]') || root.querySelector('.lb-scroll');
      if (!pane) return null;
      const stack = [pane];
      while (stack.length) {
        const node = stack.shift();
        if (!(node instanceof Element)) continue;
        if (canScroll(node, 'y')) return node;
        for (let i = 0; i < node.children.length; i++) stack.push(node.children[i]);
      }
      return null;
    };
    const paint = (state) => {
      raf = 0;
      if (state.axis === 'x') state.xEl.scrollLeft = state.left - (state.x - state.startX);
      else if (state.axis === 'y') state.yEl.scrollTop = state.top - (state.y - state.startY);
    };
    const onDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const xEl = findScroller(e.target, 'x');
      const yEl = findYScroller(e.target);
      if (!xEl && !yEl) return;
      drag = {
        startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY,
        left: xEl ? xEl.scrollLeft : 0, top: yEl ? yEl.scrollTop : 0,
        xEl, yEl, axis: null,
      };
    };
    const onMove = (e) => {
      if (!drag || e.pointerType !== 'mouse') return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.axis) {
        if (Math.hypot(dx, dy) < 6) return;
        drag.axis = drag.xEl && Math.abs(dx) > Math.abs(dy) ? 'x' : (drag.yEl ? 'y' : 'x');
        suppressClick = true;
        root.classList.add('lb-mouse-dragging');
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
      e.preventDefault();
      if (!raf) {
        const state = drag;
        raf = requestAnimationFrame(() => paint(state));
      }
    };
    const finish = () => {
      if (!drag) return;
      drag = null;
      root.classList.remove('lb-mouse-dragging');
      if (suppressClick) {
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { suppressClick = false; }, 80);
      }
    };
    const onClick = (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const stopNativeDrag = (e) => e.preventDefault();
    root.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    root.addEventListener('click', onClick, true);
    root.addEventListener('dragstart', stopNativeDrag);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(clickTimer);
      root.classList.remove('lb-mouse-dragging');
      root.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      root.removeEventListener('click', onClick, true);
      root.removeEventListener('dragstart', stopNativeDrag);
    };
  }, [wide, onboarded]);

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

  // 토스트는 1.9초 스쳐 가는 알림이다. 모바일에서 한 줄을 넘기면 읽기도 전에 사라지고
  // 화면만 가린다. 서버 문구처럼 두세 문장짜리가 들어오면 첫 문장만 띄운다 —
  // 자세한 안내가 필요한 자리(추가 시트·일괄 등록 목록)에는 전체 문장이 그대로 남는다.
  const shortToast = (msg) => {
    // 개발용 코드는 토스트에 띄우지 않는다(자세한 화면·로그에는 그대로 남는다).
    const text = String(msg || '').replace(/\s*\(코드:[^)]*\)/g, '').trim();
    if (text.length <= 22) return text.replace(/\.$/, '');
    const first = (text.split(/(?<=[.!?])\s+/)[0] || text).replace(/\.$/, '');
    return first.length <= 22 ? first : first.slice(0, 21) + '…';
  };
  const showToast = useCallback((msg, icon) => {
    setToast({ msg: shortToast(msg), icon });
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

  // 저장·해제를 누른 뒤에 뒤늦게 도착한 응답이 화면을 되돌리지 않게 하는 카운터.
  const outfitMutRef = useRef(0);
  // 서버 코디 목록 → 룩북·날짜별 기록·오늘 코디 캐시. 로컬은 첫 페인트용 캐시일 뿐이다.
  const hydrateOutfits = useCallback((data, ownedItems, mutAtStart) => {
    const list = data.outfits || [];
    list.forEach((o) => {
      LB_DATA.OUTFIT_BY_ID[o.id] = {
        id: o.id, label: o.label, mood: o.mood, styles: o.styles || [],
        itemIds: o.itemIds, lookImg: o.lookImg, manual: !!o.manual, wish: o.wish,
      };
    });
    // 요청을 보낸 뒤에 사용자가 저장·해제를 눌렀다면 그 결과가 최신이다. 덮지 않는다.
    if (mutAtStart === outfitMutRef.current) {
      setSavedLooks(list.filter((o) => o.saved).map((o) => ({
        id: 'look-' + o.id, outfitId: o.id, label: o.label,
        savedAt: relativeSavedAt(o.createdAt),
      })));
    }
    // 서버는 최신순으로 준다. 오늘 코디는 만든 순서대로 보여야 해서 되돌린다.
    const byDate = hydrateDailyHistoryFromServer(data, ownedItems);
    const todayKey = localYmd();
    const today = byDate[todayKey];
    if (today && today.length) {
      const kept = filterDailyOutfitsByOwned(today, ownedItems);
      if (kept.length) {
        // 서버 목록은 새 객체라, 지금 화면에 이미 붙은 lookImg를 지우면 착장이
        // 서버에 있어도 컷아웃만 남는다. 둘 중 있는 쪽을 쓴다.
        const localLook = {};
        (LB_DATA.DAILY || []).forEach((o) => { if (o && o.id && o.lookImg) localLook[o.id] = o.lookImg; });
        kept.forEach((o) => { if (o && !o.lookImg && localLook[o.id]) o.lookImg = localLook[o.id]; });
        const cached = readDailyCache();
        writeDailyCache({
          style: (cached && cached.style) || '',
          outfits: kept,
          items: dailyCacheItemsFromOwned(ownedItems, kept),
          // sig는 지금 옷장 기준. 서버에서 받아온 직후엔 '옷장이 늘었다' CTA가 뜰 이유가 없다.
          wardrobeSig: (cached && cached.wardrobeSig) || wardrobeSigOf(ownedItems),
          wardrobeCount: cached && cached.wardrobeCount != null ? cached.wardrobeCount : (ownedItems || []).length,
        });
        LB_DATA.DAILY.splice(0, LB_DATA.DAILY.length, ...kept);
      }
    } else {
      // 서버에 오늘 코디가 없으면 로컬 캐시·히스토리를 비운다. 안 그러면 리셋 후에도
      // lb_daily_outfits_v3 / history merge가 지운 착장을 다시 그린다.
      LB_DATA.DAILY.splice(0, LB_DATA.DAILY.length);
      clearDailyCache();
      overwriteDailyRecord(todayKey, { outfits: [], items: [], wornIds: [] });
    }
  }, []);

  // 요금제·크레딧 — 서버가 정본이다. 마이페이지가 서버를 기다리지 않게
  // 마지막 값을 먼저 그리고, 받은 뒤에 덮는다.
  const [billing, setBilling] = useState(() => readBillingCache());
  const [billingTick, setBillingTick] = useState(0);
  const reloadBilling = useCallback(() => setBillingTick((n) => n + 1), []);
  useEffect(() => {
    if (isShowcase || !authUid) return;
    const cached = readBillingCache(authUid);
    if (cached) setBilling(cached);
    let dead = false;
    liveJSON('/api/live/billing')
      .then((data) => {
        if (dead) return;
        setBilling(data);
        writeBillingCache(authUid, data);
      })
      .catch(() => { /* 요금제를 못 읽어도 앱은 그대로 돈다 */ });
    return () => { dead = true; };
  }, [isShowcase, authUid, billingTick]);

  const refreshLive = useCallback(async () => {
    if (isShowcase || !authUid) return;
    const mutAtStart = outfitMutRef.current;
    // 사용량도 옷장과 동시에 요청한다 — 옷장 응답을 기다렸다가 뒤이어 부르면
    // 마이페이지 사용량이 그만큼 늦게 뜬다(직렬 대기 → 병렬 요청).
    reloadBilling();
    try {
      const [ownedData, archData, outfitData] = await Promise.all([
        liveJSON('/api/live/wardrobe'),
        liveJSON('/api/live/wardrobe?status=archived').catch(() => ({ items: [] })),
        liveJSON('/api/live/outfits').catch(() => null),
      ]);
      const liveItems = (ownedData.items || []).map(liveRememberItem);
      const archItems = (archData.items || []).map(liveRememberItem);
      setItems(liveItems);
      setArchived(archItems);
      syncAllFromWardrobe(liveItems, archItems);
      if (outfitData) hydrateOutfits(outfitData, liveItems, mutAtStart);
      const removed = pruneDailyAgainstOwned(liveItems);
      if (LB_DATA.DAILY.length) setDailyAllowed(true);
      else if (removed) setDailyAllowed(false);
      bumpDaily();
    } catch (e) {
      showToast(e.message || '옷장을 불러오지 못했어요');
    }
  }, [isShowcase, authUid, hydrateOutfits, bumpDaily, reloadBilling, showToast]);

  useEffect(() => {
    if (isShowcase) return;
    if (!authUid) return;
    let dead = false;
    setWardrobeLoading(true);
    refreshLive()
      .finally(() => { if (!dead) { setWardrobeLoading(false); setWardrobeLoaded(true); } });
    return () => { dead = true; };
  }, [isShowcase, authUid, refreshLive]);

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

  // (제거) 예전에는 부팅할 때마다 /wardrobe/refresh-cache 를 불러 옛 이미지를 WebP로
  // 다시 올렸다. 마이그레이션은 끝났는데 기기 캐시를 지울 때마다 다시 돌면서 첫 화면에
  // 왕복 세 번(마이그레이션 + 옷장 재조회 2번)을 얹고 있었다. 필요하면 스크립트로 한 번만 돈다.

  // 스크롤 위치 표시 — 스크롤 중에만 보인다. 리스너는 반드시 passive + capture로 단다.
  // 스크롤 경로에 비패시브 리스너를 다시 달면 컴포지터 스크롤이 또 꺼진다.
  // 측정·스타일 적용은 rAF 한 번으로 묶어 스크롤 프레임마다 레이아웃을 되읽지 않는다.
  useEffect(() => {
    const bar = document.createElement('div');
    bar.className = 'lb-sbar';
    document.body.appendChild(bar);
    let hideTimer = null;
    let frame = null;
    let pending = null;

    const draw = () => {
      frame = null;
      const el = pending;
      if (!el || !el.isConnected) return;
      const track = el.clientHeight;
      const total = el.scrollHeight;
      if (total <= track + 4) { bar.classList.remove('on'); return; }
      const r = el.getBoundingClientRect();
      const inset = 3;
      const usable = track - inset * 2;
      const h = Math.max(28, Math.round((track / total) * usable));
      const top = Math.round((el.scrollTop / (total - track)) * (usable - h));
      bar.style.height = h + 'px';
      bar.style.top = (r.top + inset + top) + 'px';
      bar.style.left = (r.right - 4 - inset) + 'px';
      bar.classList.add('on');
    };

    const onScroll = (e) => {
      const el = e.target;
      if (!el || el.nodeType !== 1 || !el.classList || !el.classList.contains('lb-scrollable')) return;
      pending = el;
      if (!frame) frame = requestAnimationFrame(draw);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => bar.classList.remove('on'), 700);
    };

    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      clearTimeout(hideTimer);
      if (frame) cancelAnimationFrame(frame);
      bar.remove();
    };
  }, []);

  // Persist the wardrobe locally so the next load paints instantly.
  useEffect(() => {
    if (isShowcase) return;
    writeWardrobeCache(authUid, items, archived);
  }, [authUid, items, archived, isShowcase]);

  // 원본 이미지 미리 받기 — 목록 전체를 한꺼번에 받으면(예전 동작) 옷이 늘수록 첫 화면이
  // 느려진다. 43개에 1.7MB, 200개면 8MB를 그리드 썸네일과 동시에 경쟁시키는 셈이었다.
  // 이제 목록은 썸네일로 그리고, 원본은 '먼저 열어 볼 만한 앞쪽 몇 개'만 한가할 때 데운다.
  useEffect(() => {
    if (isShowcase) return;
    const urls = (items || []).slice(0, 12).map((it) => it && it.img).filter(Boolean);
    if (!urls.length) return undefined;
    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      urls.forEach((u) => {
        const im = new Image();
        im.decoding = 'async';
        im.fetchPriority = 'low';
        im.src = u;
      });
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(warm, { timeout: 3000 })
      : setTimeout(warm, 1200);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback && window.requestIdleCallback) window.cancelIdleCallback(idle);
      else clearTimeout(idle);
    };
  }, [items, isShowcase]);

  // ---- actions ----
  const savedOutfitIds = savedLooks.map((l) => l.outfitId);
  const go = (id) => { setView(null); setTab(id); if (!isShowcase) persistTab(id); };
  const back = () => setView(null);

  // 좌상단 로고 = 홈. 옷장으로 보내면서 새로 불러온다. 이미 옷장이어도 같은 주소로
  // replace하면 그대로 새로고침된다(탭은 ?tab= 으로 복원되므로 자리를 잃지 않는다).
  const goHome = () => {
    try {
      const u = new URL(location.href);
      u.searchParams.set('tab', 'wardrobe');
      u.hash = '';
      location.replace(u.pathname + u.search);
    } catch (e) { location.reload(); }
  };

  const openAdd = (mode, extra = {}) => setAddSheet({ open: true, mode, ...extra });
  const closeAdd = () => setAddSheet((s) => ({ ...s, open: false, replaceItem: null }));
  const startCombo = () => openAdd('anchor');
  // 마이페이지 '바로 보기 전신 이미지 설정' — 조합 추천과 같은 시트를 '바로 보기' 탭으로 연다
  const openTryOnTab = () => openAdd('anchor', { initialSourceTab: 'tryon' });
  const comboTops = items.filter((it) => it.category === '상의' || it.category === '원피스').length;
  const comboBottoms = items.filter((it) => it.category === '하의' || it.category === '스커트' || it.category === '원피스').length;
  // 조합 추천은 최소 상의 2벌 + 하의 2벌(총 4벌) 필요.
  const comboTopsNeed = Math.max(0, 2 - comboTops);
  const comboBottomsNeed = Math.max(0, 2 - comboBottoms);
  const comboReady = comboTopsNeed === 0 && comboBottomsNeed === 0;
  const comboProgress = Math.min(comboTops, 2) + Math.min(comboBottoms, 2);
  const comboNeed = [comboTopsNeed ? `상의 ${comboTopsNeed}개` : '', comboBottomsNeed ? `하의 ${comboBottomsNeed}개` : ''].filter(Boolean).join(', ');
  const comboGate = () => startCombo(); // 옷 부족해도 시트 오픈 — '바로 보기'는 옷장 없이도 가능
  // 계정 설정에 남긴다(다른 기기에서도 안 뜨게). 로컬은 계정 응답을 기다리는 동안의 폴백.
  const finishTutorial = () => {
    try { localStorage.setItem('lb_tutorial_done', '1'); } catch (e) { /* noop */ }
    setTutorialSeen(true);
    if (!prefs.tutorialDone) {
      const np = { ...prefs, tutorialDone: true };
      setPrefs(np);
      persistPrefs(np);
    }
  };
  // 계정에 이미 봤다고 남아 있거나, 옷장에 옷이 있으면 보여줄 이유가 없다.
  const tutorialDone = tutorialSeen || !!prefs.tutorialDone || items.length > 0 || !wardrobeLoaded;
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

  // 처음 추천받을 때 만드는 코디 수와, 그중 '옷장에 없는 아이템'을 더한 코디 수.
  // 둘 다 계정 설정이라 기기를 옮겨도 그대로다.
  const dailyCount = Math.max(2, Math.min(8, parseInt(prefs.dailyCount, 10) || parseInt(t.dailyCount, 10) || 4));
  const wishCount = Math.max(0, Math.min(3, parseInt(prefs.wishCount, 10) || 0));
  const setDailyCount = (n) => {
    const np = { ...prefs, dailyCount: Math.max(2, Math.min(8, parseInt(n, 10) || 4)) };
    setPrefs(np); persistPrefs(np);
  };
  const setWishCount = (n) => {
    const np = { ...prefs, wishCount: Math.max(0, Math.min(3, parseInt(n, 10) || 0)) };
    setPrefs(np); persistPrefs(np);
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

  const lookInflight = useRef(new Set());
  const applyModelLooks = useCallback(async (list) => {
    const targets = (list || LB_DATA.DAILY || []).filter((o) => (
      o && (o.itemIds || []).length && !o.lookImg && o.id && !lookInflight.current.has(o.id)
    ));
    if (!targets.length) return 0;
    targets.forEach((o) => lookInflight.current.add(o.id));
    const paintLook = (id, url) => {
      if (!id || !url) return;
      // hydrate가 DAILY를 새 객체로 갈아끼워도 id로 찾아 붙인다.
      (LB_DATA.DAILY || []).forEach((o) => { if (o && o.id === id) o.lookImg = url; });
      (list || []).forEach((o) => { if (o && o.id === id) o.lookImg = url; });
      if (LB_DATA.OUTFIT_BY_ID[id]) LB_DATA.OUTFIT_BY_ID[id].lookImg = url;
      writeDailyCache({
        style: dailyStyle,
        outfits: LB_DATA.DAILY.slice(),
        items: dailyCacheItemsFromOwned(items, LB_DATA.DAILY),
        wardrobeSig: wardrobeSigOf(items),
        wardrobeCount: items.length,
      });
      bumpDaily();
    };
    try {
      const payload = await liveJSON('/api/live/coordinate/looks', {
        method: 'POST',
        timeoutMs: 420000,
        onLook: (row) => paintLook(row && row.id, row && row.lookImg),
        body: JSON.stringify({
          gender: prefs.gender || '',
          outfits: targets.map((o) => ({
            id: o.id,
            item_ids: o.itemIds || [],
            label: o.label || '',
            wish: o.wish || null,
          })),
        }),
      });
      let n = 0;
      (payload.outfits || []).forEach((row) => {
        if (row && row.id && row.lookImg) {
          paintLook(row.id, row.lookImg);
          n += 1;
        }
      });
      reloadBilling();
      return n;
    } finally {
      targets.forEach((o) => lookInflight.current.delete(o.id));
      bumpDaily();
    }
  }, [prefs.gender, dailyStyle, items, bumpDaily, reloadBilling]);

  // refreshLive로 코디만 채워지면 dailyAllowed=true라 오늘 탭이 request를 스킵한다.
  // 그때 applyModelLooks가 안 타서 착장 토글이 켜져 있어도 옷 컷아웃만 보였다.
  useEffect(() => {
    if (isShowcase || !authUid || !wardrobeLoaded || !prefs.modelLook || !prefs.dailyEnabled) return;
    const pending = (LB_DATA.DAILY || []).filter((o) => (
      o && !o.lookImg && (o.itemIds || []).length && o.id && !lookInflight.current.has(o.id)
    ));
    if (!pending.length) return;
    applyModelLooks(pending).catch((e) => showToast(e.message || 'AI 착장 이미지를 만들지 못했어요'));
  }, [isShowcase, authUid, wardrobeLoaded, prefs.modelLook, prefs.dailyEnabled, dailyTick, applyModelLooks, showToast]);

  const setModelLook = (on) => {
    const np = { ...prefs, modelLook: !!on };
    setPrefs(np);
    persistPrefs(np);
    if (on) {
      const pending = (LB_DATA.DAILY || []).filter((o) => o && !o.lookImg && (o.itemIds || []).length);
      if (pending.length) {
        showToast('AI 착장 이미지를 만들고 있어요. 조금 걸려요.');
        applyModelLooks(pending).then((n) => {
          showToast(n ? 'AI 착장으로 바꿔 보여드려요' : '다음 추천부터 AI 착장으로 보여드려요');
        }).catch((e) => showToast(e.message || 'AI 착장 이미지를 만들지 못했어요'));
      } else {
        showToast('다음 추천부터 AI 착장으로 보여드려요');
      }
    } else {
      showToast('AI 착장 이미지를 껐어요');
    }
    return true;
  };

  const requestDailyOutfits = async (style = preferredDailyStyle, opts = {}) => {
    const force = !!(opts && opts.force);
    const quiet = !!(opts && opts.quiet);
    if (!prefs.dailyEnabled) return { added: 0, wardrobeGrew: false };
    // 캐시/메모리에 남은 삭제·보관 아이템 코디를 먼저 걷어낸다.
    syncAllFromWardrobe(items, archived);
    pruneDailyAgainstOwned(items);
    const wardrobeGrew = dailyWardrobeGrewSinceCache(items);
    // AI 착장 이미지 — 토글이 켜져 있으면 성별만 맞춰 룩북 모델을 그린다.
    // 성별은 coordProfile에 이미 들어 있다.
    const modelLook = prefs.modelLook ? { model_look: true } : {};
    // 마이페이지에 저장한 취향은 계정(user_metadata)에만 있어서 서버가 모른다.
    // 코디는 퍼스널 컬러·선호 실루엣까지 봐야 감이 맞으므로 요청마다 같이 싣는다.
    const styleProfile = coordProfile(prefs);
    if (!force) {
      // 오늘 이미 추천한 이력이 있으면 API 없이 기존 코디만 보여준다.
      if (LB_DATA.DAILY.length > 0) {
        const cached = readDailyCache();
        setDailyStyle((cached && cached.style) || style);
        setDailyAllowed(true);
        bumpDaily();
        if (prefs.modelLook && LB_DATA.DAILY.some((o) => !o.lookImg)) {
          applyModelLooks(LB_DATA.DAILY.filter((o) => !o.lookImg));
        }
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
          if (prefs.modelLook && outfits.some((o) => !o.lookImg)) {
            applyModelLooks(outfits.filter((o) => !o.lookImg));
          }
          return { added: 0, wardrobeGrew, fromCache: true };
        }
        clearDailyCache();
      }
    }
    // 탭에 들어온 것만으로는 새로 만들지 않는다. 여기까지 왔다는 건 캐시가 없다는 뜻이고,
    // 다음 줄부터는 크레딧을 쓰는 실제 추천이라 사용자가 직접 눌렀을 때만 진행한다.
    if (opts && opts.restoreOnly) return { added: 0, wardrobeGrew, restored: false };
    setDailyStyle(style);
    setDailyAllowed(true);
    setDailyLoading(true);
    try {
      const baseCount = dailyCount;
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
            for_date: localYmd(),
            exclude_item_ids: LB_DATA.DAILY.map((o) => o.itemIds || []),
            ...styleProfile,
            ...modelLook,
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
        else if (!quiet) showToast('더 만들 조합이 없어요');
        if (prefs.modelLook) {
          applyModelLooks(LB_DATA.DAILY.filter((o) => !o.lookImg));
        }
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
          for_date: localYmd(),
          wish_combos: Math.min(wishCount, baseCount),
          ...styleProfile,
          ...modelLook,
        }),
      });
      stampOutfitStyle(payload.outfits);
      (payload.items || []).forEach(liveRememberItem);
      // 첫 요청은 최대 baseCount개만 (버튼으로 2개씩 추가)
      const outfits = filterDailyOutfitsByOwned(payload.outfits || [], items).slice(0, baseCount);
      liveApplyPayload({ outfits, items: dailyCacheItemsFromOwned(items, outfits) }, 'daily');
      // wish 코디 등으로 줄어들었거나 조합이 부족하면 같은 날 안에서 한 번 더 채운다.
      let topUpGuard = 0;
      while (LB_DATA.DAILY.length < baseCount && topUpGuard < 3) {
        topUpGuard += 1;
        const need = baseCount - LB_DATA.DAILY.length;
        const wishLeft = Math.max(0, Math.min(wishCount, baseCount) - LB_DATA.DAILY.filter((o) => (o.itemIds || []).some(isWishId)).length);
        const extra = await liveJSON('/api/live/coordinate', {
          method: 'POST',
          body: JSON.stringify({
            max_combos: need,
            style,
            styles: preferredStyles,
            for_date: localYmd(),
            exclude_item_ids: LB_DATA.DAILY.map((o) => o.itemIds || []),
            wish_combos: Math.min(wishLeft, need),
            ...styleProfile,
            ...modelLook,
          }),
        });
        stampOutfitStyle(extra.outfits);
        (extra.items || []).forEach(liveRememberItem);
        const added = liveAppendDaily(extra, items);
        pruneDailyAgainstOwned(items);
        if (!added.length) break;
      }
      const wishNeed = Math.min(wishCount, baseCount);
      const haveWish = LB_DATA.DAILY.filter((o) => (o.itemIds || []).some(isWishId)).length;
      if (wishNeed > haveWish) {
        const extra = await liveJSON('/api/live/coordinate', {
          method: 'POST',
          body: JSON.stringify({
            max_combos: wishNeed - haveWish,
            style,
            styles: preferredStyles,
            for_date: localYmd(),
            exclude_item_ids: LB_DATA.DAILY.map((o) => o.itemIds || []),
            wish_combos: wishNeed - haveWish,
            ...styleProfile,
            ...modelLook,
          }),
        });
        stampOutfitStyle(extra.outfits);
        (extra.items || []).forEach(liveRememberItem);
        liveAppendDaily(extra, items);
        pruneDailyAgainstOwned(items);
        while (LB_DATA.DAILY.length > baseCount) {
          const drop = [...LB_DATA.DAILY].map((o, i) => i).reverse().find((i) => !(LB_DATA.DAILY[i].itemIds || []).some(isWishId));
          if (drop == null) break;
          LB_DATA.DAILY.splice(drop, 1);
        }
      }
      writeDailyCache({
        style,
        outfits: LB_DATA.DAILY.slice(),
        items: dailyCacheItemsFromOwned(items, LB_DATA.DAILY),
        wardrobeSig: ownedSig,
        wardrobeCount: items.length,
      });
      bumpDaily();
      reloadBilling();
      if (!quiet) showToast('오늘의 코디를 만들었어요', 'sparkle');
      if (prefs.modelLook) {
        applyModelLooks(LB_DATA.DAILY.filter((o) => !o.lookImg));
      }
      return { added: LB_DATA.DAILY.length, wardrobeGrew: false };
    } catch (e) {
      setDailyAllowed(false);
      showToast(e.message || '코디를 만들지 못했어요');
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
            ...coordProfile(prefs),
          }),
        });
        stampOutfitStyle(payload.outfits);
        liveApplyPayload({ ...payload, anchor: LB_DATA.ANCHOR }, 'outfits');
        setComboRev((n) => n + 1);
        showToast(`${preferredStyleLabel} 무드로 코디를 추천했어요`, 'sparkle');
      } catch (e) {
        showToast(e.message || '코디를 만들지 못했어요');
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
      showToast('고민 중인 옷을 다시 올려 주세요');
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
          ...coordProfile(prefs),
          exclude_item_ids: LB_DATA.OUTFITS.map((o) => o.itemIds || []),
        }),
      });
      stampOutfitStyle(payload.outfits);
      const added = liveAppendOutfits(payload);
      setComboRev((n) => n + 1);
      if (!added.length) showToast('더 만들 조합이 없어요');
      else showToast(`${added.length}개 더 가져왔어요`, 'sparkle');
    } catch (e) {
      showToast(e.message || '더 만들지 못했어요');
    } finally {
      setMoreLoading(false);
    }
  };

  // 룩북 저장 상태는 서버에 남긴다. 화면은 먼저 바꾸고(누른 즉시 반응) 서버 호출은
  // 뒤따르게 한다 — 실패하면 알려주되 되돌리지는 않는다(다음 로드에서 서버값으로 맞춰진다).
  const persistOutfitState = (outfitId, patch) => {
    outfitMutRef.current += 1;
    if (!outfitId || String(outfitId).startsWith('live-') || String(outfitId).startsWith('manual-')) return;
    liveJSON(`/api/live/outfits/${encodeURIComponent(outfitId)}/state`, {
      method: 'POST', body: JSON.stringify(patch),
    }).catch(() => showToast('서버에 저장하지 못했어요'));
  };
  const saveOutfit = (outfitId) => {
    setSavedLooks((arr) => {
      if (arr.some((l) => l.outfitId === outfitId)) {
        showToast('룩북에서 해제했어요');
        persistOutfitState(outfitId, { saved: false });
        return arr.filter((l) => l.outfitId !== outfitId);
      }
      const o = LB_DATA.OUTFIT_BY_ID[outfitId];
      showToast('룩북에 저장했어요', 'bookmark');
      persistOutfitState(outfitId, { saved: true });
      return [{ id: 'look-' + outfitId, outfitId, label: o ? o.label : '저장한 코디', savedAt: '방금' }, ...arr];
    });
  };
  // 옷장에서 직접 고른 조합을 룩북에 저장 — 추천을 거치지 않는 수동 경로
  const createManualLook = async (itemIds, label) => {
    const ids = (itemIds || []).map(String);
    if (ids.length < 2) return;
    const name = (label || '').trim() || '내가 만든 코디';
    outfitMutRef.current += 1;
    // 서버에 먼저 만들어 진짜 id를 받는다. 로컬 id로 두면 다음 로드에 사라진다.
    let outfitId = null;
    try {
      const res = await liveJSON('/api/live/outfits/manual', {
        method: 'POST', body: JSON.stringify({ label: name, item_ids: ids }),
      });
      outfitId = res && res.id;
    } catch (e) {
      showToast(e.message || '룩북에 저장하지 못했어요');
      return;
    }
    LB_DATA.OUTFIT_BY_ID[outfitId] = {
      // manual: 추천에서 저장한 코디와 달리 사본이 없다. 룩북에서 빼면 그걸로 끝이라
      // 확인 문구를 다르게 보여준다.
      id: outfitId, label: name, mood: '직접 만든 코디', styles: [], itemIds: ids, lookImg: null, manual: true,
    };
    setSavedLooks((arr) => [{ id: 'look-' + outfitId, outfitId, label: name, savedAt: '방금' }, ...arr]);
    showToast('룩북에 저장했어요', 'bookmark');
  };

  // 룩북 저장된 코디를 해제할 때는 확인을 받는다 (룩북에서도 사라지므로).
  // after: 뺀 뒤에 할 일. 상세 화면에서 지금 보던 코디를 빼면 다음 코디로 넘겨야 한다.
  const [unsaveTarget, setUnsaveTarget] = useState(null);
  const requestUnsave = (outfitId, after) => setUnsaveTarget({ outfitId, after });
  const confirmUnsave = () => {
    if (unsaveTarget) {
      saveOutfit(unsaveTarget.outfitId);
      if (unsaveTarget.after) unsaveTarget.after();
    }
    setUnsaveTarget(null);
  };
  // 여러 개를 한 번에 — 확인은 부르는 화면에서 받는다(옷장 일괄 삭제와 같은 흐름)
  const bulkUnsave = (lookIds) => {
    const ids = lookIds || [];
    if (!ids.length) return;
    savedLooks.filter((l) => ids.includes(l.id)).forEach((l) => persistOutfitState(l.outfitId, { saved: false }));
    setSavedLooks((arr) => arr.filter((l) => !ids.includes(l.id)));
    showToast(`${ids.length}개를 룩북에서 뺐어요`);
  };
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
  const liveReplaceItemImage = async ({ itemId, sourceType, file, url, extractHint, commit = true, onProgress }) => {
    const fd = new FormData();
    if (sourceType === 'url') fd.append('url', url);
    else fd.append('image', file);
    fd.append('extract_hint', (extractHint || '').trim());
    fd.append('commit', commit ? 'true' : 'false');
    const data = await liveJSON(`/api/live/items/${encodeURIComponent(itemId)}/replace-image`, {
      method: 'POST',
      body: fd,
      onProgress,
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
      const next = arr.includes(outfitId) ? arr.filter((x) => x !== outfitId) : [outfitId, ...arr];
      showToast(arr.includes(outfitId) ? '오늘 입기를 취소했어요' : '오늘의 코디로 기록했어요',
        arr.includes(outfitId) ? undefined : 'check');
      writeDailyRecord(localYmd(), { wornIds: next });
      return next;
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
      price: draft.price || '',
      material: draft.material || '',
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

  // 옷장에서 고른 옷으로 코디 추천 — 탭을 바꾸지 않고 모달로 보여준다. 옷장에서
  // 고르던 흐름을 끊지 않으려면 화면을 갈아타지 않는 편이 낫다.
  const [pickSheet, setPickSheet] = useState(null); // { ids, loading, outfits, error }
  const requestPickedOutfits = async (ids, opts = {}) => {
    const picked = (ids || []).map(String).filter(Boolean);
    if (!picked.length) return;
    const append = !!opts.append;
    const prev = (append && pickSheet && pickSheet.outfits) || [];
    setPickSheet({ ids: picked, loading: true, outfits: prev, error: '' });
    try {
      const payload = await liveJSON('/api/live/coordinate', {
        method: 'POST',
        body: JSON.stringify({
          include_item_ids: picked,
          max_combos: append ? 2 : dailyCount,
          style: preferredDailyStyle,
          styles: preferredStyles,
          wish_combos: append ? 0 : Math.min(wishCount, dailyCount),
          exclude_item_ids: prev.map((o) => o.itemIds || []),
          ...coordProfile(prefs),
          ...(prefs.modelLook ? { model_look: true } : {}),
        }),
      });
      (payload.items || []).forEach(liveRememberItem);
      const fresh = (payload.outfits || []).filter((o) => o && (o.itemIds || []).length >= 2);
      fresh.forEach((o) => { LB_DATA.OUTFIT_BY_ID[o.id] = o; });
      const merged = [...prev, ...fresh.filter((o) => !prev.some((p) => p.id === o.id))];
      setPickSheet({ ids: picked, loading: false, outfits: merged, error: '' });
      reloadBilling();
      if (append && !fresh.length) showToast('더 만들 조합이 없어요');
      if (prefs.modelLook && fresh.some((o) => !o.lookImg)) {
        applyModelLooks(fresh).then(() => {
          setPickSheet((cur) => {
            if (!cur || cur.ids !== picked) return cur;
            return { ...cur, outfits: cur.outfits.map((o) => LB_DATA.OUTFIT_BY_ID[o.id] || o) };
          });
        });
      }
    } catch (e) {
      if (append) {
        setPickSheet({ ids: picked, loading: false, outfits: prev, error: '' });
        showToast(e.message || '더 만들지 못했어요');
      } else {
        setPickSheet({ ids: picked, loading: false, outfits: [], error: e.message || '코디를 만들지 못했어요' });
      }
    }
  };
  const closePickSheet = () => setPickSheet(null);

  // 쇼핑몰 구매내역(또는 URL 여러 개)을 한 번에 등록한다. 한 건씩 순서대로 돌리는 이유:
  // 추출은 아이템마다 몇 초씩 걸리고, 한 건이 실패해도 나머지는 계속 담겨야 한다.
  // 후보들이 이미 옷장에 있는지 서버에 물어본다(주소·상품코드·이름·사진 지문 — AI 아님).
  const checkDuplicates = async (list) => {
    const items = (list || []).filter((it) => it && it.url).map((it) => ({
      url: it.url, name: it.name || '', brand: it.brand || '', store: it.store || '', thumb: it.thumb || '',
    }));
    if (!items.length) return {};
    try {
      const res = await liveJSON('/api/live/import/check-duplicates', {
        method: 'POST', body: JSON.stringify({ items }),
      });
      const map = {};
      (res.results || []).forEach((r) => { map[r.url] = r; });
      return map;
    } catch (e) {
      return {};   // 확인에 실패해도 등록은 진행한다 — 서버가 등록 시점에 한 번 더 막는다
    }
  };

  const importOrders = async (list, onProgress) => {
    const queue = (list || []).filter((it) => it && it.url);
    const done = [];
    const failed = [];
    const skipped = [];
    for (let i = 0; i < queue.length; i++) {
      const it = queue[i];
      if (onProgress) onProgress({ index: i, total: queue.length, item: it, state: 'run' });
      try {
        const res = await liveImportSource({ sourceType: 'url', url: it.url, status: 'owned' });
        // 서버가 '이미 옷장에 있다'고 판단하면 등록하지 않고 이유를 돌려준다.
        if (res && res.duplicate) {
          skipped.push({ ...it, reason: res.reason || '이미 옷장에 있어요', matchedName: res.matchedName || '' });
          if (onProgress) onProgress({ index: i, total: queue.length, item: it, state: 'dup', reason: res.reason });
          continue;
        }
        const got = (res.items || []).map(liveRememberItem);
        if (got.length) putLiveItems(got, true);
        done.push(...got);
        if (onProgress) onProgress({ index: i, total: queue.length, item: it, state: 'ok', items: got });
      } catch (e) {
        failed.push({ ...it, error: e.message || '등록하지 못했어요' });
        if (onProgress) onProgress({ index: i, total: queue.length, item: it, state: 'fail', error: e.message });
      }
    }
    reloadBilling();
    return { done, failed, skipped };
  };

  const openDetail = (look, looks, label) => {
    setDetailLook(look);
    setDetailList(looks && looks.length ? { looks, label: label || '다른 코디' } : null);
    setView('detail');
  };
  const gotoLook = (dir) => {
    setDetailLook((cur) => {
      const list = (detailList && detailList.looks) || savedLooks;
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
      showToast(e.message || '저장이 늦어지고 있어요');
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
        seasons: it.seasons || [],
        price: it.price || '',
        material: it.material || '',
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
    detailLooks: (detailList && detailList.looks) || savedLooks,
    detailListLabel: (detailList && detailList.label) || '룩북의 다른 코디',
    detailFromLookbook: !detailList,
    detailIndex: ((detailList && detailList.looks) || savedLooks).findIndex((l) => l.id === (detailLook ? detailLook.id : '')),
    detailTotal: ((detailList && detailList.looks) || savedLooks).length, gotoLook,
    hasWardrobe: comboReady,
    comboReady, comboGate, comboNeed, comboProgress, wardrobeLoading,
    detectCount: Math.max(1, parseInt(t.detectCount, 10) || 3),
    // 코디 개수·제안 코디 수는 계정 설정(prefs)을 따른다. 기기별 tweak은 쇼케이스용 폴백.
    dailyCount, wishCount, setDailyCount, setWishCount,
    dailyAllowed, dailyLoading, dailyStyle, setDailyStyle, requestDailyOutfits,
    dailyEnabled, setDailyEnabled,
    modelLook: !!prefs.modelLook, setModelLook,
    dailyWardrobeGrew: dailyWardrobeGrewSinceCache(items),
    dailyTick,
    preferredDailyStyle, preferredDailyStyleName, preferredStyleLabel,
    wornToday, wearToday, getDayRecord: readDailyRecord,
    addItemsBatch, discardLiveItems, liveImportSource, showToast,
    billing, reloadBilling, refreshLive,
    requestPickedOutfits, importOrders, checkDuplicates, liveCollectOrders,
    knownSourceUrls: [...items, ...archived]
      .map((it) => normalizeProductUrl(it && it.sourceUrl))
      .filter(Boolean),
    openAdd, closeAdd, confirmAdd, startCombo, saveOutfit, toggleSaveOutfit, requestUnsave, bulkUnsave, createManualLook, openDetail, addToWardrobe, back,
    openItem, openImageViewer, openOutfitViewer, requestRemove, bulkArchive, bulkRestore, bulkDelete, openPrefs, openAccount, setAvatar, logout, prefs, go, goHome,
    openTryOn, openTryOnSetup, openTryOnTab, startTryOn, setTryOnFrame, makeTryOnBody, tryOnMaking,
    liveReplaceItemImage, liveConfirmReplaceImage, applyReextractItem,
    startComboOrWardrobe: () => comboReady ? startCombo() : (go('wardrobe'), openAdd('wardrobe')),
  };

  // ---- 온보딩 게이트: 가입 전이면 홈(랜딩) → 회원가입 단계 ----
  if (!onboarded) {
    if (phase === 'onboarding') {
      return (
        <Onboarding
          mode="signup"
          onAccount={createAccount}
          onDone={completeOnboarding}
          onCancel={() => setPhase('landing')}
        />
      );
    }
    if (phase === 'login') {
      return <Login onDone={completeLogin} onCancel={() => setPhase('landing')} onSignup={() => setPhase('onboarding')} />;
    }
    return <Landing onStart={() => setPhase('onboarding')} onLogin={() => setPhase('login')} />;
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
      {tabPane('today', <TodayScreen ctx={ctx} />)}
      {tabPane('lookbook', <LookbookScreen ctx={ctx} />)}
      {tabPane('mypage', <MyPageScreen ctx={ctx} />)}
    </>
  );

  return (
    <div ref={shellRef} className={'lb-app' + (wide ? ' lb-shell-wide' : '')}>
      {wide ? (
        <>
          <aside className="lb-sidebar">
            <div style={{ padding: '4px 8px 22px' }}><Wordmark size={22} onClick={goHome} /></div>
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
              <Btn full icon="sparkle" variant={comboReady ? 'primary' : 'soft'} onClick={comboGate}>조합 추천받기</Btn>
              <Btn full variant="soft" icon="plus" onClick={() => openAdd('wardrobe')}>아이템 추가</Btn>
            </div>
          </aside>
          <main className="lb-wide-main">
            {mainTabs}
            {/* 결과·상세도 폭 상한 + margin auto로 가운데 정렬돼 있었다 — 다른 화면과
                같은 이유로 좌우가 비고, 토스트가 콘텐츠 중심에서 어긋나 보였다.
                폭을 풀어 좌측에 붙인다. */}
            {focused && (
              <div style={{
                width: '100%',
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
            {/* JSX는 소스의 줄바꿈을 공백으로 합쳐서 한 문단으로 흘린다 — 두 줄로
                보이게 하려면 br로 고정해야 한다. */}
            <p style={{ margin: '9px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--ink-2)' }}>
              옷장에 있는 옷으로만 조합을 만들어요.<br />
              몇 개 모이면 추천이 정확해져요.
            </p>
            <div style={{ display: 'grid', gap: 0, marginTop: 18 }}>
              {[
                ['1', '사진으로 아이템 추가', '사진을 올리면 상의·하의·신발로 나눠 담아요'],
                ['2', '옷장 확인', '카테고리, 색상 등 필요한 정보만 고쳐요'],
                ['3', '추천 사용', '옷이 모이면 구매 전 조합과 오늘 코디가 열려요'],
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
            <Btn full variant="soft" icon="cutout" onClick={() => { setComboPrompt(false); openTryOn(); }}>바로 보기</Btn>
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

      <TryOnSetupOverlay
        open={tryOnSetup}
        wide={wide}
        making={tryOnSetupMaking}
        seedBody={tryOnSeedBody}
        initialBody={prefs.tryOnBody}
        initialFrame={prefs.tryOnFrame}
        initialCut={prefs.tryOnCut}
        onClose={() => {
          setTryOnSetup(false);
          setTryOnSeedBody('');
          setTryOnSetupAsSettings(false);
          setTryOnSetupMaking(false);
        }}
        onSave={(payload) => {
          setTryOnFrame(payload);
          if (tryOnSetupAsSettings) {
            setTryOnSeedBody('');
            return;
          }
          setTryOnSetup(false);
          setTryOnSeedBody('');
          if (!wide) setTryOnCamera(true);
          else showToast('휴대폰에서 열어 주세요', 'camera');
        }}
      />
      <TryOnCameraOverlay
        open={tryOnCamera}
        wide={wide}
        frameSrc={prefs.tryOnFrame}
        bodySrc={prefs.tryOnCut === 'auto' ? (prefs.tryOnBody || prefs.tryOnFrame) : ''}
        onClose={() => setTryOnCamera(false)}
        onEdit={() => { setTryOnCamera(false); openTryOnTab(); }}
      />
      <TryOnDesktopSheet open={tryOnDesktopHint} onClose={() => setTryOnDesktopHint(false)} />

      {unsaveTarget && (() => {
        // 직접 만든 코디는 다른 화면에 사본이 없어서, 여기서 빼면 영영 사라진다.
        const manual = !!(LB_DATA.OUTFIT_BY_ID[unsaveTarget.outfitId] || {}).manual;
        return (
          <div onClick={() => setUnsaveTarget(null)} style={{ position: 'absolute', inset: 0, zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(30,27,21,0.45)' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 340, background: 'var(--surface)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--pop-shadow)', padding: '24px 22px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--ivory)', display: 'grid', placeItems: 'center', margin: '0 auto 14px', color: manual ? '#B0573C' : 'var(--accent)' }}>
                <Icon name={manual ? 'trash' : 'heart'} size={22} fill={manual ? 'none' : 'currentColor'} stroke={manual ? 2 : 0} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>
                {manual ? '이 코디를 지울까요?' : '룩북에서 해제할까요?'}
              </div>
              <p style={{ margin: '9px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, wordBreak: 'keep-all' }}>
                {manual
                  ? <>직접 만든 코디라 다른 곳에 남지 않아요. <b style={{ color: 'var(--ink)', fontWeight: 700 }}>되돌릴 수 없어요.</b></>
                  : '좋아요를 해제하면 룩북 목록에서도 사라져요.'}
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <Btn variant="soft" onClick={() => setUnsaveTarget(null)} style={{ flex: 1 }}>유지</Btn>
                {manual
                  ? <Btn icon="trash" onClick={confirmUnsave} style={{ flex: 1, background: '#B0573C', color: '#fff' }}>지우기</Btn>
                  : <Btn icon="heart" onClick={confirmUnsave} style={{ flex: 1 }}>해제하기</Btn>}
              </div>
            </div>
          </div>
        );
      })()}

      {editPrefs && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'var(--ivory)' }}>
          <Onboarding mode="edit" initial={prefs} onDone={saveEditedPrefs} onCancel={() => setEditPrefs(false)} />
        </div>
      )}

      {pickSheet && (
        <PickedOutfitsModal
          state={pickSheet}
          onClose={closePickSheet}
          onMore={() => requestPickedOutfits(pickSheet.ids, { append: true })}
          savedOutfitIds={savedOutfitIds}
          onSave={toggleSaveOutfit}
          onOpen={(look, looks) => { closePickSheet(); openDetail(look, looks, '이 옷으로 만든 다른 코디'); }}
          wide={wide}
        />
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
        <TweakSection label="오늘의 코디" />
        <TweakRadio label="데일리 추천 개수" value={t.dailyCount} options={['2', '3', '4']}
          onChange={(v) => setTweak('dailyCount', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
