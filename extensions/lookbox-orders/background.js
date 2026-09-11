import { PLATFORMS, byId } from './platforms.js';
import {
  pageAccessDenied,
  pageLooksLoggedOut,
  pageExpandList,
  pageExtractItems,
} from './extract.js';

const LOGIN_WAIT_MS = 5 * 60 * 1000;
const POPUP_WIDTH = 520;
const POPUP_HEIGHT = 760;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const LOOKBOX_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|lookbox\.vercel\.app|realcloset\.vercel\.app)(:\d+)?\//i;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function runInTab(tabId, func) {
  const [hit] = await chrome.scripting.executeScript({ target: { tabId }, func });
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
  const popup = await chrome.windows.create({
    url,
    type: 'popup',
    focused: true,
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
  });
  const tab = popup.tabs && popup.tabs[0];
  if (!tab || !tab.id) throw new Error('로그인 창을 열지 못했어요.');
  await waitTabComplete(tab.id);
  return chrome.tabs.get(tab.id);
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

async function waitUntilLoggedIn(tabId, emit) {
  const deadline = Date.now() + LOGIN_WAIT_MS;
  while (Date.now() < deadline) {
    await delay(900);
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) return false;
    if (tab.status !== 'complete') continue;
    await assertPageAccessible(tabId);
    const loggedOut = await isLoggedOut(tabId);
    if (!loggedOut && !/login|signin|auth|member\/login/i.test(tab.url || '')) return true;
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
  if (!(await isLoggedOut(tabId))) return true;
  const current = await chrome.tabs.get(tabId).catch(() => null);
  emit({ type: 'progress', key: 'extension_login', url: (current && current.url) || '' });
  return waitUntilLoggedIn(tabId, emit);
}

async function preparePlatform(platform, previousTabId, emit) {
  const firstUrl = platform.loginUrl || platform.bootstrapUrl || platform.urls[0];
  let tab = await showPopup(firstUrl, previousTabId);
  emit({ type: 'progress', key: 'extension_login', url: tab.url || firstUrl, tabId: tab.id });

  const loggedIn = await openLoginIfNeeded(platform, tab.id, emit);
  if (!loggedIn) return { status: 'need_login', tabId: tab.id, platform: platform.id };

  for (const url of platform.urls) {
    emit({ type: 'progress', key: 'orders_open', url });
    tab = await navigate(tab.id, url);
    await assertPageAccessible(tab.id);
    if (await isLoggedOut(tab.id)) {
      emit({ type: 'progress', key: 'extension_login', url: tab.url || url });
      const ok = await waitUntilLoggedIn(tab.id, emit);
      if (!ok) return { status: 'need_login', tabId: tab.id, platform: platform.id };
      tab = await navigate(tab.id, url);
      await assertPageAccessible(tab.id);
    }
    emit({ type: 'progress', key: 'orders_ready', url: tab.url || url });
    return { status: 'orders_ready', tabId: tab.id, platform: platform.id };
  }

  return { status: 'empty', tabId: tab.id, items: [] };
}

async function collectPlatform(platform, previousTabId, emit) {
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
    await runInTab(tab.id, pageExpandList).catch(() => {});
    const items = (await runInTab(tab.id, pageExtractItems).catch(() => [])) || [];
    if (!items.length) continue;

    const rows = items.map((item) => ({ ...item, platform: platform.name }));
    for (const item of rows) {
      emit({ type: 'item', item });
      await delay(80);
    }
    emit({ type: 'progress', key: 'collect_done', count: rows.length, url: tab.url || url });
    await chrome.tabs.remove(tab.id).catch(() => {});
    return { status: 'ok', tabId: tab.id, items: rows };
  }

  return { status: 'empty', tabId: tab.id, items: [] };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type || !sender.tab || !LOOKBOX_ORIGIN.test(sender.tab.url || '')) return;
  if (msg.type === 'PING') {
    sendResponse({ ok: true, version: '0.3.0' });
    return;
  }
  if (msg.type === 'CANCEL') {
    if (Number.isInteger(msg.tabId)) chrome.tabs.remove(msg.tabId).catch(() => {});
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
      : collectPlatform(platform, msg.tabId, emit);
    job
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', error: String(error && error.message || error) }));
    return true;
  }
});
