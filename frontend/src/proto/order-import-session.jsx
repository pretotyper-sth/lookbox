/* 구매내역: 몰을 누르면 바로 쇼핑몰 화면. 아래 불러오기가 주문내역을 읽는다.
   zip·확장 설치 안내는 없다. 비밀번호는 받지 않는다. */
const React = window.React;
const { useState, useRef, useEffect } = React;

function OrderImportSession({
  open,
  platform,
  onClose,
  onConfirm,
  collectOrders,
}) {
  const Icon = window.Icon;
  const iframeRef = useRef(null);
  const [phase, setPhase] = useSess('browse'); // browse | scan
  const [guide, setGuide] = useSess(false);
  const [busy, setBusy] = useSess(false);
  const [progress, setProgress] = useSess(0);
  const [err, setErr] = useSess('');
  const [found, setFound] = useSess([]);
  const [frameOk, setFrameOk] = useSess(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current = false;
    setPhase('browse');
    setGuide(false);
    setBusy(false);
    setProgress(0);
    setErr('');
    setFound([]);
    setFrameOk(false);
    return () => { cancelRef.current = true; };
  }, [open, platform && platform.id]);

  if (!open || !platform) return null;

  const host = platform.host || '쇼핑몰';
  const picked = found.filter((x) => x.pick);
  const close = () => {
    cancelRef.current = true;
    onClose();
  };

  const goBack = () => {
    try { iframeRef.current.contentWindow.history.back(); } catch (e) { /* SOP */ }
  };
  const goForward = () => {
    try { iframeRef.current.contentWindow.history.forward(); } catch (e) { /* SOP */ }
  };
  const reload = () => {
    const el = iframeRef.current;
    if (!el) return;
    try { el.contentWindow.location.reload(); } catch (e) { el.src = platform.ordersUrl; }
  };

  const onImport = async () => {
    setErr('');
    setPhase('scan');
    setBusy(true);
    setProgress(8);
    setFound([]);
    try {
      const items = await collectOrders({
        platform,
        iframe: iframeRef.current,
        onProgress: (step) => {
          if (cancelRef.current) return;
          const key = (step && (step.key || step)) || '';
          const pct = key === 'open' ? 18 : key === 'need_login' ? 28 : key === 'collect' ? 62 : 40;
          setProgress((p) => Math.max(p, pct));
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
        setErr('이 화면에서 상품을 찾지 못했어요. 주문내역이 보이면 다시 불러오세요.');
        setBusy(false);
        setProgress(0);
        return;
      }
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
      if (msg === 'NEED_LOGIN' || /로그인/.test(msg)) {
        setPhase('browse');
        setErr('로그인한 뒤, 주문내역이 보이면 불러오기를 눌러 주세요.');
      } else if (msg === 'ORDER_READ_BLOCKED') {
        setErr('이 화면의 주문내역을 읽지 못했어요. 주문 목록이 보이는 상태에서 다시 눌러 주세요.');
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
            display: 'flex', alignItems: 'center', gap: 8,
            height: 48, padding: '0 8px 0 4px', flex: 'none',
            borderBottom: '1px solid var(--line)',
          }}>
            <button type="button" aria-label="닫기" onClick={close} style={iconHit}>
              <Icon name="x" size={20} stroke={2} />
            </button>
            <div style={{
              flex: 1, minWidth: 0, height: 32, borderRadius: 999,
              background: 'var(--surface-2)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 6, padding: '0 12px',
              fontSize: 13, fontWeight: 600, color: 'var(--ink-2)',
            }}>
              <Icon name="lock" size={12} stroke={2} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{host}</span>
            </div>
            <button type="button" onClick={() => setGuide((g) => !g)} style={{
              flex: 'none', padding: '8px 10px', fontSize: 13, fontWeight: 700, color: 'var(--ink-2)',
            }}>
              가이드
            </button>
          </div>

          {guide ? (
            <div style={{
              margin: '10px 18px 0', padding: '12px 14px', borderRadius: 'var(--r-md)',
              background: 'var(--ivory)', boxShadow: 'inset 0 0 0 1px var(--line)',
              fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)', wordBreak: 'keep-all',
            }}>
              {platform.name}에 로그인한 뒤, 주문내역이 보이면 아래 <b style={{ color: 'var(--ink)', fontWeight: 700 }}>불러오기</b>를 누르세요. 비밀번호는 받지 않아요.
            </div>
          ) : null}

          {err ? (
            <div style={{
              margin: '10px 18px 0', fontSize: 13, fontWeight: 600, color: '#B0573C',
              lineHeight: 1.4, wordBreak: 'keep-all',
            }}>
              {err}
            </div>
          ) : null}

          <div style={{ flex: 1, minHeight: 0, position: 'relative', background: 'var(--ivory)' }}>
            <iframe
              ref={iframeRef}
              title={`${platform.name} 주문내역`}
              src={platform.ordersUrl}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              onLoad={() => {
                try {
                  const doc = iframeRef.current && iframeRef.current.contentDocument;
                  setFrameOk(!!(doc && doc.body && (doc.body.childElementCount > 0 || (doc.body.innerText || '').length > 8)));
                } catch (e) {
                  setFrameOk(false);
                }
              }}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: '#fff',
                opacity: frameOk ? 1 : 0, pointerEvents: frameOk ? 'auto' : 'none',
              }}
            />
            {!frameOk ? (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', padding: '24px 28px', textAlign: 'center',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14, background: 'var(--ink)', color: '#fff',
                  display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 800, letterSpacing: '-0.04em',
                }}>
                  {(platform.name || '?').slice(0, 2)}
                </div>
                <div style={{ marginTop: 16, fontSize: 18, fontWeight: 800 }}>{platform.name}</div>
                <div style={{ marginTop: 8, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5, wordBreak: 'keep-all', maxWidth: 280 }}>
                  로그인하면 주문내역이 열려요. 아래 불러오기를 누르면 산 옷이 하나씩 보여요.
                </div>
              </div>
            ) : null}
          </div>

          <div style={{
            flex: 'none', display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px calc(10px + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid var(--line)', background: '#fff',
          }}>
            <button type="button" aria-label="뒤로" onClick={goBack} style={iconHit}><Icon name="chevL" size={20} /></button>
            <button type="button" aria-label="앞으로" onClick={goForward} style={iconHit}><Icon name="chevR" size={20} /></button>
            <button
              type="button"
              onClick={onImport}
              disabled={busy}
              style={{
                flex: 1, height: 48, borderRadius: 999, fontSize: 16, fontWeight: 800,
                background: 'var(--ink)', color: 'var(--surface)',
              }}
            >
              {busy ? '찾는 중…' : '불러오기'}
            </button>
            <button type="button" aria-label="새로고침" onClick={reload} style={iconHit}><Icon name="refresh" size={20} /></button>
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
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => setGuide((g) => !g)} style={{
              padding: '8px 10px', fontSize: 13, fontWeight: 700, color: 'var(--ink-2)',
            }}>가이드</button>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', padding: '0 18px 12px', gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: 'var(--ink)', color: '#fff',
              display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, letterSpacing: '-0.04em',
            }}>
              {(platform.name || '?').slice(0, 2)}
            </div>
            <div style={{ flex: 1, fontSize: 18, fontWeight: 800 }}>{platform.name}</div>
            <button type="button" onClick={close} style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' }}>취소</button>
          </div>

          <div className="lb-scrollable" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 18px 12px' }}>
            <div style={{
              borderRadius: 16, background: 'var(--surface-2)', padding: '16px 16px 14px',
            }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                {busy ? '구매 아이템 분석 중' : (found.length ? '아이템을 찾았어요' : '아이템을 찾는 중')}
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
                {err || '잠시 시간이 걸릴 수 있으니 이 화면을 열어 둔 채로 기다려 주세요'}
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
                  style={{
                    textAlign: 'left', background: 'transparent', padding: 0,
                  }}
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
                    {it.store || host}
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
              아이템 {picked.length}개 추가하기
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

function useSess(init) {
  return useState(init);
}

window.LB_ORDER_IMPORT = { OrderImportSession };
export { OrderImportSession };
