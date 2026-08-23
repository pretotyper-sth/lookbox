import { PLATFORMS, byId } from './platforms.js';
import { pageLooksLoggedOut, pageExpandList, pageExtractItems } from './extract.js';

const waitTabComplete = (tabId) => new Promise((resolve) => {
  const t = setTimeout(() => {
    chrome.tabs.onUpdated.removeListener(onUp);
    resolve();
  }, 25000);
  function onUp(id, info) {
    if (id === tabId && info.status === 'complete') {
      clearTimeout(t);
      chrome.tabs.onUpdated.removeListener(onUp);
      resolve();
    }
  }
  chrome.tabs.onUpdated.addListener(onUp);
});

async function runInTab(tabId, func) {
  const [hit] = await chrome.scripting.executeScript({
    target: { tabId },
    func,
  });
  return hit && hit.result;
}

async function collectPlatform(platform, tabId) {
  let tab = tabId ? await chrome.tabs.get(tabId).catch(() => null) : null;
  for (const url of platform.urls) {
    if (!tab) {
      tab = await chrome.tabs.create({ url, active: true });
      await waitTabComplete(tab.id);
    } else {
      await chrome.tabs.update(tab.id, { url, active: true });
      await waitTabComplete(tab.id);
    }
    await new Promise((r) => setTimeout(r, 900));
    let loggedOut = await runInTab(tab.id, pageLooksLoggedOut);
    if (loggedOut) {
      const deadline = Date.now() + 180000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1500));
        loggedOut = await runInTab(tab.id, pageLooksLoggedOut);
        if (!loggedOut) break;
      }
      if (loggedOut) {
        return { status: 'need_login', tabId: tab.id, platform: platform.id };
      }
    }
    await runInTab(tab.id, pageExpandList);
    const items = (await runInTab(tab.id, pageExtractItems)) || [];
    if (items.length) {
      return {
        status: 'ok',
        tabId: tab.id,
        items: items.map((it) => ({ ...it, platform: platform.name })),
      };
    }
  }
  return { status: 'empty', tabId: tab && tab.id, items: [] };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'PING') {
    sendResponse({ ok: true, version: '0.1.0' });
    return;
  }
  if (msg.type === 'COLLECT') {
    const platform = byId(msg.platform) || PLATFORMS[0];
    collectPlatform(platform, msg.tabId)
      .then(sendResponse)
      .catch((err) => sendResponse({ status: 'error', error: String(err && err.message || err) }));
    return true;
  }
});
