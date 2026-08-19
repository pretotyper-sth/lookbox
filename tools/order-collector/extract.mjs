// 페이지 안에서 실행되는 수집 함수. 사이트별 셀렉터에 기대지 않고, '상품 링크처럼 생긴
// 앵커'를 찾아 그 주변에서 이름·썸네일·가격·날짜를 줍는다. 셀렉터가 바뀌어도 잘 버틴다.
export const PAGE_EXTRACTOR = () => {
  const PRODUCT_RE = /(\/goods\/|goodsNo=|\/products?\/|\/product\/|\/catalog\/|\/pd\/|productNo=|itemId=|\/item\/|prdNo=|\/detail\/)/i;
  const SKIP_RE = /(review|리뷰|문의|교환|반품|취소|배송조회|장바구니|쿠폰|이벤트|login|logout)/i;
  const MONEY = /[0-9][0-9,]{2,}\s*원/;
  const DATE = /\d{4}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}/;

  const norm = (href) => {
    try {
      const u = new URL(href, location.href);
      const id = (u.search.match(/(goodsNo|productNo|itemId|prdNo|goods_no)=[^&]+/i) || [''])[0];
      return u.origin + u.pathname + (id ? '?' + id : '');
    } catch { return href; }
  };

  const out = new Map();
  for (const a of Array.from(document.querySelectorAll('a[href]'))) {
    const href = a.href || '';
    if (!PRODUCT_RE.test(href) || SKIP_RE.test(href)) continue;
    // 이미지와 글자를 함께 담은 가장 가까운 조상을 '주문 한 줄'로 본다
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
    const key = norm(a.href);
    const prev = out.get(key);
    // 같은 상품이 여러 번 걸리면 정보가 더 많은 쪽을 남긴다
    const score = (x) => (x.thumb ? 2 : 0) + (x.price ? 1 : 0) + (x.purchasedAt ? 1 : 0);
    if (!prev || score(item) > score(prev)) out.set(key, item);
  }
  return Array.from(out.values());
};

// 목록을 끝까지 펼친다: 스크롤 + '더보기' 계열 버튼 클릭.
export const PAGE_EXPAND = async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const MORE = /^(더보기|더 보기|더 불러오기|see more|more|load more)$/i;
  let last = 0;
  for (let round = 0; round < 12; round++) {
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(700);
    const more = Array.from(document.querySelectorAll('button, a, div[role=button]'))
      .find((el) => MORE.test((el.innerText || '').trim()) && el.offsetParent);
    if (more) { more.click(); await sleep(1200); }
    const now = document.querySelectorAll('a[href]').length;
    if (now === last && !more) break;
    last = now;
  }
  window.scrollTo(0, 0);
  return last;
};
