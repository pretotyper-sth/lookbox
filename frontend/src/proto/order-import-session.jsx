/* 구매내역 세션. 몰은 시트에서 고르고, 여기서는 웹뷰로 로그인한 뒤 옷을 하나씩 담는다.
   비밀번호는 받지 않는다. 쇼핑몰 창(네이티브 웹뷰·확장 탭·로컬 크롬)에서만 로그인한다. */
const React = window.React;
const { useState, useEffect, useRef } = React;

const CARD_H = 'min(640px, calc(100dvh - 48px))';

function barUrl(platform, phase) {
  const raw = phase === 'login'
    ? (platform.loginUrl || (`https://${platform.host}`))
    : (platform.ordersUrl || (`https://${platform.host}`));
  return String(raw).replace(/^https?:\/\//, '');
}

function OrderImportSession({
  open,
  platform,
  wide,
  onClose,
  onConfirm,
  onSaveOne,
  collectOrders,
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
  const [savingUrl, setSavingUrl] = useState('');
  const cancelRef = useRef(false);
  const startedRef = useRef(false);
  const collectRef = useRef(collectOrders);
  collectRef.current = collectOrders;
  const seenRef = useRef(new Set());
  const platformRef = useRef(platform);
  platformRef.current = platform;
  window.useEscapeClose(open, () => {
    cancelRef.current = true;
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

  const begin = async () => {
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
        onProgress: (step) => {
          if (cancelRef.current) return;
          const key = (step && (step.key || step)) || '';
          if (key === 'orders_ready' || key === 'collect') {
            setPhase((p) => (p === 'login' ? 'orders' : p));
          }
        },
        onItem: (it) => {
          if (cancelRef.current) return;
          setPhase((p) => (p === 'login' ? 'orders' : p));
          pushItem(it);
        },
      });
      if (cancelRef.current) return;
      (items || []).forEach(pushItem);
      setDoneCollect(true);
      setPhase((p) => (p === 'login' ? 'orders' : p));
      if (!(items && items.length) && !seenRef.current.size) {
        setErr('주문내역이 보이면 다시 불러오세요.');
      }
    } catch (e) {
      if (cancelRef.current) return;
      const msg = String((e && e.message) || '');
      if (msg === 'NEED_LOGIN' || /로그인/.test(msg)) {
        setErr('열린 창에서 로그인한 뒤 다시 눌러 주세요.');
        setPhase('login');
      } else if (msg === 'ORDER_READ_BLOCKED') {
        setErr('이 기기에서는 쇼핑몰 창을 열 수 없어요. 컴퓨터에서 다시 시도해 주세요.');
      } else {
        setErr(msg || '주문 내역을 가져오지 못했어요.');
      }
    } finally {
      if (!cancelRef.current) setBusy(false);
    }
  };

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      return undefined;
    }
    cancelRef.current = false;
    seenRef.current = new Set();
    setPhase('login');
    setBusy(false);
    setErr('');
    setFound([]);
    setDoneCollect(false);
    setSavingUrl('');
    if (startedRef.current) return undefined;
    startedRef.current = true;
    begin();
    return () => { cancelRef.current = true; };
  }, [open, platform && platform.id]);

  if (!open || !platform) return null;

  const picked = found.filter((x) => x.pick && x.state !== 'saved' && x.state !== 'dup');
  const savedN = found.filter((x) => x.state === 'saved').length;
  const close = () => {
    cancelRef.current = true;
    onClose();
  };

  const openTray = () => setPhase('tray');

  const togglePick = (url) => {
    setFound((arr) => arr.map((x) => (x.url === url ? { ...x, pick: !x.pick } : x)));
  };

  const saveOne = async (it) => {
    if (!onSaveOne || savingUrl || it.state === 'saved' || it.state === 'dup') return;
    setSavingUrl(it.url);
    setFound((arr) => arr.map((x) => (x.url === it.url ? { ...x, state: 'saving', error: '' } : x)));
    try {
      const res = await onSaveOne(it);
      if (cancelRef.current) return;
      if (res && res.status === 'dup') {
        setFound((arr) => arr.map((x) => (x.url === it.url
          ? { ...x, state: 'dup', pick: false, error: res.reason || '이미 옷장에 있어요' }
          : x)));
        return;
      }
      setFound((arr) => arr.map((x) => (x.url === it.url
        ? { ...x, state: 'saved', pick: false, error: '' }
        : x)));
    } catch (e) {
      if (cancelRef.current) return;
      setFound((arr) => arr.map((x) => (x.url === it.url
        ? { ...x, state: 'idle', error: (e && e.message) || '담지 못했어요' }
        : x)));
    } finally {
      if (!cancelRef.current) setSavingUrl('');
    }
  };

  const trayOn = phase === 'tray';
  const urlText = barUrl(platform, phase === 'login' ? 'login' : 'orders');

  const privacy = (
    <div className="lb-order-privacy">
      <Icon name="shield" size={13} stroke={2} />
      <span>로그인은 쇼핑몰에서만 이뤄져요. 아이디·비밀번호는 저장하지 않아요.</span>
    </div>
  );

  const webview = (
    <div className="lb-order-webview">
      <div className="lb-order-urlbar">
        <Icon name="lock" size={12} stroke={2.2} />
        <span>{urlText}</span>
      </div>
      <div className="lb-order-webbody">
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em' }}>{platform.name}</div>
          {err ? (
          <div style={{
            marginTop: 10, fontSize: 13, fontWeight: 600, color: '#B0573C',
            lineHeight: 1.4, wordBreak: 'keep-all',
          }}>
            {err}
          </div>
        ) : (
          <div style={{
            marginTop: 10, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5, wordBreak: 'keep-all',
          }}>
            {phase === 'login'
              ? (busy
                ? '로그인 화면을 열고 있어요. 열린 창에서 로그인해 주세요.'
                : '로그인하면 주문내역으로 바로 이동해요.')
              : '주문내역으로 이동했어요. 옷을 가져오려면 아래 버튼을 눌러 주세요.'}
          </div>
        )}
      </div>
      {privacy}
    </div>
  );

  const loginCard = (
    <div className="lb-order-card login" style={{ height: wide ? CARD_H : 'min(92dvh, 760px)' }}>
      <div className="lb-order-head">
        <button type="button" aria-label="닫기" onClick={close} style={iconHit}>
          <Icon name="x" size={20} stroke={2} />
        </button>
        <div className="lb-order-head-title">{platform.name}</div>
        <div style={{ width: 44 }} />
      </div>
      {webview}
      <div className="lb-order-foot">
        {phase === 'login' ? (
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
            locked={!!savingUrl}
            onToggle={() => togglePick(it.url)}
            onSave={() => saveOne(it)}
            canSave={typeof onSaveOne === 'function'}
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
        {picked.length && typeof onConfirm === 'function' ? (
          <button
            type="button"
            disabled={busy && !found.length}
            onClick={() => onConfirm(picked)}
            className="lb-order-cta ghost"
            style={{ flex: 'none', width: 'auto', padding: '0 16px' }}
          >
            {picked.length}개 확인
          </button>
        ) : null}
        <button
          type="button"
          onClick={close}
          className="lb-order-cta"
        >
          {savedN ? `${savedN}개 담고 완료` : '완료'}
        </button>
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
        {(!trayOn || wide) ? loginCard : null}
        {trayOn ? (
          <div className="lb-order-card tray" style={{ height: wide ? CARD_H : 'min(92dvh, 760px)' }}>
            {trayBody}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OrderItemRow({ it, onToggle, onSave, locked, canSave }) {
  const Icon = window.Icon;
  const saved = it.state === 'saved';
  const dup = it.state === 'dup';
  const saving = it.state === 'saving';
  return (
    <div className={`lb-order-row${it.pick && !saved && !dup ? ' on' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={saved || dup}
        aria-label={it.pick ? '선택 해제' : '선택'}
        style={{
          width: 22, height: 22, borderRadius: 6, flex: 'none',
          display: 'grid', placeItems: 'center',
          background: saved || it.pick ? 'var(--ink)' : 'transparent',
          boxShadow: saved || it.pick ? 'none' : 'inset 0 0 0 1.5px var(--line-2)',
          color: 'var(--surface)',
          opacity: dup ? 0.4 : 1,
        }}
      >
        {(saved || it.pick) ? <Icon name="check" size={12} stroke={2.6} /> : null}
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
        {saved ? (
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: 'var(--good)' }}>옷장에 담았어요</div>
        ) : null}
      </div>
      {canSave && !saved && !dup ? (
        <button
          type="button"
          disabled={locked || saving}
          onClick={onSave}
          className="lb-order-add"
        >
          {saving ? '담는 중…' : '담기'}
        </button>
      ) : null}
    </div>
  );
}

const iconHit = {
  width: 44, height: 44, display: 'grid', placeItems: 'center',
  background: 'none', color: 'var(--ink)', flex: 'none',
};

window.LB_ORDER_IMPORT = { OrderImportSession };
export { OrderImportSession };
