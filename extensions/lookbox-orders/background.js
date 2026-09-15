import { PLATFORMS, byId } from './platforms.js';
import {
  pageAccessDenied,
  pageHasNoOrders,
  pageLooksLoggedOut,
  pageExpandList,
  pageExtractItems,
  pageExtractKreamItems,
  pageExtractMustitItems,
  pageExtractNaverPayItems,
  pageNaverPayNext,
  pageNextUrl,
  pageOpenZigzagOrders,
  pageOpenZigzagYearFilter,
  pageSelectZigzagMaxYears,
  pageOpenMusinsaDateSearch,
  pageSetMusinsaThreeYearRange,
  pageSetWConceptYearRange,
  pageZigzagHasNoOrders,
} from './extract.js';

const LOGIN_WAIT_MS = 5 * 60 * 1000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const LOOKBOX_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|lookbox\.vercel\.app|realcloset\.vercel\.app)(:\d+)?\//i;
const orderWatchers = new Map();

const extractFor = (platform) => platform.id === 'naver'
  ? pageExtractNaverPayItems
  : platform.id === 'musthave' ? pageExtractMustitItems
    : platform.id === 'kream' ? pageExtractKreamItems : pageExtractItems;

const ACTION_LABEL = /^(?:스냅\s*보기|자세히\s*보기|상세\s*보기|주문\s*상세(?:\s*보기)?|상품\s*상세(?:\s*보기)?|배송\s*조회|재구매|후기\s*작성|스타일\s*올리기)$/;

const sanitizeOrderItem = (item) => {
  const brand = String(item?.brand || '').replace(/\s+/g, ' ').trim();
  return { ...item, brand: ACTION_LABEL.test(brand) ? '' : brand };
};

const orderIdentity = (item) => {
  const label = `${item?.brand || ''} ${item?.name || ''}`
    .toLocaleLowerCase('ko-KR')
    .replace(/[^\p{L}\p{N}]+/gu, '');
  return label || item?.url || '';
};

const uniqueOrders = (items) => {
  const seen = new Set();
  return (items || []).map(sanitizeOrderItem).filter((item) => {
    const key = orderIdentity(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const rememberOrder = (seen, item) => {
  const key = orderIdentity(item);
  if (!key || seen.has(key)) return false;
  seen.add(key);
  return true;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({
    url: ['http://localhost:5173/*', 'http://127.0.0.1:5173/*', 'https://lookbox.vercel.app/*', 'https://realcloset.vercel.app/*'],
  });
  for (const tab of tabs) {
    if (!tab.id) continue;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['lookbox-bridge.js'] }).catch(() => {});
  }
});

async function waitTabComplete(tabId, timeoutMs = 30000, allowCurrent = true) {
  if (allowCurrent) {
    const current = await chrome.tabs.get(tabId).catch(() => null);
    if (current && current.status === 'complete') return current;
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve(null);
    }, timeoutMs);
    function onUpdated(id, info, tab) {
      if (id !== tabId || info.status !== 'complete') return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve(tab);
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function runInTab(tabId, func, args = []) {
  const [hit] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return hit && hit.result;
}

async function showPopup(url, tabId) {
  const existing = tabId ? await chrome.tabs.get(tabId).catch(() => null) : null;
  if (existing) {
    await chrome.windows.update(existing.windowId, { focused: true }).catch(() => {});
    const loaded = waitTabComplete(existing.id, 30000, false);
    await chrome.tabs.update(existing.id, { url, active: true });
    await loaded;
    return chrome.tabs.get(existing.id);
  }
  const tab = await chrome.tabs.create({ url, active: false });
  if (!tab || !tab.id) throw new Error('로그인 창을 열지 못했어요.');
  await waitTabComplete(tab.id);
  return chrome.tabs.get(tab.id);
}

async function findOpenShopTab(platform) {
  const root = platformRoot(platform);
  if (!root) return null;
  const tabs = await chrome.tabs.query({}).catch(() => []);
  return tabs
    .filter((tab) => {
      try { return new URL(tab.url || '').hostname.endsWith(root); } catch { return false; }
    })
    .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || null;
}

async function navigate(tabId, url) {
  const loaded = waitTabComplete(tabId, 30000, false);
  await chrome.tabs.update(tabId, { url, active: true });
  await loaded;
  await delay(250);
  return chrome.tabs.get(tabId);
}

async function isLoggedOut(tabId) {
  try {
    return !!(await runInTab(tabId, pageLooksLoggedOut));
  } catch {
    return true;
  }
}

async function assertPageAccessible(tabId) {
  const denied = await runInTab(tabId, pageAccessDenied).catch(() => false);
  if (denied) throw new Error('쇼핑몰에서 이 브라우저의 접속을 차단했어요. 일반 Chrome에서 다시 시도해 주세요.');
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function fetchImageData(url) {
  const parsed = new URL(String(url || ''));
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('상품 이미지 주소가 올바르지 않아요.');
  const response = await fetch(parsed.href, { credentials: 'include', cache: 'no-store' });
  if (!response.ok) throw new Error('쇼핑몰 상품 이미지를 가져오지 못했어요.');
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) throw new Error('상품 이미지가 아닌 응답이에요.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('상품 이미지 용량이 너무 커요.');
  return { dataUrl: `data:${contentType};base64,${bytesToBase64(bytes)}`, contentType };
}

async function enrichOrderThumbnail(item) {
  if (item.thumb && /^https?:/i.test(item.thumb) && !/placeholder|no[_-]?image|default[_-]?image/i.test(item.thumb)) return item;
  try {
    const res = await fetch(item.url, { credentials: 'include' });
    if (!res.ok) return item;
    const html = await res.text();
    const og = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);
    if (og && og[1]) return { ...item, thumb: new URL(og[1], item.url).href };
  } catch { /* 주문 목록 썸네일만 사용 */ }
  return item;
}

async function prepareOrderThumbnail(item, platform) {
  const enriched = await enrichOrderThumbnail(item);
  if (platform?.id !== 'kream' || !/^https?:/i.test(enriched.thumb || '')) return enriched;
  try {
    const preview = await fetchImageData(enriched.thumb);
    return { ...enriched, imageUrl: enriched.thumb, thumb: preview.dataUrl };
  } catch { return enriched; }
}

function platformRoot(platform) {
  try { return new URL(platform.loginUrl || platform.bootstrapUrl || platform.urls[0]).hostname.split('.').slice(-2).join('.'); } catch { return ''; }
}

async function waitUntilLoggedIn(platform, tabId, emit) {
  const deadline = Date.now() + LOGIN_WAIT_MS;
  const root = platformRoot(platform);
  let currentTabId = tabId;
  while (Date.now() < deadline) {
    await delay(900);
    const candidates = await chrome.tabs.query({}).catch(() => []);
    const signupTab = candidates.find((tab) => tab.active && root && (() => {
      try { return new URL(tab.url || '').hostname.endsWith(root); } catch { return false; }
    })());
    if (signupTab && Number.isInteger(signupTab.id)) currentTabId = signupTab.id;
    const tab = await chrome.tabs.get(currentTabId).catch(() => null);
    if (!tab) return false;
    if (tab.status !== 'complete') continue;
    await assertPageAccessible(currentTabId);
    const loggedOut = await isLoggedOut(currentTabId);
    if (!loggedOut && !/login|signin|auth|member\/login/i.test(tab.url || '')) return currentTabId;
    emit({ type: 'progress', key: 'extension_login', url: tab.url || '' });
  }
  return false;
}

async function openLoginIfNeeded(platform, tabId, emit) {
  if (platform.bootstrapUrl) {
    emit({ type: 'progress', key: 'extension_login', url: platform.bootstrapUrl });
    await navigate(tabId, platform.bootstrapUrl);
  }

  await assertPageAccessible(tabId);
  if (!(await isLoggedOut(tabId))) return tabId;
  const current = await chrome.tabs.get(tabId).catch(() => null);
  if (current) {
    await chrome.tabs.update(tabId, { active: true }).catch(() => {});
    await chrome.windows.update(current.windowId, { focused: true }).catch(() => {});
  }
  emit({ type: 'progress', key: 'extension_login', url: (current && current.url) || '' });
  return waitUntilLoggedIn(platform, tabId, emit);
}

async function preparePlatform(platform, previousTabId, emit) {
  const firstUrl = platform.loginUrl || platform.bootstrapUrl || platform.urls[0];
  const previous = previousTabId ? await chrome.tabs.get(previousTabId).catch(() => null) : null;
  const existing = previous || await findOpenShopTab(platform);
  let tab = existing || await showPopup(firstUrl);
  emit({ type: 'progress', key: 'extension_login', url: tab.url || firstUrl, tabId: tab.id });

  const loggedInTabId = await openLoginIfNeeded(platform, tab.id, emit);
  if (!loggedInTabId) return { status: 'need_login', tabId: tab.id, platform: platform.id };
  tab = await chrome.tabs.get(loggedInTabId).catch(() => tab);

  if (platform.id === 'zigzag') {
    emit({ type: 'progress', key: 'orders_open', url: 'https://zigzag.kr/my-page' });
    tab = await navigate(tab.id, 'https://zigzag.kr/my-page');
    await assertPageAccessible(tab.id);
    if (await isLoggedOut(tab.id)) return { status: 'need_login', tabId: tab.id, platform: platform.id };
    const opened = await runInTab(tab.id, pageOpenZigzagOrders).catch(() => false);
    if (!opened) return { status: 'orders_unavailable', tabId: tab.id, platform: platform.id };
    await delay(1000);
    emit({ type: 'progress', key: 'orders_ready', url: (await chrome.tabs.get(tab.id).catch(() => tab)).url || '' });
    return { status: 'orders_ready', tabId: tab.id, platform: platform.id };
  }

  for (const url of platform.urls) {
    emit({ type: 'progress', key: 'orders_open', url });
    tab = await navigate(tab.id, url);
    await assertPageAccessible(tab.id);
    if (await isLoggedOut(tab.id)) {
      emit({ type: 'progress', key: 'extension_login', url: tab.url || url });
      const loggedInTabId = await waitUntilLoggedIn(platform, tab.id, emit);
      if (!loggedInTabId) return { status: 'need_login', tabId: tab.id, platform: platform.id };
      tab = await navigate(loggedInTabId, url);
      await assertPageAccessible(tab.id);
    }
    emit({ type: 'progress', key: 'orders_ready', url: tab.url || url });
    return { status: 'orders_ready', tabId: tab.id, platform: platform.id };
  }

  return { status: 'empty', tabId: tab.id, items: [] };
}

async function returnToLookbox(tabId) {
  if (!Number.isInteger(tabId)) return;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;
  await chrome.tabs.update(tab.id, { active: true }).catch(() => {});
  await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
}

function watchOrderTab(tabId, platform, emit, initialItems) {
  const old = orderWatchers.get(tabId);
  if (old) clearInterval(old.timer);
  const seen = new Set(uniqueOrders(initialItems).map(orderIdentity));
  let reading = false;
  const timer = setInterval(async () => {
    if (reading) return;
    reading = true;
    try {
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab) { clearInterval(timer); orderWatchers.delete(tabId); return; }
      const extract = extractFor(platform);
      const items = uniqueOrders((await runInTab(tabId, extract).catch(() => [])) || []);
      for (const item of items) {
        if (!rememberOrder(seen, item)) continue;
        emit({ type: 'item', item: { ...(await prepareOrderThumbnail(item, platform)), platform: platform.name } });
      }
    } finally { reading = false; }
  }, 1800);
  orderWatchers.set(tabId, { timer });
}

async function collectNaverPayPages(tab, platform, emit, initialRows) {
  const rows = uniqueOrders(initialRows);
  const seen = new Set(rows.map(orderIdentity));
  let unchanged = 0;
  try {
    for (let page = 2; page <= 60; page++) {
      const moved = await runInTab(tab.id, pageNaverPayNext).catch(() => false);
      if (!moved) break;
      await delay(1100);
      const items = uniqueOrders((await runInTab(tab.id, pageExtractNaverPayItems).catch(() => [])) || []);
      let added = 0;
      for (const item of items) {
        if (!rememberOrder(seen, item)) continue;
        const row = { ...(await prepareOrderThumbnail(item, platform)), platform: platform.name };
        rows.push(row);
        emit({ type: 'item', item: row });
        added++;
      }
      unchanged = added ? 0 : unchanged + 1;
      if (unchanged >= 2) break;
    }
  } catch { /* 첫 페이지에서 읽은 주문은 유지 */ }
  return { tab, rows };
}

async function collectWConceptYears(tab, platform, emit, initialRows) {
  const rows = uniqueOrders(initialRows);
  const seen = new Set(rows.map(orderIdentity));
  try {
    for (let yearOffset = 1; yearOffset < 3; yearOffset++) {
      const changed = await runInTab(tab.id, pageSetWConceptYearRange, [yearOffset]).catch(() => false);
      if (!changed) break;
      await delay(1300);
      const items = uniqueOrders((await runInTab(tab.id, extractFor(platform)).catch(() => [])) || []);
      for (const item of items) {
        if (!rememberOrder(seen, item)) continue;
        const row = { ...(await prepareOrderThumbnail(item, platform)), platform: platform.name };
        rows.push(row);
        emit({ type: 'item', item: row });
      }
    }
  } catch { /* 현재까지 읽은 주문은 유지 */ }
  return { tab, rows };
}

async function collectCoupangYears(tab, platform, emit, initialRows) {
  const rows = uniqueOrders(initialRows);
  const seen = new Set(rows.map(orderIdentity));
  const base = new URL(platform.urls[0]);
  try {
    for (let offset = 0; offset < 3; offset++) {
      const year = new Date().getFullYear() - offset;
      base.searchParams.set('requestYear', String(year));
      tab = await navigate(tab.id, base.href);
      await delay(1000);
      const items = uniqueOrders((await runInTab(tab.id, extractFor(platform)).catch(() => [])) || []);
      for (const item of items) {
        if (!rememberOrder(seen, item)) continue;
        const row = { ...(await prepareOrderThumbnail(item, platform)), platform: platform.name };
        rows.push(row);
        emit({ type: 'item', item: row });
      }
    }
  } catch { /* 현재까지 읽은 주문은 유지 */ }
  return { tab, rows };
}

async function collectNaverPages(tab, platform, emit, initialRows) {
  const rows = uniqueOrders(initialRows);
  const seen = new Set(rows.map(orderIdentity));
  try {
    const first = new URL(tab.url);
    if (!/\/pc\/history/i.test(first.pathname)) return { tab, rows };
    first.searchParams.set('page', '1');
    for (let page = 2; page <= 30; page++) {
      const next = new URL(first);
      next.searchParams.set('page', String(page));
      tab = await navigate(tab.id, next.href);
      const items = uniqueOrders((await runInTab(tab.id, extractFor(platform)).catch(() => [])) || []);
      const pageText = await runInTab(tab.id, () => (document.body && document.body.innerText) || '').catch(() => '');
      if (!items.length && /주문.*없|내역.*없|조회.*없/.test(pageText)) break;
      for (const item of items) {
        if (!rememberOrder(seen, item)) continue;
        const row = { ...(await prepareOrderThumbnail(item, platform)), platform: platform.name };
        rows.push(row);
        emit({ type: 'item', item: row });
      }
    }
    tab = await navigate(tab.id, first.href);
  } catch { /* 첫 페이지에서 읽은 결과는 그대로 쓴다 */ }
  return { tab, rows };
}

async function collectPagedOrders(tab, platform, emit, initialRows) {
  const rows = uniqueOrders(initialRows);
  const seen = new Set(rows.map(orderIdentity));
  const firstUrl = tab.url;
  try {
    for (let page = 2; page <= 60; page++) {
      const nextUrl = await runInTab(tab.id, pageNextUrl).catch(() => '');
      if (!nextUrl) break;
      tab = await navigate(tab.id, nextUrl);
      const items = uniqueOrders((await runInTab(tab.id, extractFor(platform)).catch(() => [])) || []);
      for (const item of items) {
        if (!rememberOrder(seen, item)) continue;
        const row = { ...(await prepareOrderThumbnail(item, platform)), platform: platform.name };
        rows.push(row);
        emit({ type: 'item', item: row });
      }
    }
    tab = await navigate(tab.id, firstUrl);
  } catch { /* 현재까지 읽은 주문은 유지 */ }
  return { tab, rows };
}

async function collectPlatform(platform, previousTabId, emit, lookboxTabId) {
  let tab = previousTabId ? await chrome.tabs.get(previousTabId).catch(() => null) : null;
  if (!tab) {
    const prepared = await preparePlatform(platform, null, emit);
    if (prepared.status !== 'orders_ready') return prepared;
    tab = await chrome.tabs.get(prepared.tabId).catch(() => null);
  }
  if (!tab) throw new Error('주문내역 창이 닫혔어요. 다시 열어 주세요.');

  const candidates = [tab.url, ...platform.urls]
    .filter((url, index, all) => /^https?:/i.test(url || '') && all.indexOf(url) === index);
  for (const url of candidates) {
    if (tab.url !== url) tab = await navigate(tab.id, url);
    await assertPageAccessible(tab.id);
    if (await isLoggedOut(tab.id)) {
      return { status: 'need_login', tabId: tab.id, platform: platform.id };
    }
    emit({ type: 'progress', key: 'collect', url: tab.url || url });
    if (platform.id === 'zigzag') {
      await runInTab(tab.id, pageOpenZigzagOrders).catch(() => false);
      await delay(800);
      const opened = await runInTab(tab.id, pageOpenZigzagYearFilter).catch(() => false);
      if (opened) {
        await delay(250);
        await runInTab(tab.id, pageSelectZigzagMaxYears).catch(() => false);
        await delay(900);
      }
    }
    if (platform.id === 'musinsa') {
      const opened = await runInTab(tab.id, pageOpenMusinsaDateSearch).catch(() => false);
      if (opened) await delay(300);
      const changed = await runInTab(tab.id, pageSetMusinsaThreeYearRange).catch(() => false);
      if (changed) await delay(1200);
    }
    if (platform.id !== 'naver') await runInTab(tab.id, pageExpandList).catch(() => {});
    const extract = extractFor(platform);
    const items = uniqueOrders((await runInTab(tab.id, extract).catch(() => [])) || []);
    if (!items.length) {
      if (platform.id === 'wconcept') {
        const ranged = await collectWConceptYears(tab, platform, emit, []);
        if (ranged.rows.length) {
          emit({ type: 'progress', key: 'collect_done', count: ranged.rows.length, url: tab.url || url });
          watchOrderTab(tab.id, platform, emit, ranged.rows);
          await returnToLookbox(lookboxTabId);
          return { status: 'ok', tabId: tab.id, items: ranged.rows };
        }
      }
      if (platform.id === 'coupang') {
        const ranged = await collectCoupangYears(tab, platform, emit, []);
        if (ranged.rows.length) {
          emit({ type: 'progress', key: 'collect_done', count: ranged.rows.length, url: ranged.tab.url || url });
          watchOrderTab(ranged.tab.id, platform, emit, ranged.rows);
          await returnToLookbox(lookboxTabId);
          return { status: 'ok', tabId: ranged.tab.id, items: ranged.rows };
        }
      }
      if (await runInTab(tab.id, pageHasNoOrders).catch(() => false)) {
        await returnToLookbox(lookboxTabId);
        return { status: 'empty_orders', tabId: tab.id, items: [] };
      }
      continue;
    }

    const rows = await Promise.all(items.map(async (item) => ({ ...(await prepareOrderThumbnail(item, platform)), platform: platform.name })));
    for (const item of rows) {
      emit({ type: 'item', item });
      await delay(80);
    }
    if (platform.id === 'naver') {
      await returnToLookbox(lookboxTabId);
      const paged = await collectNaverPayPages(tab, platform, emit, rows);
      tab = paged.tab;
      rows.splice(0, rows.length, ...paged.rows);
    } else if (platform.id === 'wconcept') {
      const ranged = await collectWConceptYears(tab, platform, emit, rows);
      tab = ranged.tab;
      rows.splice(0, rows.length, ...ranged.rows);
    } else if (platform.id === 'coupang') {
      const ranged = await collectCoupangYears(tab, platform, emit, rows);
      tab = ranged.tab;
      rows.splice(0, rows.length, ...ranged.rows);
    } else {
      const paged = await collectPagedOrders(tab, platform, emit, rows);
      tab = paged.tab;
      rows.splice(0, rows.length, ...paged.rows);
    }
    emit({ type: 'progress', key: 'collect_done', count: rows.length, url: tab.url || url });
    watchOrderTab(tab.id, platform, emit, rows);
    await returnToLookbox(lookboxTabId);
    return { status: 'ok', tabId: tab.id, items: rows };
  }

  await returnToLookbox(lookboxTabId);
  return { status: 'empty', tabId: tab.id, items: [] };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type || !sender.tab || !LOOKBOX_ORIGIN.test(sender.tab.url || '')) return;
  if (msg.type === 'PING') {
    sendResponse({ ok: true, version: '0.3.45' });
    return;
  }
  if (msg.type === 'CANCEL') {
    const watcher = Number.isInteger(msg.tabId) && orderWatchers.get(msg.tabId);
    if (watcher) clearInterval(watcher.timer);
    if (Number.isInteger(msg.tabId)) orderWatchers.delete(msg.tabId);
    returnToLookbox(sender.tab.id).catch(() => {});
    sendResponse({ ok: true });
    return;
  }
  if (msg.type === 'FETCH_IMAGE') {
    fetchImageData(msg.url)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: String(error && error.message || error) }));
    return true;
  }
  if (msg.type === 'OPEN' || msg.type === 'COLLECT') {
    const platform = byId(msg.platform) || PLATFORMS[0];
    const emit = (event) => {
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'LOOKBOX_ORDER_EVENT',
        requestId: msg.id,
        event,
      }).catch(() => {});
    };
    const job = msg.type === 'OPEN'
      ? preparePlatform(platform, msg.tabId, emit)
      : collectPlatform(platform, msg.tabId, emit, sender.tab.id);
    job
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', error: String(error && error.message || error) }));
    return true;
  }
});
