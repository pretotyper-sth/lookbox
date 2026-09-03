/* 구매내역 세션. 몰은 시트에서 고르고, 여기서는 로그인 → 불러오기만 한다.
   비밀번호는 받지 않는다. 웹뷰 뒤로/새로고침은 막을 수 없어서 넣지 않는다. */
const React = window.React;
const { useState, useEffect, useRef } = React;

function OrderImportSession({
  open,
  platform,
  onClose,
  onConfirm,
  collectOrders,
}) {
  const Icon = window.Icon;
  const [phase, setPhase] = useState('browse'); // browse | scan
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState('');
  const [found, setFound] = useState([]);
  const [loginWait, setLoginWait] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current = false;
    setPhase('browse');
    setBusy(false);
    setProgress(0);
    setErr('');
    setFound([]);
    setLoginWait(false);
    return () => { cancelRef.current = true; };
  }, [open, platform && platform.id]);

  if (!open || !platform) return null;

  const picked = found.filter((x) => x.pick);
  const close = () => {
    cancelRef.current = true;
    onClose();
  };

  const onImport = async () => {
    setErr('');
    setBusy(true);
    setFound([]);
    setProgress(0);
    setLoginWait(false);
    try {
      const items = await collectOrders({
        platform,
        onProgress: (step) => {
          if (cancelRef.current) return;
          const key = (step && (step.key || step)) || '';
          if (key === 'open' || key === 'need_login') setLoginWait(true);
          if (key === 'collect') {
            setLoginWait(false);
            setPhase('scan');
            setProgress((p) => Math.max(p, 40));
          }
        },
      });
      if (cancelRef.current) return;
      const rows = (items || []).map((it) => ({
        url: it.url,
        name: it.name || '',
        store: it.platform || it.store || platform.name,
        price: it.price || '',
        purchasedAt: it.purchasedAt || '',
        thumb: it.thumb || '',
        pick: true,
      }));
      if (!rows.length) {
        setPhase('browse');
        setErr('주문내역이 보이면 다시 불러오세요.');
        return;
      }
      setPhase('scan');
      for (let i = 0; i < rows.length; i++) {
        if (cancelRef.current) return;
        setFound((prev) => prev.concat([rows[i]]));
        setProgress(Math.min(96, 40 + Math.round(((i + 1) / rows.length) * 56)));
        await new Promise((r) => setTimeout(r, 70));
      }
      setProgress(100);
    } catch (e) {
      if (cancelRef.current) return;
      const msg = String((e && e.message) || '');
      setPhase('browse');
      if (msg === 'NEED_LOGIN' || /로그인/.test(msg)) {
        setErr('열린 창에서 로그인한 뒤 다시 불러오세요.');
      } else if (msg === 'ORDER_READ_BLOCKED') {
        setErr('주문내역이 보이는 창에서 다시 불러오세요.');
      } else {
        setErr(msg || '주문 내역을 가져오지 못했어요.');
      }
    } finally {
      if (!cancelRef.current) setBusy(false);
    }
  };

  const togglePick = (url) => {
    setFound((arr) => arr.map((x) => (x.url === url ? { ...x, pick: !x.pick } : x)));
  };

  return (
    <div
      role="dialog"
      aria-label={`${platform.name} 구매내역`}
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        display: 'flex', flexDirection: 'column',
        background: '#fff', color: 'var(--ink)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {phase === 'browse' ? (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', height: 48,
            padding: '0 8px 0 4px', flex: 'none',
          }}>
            <button type="button" aria-label="닫기" onClick={close} style={iconHit}>
              <Icon name="x" size={20} stroke={2} />
            </button>
          </div>
          <div style={{
            flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '24px 28px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>{platform.name}</div>
            <div style={{
              marginTop: 12, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5, wordBreak: 'keep-all',
            }}>
              <div>로그인하면 주문내역이 열려요.</div>
              <div>불러오면 산 옷이 하나씩 보여요.</div>
            </div>
            {err ? (
              <div style={{
                marginTop: 16, fontSize: 13, fontWeight: 600, color: '#B0573C',
                lineHeight: 1.4, wordBreak: 'keep-all',
              }}>
                {err}
              </div>
            ) : null}
          </div>
          <div style={{
            flex: 'none',
            padding: '10px 18px calc(10px + env(safe-area-inset-bottom, 0px))',
            background: '#fff',
          }}>
            <button
              type="button"
              onClick={onImport}
              disabled={busy}
              style={{
                width: '100%', height: 52, borderRadius: 999, fontSize: 16, fontWeight: 800,
                background: 'var(--ink)', color: 'var(--surface)',
              }}
            >
              {busy
                ? (loginWait ? '열린 창에서 로그인하세요' : '로그인 창을 여는 중…')
                : '불러오기'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', height: 48,
            padding: '0 8px 0 4px', flex: 'none',
          }}>
            <button type="button" aria-label="뒤로" onClick={() => { setPhase('browse'); setErr(''); }} style={iconHit}>
              <Icon name="chevL" size={20} />
            </button>
            <div style={{ flex: 1, fontSize: 16, fontWeight: 800, textAlign: 'center' }}>{platform.name}</div>
            <button type="button" onClick={close} style={{ padding: '8px 12px', fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' }}>취소</button>
          </div>

          <div className="lb-scrollable" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 18px 12px' }}>
            <div style={{
              borderRadius: 16, background: 'var(--surface-2)', padding: '16px 16px 14px',
            }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                {busy ? '아이템을 찾는 중' : (found.length ? '아이템을 찾았어요' : '아이템을 찾는 중')}
              </div>
              <div style={{
                marginTop: 12, height: 6, borderRadius: 999, background: 'var(--line-2)', overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.max(6, progress)}%`, height: '100%', background: 'var(--ink)',
                  transition: 'width 240ms var(--ease)',
                }} />
              </div>
              <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.4 }}>
                {err || '이 화면을 열어 둔 채로 기다려 주세요'}
              </div>
            </div>

            <div style={{
              marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
            }}>
              {found.map((it) => (
                <button
                  key={it.url}
                  type="button"
                  onClick={() => togglePick(it.url)}
                  style={{ textAlign: 'left', background: 'transparent', padding: 0 }}
                >
                  <div style={{
                    position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden',
                    background: 'var(--surface-2)',
                  }}>
                    {it.thumb ? (
                      <img src={it.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
                        <Icon name="hanger" size={28} />
                      </div>
                    )}
                    <span style={{
                      position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: 6,
                      display: 'grid', placeItems: 'center',
                      background: it.pick ? 'var(--ink)' : 'rgba(255,255,255,0.92)',
                      boxShadow: it.pick ? 'none' : 'inset 0 0 0 1.5px var(--line-2)',
                      color: 'var(--surface)',
                    }}>
                      {it.pick ? <Icon name="check" size={12} stroke={2.6} /> : null}
                    </span>
                  </div>
                  <div style={{
                    marginTop: 8, fontSize: 12.5, fontWeight: 700, lineHeight: 1.35,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {it.store || platform.name}
                  </div>
                  <div style={{
                    marginTop: 2, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.35,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {it.name || '상품'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={{
            flex: 'none', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 18px calc(10px + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid var(--line)', background: '#fff',
          }}>
            <button
              type="button"
              aria-label="목록 비우기"
              onClick={() => { setFound([]); setPhase('browse'); setErr(''); }}
              style={{ ...iconHit, width: 48, height: 48, borderRadius: 12, boxShadow: 'inset 0 0 0 1px var(--line)' }}
            >
              <Icon name="trash" size={18} />
            </button>
            <button
              type="button"
              disabled={!picked.length || busy}
              onClick={() => onConfirm(picked)}
              style={{
                flex: 1, height: 52, borderRadius: 14, fontSize: 16, fontWeight: 800,
                background: picked.length && !busy ? 'var(--ink)' : 'var(--line-2)',
                color: picked.length && !busy ? 'var(--surface)' : 'var(--ink-3)',
              }}
            >
              {picked.length}개 추가하기
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const iconHit = {
  width: 44, height: 44, display: 'grid', placeItems: 'center',
  background: 'none', color: 'var(--ink)', flex: 'none',
};

window.LB_ORDER_IMPORT = { OrderImportSession };
export { OrderImportSession };
