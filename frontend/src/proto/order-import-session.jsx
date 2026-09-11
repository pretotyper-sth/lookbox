/* 구매내역 세션. 몰은 시트에서 고르고, 여기서는 웹뷰로 로그인한 뒤 옷을 하나씩 담는다.
   비밀번호는 받지 않는다. 쇼핑몰 창(네이티브 웹뷰·확장 탭·로컬 크롬)에서만 로그인한다. */
const React = window.React;
const { useState, useEffect, useRef, useLayoutEffect } = React;

const CARD_H = 'min(640px, calc(100dvh - 48px))';
const NATIVE_WEBVIEW_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const NATIVE_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';

function nativePageLooksLoggedOut() {
  const url = location.href.toLowerCase();
  if (/login|signin|auth|member\/login/.test(url)) return true;
  const body = ((document.body && document.body.innerText) || '').slice(0, 800);
  return /로그인이 필요|로그인 해주세요|로그인하세요|로그인 후 이용|로그인하고/.test(body);
}

function nativePageStartCoupangLogin() {
  const login = Array.from(document.querySelectorAll('a[href]'))
    .find((a) => /login\.coupang\.com\/login\/login\.pang/i.test(a.href || ''));
  if (!login) return false;
  login.click();
  return true;
}

async function nativePageExpandList() {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const morePattern = /^(더보기|더 보기|더 불러오기|see more|more|load more)$/i;
  let last = 0;
  for (let round = 0; round < 12; round += 1) {
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(700);
    const more = Array.from(document.querySelectorAll('button, a, div[role=button]'))
      .find((el) => morePattern.test((el.innerText || '').trim()) && el.offsetParent);
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

function nativePageExtractItems() {
  const productPattern = /(\/goods\/|goodsNo=|\/products?\/|\/product\/|\/catalog\/|\/pd\/|productNo=|itemId=|\/item\/|prdNo=|\/detail\/)/i;
  const skipPattern = /(review|리뷰|문의|교환|반품|취소|배송조회|장바구니|쿠폰|이벤트|login|logout)/i;
  const moneyPattern = /[0-9][0-9,]{2,}\s*원/;
  const datePattern = /\d{4}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}/;
  const out = new Map();
  for (const a of Array.from(document.querySelectorAll('a[href]'))) {
    const href = a.href || '';
    if (!productPattern.test(href) || skipPattern.test(href)) continue;
    let box = a;
    for (let i = 0; i < 6 && box.parentElement; i += 1) {
      box = box.parentElement;
      if (box.querySelector('img') && (box.innerText || '').trim().length > 12) break;
    }
    const lines = (box.innerText || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const anchorText = (a.innerText || '').trim();
    const name = (anchorText.length > 3 && !skipPattern.test(anchorText) ? anchorText
      : lines.find((t) => t.length > 5 && !moneyPattern.test(t) && !datePattern.test(t) && !skipPattern.test(t))) || '';
    if (!name) continue;
    const img = a.querySelector('img') || box.querySelector('img');
    const item = {
      url: a.href,
      name: name.slice(0, 120),
      thumb: (img && (img.currentSrc || img.src)) || '',
      price: (lines.find((t) => moneyPattern.test(t)) || '').match(moneyPattern)?.[0] || '',
      purchasedAt: (lines.find((t) => datePattern.test(t)) || '').match(datePattern)?.[0] || '',
      store: location.hostname.replace(/^www\./, ''),
    };
    let key = href;
    try {
      const u = new URL(href, location.href);
      const id = (u.search.match(/(goodsNo|productNo|itemId|prdNo|goods_no)=[^&]+/i) || [''])[0];
      key = u.origin + u.pathname + (id ? `?${id}` : '');
    } catch { /* keep href */ }
    const prev = out.get(key);
    const score = (x) => (x.thumb ? 2 : 0) + (x.price ? 1 : 0) + (x.purchasedAt ? 1 : 0);
    if (!prev || score(item) > score(prev)) out.set(key, item);
  }
  return Array.from(out.values());
}

function barUrl(platform, phase) {
  const raw = phase === 'login'
    ? (platform.loginUrl || (`https://${platform.host}`))
    : (platform.ordersUrl || (`https://${platform.host}`));
  return String(raw).replace(/^https?:\/\//, '');
}

function formatOrderErr(raw, wide) {
  const s = String(raw || '').trim();
  if (s === 'ORDER_READ_BLOCKED') {
    return '이 기기에서는 쇼핑몰 창을 열 수 없어요.\n컴퓨터에서 다시 시도해 주세요.';
  }
  if (s === 'NO_EXT') {
    return '구매내역 연결 확장 프로그램이 필요해요.\n설치한 뒤 이 페이지를 새로고침해 주세요.';
  }
  if (s === 'ORDER_OPEN_FAILED' || s === 'NEED_SETUP') {
    return wide
      ? '쇼핑몰 창을 열지 못했어요.\n이 컴퓨터에서 다시 열어 주세요.'
      : '이 기기에서는 쇼핑몰 창을 열 수 없어요.\n컴퓨터에서 다시 시도해 주세요.';
  }
  if (s.includes('\n')) return s;
  const parts = s.split(/(?<=다\.|요\.)\s+/).filter(Boolean);
  if (parts.length >= 2) return parts[0] + '\n' + parts.slice(1).join(' ');
  return s;
}

function OrderImportSession({
  open,
  platform,
  wide,
  onClose,
  onConfirm,
  collectOrders,
  sendInput,
  cancelCollect,
}) {
  const Icon = window.Icon;
  // login: 웹뷰에서 로그인 대기
  // orders: 주문내역으로 이동됨. CTA로 불러오기
  // tray: 오른쪽(또는 모바일 본문)에 옷이 하나씩 쌓임
  const [phase, setPhase] = useState('login');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [found, setFound] = useState([]);
  const [doneCollect, setDoneCollect] = useState(false);
  const [embedOrigin, setEmbedOrigin] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [stageSize, setStageSize] = useState(null);
  const [sessionMode, setSessionMode] = useState('');
  const nativeWebview = !!(window.LookboxNative && window.LookboxNative.embeddedWebview);
  const platformId = platform && platform.id;
  const cancelRef = useRef(false);
  const startedRef = useRef(false);
  const collectRef = useRef(collectOrders);
  collectRef.current = collectOrders;
  const cancelCollectRef = useRef(cancelCollect);
  cancelCollectRef.current = cancelCollect;
  const seenRef = useRef(new Set());
  const platformRef = useRef(platform);
  platformRef.current = platform;
  const sendRef = useRef(sendInput);
  sendRef.current = sendInput;
  const embedRef = useRef('');
  const viewBoxRef = useRef(null);
  const hitRef = useRef(null);
  const stageRef = useRef(null);
  stageRef.current = stageSize;
  const nativeViewRef = useRef(null);
  const nativeOrdersOpenedRef = useRef(false);
  const extensionRef = useRef(false);
  const extensionPreparedRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const stopCollect = () => {
    cancelRef.current = true;
    if (typeof cancelCollectRef.current === 'function') cancelCollectRef.current();
  };
  window.useEscapeClose(open, () => {
    stopCollect();
    onClose();
  });

  const pushItem = (it) => {
    const shop = platformRef.current;
    const url = it && it.url;
    if (!url || seenRef.current.has(url)) return;
    seenRef.current.add(url);
    setFound((prev) => prev.concat([{
      url,
      name: it.name || '',
      store: it.platform || it.store || (shop && shop.name) || '',
      price: it.price || '',
      purchasedAt: it.purchasedAt || '',
      thumb: it.thumb || '',
      pick: true,
      state: 'idle',
      error: '',
    }]));
  };

  const begin = async (action = 'open') => {
    const shop = platformRef.current;
    if (!shop || !collectRef.current) return;
    setErr('');
    setBusy(true);
    setFound([]);
    setDoneCollect(false);
    seenRef.current = new Set();
    try {
      const items = await collectRef.current({
        platform: shop,
        action,
        width: stageSize && stageSize.w,
        height: stageSize && stageSize.h,
        onProgress: (step) => {
          if (cancelRef.current) return;
          const key = (step && (step.key || step)) || '';
          if (key === 'extension_login') {
            extensionRef.current = true;
            setSessionMode('extension');
          }
          if (key === 'orders_ready' && extensionRef.current) extensionPreparedRef.current = true;
          if (step && step.url) setPageUrl(String(step.url));
          if (key === 'orders_ready' || key === 'collect') {
            setPhase((p) => (p === 'login' ? 'orders' : p));
          }
        },
        onItem: (it) => {
          if (cancelRef.current) return;
          setPhase((p) => (p === 'login' ? 'orders' : p));
          pushItem(it);
        },
        onEmbed: (info) => {
          if (cancelRef.current || !info || !info.origin) return;
          embedRef.current = info.origin;
          setEmbedOrigin(info.origin);
        },
      });
      if (cancelRef.current) return;
      (items || []).forEach(pushItem);
      if (action === 'open' && extensionPreparedRef.current) {
        setPhase('orders');
        return;
      }
      setDoneCollect(true);
      setPhase((p) => (p === 'login' ? 'orders' : p));
      if (!(items && items.length) && !seenRef.current.size) {
        setErr('주문내역이 보이면\n다시 불러오세요.');
      }
    } catch (e) {
      if (cancelRef.current) return;
      const msg = String((e && e.message) || '');
      if (msg === 'NEED_LOGIN' || /로그인/.test(msg)) {
        setErr('이 화면에서 로그인한 뒤\n다시 눌러 주세요.');
        setPhase('login');
      } else {
        setErr(formatOrderErr(msg || '주문 내역을 가져오지 못했어요.', wide));
      }
    } finally {
      if (!cancelRef.current) setBusy(false);
    }
  };

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      embedRef.current = '';
      setEmbedOrigin('');
      setPageUrl('');
      setStageSize(null);
      if (typeof cancelCollectRef.current === 'function') cancelCollectRef.current();
      return undefined;
    }
    cancelRef.current = false;
    seenRef.current = new Set();
    setPhase('login');
    setBusy(false);
    setErr('');
    setFound([]);
    setDoneCollect(false);
    setSessionMode('');
    nativeOrdersOpenedRef.current = false;
    extensionRef.current = false;
    extensionPreparedRef.current = false;
    return undefined;
  }, [open, platformId]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const measure = () => {
      const el = viewBoxRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) return;
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      setStageSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (nativeWebview || !open || !stageSize || startedRef.current) return undefined;
    startedRef.current = true;
    begin();
    return () => { cancelRef.current = true; };
  }, [open, stageSize, nativeWebview]);

  useLayoutEffect(() => {
    if (!open || !nativeWebview) return undefined;
    const view = nativeViewRef.current;
    if (!view) return undefined;
    const syncPage = async () => {
      let url = '';
      try { url = view.getURL(); } catch { return; }
      if (!/^https?:/i.test(url)) return;
      setPageUrl(url);
      setBusy(false);
      const shop = platformRef.current;
      if (shop && shop.id === 'coupang' && /^https:\/\/(www\.)?coupang\.com\/?(?:[?#].*)?$/i.test(url)) {
        const startedLogin = await view.executeJavaScript(`(${nativePageStartCoupangLogin.toString()})()`)
          .catch(() => false);
        if (startedLogin) {
          setPhase('login');
          return;
        }
      }
      let loggedOut = true;
      try {
        loggedOut = await view.executeJavaScript(`(${nativePageLooksLoggedOut.toString()})()`);
      } catch { return; }
      if (cancelRef.current) return;
      if (loggedOut) {
        setPhase('login');
        return;
      }
      if (!shop || !shop.ordersUrl) return;
      if (!nativeOrdersOpenedRef.current && url !== shop.ordersUrl) {
        nativeOrdersOpenedRef.current = true;
        setBusy(true);
        view.loadURL(shop.ordersUrl);
        return;
      }
      setErr('');
      setPhase('orders');
    };
    const onStart = () => setBusy(true);
    const syncUrl = () => {
      try {
        const url = view.getURL();
        if (/^https?:/i.test(url)) setPageUrl(url);
      } catch { /* webview가 닫히는 중이면 무시 */ }
    };
    const onFail = (event) => {
      if (event && event.errorCode === -3) return;
      setBusy(false);
      setErr('로그인 화면을 열지 못했어요.\n다시 열어 주세요.');
    };
    view.addEventListener('did-start-loading', onStart);
    view.addEventListener('did-stop-loading', syncPage);
    view.addEventListener('did-navigate', syncUrl);
    view.addEventListener('did-navigate-in-page', syncUrl);
    view.addEventListener('did-fail-load', onFail);
    return () => {
      view.removeEventListener('did-start-loading', onStart);
      view.removeEventListener('did-stop-loading', syncPage);
      view.removeEventListener('did-navigate', syncUrl);
      view.removeEventListener('did-navigate-in-page', syncUrl);
      view.removeEventListener('did-fail-load', onFail);
    };
  }, [open, nativeWebview, platformId]);

  useEffect(() => {
    if (!embedOrigin) return undefined;
    let on = true;
    const tick = () => {
      fetch(`${embedOrigin}/meta`)
        .then((r) => r.json())
        .then((d) => {
          if (!on || !d || !d.url) return;
          setPageUrl(String(d.url));
        })
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, 500);
    return () => { on = false; clearInterval(id); };
  }, [embedOrigin]);

  useEffect(() => {
    const el = hitRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const origin = embedRef.current;
      const box = viewBoxRef.current;
      const r = box ? box.getBoundingClientRect() : null;
      const size = stageRef.current;
      const vw = (size && size.w) || (r && r.width) || 1;
      const vh = (size && size.h) || (r && r.height) || 1;
      const x = r ? ((e.clientX - r.left) / r.width) * vw : vw / 2;
      const y = r ? ((e.clientY - r.top) / r.height) * vh : vh / 2;
      const payload = (e.ctrlKey || e.metaKey)
        ? { t: 'zoom', scale: e.deltaY < 0 ? 1.08 : 0.93 }
        : { t: 'scroll', dx: e.deltaX, dy: e.deltaY, x, y };
      if (origin) {
        fetch(`${origin}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      } else if (typeof sendRef.current === 'function') {
        sendRef.current(payload);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [embedOrigin]);

  if (!open || !platform) return null;

  const picked = found.filter((x) => x.pick && x.state !== 'dup');
  const close = () => {
    stopCollect();
    onClose();
  };

  const collectNativeOrders = async () => {
    const view = nativeViewRef.current;
    if (!view || busy) return;
    setErr('');
    setFound([]);
    setDoneCollect(false);
    seenRef.current = new Set();
    setPhase('tray');
    setBusy(true);
    try {
      await view.executeJavaScript(`(${nativePageExpandList.toString()})()`);
      const items = await view.executeJavaScript(`(${nativePageExtractItems.toString()})()`);
      if (cancelRef.current) return;
      for (const item of (items || [])) {
        pushItem({ ...item, platform: platformRef.current.name });
        await new Promise((resolve) => setTimeout(resolve, 90));
      }
      setDoneCollect(true);
      if (!(items && items.length)) setErr('주문내역에서 옷을 찾지 못했어요.');
    } catch {
      if (!cancelRef.current) setErr('주문내역을 읽지 못했어요.\n페이지를 확인한 뒤 다시 시도해 주세요.');
    } finally {
      if (!cancelRef.current) setBusy(false);
    }
  };

  const openTray = () => {
    if (nativeWebview) {
      collectNativeOrders();
      return;
    }
    if (extensionMode) {
      setPhase('tray');
      begin('collect');
      return;
    }
    setPhase('tray');
  };

  const togglePick = (url) => {
    setFound((arr) => arr.map((x) => (x.url === url ? { ...x, pick: !x.pick } : x)));
  };

  const trayOn = phase === 'tray';
  const urlText = pageUrl
    ? pageUrl.replace(/^https?:\/\//, '')
    : barUrl(platform, phase === 'login' ? 'login' : 'orders');

  const toPageXY = (e) => {
    const box = viewBoxRef.current;
    if (!box) return null;
    const r = box.getBoundingClientRect();
    const vw = (stageSize && stageSize.w) || r.width;
    const vh = (stageSize && stageSize.h) || r.height;
    return {
      x: ((e.clientX - r.left) / r.width) * vw,
      y: ((e.clientY - r.top) / r.height) * vh,
    };
  };

  const send = (payload) => {
    const origin = embedRef.current;
    if (origin) {
      fetch(`${origin}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
      return;
    }
    if (typeof sendRef.current === 'function') sendRef.current(payload);
  };

  const onHit = (e) => {
    e.preventDefault();
    const xy = toPageXY(e);
    if (!xy) return;
    send({ t: 'click', x: xy.x, y: xy.y });
    e.currentTarget.focus();
  };

  const onKey = (e) => {
    if (e.isComposing) return;
    if (e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Tab' || e.key === 'Escape') {
      e.preventDefault();
      send({ t: 'key', key: e.key });
      return;
    }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      send({ t: 'type', text: e.key });
    }
  };

  const onCompEnd = (e) => {
    const text = e.data;
    if (text) send({ t: 'type', text });
    e.currentTarget.textContent = '';
  };

  const extensionMode = sessionMode === 'extension';
  const live = nativeWebview || !!embedOrigin || (extensionMode && !err);

  const privacy = (
    <div className="lb-order-privacy">
      <Icon name="shield" size={13} stroke={2} />
      <span>선택한 상품 정보와 이미지만 옷장 등록에 사용해요. 로그인 정보는 읽거나 저장하지 않아요.</span>
    </div>
  );

  const webview = (
    <div className="lb-order-webview">
      <div className="lb-order-urlbar">
        <Icon name="lock" size={12} stroke={2.2} />
        <span>{urlText}</span>
      </div>
      <div className="lb-order-webbody live">
        <div ref={viewBoxRef} className="lb-order-stage">
          {nativeWebview ? (
            <webview
              ref={nativeViewRef}
              className="lb-order-native-view"
              src={platform.loginUrl || `https://${platform.host}`}
              partition="persist:lookbox-orders"
              useragent={platform.desktopUa ? NATIVE_DESKTOP_UA : NATIVE_WEBVIEW_UA}
              allowpopups="true"
            />
          ) : embedOrigin ? (
            <img className="lb-order-frame" alt="" src={`${embedOrigin}/stream`} />
          ) : extensionMode && !err ? (
            <div className="lb-order-wait">
              <Icon name="lock" size={24} stroke={1.8} />
              <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)', lineHeight: 1.45 }}>
                {phase === 'login' ? 'Chrome에 로그인 창을 열었어요.' : '주문내역 화면을 준비했어요.'}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, wordBreak: 'keep-all' }}>
                {phase === 'login' ? (
                  <>로그인하면 주문내역으로 자동 이동해요.</>
                ) : (
                  <>가져오기를 누르면 찾은 옷이<br />여기에 차례로 표시돼요.</>
                )}
              </div>
            </div>
          ) : (
            <div className="lb-order-wait">
              {err ? (
                <div style={{
                  fontSize: 13, fontWeight: 600, color: '#B0573C',
                  lineHeight: 1.45, wordBreak: 'keep-all', whiteSpace: 'pre-line',
                }}>
                  {err}
                </div>
              ) : (
                <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5, wordBreak: 'keep-all' }}>
                  {busy ? '로그인 화면을 열고 있어요.' : '로그인하면 주문내역으로 바로 이동해요.'}
                </div>
              )}
            </div>
          )}
          {!nativeWebview && !extensionMode ? (
            <div
              ref={hitRef}
              className="lb-order-webhit"
              tabIndex={0}
              contentEditable
              suppressContentEditableWarning
              onMouseDown={onHit}
              onKeyDown={onKey}
              onCompositionEnd={onCompEnd}
            />
          ) : null}
        </div>
      </div>
      {privacy}
    </div>
  );

  const loginCard = (
    <div
      className={`lb-order-card login${extensionMode ? ' extension' : ''}`}
      style={{ height: extensionMode ? 310 : (wide ? CARD_H : 'min(92dvh, 760px)') }}
    >
      <div className="lb-order-head">
        <button type="button" aria-label="닫기" onClick={close} style={iconHit}>
          <Icon name="x" size={20} stroke={2} />
        </button>
        <div className="lb-order-head-title">{platform.name}</div>
        <div style={{ width: 44 }} />
      </div>
      {webview}
      <div className="lb-order-foot">
        {phase === 'login' && live ? (
          <div style={{
            height: 52, display: 'grid', placeItems: 'center',
            fontSize: 13, fontWeight: 700, color: 'var(--ink-3)',
            wordBreak: 'keep-all', textAlign: 'center',
          }}>
            {extensionMode ? '열린 Chrome 창에서 로그인해 주세요' : '위 화면에서 로그인해 주세요'}
          </div>
        ) : phase === 'login' ? (
          <button
            type="button"
            onClick={begin}
            disabled={busy}
            className="lb-order-cta"
          >
            {busy ? '로그인 화면을 여는 중…' : (err ? '다시 열기' : '로그인 화면 열기')}
          </button>
        ) : trayOn ? (
          <div style={{
            height: 52, display: 'grid', placeItems: 'center',
            fontSize: 13, fontWeight: 700, color: 'var(--ink-3)',
          }}>
            {busy && !doneCollect ? '주문내역을 읽고 있어요' : '주문내역'}
          </div>
        ) : err && !found.length ? (
          <button
            type="button"
            onClick={begin}
            disabled={busy}
            className="lb-order-cta"
          >
            다시 가져오기
          </button>
        ) : (
          <button
            type="button"
            onClick={openTray}
            className="lb-order-cta"
          >
            주문내역 가져오기
          </button>
        )}
      </div>
    </div>
  );

  const statusLine = (() => {
    if (!doneCollect && busy) {
      return found.length
        ? `${found.length}개를 찾는 중… 먼저 담아도 돼요`
        : '주문내역에서 옷을 찾는 중…';
    }
    if (doneCollect && found.length) {
      return `${found.length}개를 불러왔어요. 담을 옷을 골라 주세요.`;
    }
    if (doneCollect && !found.length) {
      return err || '주문내역에서 옷을 찾지 못했어요.';
    }
    return '옷을 찾는 중…';
  })();

  const trayBody = (
    <>
      <div className="lb-order-head">
        {wide ? (
          <div style={{ width: 44 }} />
        ) : (
          <button
            type="button"
            aria-label="뒤로"
            onClick={() => setPhase('orders')}
            style={iconHit}
          >
            <Icon name="chevL" size={20} />
          </button>
        )}
        <div className="lb-order-head-title">불러온 옷</div>
        <button type="button" onClick={close} style={{ padding: '8px 12px', fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' }}>
          닫기
        </button>
      </div>
      <div className="lb-order-status">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {(!doneCollect && busy) ? <span className="lb-spin" style={{ width: 16, height: 16 }} /> : null}
          <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.4, wordBreak: 'keep-all' }}>
            {statusLine}
          </div>
        </div>
      </div>
      <div className="lb-scrollable lb-order-list">
        {found.map((it) => (
          <OrderItemRow
            key={it.url}
            it={it}
            onToggle={() => togglePick(it.url)}
          />
        ))}
        {(!doneCollect && busy) ? (
          <div className="lb-order-skel">
            <span className="lb-spin" />
            <span>다음 옷을 가져오는 중…</span>
          </div>
        ) : null}
      </div>
      <div className="lb-order-foot row">
        <button type="button" onClick={close} className="lb-order-cta ghost" style={{ flex: 1 }}>
          취소
        </button>
        {typeof onConfirm === 'function' ? (
          <button
            type="button"
            disabled={!picked.length || (busy && !found.length)}
            onClick={() => onConfirm(picked)}
            className="lb-order-cta"
            style={{ flex: 1.6 }}
          >
            {picked.length ? `${picked.length}개 담기` : '담을 옷 선택'}
          </button>
        ) : null}
      </div>
    </>
  );

  return (
    <div
      role="dialog"
      aria-label={`${platform.name} 구매내역`}
      className="lb-order-scrim"
      onClick={close}
    >
      <div
        className={`lb-order-pair${trayOn && wide ? ' split' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(!trayOn || (wide && !extensionMode)) ? loginCard : null}
        {trayOn ? (
          <div className="lb-order-card tray" style={{ height: wide ? CARD_H : 'min(92dvh, 760px)' }}>
            {trayBody}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OrderItemRow({ it, onToggle }) {
  const Icon = window.Icon;
  const dup = it.state === 'dup';
  return (
    <div className={`lb-order-row${it.pick && !dup ? ' on' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={dup}
        aria-label={it.pick ? '선택 해제' : '선택'}
        style={{
          width: 22, height: 22, borderRadius: 6, flex: 'none',
          display: 'grid', placeItems: 'center',
          background: it.pick ? 'var(--ink)' : 'transparent',
          boxShadow: it.pick ? 'none' : 'inset 0 0 0 1.5px var(--line-2)',
          color: 'var(--surface)',
          opacity: dup ? 0.4 : 1,
        }}
      >
        {it.pick ? <Icon name="check" size={12} stroke={2.6} /> : null}
      </button>
      <div className="lb-order-thumb">
        {it.thumb ? (
          <img src={it.thumb} alt="" />
        ) : (
          <Icon name="hanger" size={22} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 700, lineHeight: 1.35,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {it.name || '상품'}
        </div>
        <div style={{
          marginTop: 3, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.35,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {[it.store, it.price].filter(Boolean).join(' · ') || '상품 정보'}
        </div>
        {it.error ? (
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: '#B0573C', lineHeight: 1.35 }}>
            {it.error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const iconHit = {
  width: 44, height: 44, display: 'grid', placeItems: 'center',
  background: 'none', color: 'var(--ink)', flex: 'none',
};

window.LB_ORDER_IMPORT = { OrderImportSession };
export { OrderImportSession };
