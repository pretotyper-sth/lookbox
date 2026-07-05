/* @prototype-ported */
const React = window.React;
const { Badge, BottomSheet, Btn, CATEGORIES, Chip, Icon, IconBtn, LB_DATA, LabeledField, Skeleton, Thumb } = window;

/* global React, Thumb, Skeleton, Btn, Chip, Badge, IconBtn, Icon, BottomSheet, LB_DATA */
// LOOKBOX — screens A–E + layout chrome. Exported to window.

const { useState: useS, useEffect: useE, useRef: useR } = React;

/* ============================================================
   Layout chrome
   ============================================================ */
function Wordmark({ size = 19 }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, userSelect: 'none' }}>
      <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-0.03em', color: 'var(--ink)' }}>LOOK</span>
      <span style={{
        fontWeight: 800, fontSize: size - 2, letterSpacing: '-0.01em',
        background: 'var(--accent)', color: 'var(--accent-ink)',
        padding: '2px 7px 3px', borderRadius: 7, lineHeight: 1,
      }}>BOX</span>
    </div>
  );
}

function TopBar({ left, title, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--s2)',
      padding: '14px 18px 12px', minHeight: 56,
      position: 'sticky', top: 0, zIndex: 20,
      background: 'color-mix(in srgb, var(--ivory) 86%, transparent)',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 44 }}>{left}</div>
      <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 16 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 44, gap: 4 }}>{right}</div>
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
  const { items, openAdd, wide, openItem, comboReady, comboGate } = ctx;
  const [cat, setCat] = useS('전체');
  const cats = LB_DATA.CATEGORIES;
  const filtered = cat === '전체' ? items : items.filter((i) => i.category === cat);
  const count = items.length;
  const ready = count >= 3;

  /* ---- Empty state ---- */
  if (count === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!wide && <TopBar left={<Wordmark />} right={<IconBtn name="plus" label="옷 추가" onClick={() => openAdd('wardrobe')} />} />}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 40px 80px' }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)', marginBottom: 'var(--s5)' }}>
            <Icon name="hanger" size={40} stroke={1.4} />
          </div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>옷장에 옷을 담아보세요</h1>
          <p style={{ margin: '10px 0 0', fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.5, maxWidth: 260 }}>
            가진 옷을 모아두면, 구매 전<br />어울리는 조합을 미리 확인할 수 있어요.
          </p>
          <div style={{ marginTop: 'var(--s7)', width: '100%', maxWidth: 280 }}>
            <Btn full size="lg" icon="plus" onClick={() => openAdd('wardrobe')}>옷 추가</Btn>
          </div>
          <div style={{ marginTop: 'var(--s4)', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 12.5 }}>
            <Icon name="lock" size={14} /> 3벌부터 조합 추천이 열려요
          </div>
        </div>
      </div>
    );
  }

  /* ---- Partial / Full ---- */
  const chips = (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: wide ? '0 0 30px' : '2px 18px 14px' }}>
      {cats.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
    </div>
  );
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {!wide && <TopBar left={<Wordmark />} right={<IconBtn name="plus" label="옷 추가" onClick={() => openAdd('wardrobe')} />} />}
      {!wide && chips}

      <div style={{ flex: 1, overflowY: 'auto', padding: wide ? '28px 0 36px' : '0 18px', paddingBottom: !wide ? 110 : undefined }}>
       <div className={wide ? 'lb-wide-inner' : ''}>
        {wide && (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
            <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800 }}>옷장</h1>
            <span style={{ fontSize: 13.5, color: 'var(--ink-3)', fontWeight: 600 }}>{count}벌</span>
          </div>
        )}
        {wide && chips}
        {!ready && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)', padding: 'var(--s4)', background: 'var(--surface)', borderRadius: 'var(--r-md)', marginBottom: 'var(--s4)' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--ivory)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flex: 'none' }}>
              <Icon name="lock" size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{3 - count}벌 더 담으면 조합을 추천해드려요</div>
              <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i < count ? 'var(--accent)' : 'var(--line-2)' }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="lb-grid">
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
                <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>옷</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>옷</div>
              </div>
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="plus" size={26} /><span style={{ fontSize: 12.5, fontWeight: 600 }}>옷 추가</span>
            </div>
          </button>
          {filtered.map((it) => (
            <div key={it.id} className="lb-anim-in">
              <button onClick={() => openItem(it)} className="lb-itembtn" style={{ display: 'block', width: '100%', textAlign: 'left', position: 'relative' }}>
                <Thumb item={it} />
                {(it.brand || it.size || it.store || it.note) && (
                  <span style={{ position: 'absolute', right: 8, top: 8, width: 22, height: 22, borderRadius: '50%', background: 'color-mix(in srgb, var(--ink) 80%, transparent)', color: '#fff', display: 'grid', placeItems: 'center', backdropFilter: 'blur(4px)' }}>
                    <Icon name="check" size={13} stroke={2.6} />
                  </span>
                )}
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, textWrap: 'pretty' }}>{it.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{it.brand ? it.brand + ' · ' : ''}{it.category} · {it.color}</div>
                </div>
              </button>
            </div>
          ))}
        </div>
       </div>
      </div>

      {!wide && (
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
   anchor:    input only (single garment → combo recommend)
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

function AddSheet({ ctx }) {
  const { addSheet, closeAdd, confirmAdd, addItemsBatch, liveImportSource, autoAddDetails, detectCount } = ctx;
  const mode = addSheet.mode; // 'wardrobe' | 'anchor'
  const anchor = mode === 'anchor';
  const CATS = LB_DATA.CATEGORIES.filter((c) => c !== '전체');

  // input
  const [tab, setTab] = useS('photo');
  const [picked, setPicked] = useS(false);
  const [url, setUrl] = useS('');
  const [loaded, setLoaded] = useS(false);
  const [file, setFile] = useS(null);
  const [busy, setBusy] = useS(false);
  const [err, setErr] = useS('');
  const fileInput = useR(null);

  // stage machine (wardrobe only goes past 'input')
  const [stage, setStage] = useS('input'); // input | analyzing | select | register
  const [detected, setDetected] = useS([]);
  const [sel, setSel] = useS([]); // selected detected ids
  const [steps, setSteps] = useS([]); // ordered queue for sequential register
  const [stepIdx, setStepIdx] = useS(0);

  // anchor single-add draft
  const [showDetails, setShowDetails] = useS(false);
  const [draft, setDraft] = useS({ brand: '', size: '', store: '', note: '' });

  useE(() => {
    if (!addSheet.open) return;
    setTab('photo'); setPicked(false); setUrl(''); setLoaded(false); setFile(null); setBusy(false); setErr('');
    setStage('input'); setDetected([]); setSel([]); setSteps([]); setStepIdx(0);
    setShowDetails(!!autoAddDetails); setDraft({ brand: '', size: '', store: '', note: '' });
  }, [addSheet.open, addSheet.mode]);

  // ---- detection: API "separates" one source image into N garments ----
  const runDetect = async (source = {}) => {
    setErr('');
    setBusy(true);
    setStage('analyzing');
    try {
      const data = await liveImportSource({
        sourceType: source.sourceType || tab,
        file: source.file || file,
        url,
        status: 'pending',
      });
      const list = (data.items || []).slice(0, detectCount).map((d, i) => ({ ...d, id: d.id || 'det' + i, cat: d.category, conf: d.conf || 0.95 }));
      if (!list.length) throw new Error('사진에서 옷을 찾지 못했어요');
      setDetected(list);
      setSel(list.map((d) => d.id));
      setStage(() => {
        if (list.length === 1) {
          setSteps(list.map((d) => ({ ...d, cat: d.category, draft: { brand: d.brand || '', size: '', store: d.store || '', note: '' }, showDetails: !!autoAddDetails || !!d.brand })));
          setStepIdx(0);
          return 'register';
        }
        return 'select';
      });
    } catch (e) {
      setErr(e.message || 'AI 분석에 실패했어요');
      setStage('input');
    } finally {
      setBusy(false);
    }
  };
  const onPickPhoto = () => { if (fileInput.current) fileInput.current.click(); };
  const onFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
    setPicked(true);
    if (!anchor) runDetect({ sourceType: 'photo', file: f });
  };
  const onLoadUrl = async () => { if (!url.trim()) return; setLoaded(true); if (!anchor) await runDetect({ sourceType: 'url' }); };

  // ---- select ----
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allOn = detected.length > 0 && sel.length === detected.length;
  const startRegister = () => {
    const q = detected.filter((d) => sel.includes(d.id));
    setSteps(q.map((d) => ({ ...d, cat: d.category, draft: { brand: d.brand || '', size: '', store: d.store || '', note: '' }, showDetails: !!autoAddDetails || !!d.brand })));
    setStepIdx(0);
    setStage('register');
  };

  // ---- register (sequential) ----
  const cur = steps[stepIdx] || null;
  const patchStep = (patch) => setSteps((arr) => arr.map((x, i) => (i === stepIdx ? { ...x, ...patch } : x)));
  const setStepDraft = (k) => (v) => setSteps((arr) => arr.map((x, i) => (i === stepIdx ? { ...x, draft: { ...x.draft, [k]: v } } : x)));
  const toItem = (s) => {
    const clean = Object.fromEntries(Object.entries(s.draft).filter(([, v]) => v && String(v).trim()));
    return { ...s, name: s.name || s.cat + ' 아이템', category: s.cat || s.category, color: s.color || '뉴트럴', img: s.img || null, ...clean };
  };
  const advance = (keep) => {
    const updated = steps.map((x, i) => (i === stepIdx ? { ...x, added: keep } : x));
    setSteps(updated);
    if (stepIdx >= steps.length - 1) {
      const kept = updated.filter((s) => s.added).map(toItem);
      const skipped = detected.filter((d) => !updated.some((s) => s.id === d.id && s.added)).map((d) => d.id);
      addItemsBatch(kept, skipped);
    } else setStepIdx(stepIdx + 1);
  };
  const doneCount = steps.filter((s) => s.added).length;

  const goBack = () => {
    if (stage === 'select') { setStage('input'); setPicked(false); setLoaded(false); }
    else if (stage === 'register') { if (stepIdx > 0) setStepIdx(stepIdx - 1); else setStage('select'); }
  };

  // ---- header copy ----
  let header, sub;
  if (stage === 'select') { header = '담을 옷을 골라주세요'; sub = `사진에서 ${detected.length}벌을 찾았어요 · 고른 옷을 하나씩 담아요`; }
  else if (stage === 'register') { header = null; sub = null; }
  else { header = anchor ? '고민 중인 옷 추가' : '옷장에 옷 추가'; sub = anchor ? '이 옷이 내 옷장 옷들과 어울리는지 확인해볼게요.' : '사진 한 장 속 여러 벌을 자동으로 분리해 드려요.'; }

  const anchorReady = tab === 'photo' ? picked : loaded;
  const setD = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));
  const showBack = stage === 'select' || stage === 'register';

  return (
    <BottomSheet open={addSheet.open} onClose={closeAdd}>
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
                  {doneCount > 0 ? `지금까지 ${doneCount}벌 담음 · ` : ''}내용을 확인하고 하나씩 담아요.
                </p>
              </div>
            ) : (
              <div>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{header}</h2>
                <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>{sub}</p>
              </div>
            )}
          </div>
          <IconBtn name="x" label="닫기" onClick={closeAdd} style={{ marginRight: -8, flex: 'none' }} />
        </div>

        {/* ---------- INPUT (also anchor's whole flow) ---------- */}
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
                anchor && picked ? (
                  <div style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'center', padding: 'var(--s3)', background: 'var(--ivory)', borderRadius: 'var(--r-md)' }}>
                    <div style={{ width: 76, flex: 'none' }}><Thumb item={{ category: '아우터' }} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600 }}>새 옷</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>사진 1장 · 분류 자동 인식</div>
                    </div>
                    <button onClick={() => setPicked(false)} style={{ color: 'var(--ink-3)', fontSize: 13, fontWeight: 600 }}>변경</button>
                  </div>
                ) : (
                  <>
                  <input ref={fileInput} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
                  <button onClick={onPickPhoto} className="lb-drop" style={{
                    width: '100%', padding: '34px 0', borderRadius: 'var(--r-md)', background: 'var(--ivory)',
                    border: '1.5px dashed var(--line-2)', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 10, color: 'var(--ink-2)',
                  }}>
                    <Icon name="camera" size={30} stroke={1.5} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>사진 업로드</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>탭하여 사진 선택 · 배경은 자동 정리</span>
                  </button>
                  </>
                )
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={url} onChange={(e) => { setUrl(e.target.value); setLoaded(false); }}
                      placeholder="상품 URL 붙여넣기" className="lb-input" style={{
                        flex: 1, padding: '13px 16px', borderRadius: 'var(--r-pill)', fontSize: 14,
                        background: 'var(--ivory)', border: '1px solid var(--line)', color: 'var(--ink)', outline: 'none',
                      }} />
                    <Btn variant="soft" onClick={onLoadUrl} disabled={!url.trim() || busy}>{busy ? '분석 중' : '불러오기'}</Btn>
                  </div>
                  {anchor && loaded && (
                    <div className="lb-anim-in" style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'center', padding: 'var(--s3)', background: 'var(--ivory)', borderRadius: 'var(--r-md)', marginTop: 'var(--s3)' }}>
                      <div style={{ width: 76, flex: 'none' }}><Thumb item={{ category: '아우터' }} /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>불러온 상품</div>
                        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{url}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!anchor && (
              <div style={{ marginTop: 'var(--s4)', display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--ink-3)', fontSize: 12.5 }}>
                <Icon name="sparkle" size={15} /> 사진 속 상의·하의·신발까지 따로따로 찾아드려요
              </div>
            )}

            {err && (
              <div style={{ marginTop: 'var(--s3)', color: '#B91C1C', fontSize: 13, fontWeight: 600 }}>{err}</div>
            )}

            {anchor && (
              <div style={{ marginTop: 'var(--s7)' }}>
                <Btn full size="lg" icon="sparkle" disabled={!anchorReady || busy} onClick={() => confirmAdd(mode, { sourceType: tab, file, url, ...draft })}>{busy ? '분석 중' : '조합 추천받기'}</Btn>
              </div>
            )}
          </>
        )}

        {/* ---------- ANALYZING ---------- */}
        {stage === 'analyzing' && (
          <div style={{ marginTop: 'var(--s6)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="lb-scan" style={{
              width: '100%', maxWidth: 280, borderRadius: 'var(--r-md)', background: 'var(--ivory)',
              boxShadow: 'inset 0 0 0 1px var(--line)', padding: 14,
              display: 'grid', gridTemplateColumns: detected.length > 1 ? '1fr 1fr' : '1fr', gap: 10,
            }}>
              {detected.map((d, i) => (
                <div key={d.id} className="lb-detect-in" style={{ animationDelay: (i * 220) + 'ms' }}>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
                    <Thumb item={d} radius="var(--r-sm)" />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 'var(--s5)', fontSize: 15, fontWeight: 700 }}>{detected.length > 1 ? '옷을 하나씩 분리하고 있어요' : '옷을 인식하고 있어요'}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-3)' }}>사진 속 의류를 찾는 중…</div>
          </div>
        )}

        {/* ---------- SELECT ---------- */}
        {stage === 'select' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--s5)', marginBottom: 'var(--s3)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }} className="tnum">{sel.length}벌 선택됨</span>
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
                {sel.length > 0 ? `선택한 ${sel.length}벌 담기` : '담을 옷을 선택하세요'}
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
                <input value={cur.name} onChange={(e) => patchStep({ name: e.target.value })} className="lb-input" style={{
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
                    <LabeledField label="구매처" value={cur.draft.store} onChange={setStepDraft('store')} placeholder="예) 무신사 · 오프라인" />
                    <LabeledField label="메모" value={cur.draft.note} onChange={setStepDraft('note')} placeholder="코디 팁, 세탁 주의 등" multiline />
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 'var(--s7)', display: 'flex', gap: 10 }}>
              <Btn variant="ghost" onClick={() => advance(false)} style={{ flex: '0 0 auto' }}>건너뛰기</Btn>
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

window.LB_SCREENS_AB = { Wordmark, TopBar, BottomNav, Eyebrow, WardrobeScreen, AddSheet };
Object.assign(window, { Wordmark, TopBar, BottomNav, Eyebrow, WardrobeScreen, AddSheet });
