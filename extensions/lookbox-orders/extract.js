// chrome.scripting.executeScript가 함수 본문만 주입하므로, 여기서 export하는
// 함수는 바깥 변수를 닫으면 안 된다.

export function pageLooksLoggedOut() {
  const url = location.href.toLowerCase();
  if (/login|signin|auth|member\/login/.test(url)) return true;
  const body = ((document.body && document.body.innerText) || '').slice(0, 800);
  return /로그인이 필요|로그인 해주세요|로그인하세요|로그인 후 이용|로그인하고/.test(body);
}

export function pageAccessDenied() {
  const title = document.title || '';
  const body = ((document.body && document.body.innerText) || '').slice(0, 1200);
  return /access denied|permission to access|사용권한이 없습니다|접근이 거부/i.test(`${title}\n${body}`);
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

export function pageNextUrl() {
  const here = new URL(location.href);
  const current = Number(here.searchParams.get('page') || 1);
  const links = Array.from(document.querySelectorAll('a[href]')).filter((a) => a.offsetParent);
  const candidates = links.map((a) => {
    try {
      const url = new URL(a.href, location.href);
      const page = Number(url.searchParams.get('page'));
      return page > current ? { url: url.href, page } : null;
    } catch { return null; }
  }).filter(Boolean).sort((a, b) => a.page - b.page);
  return candidates[0] ? candidates[0].url : '';
}

// 네이버페이 결제내역은 상품 링크가 아닌 React 결제 카드와 버튼 페이지네이션으로 구성된다.
export function pageExtractNaverPayItems() {
  const MONEY = /(?:₩\s*)?[0-9][0-9,]{2,}\s*원/;
  const STATUS = /^(?:구매확정완료|결제완료|구매확정|배송완료)$/;
  const DATE = /(?:\d{4}[.\-/]\s*)?\d{1,2}[.]\s*\d{1,2}[.]?(?:\s*\d{1,2}:\d{2})?/;
  const SKIP = /(적립|포인트|결제취소|주문 상세 보기|배송 조회|후기 작성|재구매|주문상세|삭제)/;
  const FASHION = /(shirt|tee|t-shirt|sweatshirt|hoodie|jacket|coat|cardigan|knit|sweater|blazer|pants|slacks|jeans|denim|skirt|dress|onepiece|shoes|sneaker|sandal|loafer|boot|bag|cap|hat|jewelry|clothing|apparel|wear|outer|top|bottom|상의|하의|셔츠|티셔츠|맨투맨|후드|자켓|재킷|코트|가디건|니트|스웨터|블레이저|바지|팬츠|슬랙스|청바지|데님|스커트|원피스|신발|스니커즈|샌들|로퍼|부츠|가방|모자|의류|스탠다드)/i;
  const NOT_FASHION = /(미용|헤어|네일|피부|병원|의원|약국|식당|카페|치킨|피자|햄버거|마트|식품|과일|생수|커피|영화|공연|숙박|호텔|항공|교통|택시|보험|대출|통신|멤버십|상품권|게임|강의)/i;
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const textOf = (el) => (el.innerText || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const isCard = (el) => {
    const text = (el.innerText || '').trim();
    return visible(el) && /(?:구매확정완료|결제완료|구매확정|배송완료)/.test(text)
      && MONEY.test(text) && el.querySelector('img') && text.length < 900;
  };
  const cards = Array.from(document.querySelectorAll('article, li, div')).filter((el) => {
    if (!isCard(el)) return false;
    return !Array.from(el.querySelectorAll('article, li, div')).some((child) => child !== el && isCard(child));
  });
  const out = new Map();
  for (const card of cards) {
    const lines = textOf(card);
    const candidates = lines.filter((line) => line.length > 2 && !STATUS.test(line) && !MONEY.test(line)
      && !DATE.test(line) && !SKIP.test(line) && !/^(?:결제|구매|주문)\s*(?:완료|확정).*$/i.test(line));
    const name = (candidates.find((line) => FASHION.test(line) && !NOT_FASHION.test(line)) || '').replace(/\s*[›>]\s*$/, '').trim();
    if (!name) continue;
    const image = card.querySelector('img');
    const anchor = card.closest('a[href]') || card.querySelector('a[href]');
    const price = (lines.find((line) => MONEY.test(line)) || '').match(MONEY)?.[0] || '';
    const purchasedAt = (lines.find((line) => DATE.test(line)) || '').match(DATE)?.[0] || '';
    const key = `${name}|${price}|${purchasedAt}`;
    if (out.has(key)) continue;
    out.set(key, {
      url: anchor ? anchor.href : `${location.href.split('#')[0]}#naver-pay-${encodeURIComponent(key)}`,
      name: name.slice(0, 120),
      brand: '',
      size: '',
      thumb: (image && (image.currentSrc || image.src)) || '',
      price,
      purchasedAt,
      store: '네이버페이',
    });
  }
  return Array.from(out.values());
}

// 머스트잇은 상품 링크 대신 판매자·채팅 링크가 주문 카드 상단에 있어 전용 카드 구조를 읽는다.
export function pageExtractMustitItems() {
  const MONEY = /[0-9][0-9,]{2,}\s*원/;
  const DATE = /\d{4}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}/;
  const INVALID_ORDER_STATUS = /(?:취소|반품|교환|환불|결제\s*오류|검수\s*불합격|판매\s*취소)\s*(?:완료|처리\s*완료|접수|진행\s*중|됨)/;
  const imageSrc = (img) => img && (
    img.getAttribute('data-src')
    || img.getAttribute('data-original')
    || img.getAttribute('data-lazy-src')
    || img.currentSrc
    || img.src
  );
  const out = new Map();
  for (const card of Array.from(document.querySelectorAll('.card_product_wrap'))) {
    const product = card.querySelector('.card_product_info');
    const name = (product?.querySelector('.relation_name')?.textContent || '').replace(/\s+/g, ' ').trim();
    if (!product || !name) continue;
    const status = (card.querySelector('.product_status')?.innerText || '').replace(/\s+/g, ' ');
    if (INVALID_ORDER_STATUS.test(status.replace(/\s+/g, ''))) continue;
    const onclick = product.getAttribute('onclick') || '';
    const detailPath = onclick.match(/['\"]([^'\"]*\/mypage\/order_detail[^'\"]*)['\"]/i)?.[1] || '';
    const fallback = `${location.href.split('#')[0]}#mustit-${encodeURIComponent(name)}`;
    const url = detailPath ? new URL(detailPath, location.origin).href : fallback;
    if (out.has(url)) continue;
    const option = (product.querySelector('.relation_author')?.textContent || '').replace(/\s+/g, ' ').trim();
    out.set(url, {
      url,
      name: name.slice(0, 120),
      brand: (product.querySelector('.relation_brand')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      size: (option.match(/^([^|(]+?)\s*\(\d+개\)/)?.[1] || '').trim().slice(0, 40),
      thumb: imageSrc(product.querySelector('.card_cell.img img')) || '',
      price: ((status.match(MONEY) || [])[0] || '').trim(),
      purchasedAt: ((card.closest('.info_box')?.innerText || '').match(DATE) || [])[0] || '',
      store: '머스트잇',
    });
  }
  return Array.from(out.values());
}

export function pageExtractKreamItems() {
  const invalidStatus = /(?:취소|반품|교환|환불)\s*(?:완료|처리|접수)|검수\s*불합격/;
  const status = /배송\s*완료|구매\s*완료|취소\s*완료|반품|교환|환불|검수\s*불합격/;
  const date = /\d{2}\/\d{2}\/\d{2}\s+\d{2}:\d{2}/;
  const seen = new Set();
  const items = [];

  for (const link of Array.from(document.querySelectorAll('a[href*="/my/buying/"]'))) {
    const text = (link.innerText || '').replace(/\r/g, '');
    if (!text || invalidStatus.test(text)) continue;

    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const name = lines[0] || '';
    if (!name || /^(?:구매|전체|진행 중|종료)$/.test(name)) continue;

    const statusIndex = lines.findIndex((line) => status.test(line));
    const size = lines.slice(1, statusIndex < 0 ? lines.length : statusIndex)
      .find((line) => line !== '/' && !/(?:배송|스타일|일반배송|빠른배송)/.test(line)) || '';
    const order = link.closest('.my-order-list');
    const header = order?.querySelector('a[href*="/my/order/"]')?.innerText || '';
    const image = Array.from(link.querySelectorAll('img')).find((img) =>
      /base-image-responsive__image|product/i.test(img.className || '')) || link.querySelector('img');
    const thumb = image?.getAttribute('data-src')
      || image?.getAttribute('data-original')
      || image?.getAttribute('data-lazy-src')
      || image?.currentSrc
      || image?.src
      || '';
    const url = link.href || '';
    if (!url || seen.has(url)) continue;
    seen.add(url);

    items.push({
      key: url,
      store: 'KREAM',
      brand: '',
      name,
      size,
      price: '',
      thumb,
      url,
      purchasedAt: header.match(date)?.[0] || '',
    });
  }

  return items;
}

export function pageNaverPayNext() {
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const pager = Array.from(document.querySelectorAll('div, nav, section')).find((el) => {
    const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
    return visible(el) && text.includes('처음') && text.includes('마지막') && text.length < 180;
  });
  if (!pager) return false;
  const controls = Array.from(pager.querySelectorAll('button, a, [role="button"]')).filter(visible);
  const next = controls.find((el) => /다음|next/i.test(`${el.getAttribute('aria-label') || ''} ${el.title || ''}`))
    || controls.filter((el) => !/처음|마지막|^\d+$/.test((el.innerText || '').trim())).at(-1);
  if (!next || next.hasAttribute('disabled') || next.getAttribute('aria-disabled') === 'true') return false;
  next.click();
  return true;
}

export function pageOpenZigzagOrders() {
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const targets = Array.from(document.querySelectorAll('a, button, [role="button"], div')).filter((el) => {
    const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    return visible(el) && text === '주문 배송';
  });
  const target = targets.sort((a, b) => (a.getBoundingClientRect().width * a.getBoundingClientRect().height) - (b.getBoundingClientRect().width * b.getBoundingClientRect().height))[0];
  if (!target) return false;
  target.click();
  return true;
}

export function pageOpenZigzagYearFilter() {
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const period = /^(?:최근\s*\d+\s*(?:개월|년)|\d+\s*(?:개월|년)|최대\s*5년)$/;
  const targets = Array.from(document.querySelectorAll('button, [role="button"], div, span')).filter((el) => {
    const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    return visible(el) && period.test(text);
  });
  const target = targets.sort((a, b) => {
    const aArea = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
    const bArea = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
    return aArea - bArea;
  })[0];
  if (!target || /최대\s*5년/.test((target.innerText || target.textContent || '').replace(/\s+/g, ' '))) return false;
  target.click();
  return true;
}

export function pageSelectZigzagMaxYears() {
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const targets = Array.from(document.querySelectorAll('button, [role="button"], li, div, span')).filter((el) =>
    visible(el) && (el.innerText || el.textContent || '').replace(/\s+/g, '') === '최대5년');
  const target = targets.sort((a, b) => {
    const aArea = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
    const bArea = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
    return aArea - bArea;
  })[0];
  if (!target) return false;
  target.click();
  return true;
}

export function pageZigzagHasNoOrders() {
  const body = (document.body && document.body.innerText) || '';
  return /(?:주문\s*내역|주문한\s*상품).{0,16}(?:없어요|없습니다)|아직\s*주문/.test(body);
}

export function pageOpenAblyOrders() {
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const targets = Array.from(document.querySelectorAll('a, button, [role="button"], div')).filter((el) => {
    const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    return visible(el) && /^(?:주문\s*배송|주문\s*내역|주문내역|주문배송)$/.test(text);
  });
  const target = targets.sort((a, b) => (a.getBoundingClientRect().width * a.getBoundingClientRect().height) - (b.getBoundingClientRect().width * b.getBoundingClientRect().height))[0];
  if (!target) return false;
  target.click();
  return true;
}

export function pageAblyHasNoOrders() {
  const body = (document.body && document.body.innerText) || '';
  return /(?:주문\s*내역|주문한\s*상품|구매\s*내역).{0,18}(?:없어요|없습니다)|아직\s*주문/.test(body);
}

export function pageHasNoOrders() {
  const body = (document.body && document.body.innerText) || '';
  const noOrderCopy = /(?:주문(?:하신)?\s*내역|주문한\s*(?:상품|내역)|구매\s*내역|최근\s*주문|조회된\s*주문).{0,24}(?:없어요|없습니다|없어)|아직\s*주문(?:한\s*(?:상품|내역))?\s*(?:이|가)?\s*없/.test(body);
  const ablyEmpty = /주문\s*[·.]?\s*예약\s*내역/.test(body)
    && /검색\s*결과가\s*없습니다/.test(body)
    && /배송중\s*0/.test(body) && /배송완료\s*0/.test(body);
  return noOrderCopy || ablyEmpty;
}

export function pageSetWConceptYearRange(yearOffset) {
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const inputs = Array.from(document.querySelectorAll('input')).filter((input) =>
    visible(input) && (/^\d{4}-\d{2}-\d{2}$/.test(input.value || '') || input.type === 'date'));
  if (inputs.length < 2) return false;
  const end = new Date();
  end.setFullYear(end.getFullYear() - Number(yearOffset || 0));
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);
  const format = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  [start, end].forEach((date, index) => {
    set.call(inputs[index], format(date));
    inputs[index].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[index].dispatchEvent(new Event('change', { bubbles: true }));
  });
  const query = Array.from(document.querySelectorAll('button, input[type="submit"], a')).find((el) =>
    visible(el) && (el.innerText || el.value || '').replace(/\s+/g, '') === '조회');
  if (!query) return false;
  query.click();
  return true;
}

export function pageSetMusinsaThreeYearRange() {
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const inputs = Array.from(document.querySelectorAll('input')).filter((input) =>
    visible(input) && /DateSelector__DateInput/.test(input.className || ''));
  if (inputs.length < 2) return false;
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 3);
  const format = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  [start, end].forEach((date, index) => {
    set.call(inputs[index], format(date));
    inputs[index].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[index].dispatchEvent(new Event('change', { bubbles: true }));
  });
  const search = Array.from(document.querySelectorAll('button')).find((button) =>
    (button.innerText || '').replace(/\s+/g, '') === '검색하기');
  if (!search) return false;
  search.click();
  return true;
}

export function pageOpenMusinsaDateSearch() {
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const dateInputs = Array.from(document.querySelectorAll('input')).filter((input) =>
    visible(input) && /DateSelector__DateInput/.test(input.className || ''));
  if (dateInputs.length >= 2) return true;
  const search = Array.from(document.querySelectorAll('input')).find((input) =>
    visible(input) && /(상품명|브랜드명|검색)/.test(input.placeholder || ''));
  if (!search) return false;
  search.focus();
  search.click();
  return true;
}

export function pageExtractItems() {
  const PRODUCT_RE = /(\/goods\/|goodsNo=|\/products?\/|\/product\/|\/catalog\/|\/pd\/|productNo=|itemId=|\/item\/|prdNo=|\/detail\/|\/pc\/history\/)/i;
  const SKIP_RE = /(review|리뷰|문의|교환|반품|취소|배송조회|장바구니|쿠폰|이벤트|login|logout|카테고리|브랜드관|기획전)/i;
  const ACTION_RE = /^(?:스냅\s*보기|자세히\s*보기|상세\s*보기|주문\s*상세(?:\s*보기)?|상품\s*상세(?:\s*보기)?|배송\s*조회|재구매|후기\s*작성|스타일\s*올리기)$/;
  const ORDER_STATUS = /^(?:구매\s*확정|배송\s*완료|결제\s*완료|취소\s*완료|반품\s*완료|교환\s*완료|환불\s*완료|결제\s*오류|검수\s*불합격|판매\s*취소\s*완료)$/;
  const INVALID_ORDER_STATUS = /^(?:취소\s*완료|반품\s*완료|교환\s*완료|환불\s*완료|결제\s*오류|검수\s*불합격|판매\s*취소\s*완료)$/;
  const MONEY = /[0-9][0-9,]{2,}\s*원/;
  const DATE = /\d{4}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}/;
  const FASHION = /(의류|패션|상의|하의|아우터|셔츠|티셔츠|반팔|긴팔|맨투맨|후드|자켓|재킷|코트|가디건|니트|스웨터|블레이저|바지|팬츠|슬랙스|청바지|데님|스커트|원피스|드레스|레깅스|트레이닝|셋업|신발|스니커즈|샌들|로퍼|부츠|구두|가방|백팩|모자|캡|비니|벨트|지갑|주얼리|목걸이|반지|귀걸이|watch|shirt|tee|t-shirt|sweatshirt|hoodie|jacket|coat|cardigan|knit|sweater|blazer|pants|slacks|jeans|denim|skirt|dress|leggings|sneaker|sandal|loafer|boot|bag|backpack|cap|beanie|belt|wallet|jewelry)/i;
  const NOT_FASHION = /(식품|음식|농산물|과자|라면|생수|닭가슴살|쌀|두유|음료|커피|차\b|티슈|물티슈|휴지|클렌저|화장품|샴푸|린스|비타민|영양제|건강식품|세제|주방|기저귀|반려|사료|헤어|네일|피부|병원|약국|식당|카페|영화|공연|숙박|호텔|항공|택시|보험|대출|통신|멤버십|상품권|게임|강의)/i;
  const mixedStore = /(?:^|\.)(?:coupang|ssg|naver)\./i.test(location.hostname);
  const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
  const statusMarkers = Array.from(document.querySelectorAll('body *')).flatMap((node) => {
    const text = normalize(node.innerText);
    return ORDER_STATUS.test(text) && !Array.from(node.children).some((child) => ORDER_STATUS.test(normalize(child.innerText)))
      ? [{ node, invalid: INVALID_ORDER_STATUS.test(text) }] : [];
  });
  const hasNearbyInvalidStatus = (anchor) => {
    const anchorRect = anchor.getBoundingClientRect();
    for (let i = statusMarkers.length - 1; i >= 0; i--) {
      const marker = statusMarkers[i];
      if (marker.node === anchor || marker.node.contains(anchor)
        || !(marker.node.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      const markerRect = marker.node.getBoundingClientRect();
      const verticallyNear = anchorRect.top - markerRect.bottom >= -80 && anchorRect.top - markerRect.bottom <= 360;
      const horizontallyNear = markerRect.right >= anchorRect.left - 160 && markerRect.left <= anchorRect.right + 160;
      if (verticallyNear && horizontallyNear) return marker.invalid;
    }
    return false;
  };
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
    if (hasNearbyInvalidStatus(a) || lines.some((line) => INVALID_ORDER_STATUS.test(normalize(line)))) continue;
    const anchorText = (a.innerText || '').trim();
    const candidates = lines.filter((t) => t.length > 3 && !MONEY.test(t) && !DATE.test(t) && !SKIP_RE.test(t) && !ACTION_RE.test(t)
      && !/^[A-Z0-9]{1,5}\s*\/\s*\d+개$/i.test(t));
    const detail = candidates.filter((t) => t !== anchorText).sort((a, b) => b.length - a.length)[0];
    const name = detail || (anchorText.length > 3 && !SKIP_RE.test(anchorText) ? anchorText : candidates[0]) || '';
    if (!name) continue;
    const sizeLine = lines.find((t) => /^(.+?)\s*\/\s*\d+개$/i.test(t));
    const size = sizeLine ? sizeLine.replace(/\s*\/\s*\d+개$/i, '').trim() : '';
    const brand = anchorText && anchorText !== name && !ACTION_RE.test(anchorText)
      ? anchorText : (candidates.find((t) => t !== name) || '');
    const classification = `${name} ${brand}`;
    if (mixedStore && (!FASHION.test(classification) || NOT_FASHION.test(classification))) continue;
    const img = a.querySelector('img') || box.querySelector('img');
    const thumb = img && (
      img.getAttribute('data-src')
      || img.getAttribute('data-original')
      || img.getAttribute('data-lazy-src')
      || img.currentSrc
      || img.src
    );
    const item = {
      url: a.href,
      name: name.slice(0, 120),
      brand: brand.slice(0, 80),
      size: size.slice(0, 40),
      thumb: thumb || '',
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
    if (!out.has(key)) out.set(key, item);
  }
  return Array.from(out.values());
}
