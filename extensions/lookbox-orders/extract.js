// chrome.scripting.executeScript가 함수 본문만 주입하므로, 여기서 export하는
// 함수는 바깥 변수를 닫으면 안 된다.

export function pageLooksLoggedOut() {
  const url = location.href.toLowerCase();
  if (/login|signin|auth|member\/login/.test(url)) return true;
  const body = ((document.body && document.body.innerText) || '').slice(0, 800);
  return /로그인이 필요|로그인 해주세요|로그인하세요|로그인 후 이용|로그인하고/.test(body);
}

export async function pageExpandList() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const MORE = /^(더보기|더 보기|더 불러오기|see more|more|load more)$/i;
  let last = 0;
  for (let round = 0; round < 12; round++) {
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(700);
    const more = Array.from(document.querySelectorAll('button, a, div[role=button]'))
      .find((el) => MORE.test((el.innerText || '').trim()) && el.offsetParent);
    if (more) {
      more.click();
      await sleep(1200);
    }
    const now = document.querySelectorAll('a[href]').length;
    if (now === last && !more) break;
    last = now;
  }
  window.scrollTo(0, 0);
  return last;
}

export function pageExtractItems() {
  const PRODUCT_RE = /(\/goods\/|goodsNo=|\/products?\/|\/product\/|\/catalog\/|\/pd\/|productNo=|itemId=|\/item\/|prdNo=|\/detail\/)/i;
  const SKIP_RE = /(review|리뷰|문의|교환|반품|취소|배송조회|장바구니|쿠폰|이벤트|login|logout)/i;
  const MONEY = /[0-9][0-9,]{2,}\s*원/;
  const DATE = /\d{4}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}/;
  const out = new Map();
  for (const a of Array.from(document.querySelectorAll('a[href]'))) {
    const href = a.href || '';
    if (!PRODUCT_RE.test(href) || SKIP_RE.test(href)) continue;
    let box = a;
    for (let i = 0; i < 6 && box.parentElement; i++) {
      box = box.parentElement;
      if (box.querySelector('img') && (box.innerText || '').trim().length > 12) break;
    }
    const lines = (box.innerText || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const anchorText = (a.innerText || '').trim();
    const name = (anchorText.length > 3 && !SKIP_RE.test(anchorText) ? anchorText
      : lines.find((t) => t.length > 5 && !MONEY.test(t) && !DATE.test(t) && !SKIP_RE.test(t))) || '';
    if (!name) continue;
    const img = a.querySelector('img') || box.querySelector('img');
    const item = {
      url: a.href,
      name: name.slice(0, 120),
      thumb: (img && (img.currentSrc || img.src)) || '',
      price: (lines.find((t) => MONEY.test(t)) || '').match(MONEY)?.[0] || '',
      purchasedAt: (lines.find((t) => DATE.test(t)) || '').match(DATE)?.[0] || '',
      store: location.hostname.replace(/^www\./, ''),
    };
    let key = href;
    try {
      const u = new URL(href, location.href);
      const id = (u.search.match(/(goodsNo|productNo|itemId|prdNo|goods_no)=[^&]+/i) || [''])[0];
      key = u.origin + u.pathname + (id ? '?' + id : '');
    } catch { /* keep href */ }
    const prev = out.get(key);
    const score = (x) => (x.thumb ? 2 : 0) + (x.price ? 1 : 0) + (x.purchasedAt ? 1 : 0);
    if (!prev || score(item) > score(prev)) out.set(key, item);
  }
  return Array.from(out.values());
}
