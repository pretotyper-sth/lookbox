/* @prototype-ported */
const React = window.React;
const { Badge, BottomSheet, Btn, CATEGORIES, Chip, EmptyState, Icon, IconBtn, LB_DATA, LabeledField, Skeleton, Thumb } = window;

/* global React, Thumb, Skeleton, Btn, Chip, Badge, IconBtn, Icon, BottomSheet, LB_DATA, EmptyState */
// LOOKBOX — screens A–E + layout chrome. Exported to window.

const { useState: useS, useEffect: useE, useRef: useR } = React;

/* ============================================================
   Layout chrome
   ============================================================ */
function Wordmark({ size = 19 }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, userSelect: 'none', height: 24 }}>
      <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-0.03em', color: 'var(--ink)', lineHeight: 1 }}>LOOK</span>
      <span style={{
        fontWeight: 800, fontSize: size - 2, letterSpacing: '-0.01em', lineHeight: 1,
        background: 'var(--accent)', color: 'var(--accent-ink)',
        padding: '3px 7px', borderRadius: 7,
      }}>BOX</span>
    </div>
  );
}

/** 탭 공통 좌측 타이틀 — Wordmark와 같은 시각 높이 */
function NavTitle({ children }) {
  return (
    <div style={{
      fontWeight: 800, fontSize: 19, letterSpacing: '-0.03em',
      lineHeight: 1, color: 'var(--ink)', height: 24,
      display: 'flex', alignItems: 'center',
    }}>{children}</div>
  );
}

function TopBar({ left, title, right, sticky = true, border = true }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--s2)',
      paddingTop: sticky ? 'calc(env(safe-area-inset-top, 0px) + 18px)' : 16,
      paddingBottom: 14,
      paddingLeft: 18,
      paddingRight: 18,
      minHeight: sticky ? 'calc(env(safe-area-inset-top, 0px) + 60px)' : 58,
      boxSizing: 'border-box',
      position: 'relative',
      flex: 'none',
      zIndex: 20,
      background: 'var(--ivory)',
      borderBottom: border ? '1px solid color-mix(in srgb, var(--line) 85%, transparent)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 44, minHeight: 32 }}>{left}</div>
      <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 44, minHeight: 32, gap: 4 }}>{right}</div>
    </div>
  );
}

function BottomNav({ tab, go }) {
  const tabs = [{ id: 'wardrobe', icon: 'hanger', label: '옷장' }, { id: 'today', icon: 'sparkle', label: '오늘 코디' }, { id: 'lookbook', icon: 'bookmark', label: '룩북' }, { id: 'mypage', icon: 'user', label: '마이' }];
  return (
    <nav style={{
      display: 'flex', borderTop: '1px solid var(--line)',
      background: 'color-mix(in srgb, var(--ivory) 92%, transparent)',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      paddingBottom: 'max(env(safe-area-inset-bottom), 6px)',
    }}>
      {tabs.map((tb) => {
        const on = tab === tb.id;
        return (
          <button key={tb.id} onClick={() => go(tb.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '9px 0 7px', color: on ? 'var(--ink)' : 'var(--ink-3)',
            transition: 'color var(--dur)',
          }}>
            <Icon name={tb.icon} size={23} fill={on ? 'currentColor' : 'none'} stroke={on ? 0 : 1.7} />
            <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>{tb.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* small label above a section */
function Eyebrow({ children }) {
  return <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{children}</div>;
}

/* ============================================================
   A · Wardrobe (home)
   ============================================================ */
function WardrobeScreen({ ctx }) {
  const {
    items, archived = [], openAdd, wide, openItem, requestRemove,
    bulkArchive, bulkRestore, bulkDelete,
    comboReady, comboGate, comboNeed, comboProgress, wardrobeLoading,
  } = ctx;
  const [cat, setCat] = useS('전체');
  const [sel, setSel] = useS([]); // multi-select ids
  const [selectMode, setSelectMode] = useS(false); // mobile: explicit select mode (no hover)
  const [hoverId, setHoverId] = useS(null);
  const [bulkDelAsk, setBulkDelAsk] = useS(false);
  const cats = LB_DATA.CATEGORIES;
  const viewingArchive = cat === '보관';
  // 보관 탭을 보던 중 보관함이 비면 전체로 되돌린다
  useE(() => { if (cat === '보관' && archived.length === 0) setCat('전체'); }, [archived.length, cat]);
  useE(() => { setSel([]); setSelectMode(false); setBulkDelAsk(false); }, [cat]);
  const filtered = viewingArchive ? archived : (cat === '전체' ? items : items.filter((i) => i.category === cat));
  const count = items.length;
  const ready = comboReady;
  const selCount = sel.length;
  const selecting = selCount > 0;
  const mobileSelect = !wide && selectMode;
  const inSelectUx = wide ? selecting : (selectMode || selecting);

  const toggleSel = (id) => setSel((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  const clearSel = () => { setSel([]); setBulkDelAsk(false); };
  const exitSelectMode = () => { clearSel(); setSelectMode(false); };
  const runBulkArchive = () => { if (viewingArchive) bulkRestore(sel); else bulkArchive(sel); exitSelectMode(); };
  const runBulkDelete = () => { bulkDelete(sel); exitSelectMode(); };

  /* ---- Empty state (소유·보관 모두 없을 때만; 최초 로딩 중엔 스켈레톤 우선) ---- */
  if (count === 0 && archived.length === 0 && !wardrobeLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!wide && <TopBar left={<Wordmark />} right={<IconBtn name="plus" label="아이템 추가" onClick={() => openAdd('wardrobe')} />} />}
        <EmptyState
          icon="hanger"
          iconSize={40}
          title="옷장에 옷을 담아보세요"
          wide={wide}
          padTop={false}
          action={<Btn full size="lg" icon="plus" onClick={() => openAdd('wardrobe')}>아이템 추가</Btn>}
          hint={<><Icon name="lock" size={14} /> 상의·하의를 담으면 조합 추천이 열려요</>}
        >
          가진 옷을 모아두면, 구매 전<br />어울리는 조합을 미리 확인할 수 있어요.
        </EmptyState>
      </div>
    );
  }

  /* ---- Partial / Full ---- */
  const chips = (
    <div style={{
      display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      overscrollBehaviorX: 'contain', minWidth: 0, width: '100%',
      padding: wide ? '0 0 30px' : '4px 18px 14px',
    }}>
      {cats.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
      {archived.length > 0 && (
        <>
          <span style={{ flex: 'none', width: 1, alignSelf: 'stretch', margin: '4px 2px', background: 'var(--line)' }} />
          <Chip key="보관" active={viewingArchive} onClick={() => setCat('보관')}>보관 {archived.length}</Chip>
        </>
      )}
    </div>
  );
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      {!wide && (
        <div style={{
          flex: 'none',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
          background: 'var(--ivory)',
          borderBottom: '1px solid color-mix(in srgb, var(--line) 85%, transparent)',
        }}>
          <TopBar
            sticky={false}
            border={false}
            left={<Wordmark />}
            right={(
              <>
                {(count > 0 || archived.length > 0) && (
                  <button
                    type="button"
                    onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                    style={{
                      fontSize: 13, fontWeight: 700, padding: '6px 8px',
                      color: selectMode ? 'var(--ink)' : 'var(--ink-2)',
                    }}
                  >
                    {selectMode ? '완료' : '선택'}
                  </button>
                )}
                {!selectMode && <IconBtn name="plus" label="아이템 추가" onClick={() => openAdd('wardrobe')} />}
              </>
            )}
          />
          {chips}
        </div>
      )}

      <div style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: wide ? '28px 0 36px' : '16px 18px',
        paddingBottom: selecting ? (!wide ? 96 : 88) : (!wide ? 110 : undefined),
      }}>
       <div className={wide ? 'lb-wide-inner' : ''}>
        {wide && (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
            <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800 }}>{viewingArchive ? '보관함' : '옷장'}</h1>
            <span style={{ fontSize: 13.5, color: 'var(--ink-3)', fontWeight: 600 }}>{(viewingArchive ? archived.length : count)}개</span>
          </div>
        )}
        {wide && chips}
        {!viewingArchive && !ready && !wardrobeLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)', padding: 'var(--s4)', background: 'var(--surface)', borderRadius: 'var(--r-md)', marginBottom: 'var(--s4)' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--ivory)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flex: 'none' }}>
              <Icon name="lock" size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{comboNeed}를 추가로 담으면 코디 조합을 추천받을 수 있어요</div>
              <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i < comboProgress ? 'var(--accent)' : 'var(--line-2)' }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {viewingArchive && (
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
            보관한 옷은 조합 추천에 쓰이지 않아요. 카드의 <b style={{ color: 'var(--ink-2)', fontWeight: 700 }}>···</b>에서 다시 꺼내거나 삭제할 수 있어요.
          </p>
        )}

        {mobileSelect && !selecting && (
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>
            옷을 눌러 여러 개를 선택한 뒤 보관·삭제할 수 있어요.
          </p>
        )}

        <div className="lb-grid">
          {!viewingArchive && !mobileSelect && (
          <button onClick={() => openAdd('wardrobe')} className="lb-addtile" style={{
            position: 'relative', display: 'block', width: '100%', textAlign: 'center',
            borderRadius: 'var(--r-md)', color: 'var(--ink-3)',
            boxShadow: 'inset 0 0 0 1.5px var(--line)', background: 'transparent',
          }}>
            {/* invisible skeleton mirrors a garment card (square + 2 text lines) so the
                dashed box height matches the whole card, not just the thumbnail */}
            <div aria-hidden="true" style={{ visibility: 'hidden' }}>
              <div style={{ aspectRatio: '1 / 1' }}></div>
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, height: '1.3em' }}>옷</div>
                <div style={{ fontSize: 11, marginTop: 2, lineHeight: 1.3 }}>옷</div>
              </div>
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="plus" size={26} /><span style={{ fontSize: 12.5, fontWeight: 600 }}>아이템 추가</span>
            </div>
          </button>
          )}
          {wardrobeLoading && !viewingArchive && filtered.length === 0 && [0, 1, 2].map((i) => (
            <div key={'sk' + i} aria-hidden="true">
              <div className="lb-skel" style={{ aspectRatio: '1 / 1', borderRadius: 'var(--r-md)' }} />
              <div className="lb-skel" style={{ height: 12, marginTop: 8, borderRadius: 6, width: '80%' }} />
              <div className="lb-skel" style={{ height: 10, marginTop: 6, borderRadius: 6, width: '55%' }} />
            </div>
          ))}
          {filtered.map((it) => {
            const on = sel.includes(it.id);
            const showSel = wide
              ? (on || selecting || hoverId === it.id)
              : (selectMode || on);
            const onCardTap = () => {
              if (!wide && (selectMode || selecting)) toggleSel(it.id);
              else openItem(it);
            };
            return (
            <div
              key={it.id}
              style={{ position: 'relative', minWidth: 0 }}
              onMouseEnter={() => wide && setHoverId(it.id)}
              onMouseLeave={() => wide && setHoverId((h) => (h === it.id ? null : h))}
            >
              <div style={{ position: 'relative' }}>
                <button onClick={onCardTap} className="lb-itembtn" style={{ display: 'block', width: '100%', textAlign: 'left', padding: 0 }}>
                  <Thumb item={it} />
                </button>
                {(wide || selectMode || on) && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (!wide && !selectMode) setSelectMode(true); toggleSel(it.id); }}
                    aria-label={on ? '선택 해제' : '선택'}
                    aria-pressed={on}
                    style={{
                      position: 'absolute', left: 5, top: 5, width: 18, height: 18, borderRadius: '50%',
                      display: 'grid', placeItems: 'center', zIndex: 3,
                      opacity: showSel ? 1 : 0,
                      pointerEvents: showSel ? 'auto' : 'none',
                      background: on ? 'var(--accent)' : 'color-mix(in srgb, var(--surface-2) 90%, transparent)',
                      color: on ? 'var(--accent-ink)' : 'transparent',
                      boxShadow: on ? 'none' : 'inset 0 0 0 1.5px var(--line-2)',
                      backdropFilter: 'blur(6px)',
                      transition: 'opacity var(--dur) var(--ease), background var(--dur) var(--ease)',
                    }}
                  >
                    {on && <Icon name="check" size={10} stroke={2.6} />}
                  </button>
                )}
                {!inSelectUx && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); requestRemove(it); }}
                  aria-label={it.name + ' 더보기'}
                  style={{
                    position: 'absolute', right: 4, top: 4, width: 24, height: 20, borderRadius: 6,
                    display: 'grid', placeItems: 'center', color: 'var(--ink)', zIndex: 2,
                    background: 'transparent',
                  }}
                >
                  <Icon name="more" size={15} stroke={2.8} />
                </button>
                )}
              </div>
              <button onClick={onCardTap} className="lb-itembtn" style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 6 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 600, lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{it.name}</div>
                <div style={{
                  fontSize: 11, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{[it.brand, it.category, it.color].filter(Boolean).join(' · ')}</div>
              </button>
            </div>
            );
          })}
        </div>
       </div>
      </div>

      {/* 선택 시 하단 플로팅 메뉴 */}
      {selecting && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: wide ? 22 : 12, zIndex: 30,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
          padding: wide ? '0 24px' : '0 14px',
        }}>
          <div style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            maxWidth: '100%',
            padding: '10px 22px',
            borderRadius: 'var(--r-pill)',
            background: 'color-mix(in srgb, var(--surface) 94%, transparent)',
            boxShadow: '0 10px 32px -10px color-mix(in srgb, var(--ink) 28%, transparent), inset 0 0 0 1px var(--line)',
            backdropFilter: 'blur(10px)',
          }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }} className="tnum">{selCount}개 선택됨</span>
            <button onClick={clearSel} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', padding: '4px 2px' }}>선택 해제</button>
            <Btn size="sm" variant="soft" icon={viewingArchive ? 'hanger' : 'archive'} onClick={runBulkArchive}
              style={{ fontSize: 12, padding: '7px 12px' }}>
              {viewingArchive ? '옷장으로' : '보관'}
            </Btn>
            <Btn size="sm" icon="trash" onClick={() => setBulkDelAsk(true)}
              style={{ background: '#B0573C', color: '#fff', fontSize: 12, padding: '7px 12px' }}>삭제</Btn>
          </div>
        </div>
      )}

      <BottomSheet open={bulkDelAsk} onClose={() => setBulkDelAsk(false)}>
        <div style={{ padding: '10px 24px 26px', textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>선택한 {selCount}개를 삭제할까요?</h3>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
            완전히 지워지고 <b style={{ color: 'var(--ink)', fontWeight: 700 }}>되돌릴 수 없어요.</b>
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <Btn variant="soft" onClick={() => setBulkDelAsk(false)} style={{ flex: 1 }}>취소</Btn>
            <Btn icon="trash" onClick={runBulkDelete} style={{ flex: 1, background: '#B0573C', color: '#fff' }}>삭제</Btn>
          </div>
        </div>
      </BottomSheet>

      {!wide && !selectMode && !selecting && (
        <div className="lb-cta-dock">
          <Btn full size="lg" icon="sparkle" variant={comboReady ? 'primary' : 'soft'} style={comboReady ? undefined : { opacity: 0.6 }} onClick={comboGate}>구매 전 조합 추천받기</Btn>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   B · Add sheet — staged flow
   wardrobe:  input → analyzing → select → register (sequential)
   anchor:    input → analyzing → anchor-ready → combo recommend
   ============================================================ */

/* progress dots for the sequential register stepper */
function StepDots({ total, idx }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          height: 4, borderRadius: 999,
          width: i === idx ? 22 : 8,
          background: i <= idx ? 'var(--accent)' : 'var(--line-2)',
          transition: 'all var(--dur) var(--ease)',
        }} />
      ))}
    </div>
  );
}

/* one selectable detected garment in the select stage */
function DetectRow({ item, on, onToggle }) {
  return (
    <button onClick={onToggle} className="lb-detrow" style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--s3)',
      padding: 'var(--s3)', textAlign: 'left', borderRadius: 'var(--r-md)',
      background: on ? 'var(--surface-2)' : 'var(--ivory)',
      boxShadow: on ? 'inset 0 0 0 1.5px var(--accent)' : 'inset 0 0 0 1px var(--line)',
    }}>
      <div style={{ width: 54, flex: 'none' }}><Thumb item={item} radius="var(--r-sm)" /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, textWrap: 'pretty' }}>{item.name}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{item.category}</span>· {item.color}
          <span style={{ color: 'var(--ink-3)' }}>· 일치 {Math.round(item.conf * 100)}%</span>
        </div>
      </div>
      <span style={{
        width: 24, height: 24, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center',
        background: on ? 'var(--accent)' : 'transparent', color: 'var(--accent-ink)',
        boxShadow: on ? 'none' : 'inset 0 0 0 1.6px var(--line-2)',
        transition: 'all var(--dur) var(--ease)',
      }}>
        {on && <Icon name="check" size={14} stroke={2.6} />}
      </span>
    </button>
  );
}

const URL_IMPORT_BLOCKED_MSG = '이미지 불러오기가 제한되는 URL이에요. 사진으로 추가해 주세요.';
const URL_IMPORT_BLOCKED_HOST = /(^|\.)(coupang\.com|smartstore\.naver\.com|brand\.naver\.com|shopping\.naver\.com|11st\.co\.kr|gmarket\.co\.kr|auction\.co\.kr|ssg\.com|kurly\.com|wemakeprice\.com|tmon\.co\.kr)$/i;

function urlImportBlockedHint(raw) {
  try {
    const href = /^https?:\/\//i.test(raw) ? raw : ('https://' + String(raw || '').replace(/^\/+/, ''));
    const host = new URL(href).hostname.replace(/^www\./i, '');
    if (URL_IMPORT_BLOCKED_HOST.test(host)) return URL_IMPORT_BLOCKED_MSG;
  } catch (e) { /* noop */ }
  return null;
}

function AddSheet({ ctx }) {
  const {
    addSheet, closeAdd, confirmAdd, addItemsBatch, liveImportSource, discardLiveItems,
    autoAddDetails, detectCount, liveReplaceItemImage, applyReextractItem,
  } = ctx;
  const mode = addSheet.mode; // 'wardrobe' | 'anchor' | 'reextract'
  const anchor = mode === 'anchor';
  const reextract = mode === 'reextract';
  const replaceItem = addSheet.replaceItem || null;
  const CATS = LB_DATA.CATEGORIES.filter((c) => c !== '전체');
  const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0);

  // input
  const [tab, setTab] = useS('photo');
  const [picked, setPicked] = useS(false);
  const [url, setUrl] = useS('');
  const [file, setFile] = useS(null);
  const [previewUrl, setPreviewUrl] = useS('');
  const [hint, setHint] = useS('');
  const [showHint, setShowHint] = useS(false);
  const [busy, setBusy] = useS(false);
  const [err, setErr] = useS('');
  const fileInput = useR(null);
  const previewUrlRef = useR('');

  const setPreviewFromFile = (f) => {
    if (previewUrlRef.current) {
      try { URL.revokeObjectURL(previewUrlRef.current); } catch (e) { /* ignore */ }
      previewUrlRef.current = '';
    }
    if (!f) {
      setPreviewUrl('');
      return;
    }
    const next = URL.createObjectURL(f);
    previewUrlRef.current = next;
    setPreviewUrl(next);
  };

  // stage machine
  const [stage, setStage] = useS('input'); // input | analyzing | select | register | anchor-ready
  const [detected, setDetected] = useS([]);
  const [sel, setSel] = useS([]); // selected detected ids
  const [steps, setSteps] = useS([]); // ordered queue for sequential register
  const [stepIdx, setStepIdx] = useS(0);

  // 닫기/ESC 시 진행 중 인식·draft를 폐기하기 위한 세션 플래그
  const cancelledRef = useR(false);
  const draftIdsRef = useR([]);
  const detectedRef = useR([]);
  const stepsRef = useR([]);
  detectedRef.current = detected;
  stepsRef.current = steps;

  const resetLocalDraft = () => {
    setPreviewFromFile(null);
    setTab('photo'); setPicked(false); setUrl(''); setFile(null); setHint(''); setShowHint(false);
    setBusy(false); setErr('');
    setStage('input'); setDetected([]); setSel([]); setSteps([]); setStepIdx(0);
    draftIdsRef.current = [];
  };

  const discardDraftIds = (ids) => {
    const clean = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!clean.length || typeof discardLiveItems !== 'function') return;
    discardLiveItems(clean);
  };

  const requestClose = () => {
    cancelledRef.current = true;
    const ids = [
      ...draftIdsRef.current,
      ...detectedRef.current.map((d) => d && d.id),
      ...stepsRef.current.map((s) => s && s.id),
    ];
    discardDraftIds(ids);
    resetLocalDraft();
    closeAdd();
  };

  useE(() => {
    if (!addSheet.open) return;
    cancelledRef.current = false;
    resetLocalDraft();
  }, [addSheet.open, addSheet.mode, addSheet.replaceItem && addSheet.replaceItem.id]);

  // ---- detection: API "separates" one source image into N garments ----
  const runDetect = async (source = {}) => {
    cancelledRef.current = false;
    draftIdsRef.current = [];
    setErr('');
    setBusy(true);
    setStage('analyzing');
    try {
      // 이미지만 변경: 새 소스 → 기존 아이템 이미지 교체 (메타 유지)
      if (reextract && replaceItem) {
        const itemId = replaceItem.serverId || replaceItem.id;
        const next = await liveReplaceItemImage({
          itemId,
          sourceType: source.sourceType || tab,
          file: source.file || file,
          url: source.url != null ? source.url : url,
          extractHint: source.extractHint != null ? source.extractHint : hint,
        });
        if (cancelledRef.current) return;
        if (!next) throw new Error('이미지를 바꾸지 못했어요');
        applyReextractItem(next);
        closeAdd();
        return;
      }
      const data = await liveImportSource({
        sourceType: source.sourceType || tab,
        file: source.file || file,
        url: source.url != null ? source.url : url,
        status: anchor ? 'considering' : 'pending',
        extractHint: source.extractHint != null ? source.extractHint : hint,
      });
      const list = (data.items || []).slice(0, detectCount).map((d, i) => ({ ...d, id: d.id || 'det' + i, cat: d.category, conf: d.conf || 0.95 }));
      const ids = list.map((d) => d.id).filter(Boolean);
      draftIdsRef.current = ids;
      if (cancelledRef.current) {
        discardDraftIds(ids);
        draftIdsRef.current = [];
        return;
      }
      if (!list.length) throw new Error('사진에서 옷을 찾지 못했어요');
      setDetected(list);
      const primaryIdx = Math.min(data.primary_idx || 0, list.length - 1);
      const primary = list[primaryIdx] || list[0];
      setSel([primary.id]);
      if (anchor) {
        // 고민 중인 옷: 인식 결과 미리보기 → 조합 추천
        setStage('anchor-ready');
        return;
      }
      setStage(() => {
        if (list.length === 1) {
          setSteps(list.map((d) => ({ ...d, cat: d.category, draft: { brand: d.brand || '', size: '', color: d.color || '', store: d.store || '', note: '' }, showDetails: !!autoAddDetails || !!d.brand || !!d.store || !!d.color })));
          setStepIdx(0);
          return 'register';
        }
        return 'select';
      });
    } catch (e) {
      if (cancelledRef.current) return;
      setErr(e.message || 'AI 분석에 실패했어요');
      setPicked(false);
      setStage('input');
    } finally {
      if (!cancelledRef.current) setBusy(false);
    }
  };
  const onPickPhoto = () => { if (fileInput.current) fileInput.current.click(); };
  const onFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
    setPicked(true);
    setPreviewFromFile(f);
    setErr('');
    // 같은 파일을 다시 고를 수 있게 초기화
    e.target.value = '';
  };
  const clearPhoto = () => {
    setFile(null);
    setPicked(false);
    setPreviewFromFile(null);
    setErr('');
  };
  const canSubmit = tab === 'photo' ? !!file : !!url.trim();
  const onSubmitAdd = async () => {
    setErr('');
    if (tab === 'photo') {
      if (!file) { setErr('사진을 먼저 넣어 주세요'); return; }
      await runDetect({ sourceType: 'photo', file, extractHint: hint });
      return;
    }
    const raw = url.trim();
    if (!raw) { setErr('상품 URL을 입력해 주세요'); return; }
    const blocked = urlImportBlockedHint(raw);
    if (blocked) {
      setErr(blocked);
      return;
    }
    const normalized = /^https?:\/\//i.test(raw) ? raw : ('https://' + raw.replace(/^\/+/, ''));
    if (normalized !== raw) setUrl(normalized);
    await runDetect({ sourceType: 'url', url: normalized, extractHint: hint });
  };

  // ---- clipboard paste (PC: Ctrl/⌘+V, 모바일: 꾹 눌러 붙여넣기) ----
  // runDetect가 매 렌더 새로 만들어지므로 최신 참조를 ref로 유지한다.
  const runDetectRef = useR(runDetect);
  runDetectRef.current = runDetect;
  const handlePasteImage = (e) => {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it && it.kind === 'file' && it.type && it.type.indexOf('image') === 0) {
        const f = it.getAsFile();
        if (f) {
          e.preventDefault();
          setTab('photo');
          setFile(f);
          setPicked(true);
          setPreviewFromFile(f);
          setErr('');
          return true;
        }
      }
    }
    return false;
  };
  // 시트가 열려 input 단계일 때만 문서 전역 붙여넣기를 가로챈다.
  useE(() => {
    if (!addSheet.open || stage !== 'input') return undefined;
    const onDocPaste = (e) => { handlePasteImage(e); };
    document.addEventListener('paste', onDocPaste);
    return () => document.removeEventListener('paste', onDocPaste);
  }, [addSheet.open, stage]);

  const anchorPrimary = detected.find((d) => sel.includes(d.id)) || detected[0] || null;

  // ---- select ----
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allOn = detected.length > 0 && sel.length === detected.length;
  const startRegister = () => {
    const q = detected.filter((d) => sel.includes(d.id));
    setSteps(q.map((d) => ({ ...d, cat: d.category, draft: { brand: d.brand || '', size: '', color: d.color || '', store: d.store || '', note: '' }, showDetails: !!autoAddDetails || !!d.brand || !!d.store || !!d.color })));
    setStepIdx(0);
    setStage('register');
  };

  // ---- register (sequential) ----
  const cur = steps[stepIdx] || null;
  const patchStep = (patch) => setSteps((arr) => arr.map((x, i) => (i === stepIdx ? { ...x, ...patch } : x)));
  const setStepDraft = (k) => (v) => setSteps((arr) => arr.map((x, i) => (i === stepIdx ? { ...x, draft: { ...x.draft, [k]: v } } : x)));
  const toItem = (s) => {
    const clean = Object.fromEntries(Object.entries(s.draft || {}).filter(([, v]) => v && String(v).trim()));
    const cat = s.cat || s.category || '상의';
    return {
      ...s,
      name: (s.name || '').trim() || (cat + ' 아이템'),
      category: cat,
      cat,
      color: (clean.color || s.color || '').trim() || '뉴트럴',
      img: s.img || null,
      brand: clean.brand || s.brand || '',
      size: clean.size || s.size || '',
      store: clean.store || s.store || '',
      note: clean.note || s.note || '',
    };
  };
  const advance = (keep) => {
    const updated = steps.map((x, i) => (i === stepIdx ? { ...x, added: keep } : x));
    setSteps(updated);
    if (stepIdx >= steps.length - 1) {
      const kept = updated.filter((s) => s.added).map(toItem);
      const skipped = detected.filter((d) => !updated.some((s) => s.id === d.id && s.added)).map((d) => d.id);
      draftIdsRef.current = [];
      addItemsBatch(kept, skipped);
    } else setStepIdx(stepIdx + 1);
  };
  const doneCount = steps.filter((s) => s.added).length;

  const goBack = () => {
    if (stage === 'select' || stage === 'anchor-ready') {
      discardDraftIds(detected.map((d) => d && d.id));
      draftIdsRef.current = [];
      setStage('input'); setDetected([]); setSel([]);
    } else if (stage === 'register') {
      if (stepIdx > 0) setStepIdx(stepIdx - 1); else setStage('select');
    }
  };

  // ---- header copy ----
  let header, sub;
  if (stage === 'select') { header = '담을 아이템을 골라주세요'; sub = `사진에서 ${detected.length}개를 찾았어요 · 고른 아이템을 하나씩 담아요`; }
  else if (stage === 'register') { header = null; sub = null; }
  else if (stage === 'analyzing') {
    header = reextract ? '이미지만 변경' : (anchor ? '고민 중인 옷 추가' : '옷장에 아이템 추가');
    sub = reextract ? '제품 컷을 만들고 있어요' : '아이템을 인식하고 있어요';
  }
  else if (stage === 'anchor-ready') { header = '고민 중인 옷 추가'; sub = '이 옷이 내 옷장 옷들과 어울리는지 확인해볼게요.'; }
  else if (reextract) {
    header = '이미지만 변경';
    sub = replaceItem
      ? `"${replaceItem.name || '이 옷'}"의 이름·색상은 그대로 두고 제품 컷만 바꿔요.`
      : '이름·색상은 그대로 두고 제품 컷만 바꿔요.';
  }
  else { header = anchor ? '고민 중인 옷 추가' : '옷장에 아이템 추가'; sub = anchor ? '이 옷이 내 옷장 옷들과 어울리는지 확인해볼게요.' : '사진 한 장 속 여러 개를 자동으로 분리해 드려요.'; }

  const showBack = stage === 'select' || stage === 'register' || stage === 'anchor-ready';

  return (
    <BottomSheet open={addSheet.open} onClose={requestClose}>
      <div className="lb-sheet-body" style={{ padding: '10px 24px 26px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {showBack && <IconBtn name="chevL" label="뒤로" onClick={goBack} style={{ marginLeft: -8, marginTop: -4, flex: 'none' }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            {stage === 'register' ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StepDots total={steps.length} idx={stepIdx} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }} className="tnum">{stepIdx + 1} / {steps.length}</span>
                </div>
                <h2 style={{ margin: '12px 0 0', fontSize: 19, fontWeight: 700 }}>옷장에 담기</h2>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.45 }}>
                  {doneCount > 0 ? `지금까지 ${doneCount}개 담음 · ` : ''}내용을 확인하고 하나씩 담아요.
                </p>
              </div>
            ) : (
              <div>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{header}</h2>
                <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>{sub}</p>
              </div>
            )}
          </div>
          <IconBtn name="x" label="닫기" onClick={requestClose} style={{ marginRight: -8, flex: 'none' }} />
        </div>

        {/* ---------- INPUT ---------- */}
        {stage === 'input' && (
          <>
            <div style={{ display: 'flex', gap: 4, background: 'var(--ivory)', borderRadius: 'var(--r-pill)', padding: 4, marginTop: 'var(--s5)' }}>
              {[['photo', '사진', 'camera'], ['url', 'URL', 'link']].map(([id, label, ic]) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '11px 0', borderRadius: 'var(--r-pill)', fontSize: 14, fontWeight: 600,
                  background: tab === id ? 'var(--surface-2)' : 'transparent',
                  color: tab === id ? 'var(--ink)' : 'var(--ink-3)',
                  boxShadow: tab === id ? '0 1px 3px rgba(40,36,28,0.10)' : 'none',
                  transition: 'all var(--dur) var(--ease)',
                }}>
                  <Icon name={ic} size={17} />{label}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 'var(--s5)' }}>
              {tab === 'photo' ? (
                <>
                  <input ref={fileInput} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
                  {picked && previewUrl ? (
                    <div style={{
                      position: 'relative', width: '100%', borderRadius: 'var(--r-md)', overflow: 'hidden',
                      background: 'var(--thumb-bg)', boxShadow: 'inset 0 0 0 1px var(--line)',
                      aspectRatio: '1 / 1', display: 'grid', placeItems: 'center',
                    }}>
                      <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '6%' }} />
                      <button
                        type="button"
                        onClick={clearPhoto}
                        aria-label="사진 지우기"
                        className="lb-iconbtn"
                        style={{
                          position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: '50%',
                          background: 'color-mix(in srgb, var(--surface) 88%, transparent)', color: 'var(--ink-2)',
                          display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px var(--line)',
                        }}
                      >
                        <Icon name="x" size={18} />
                      </button>
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      contentEditable
                      suppressContentEditableWarning
                      inputMode="none"
                      onClick={onPickPhoto}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickPhoto(); } }}
                      onInput={(e) => { e.currentTarget.textContent = ''; }}
                      onCut={(e) => e.preventDefault()}
                      className="lb-drop" style={{
                        width: '100%', padding: '34px 0', borderRadius: 'var(--r-md)', background: 'var(--ivory)',
                        border: '1.5px dashed var(--line-2)', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 10, color: 'var(--ink-2)', cursor: 'pointer',
                        caretColor: 'transparent', outline: 'none',
                      }}>
                      <div contentEditable={false} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
                        <Icon name="camera" size={30} stroke={1.5} />
                        <span style={{ fontSize: 14, fontWeight: 600 }}>사진 업로드</span>
                        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                          {isTouch ? '탭하여 선택 · 꾹 눌러 붙여넣기' : '탭하여 선택 · Ctrl/⌘+V로 붙여넣기'}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <input
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setErr(''); }}
                  placeholder="상품 URL 붙여넣기"
                  className="lb-input"
                  style={{
                    width: '100%', padding: '13px 16px', borderRadius: 'var(--r-md)', fontSize: 14,
                    background: 'var(--ivory)', border: '1px solid var(--line)', color: 'var(--ink)', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              )}

              <button
                type="button"
                onClick={() => setShowHint((v) => !v)}
                style={{
                  marginTop: 'var(--s4)', display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', padding: '4px 2px',
                }}
              >
                <Icon name="plus" size={15} /> 추출 힌트 추가
                <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>선택</span>
                <span style={{ color: 'var(--ink-3)', transform: showHint ? 'rotate(-90deg)' : 'rotate(90deg)', display: 'inline-flex' }}>
                  <Icon name="chevL" size={14} />
                </span>
              </button>
              {showHint && (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    className="lb-input"
                    rows={2}
                    value={hint}
                    onChange={(e) => setHint(e.target.value)}
                    placeholder={'예) 이 이미지에서 가방만 추출해줘'}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 'var(--r-md)', fontSize: 14,
                      background: 'var(--ivory)', border: '1px solid var(--line)', color: 'var(--ink)',
                      outline: 'none', resize: 'none', lineHeight: 1.45, boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4 }}>
                    여러 아이템이 한 장에 있을 때 원하는 것만 지정할 수 있어요.
                  </div>
                </div>
              )}

              <div style={{ marginTop: 'var(--s5)' }}>
                <Btn full size="lg" icon="sparkle" onClick={onSubmitAdd} disabled={!canSubmit || busy}>
                  {busy ? '인식 중…' : (reextract ? '이미지 변경' : '추가하기')}
                </Btn>
              </div>
            </div>

            {!anchor && !reextract && (
              <div style={{ marginTop: 'var(--s4)', display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--ink-3)', fontSize: 12.5 }}>
                <Icon name="sparkle" size={15} /> 사진 속 상의·하의·신발까지 따로따로 찾아드려요
              </div>
            )}
            {reextract && (
              <div style={{ marginTop: 'var(--s4)', display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--ink-3)', fontSize: 12.5 }}>
                <Icon name="sparkle" size={15} /> 새 사진·URL로 추출해도 상세 정보는 유지돼요
              </div>
            )}

            {err && (
              <div style={{
                marginTop: 'var(--s3)', color: '#B91C1C', fontSize: 13, fontWeight: 600,
                lineHeight: 1.45, textWrap: 'pretty',
              }}>{err}</div>
            )}
          </>
        )}

        {/* ---------- ANALYZING ---------- */}
        {/* skeleton mirrors the DetectRow result cards (same 54px thumb + 2 text
            lines + check slot) so the loading state previews what's coming */}
        {stage === 'analyzing' && (
          <div style={{ marginTop: 'var(--s6)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="lb-scan" style={{ width: '100%', borderRadius: 'var(--r-md)' }}>
              <div className="lb-detect-in" style={{
                display: 'flex', alignItems: 'center', gap: 'var(--s3)',
                padding: 'var(--s3)', borderRadius: 'var(--r-md)', background: 'var(--ivory)',
                boxShadow: 'inset 0 0 0 1px var(--line)',
              }}>
                <div className="lb-skel" style={{ width: 54, height: 54, flex: 'none', borderRadius: 'var(--r-sm)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="lb-skel" style={{ height: 13, borderRadius: 999, width: '62%' }} />
                  <div className="lb-skel" style={{ height: 11, borderRadius: 999, width: '40%', marginTop: 8 }} />
                </div>
                <div className="lb-skel" style={{ width: 24, height: 24, flex: 'none', borderRadius: '50%' }} />
              </div>
            </div>
            <div style={{ marginTop: 'var(--s5)', fontSize: 15, fontWeight: 700 }}>옷을 인식하고 있어요</div>
            <div style={{
              marginTop: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink-3)',
              textAlign: 'center', letterSpacing: '-0.01em',
            }}>
              최대 2분 소요
            </div>
          </div>
        )}

        {/* ---------- ANCHOR READY (recognized preview) ---------- */}
        {stage === 'anchor-ready' && anchorPrimary && (
          <>
            <div className="lb-anim-in" style={{
              display: 'flex', gap: 'var(--s4)', alignItems: 'center',
              padding: 'var(--s3)', background: 'var(--ivory)', borderRadius: 'var(--r-md)', marginTop: 'var(--s5)',
            }}>
              <div style={{ width: 76, flex: 'none' }}><Thumb item={anchorPrimary} radius="var(--r-sm)" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>{anchorPrimary.name || '불러온 상품'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>
                  <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{anchorPrimary.category || anchorPrimary.cat}</span>
                  {anchorPrimary.color ? ` · ${anchorPrimary.color}` : ''}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 'var(--s7)' }}>
              <Btn full size="lg" icon="sparkle" onClick={() => confirmAdd(mode, { anchorItem: anchorPrimary })}>
                조합 추천받기
              </Btn>
            </div>
          </>
        )}

        {/* ---------- SELECT ---------- */}
        {stage === 'select' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--s5)', marginBottom: 'var(--s3)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }} className="tnum">{sel.length}개 선택됨</span>
              <button onClick={() => setSel(allOn ? [] : detected.map((d) => d.id))} style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
                {allOn ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {detected.map((d) => (
                <DetectRow key={d.id} item={d} on={sel.includes(d.id)} onToggle={() => toggle(d.id)} />
              ))}
            </div>
            <div style={{ marginTop: 'var(--s6)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Btn full size="lg" icon="check" disabled={sel.length === 0} onClick={startRegister}>
                {sel.length > 0 ? `선택한 ${sel.length}개 담기` : '담을 아이템을 선택하세요'}
              </Btn>
              <Btn full variant="ghost" onClick={goBack}>다른 사진 올리기</Btn>
            </div>
          </>
        )}

        {/* ---------- REGISTER (sequential stepper) ---------- */}
        {stage === 'register' && cur && (
          <div className="lb-anim-in" key={stepIdx}>
            <div style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'center', marginTop: 'var(--s5)' }}>
              <div style={{ width: 72, flex: 'none' }}><Thumb item={{ ...cur, category: cur.cat }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 6 }}>이름</div>
                <input value={cur.name} onChange={(e) => patchStep({ name: e.target.value.slice(0, 48) })} maxLength={48} className="lb-input" placeholder="예) 코튼 셔츠" style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--r-md)', fontSize: 14.5, fontWeight: 600,
                  background: 'var(--ivory)', border: '1px solid var(--line)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box',
                }} />
              </div>
            </div>

            <div style={{ marginTop: 'var(--s5)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 9 }}>분류</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {CATS.map((c) => <Chip key={c} active={cur.cat === c} onClick={() => patchStep({ cat: c })}>{c}</Chip>)}
              </div>
            </div>

            {/* optional details */}
            <div style={{ marginTop: 'var(--s6)', borderTop: '1px solid var(--line)', paddingTop: 'var(--s5)' }}>
              {!cur.showDetails ? (
                <button onClick={() => patchStep({ showDetails: true })} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 0',
                  color: 'var(--ink-2)', fontSize: 13.5, fontWeight: 600,
                }}>
                  <Icon name="plus" size={16} /> 상세 정보 추가 <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>선택</span>
                </button>
              ) : (
                <div className="lb-anim-in">
                  <button onClick={() => patchStep({ showDetails: false })} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, width: '100%', textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>상세 정보</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>선택 입력</div>
                    <div style={{ flex: 1 }}></div>
                    <span style={{ color: 'var(--ink-3)', transform: 'rotate(90deg)', display: 'inline-flex' }}><Icon name="chevL" size={16} /></span>
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: 1 }}><LabeledField label="브랜드" value={cur.draft.brand} onChange={setStepDraft('brand')} placeholder="예) 코스" /></div>
                      <div style={{ flex: 1 }}><LabeledField label="사이즈" value={cur.draft.size} onChange={setStepDraft('size')} placeholder="예) M" /></div>
                    </div>
                    <LabeledField label="컬러" value={cur.draft.color} onChange={setStepDraft('color')} placeholder="예) 블루" />
                    <LabeledField label="구매처" value={cur.draft.store} onChange={setStepDraft('store')} placeholder="예) 무신사 · 오프라인" />
                    <LabeledField label="메모" value={cur.draft.note} onChange={setStepDraft('note')} placeholder="코디 팁, 세탁 주의 등" multiline />
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 'var(--s7)', display: 'flex', gap: 10 }}>
              <Btn variant="ghost" onClick={() => advance(false)} style={{ flex: '0 0 auto' }}>{steps.length <= 1 ? '취소' : '건너뛰기'}</Btn>
              <Btn full icon={stepIdx >= steps.length - 1 ? 'check' : 'plus'} onClick={() => advance(true)}>
                {stepIdx >= steps.length - 1 ? '담고 완료' : '담고 다음 옷'}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

window.LB_SCREENS_AB = { Wordmark, NavTitle, TopBar, BottomNav, Eyebrow, WardrobeScreen, AddSheet };
Object.assign(window, { Wordmark, NavTitle, TopBar, BottomNav, Eyebrow, WardrobeScreen, AddSheet });
