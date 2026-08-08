/* @prototype-ported */
const React = window.React;
const { Badge, BottomSheet, Btn, Chip, EmptyState, Eyebrow, Icon, IconBtn, LB_DATA, OUTFITS, Silhouette, Skeleton, Thumb, TopBar } = window;

/* global React, Thumb, Silhouette, Skeleton, Btn, Chip, Badge, IconBtn, Icon, LB_DATA, TopBar, Eyebrow, EmptyState */
// LOOKBOX — screens C (results), D (lookbook), E (detail). Exported to window.

const { useState: useSc, useEffect: useEc } = React;

/* ---- info chips for an item (분류 · 색) ---- */
function MetaChips({ item }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {[item.category, item.color].map((x, i) => (
        <span key={i} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--ivory)', padding: '4px 10px', borderRadius: 'var(--r-pill)' }}>{x}</span>
      ))}
    </div>
  );
}

/* ============================================================
   LookComposite — 조합 전체를 한 배경 위에 옷(컷아웃)만 배치.
   개별 제품 이미지는 배경 제거된 투명 PNG여야 카드처럼 안 잘림.
   ============================================================ */
/* 아이템 이미지는 백엔드에서 정사각 캔버스로 정규화돼 온다. 이때 컷의 '긴 변'을
   카테고리별 고정 비율로 채우는데(_CATEGORY_FILL: 상의·하의 0.90, 신발 0.62 …),
   그래서 캔버스만 놓고 보면 티셔츠와 청바지가 같은 높이로 그려진다 — 실제로
   재보면 셔츠 575px, 청바지 576px다. 여기서 그 비율을 되돌려, 화면에 그릴 때만
   실제 옷 크기(청바지 105cm, 셔츠 70cm, 신발 29cm …)에 맞춘 크기로 되돌린다.

   size = 아이템을 담는 정사각 박스의 한 변(코디 가로폭 대비 %).
   캔버스가 정사각이라 박스도 정사각이어야 원래 비율대로 들어간다.
   cx/cy/z는 자리와 앞뒤만 정한다. */
const LOOK_SLOT = {
  '아우터':   { cx: 42, cy: 38, size: 64, z: 1 },
  '상의':     { cx: 50, cy: 26, size: 57, z: 3 },
  '하의':     { cx: 50, cy: 59, size: 86, z: 2 },
  '스커트':   { cx: 50, cy: 60, size: 55, z: 2 },
  '원피스':   { cx: 50, cy: 51, size: 95, z: 2 },
  // 소품은 가운데 옷을 둘러싸도록 네 귀퉁이에 흩어 놓는다. 한쪽에 몰리면 코디가 기울어 보인다.
  '신발':     { cx: 76, cy: 86, size: 35, z: 4 },
  '가방':     { cx: 19, cy: 60, size: 42, z: 4 },
  '모자':     { cx: 80, cy: 20, size: 37, z: 5 },
  '소품':     { cx: 20, cy: 20, size: 26, z: 5 },
  '액세서리': { cx: 80, cy: 20, size: 37, z: 5 }, // 구버전 데이터 호환
};
const LOOK_SCALE = 1;

function lookJitterRot(id) {
  // 아이템별 고정 ±5° 지터 (리렌더해도 동일)
  let h = 0;
  const s = String(id || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  const r = (Math.abs(h) % 11) - 5; // -5..5
  return r === 0 ? ((h & 1) ? 3 : -3) : r;
}

// bg/scale/slotMap — 온보딩 랜딩은 카드 박스 없이 페이지 위에 크게, 겹침을 줄여 펼쳐 쓴다.
function LookComposite({ outfit, items, ratio = '4 / 5', bg = 'var(--thumb-bg)', scale = LOOK_SCALE, slotMap = LOOK_SLOT }) {
  const cleanItems = (items || []).filter(Boolean);
  if (outfit && outfit.lookImg) {
    return (
      <div style={{ background: bg, borderRadius: 'var(--r-md)', overflow: 'hidden', aspectRatio: ratio }}>
        <img src={outfit.lookImg} alt={cleanItems.map((i) => i.name).join(' · ')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  const used = {};
  const hasSide = cleanItems.some((it) => ['신발', '가방', '모자', '소품', '액세서리'].includes(it.category));
  return (
    <div style={{ position: 'relative', background: bg, borderRadius: 'var(--r-md)', overflow: 'hidden', aspectRatio: ratio }}>
      {cleanItems.map((it) => {
        const base = slotMap[it.category] || slotMap['상의'];
        const n = used[it.category] || 0; used[it.category] = n + 1;
        let cx = base.cx + n * 6;
        const cy = base.cy + n * 4;
        // 상의·하의만이면 가운데 정렬
        if (!hasSide && ['상의', '하의', '스커트', '아우터', '원피스'].includes(it.category)) {
          cx = 50 + n * 4;
        }
        const size = Math.min(100, base.size * scale);
        const rot = lookJitterRot(it.id);
        const frame = {
          position: 'absolute', left: cx + '%', top: cy + '%', width: size + '%', aspectRatio: '1',
          transform: `translate(-50%,-50%) rotate(${rot}deg)`, zIndex: base.z,
          display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        };
        return it.img
          ? (
            <div key={it.id} style={frame}>
              <img src={it.img} alt={it.name} loading="eager" decoding="async" style={{
                width: '100%', height: '100%', objectFit: 'contain', display: 'block',
                filter: 'drop-shadow(0 8px 10px rgba(40,33,20,0.10))',
              }} />
            </div>
          )
          : <div key={it.id} style={{ ...frame, color: 'var(--ink-3)' }}><Silhouette category={it.category} /></div>;
      })}
    </div>
  );
}


/* ============================================================
   Outfit card — 오늘의 추천과 같은 컴팩트 카드 (2열 그리드용)
   ============================================================ */
function OutfitCard({ outfit, saved, onSave, styleLabel, onView }) {
  const items = outfit.itemIds.map((id) => LB_DATA.ALL[id]).filter(Boolean);
  const moodBasis = outfit.styleLabel || styleLabel || '';
  return (
    <div className="lb-anim-in" style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 'var(--s3)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => onView && onView(outfit, items)}
          aria-label="코디 크게 보기"
          style={{
            display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent',
            cursor: onView ? 'zoom-in' : 'default', textAlign: 'left',
          }}
        >
          <LookComposite outfit={outfit} items={items} ratio="4 / 5" />
        </button>
        <button onClick={onSave} className="lb-save" aria-label="룩북에 저장" style={{
          position: 'absolute', right: 8, top: 8, width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center',
          color: saved ? 'var(--accent-ink)' : 'var(--ink)',
          background: saved ? 'var(--accent)' : 'color-mix(in srgb, var(--surface-2) 88%, transparent)',
          boxShadow: saved ? 'none' : 'inset 0 0 0 1px var(--line-2)', backdropFilter: 'blur(4px)',
          transition: 'all var(--dur) var(--ease)',
        }}>
          <Icon name="heart" size={15} fill={saved ? 'currentColor' : 'none'} stroke={saved ? 0 : 2} />
        </button>
      </div>

      <div style={{ padding: '11px 3px 0', flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.25, textWrap: 'pretty' }}>{outfit.label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>
          {moodBasis ? `${moodBasis} · ` : ''}{items.length}개 조합
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 1 }}>
        {items.map((it) => (
          <div key={it.id} style={{ width: 40, flex: 'none' }}>
            <div style={{ padding: it.isAnchor ? 1.5 : 0, background: it.isAnchor ? 'var(--accent)' : 'transparent', borderRadius: it.isAnchor ? 8 : 'var(--r-sm)' }}>
              <div style={{ borderRadius: it.isAnchor ? 6 : 'var(--r-sm)', overflow: 'hidden', boxShadow: it.isAnchor ? 'none' : 'inset 0 0 0 1px var(--line)' }}>
                <Thumb item={it} radius={it.isAnchor ? '6px' : 'var(--r-sm)'} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutfitSkeleton() {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 'var(--s3)' }}>
      <div style={{ background: 'var(--thumb-bg)', borderRadius: 'var(--r-md)', overflow: 'hidden', aspectRatio: '4 / 5' }}><Skeleton h="100%" radius="0" /></div>
      <div style={{ padding: '11px 3px 0' }}><Skeleton w="70%" h={15} /><Skeleton w="50%" h={11} style={{ marginTop: 8 }} /></div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>{[0, 1].map((i) => <Skeleton key={i} w={40} h={40} radius="var(--r-sm)" />)}</div>
    </div>
  );
}

/* ============================================================
   C · Combo results (AI)
   ============================================================ */
function ResultsScreen({ ctx }) {
  const {
    back, anchor, loading, savedOutfitIds, saveOutfit, wide,
    loadMoreCombos, moreLoading, comboRev, preferredStyleLabel,
    openOutfitViewer,
  } = ctx;
  const outfits = LB_DATA.OUTFITS;
  void comboRev;
  const busy = !!loading;
  const moreBusy = !!moreLoading;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <TopBar
        left={<IconBtn name="chevL" label="뒤로" onClick={back} style={{ marginLeft: -8 }} />}
        title="조합 추천"
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: wide ? 'var(--gap-header) 0 36px' : 'var(--gap-header) 18px 32px' }}>
        <div className={wide ? 'lb-wide-inner' : undefined}>
          {/* anchor block */}
          <div style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'center', padding: 'var(--s4)', background: 'var(--surface)', borderRadius: 'var(--r-lg)', marginBottom: 'var(--s5)' }}>
            <div style={{ width: wide ? 80 : 92, flex: 'none' }}><Thumb item={anchor} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Eyebrow>고민 중인 옷</Eyebrow>
              <div style={{ fontSize: wide ? 16 : 17, fontWeight: 700, margin: '6px 0 8px', textWrap: 'pretty' }}>{anchor.name}</div>
              <MetaChips item={anchor} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 'var(--s3)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, minWidth: 0 }}>
              {busy ? '어울리는 조합을 찾는 중' : '내 옷장과 어울리는 코디'}
              {busy && <span style={{ fontWeight: 500, color: 'var(--ink-3)', fontSize: 12.5 }}> · 최대 10초</span>}
            </div>
            {!busy && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', flex: 'none' }}>{outfits.length}개</div>}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: wide
              ? 'repeat(auto-fill, minmax(220px, 1fr))'
              : 'repeat(2, minmax(0,1fr))',
            gap: wide ? 'var(--s4)' : 'var(--s3)',
          }}>
            {busy
              ? [0, 1, 2, 3].map((i) => <OutfitSkeleton key={i} />)
              : outfits.map((o) => (
                  <OutfitCard key={o.id} outfit={o} styleLabel={preferredStyleLabel}
                    saved={savedOutfitIds.includes(o.id)} onSave={() => saveOutfit(o.id)}
                    onView={openOutfitViewer} />
                ))}
          </div>

          {!busy && (
            <div style={{ marginTop: 'var(--s5)' }}>
              <Btn full variant="soft" icon="sparkle" onClick={loadMoreCombos} disabled={moreBusy}>
                {moreBusy ? '추천 만드는 중… 최대 10초' : '2개 더 추천받기'}
              </Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   D · Lookbook (saved coordis)
   ============================================================ */
function SavedCard({ look, onOpen }) {
  const outfit = LB_DATA.OUTFIT_BY_ID[look.outfitId];
  const items = outfit.itemIds.map((id) => LB_DATA.ALL[id]);
  return (
    <button onClick={onOpen} className="lb-anim-in lb-savedcard" style={{ textAlign: 'left', background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 10, display: 'block' }}>
      <LookComposite outfit={outfit} items={items} ratio="1 / 1" />
      <div style={{ padding: '10px 4px 4px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{look.label}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{items.length}개 품목 · {look.savedAt}</div>
      </div>
    </button>
  );
}

/* ---- 직접 코디 만들기 — 추천을 거치지 않고 옷장에서 골라 바로 저장 ---- */
function slotOf(item) {
  const cat = ((item && item.category) || '').toLowerCase();
  if (cat === '상의' || cat === 'top') return 'top';
  if (cat === '아우터' || cat === 'outer') return 'outer';
  if (cat === '하의' || cat === 'bottom') return 'bottom';
  if (cat === '스커트' || cat === 'skirt') return 'bottom';
  if (cat === '원피스' || cat === 'dress') return 'dress';
  return 'other';
}

function ManualLookSheet({ open, onClose, items, onSave }) {
  const [sel, setSel] = useSc([]);
  const [cat, setCat] = useSc('전체');
  const [name, setName] = useSc('');
  useEc(() => { if (open) { setSel([]); setCat('전체'); setName(''); } }, [open]);

  const cats = LB_DATA.CATEGORIES || ['전체'];
  const shown = cat === '전체' ? items : items.filter((i) => i.category === cat);
  const picked = sel.map((id) => items.find((i) => String(i.id) === String(id))).filter(Boolean);
  const slots = picked.map(slotOf);
  // 추천 코디와 같은 기준: 원피스 한 장이거나, 상의(아우터 포함) + 하의
  const complete = slots.includes('dress')
    || ((slots.includes('top') || slots.includes('outer')) && slots.includes('bottom'));
  const valid = picked.length >= 2 && complete;
  const need = !picked.length ? '옷장에서 아이템을 골라주세요'
    : !complete ? '상의와 하의를 하나씩 담으면 저장할 수 있어요'
    : picked.length < 2 ? '2개 이상 골라주세요' : '';

  const toggle = (id) => setSel((arr) => (
    arr.includes(String(id)) ? arr.filter((x) => x !== String(id)) : [...arr, String(id)]
  ));

  return (
    <BottomSheet open={open} onClose={onClose} maxW={520}>
      <div style={{ padding: '4px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>직접 코디 만들기</h3>
          <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)' }}>{picked.length}개 선택</span>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          옷장에 있는 아이템으로 원하는 조합을 만들어 룩북에 담아요.
        </p>
      </div>

      {/* 고른 것 미리보기 — 비어 있을 때도 자리를 지켜서, 고르는 동안 시트가 들썩이지 않게 한다 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, height: 60,
        margin: '10px 0 0', padding: '4px 20px',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {picked.length === 0 ? (
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>고른 아이템이 여기에 담겨요</span>
        ) : picked.map((it) => (
          <button key={it.id} type="button" onClick={() => toggle(it.id)} aria-label={`${it.name} 빼기`}
            style={{ flex: 'none', width: 52, position: 'relative', background: 'transparent', padding: 0 }}>
            <Thumb item={it} radius="var(--r-sm)" />
            <span style={{
              position: 'absolute', right: -4, top: -4, width: 18, height: 18, borderRadius: '50%',
              background: 'var(--ink)', color: 'var(--surface)', display: 'grid', placeItems: 'center',
            }}>
              <Icon name="x" size={11} stroke={3} />
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 20px 10px', WebkitOverflowScrolling: 'touch' }}>
        {cats.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
      </div>

      {/* 높이 고정 — 분류마다 담긴 개수가 달라도 시트 크기는 '전체' 기준 그대로 둔다 */}
      <div style={{ height: '38vh', overflowY: 'auto', padding: '2px 20px 12px', WebkitOverflowScrolling: 'touch' }}>
        {shown.length === 0 ? (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)' }}>이 분류에 담긴 아이템이 없어요.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, alignContent: 'start' }}>
            {shown.map((it) => {
              const on = sel.includes(String(it.id));
              return (
                <button key={it.id} type="button" onClick={() => toggle(it.id)} className="lb-itembtn"
                  style={{ background: 'transparent', padding: 0, textAlign: 'left', position: 'relative' }}>
                  <div style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: on ? 'inset 0 0 0 2px var(--ink)' : 'none' }}>
                    <Thumb item={it} radius="0" />
                  </div>
                  <span style={{
                    position: 'absolute', right: 6, top: 6, width: 20, height: 20, borderRadius: '50%',
                    display: 'grid', placeItems: 'center',
                    background: on ? 'var(--ink)' : 'color-mix(in srgb, var(--surface) 80%, transparent)',
                    color: 'var(--surface)',
                    boxShadow: on ? 'none' : 'inset 0 0 0 1.5px var(--line-2)',
                    transition: 'all var(--dur) var(--ease)',
                  }}>
                    {on ? <Icon name="check" size={12} stroke={3} /> : null}
                  </span>
                  <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 5, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ padding: 'var(--s4) 20px 6px', borderTop: '1px solid var(--line)' }}>
        <input className="lb-input" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="코디 이름 (비워두면 '내가 만든 코디')" aria-label="코디 이름"
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 'var(--r-md)', fontSize: 13.5,
            background: 'var(--ivory)', border: '1px solid var(--line)', color: 'var(--ink)',
            outline: 'none', boxSizing: 'border-box',
          }} />
        <div style={{ marginTop: 'var(--s5)' }}>
          <Btn full size="lg" icon="bookmark" disabled={!valid}
            onClick={() => { onSave(sel, name); onClose(); }}>룩북에 저장</Btn>
        </div>
        {/* 안내 문구 자리는 비워도 남겨둔다 — 조건을 채웠을 때 버튼이 아래로 튀지 않게 */}
        <p style={{
          margin: '9px 0 2px', height: 15, lineHeight: '15px',
          textAlign: 'center', fontSize: 12, color: 'var(--ink-3)',
        }}>{need}</p>
      </div>
    </BottomSheet>
  );
}

function LookbookScreen({ ctx }) {
  const { saved, openDetail, tab, hasWardrobe, startComboOrWardrobe, wide, items, createManualLook } = ctx;
  const [makeOpen, setMakeOpen] = useSc(false);
  // 수동 조합도 추천과 같은 기준(상의+하의)이 필요해서, 옷장이 준비됐을 때만 연다.
  const canMake = hasWardrobe && (items || []).length >= 2;
  const openMake = () => setMakeOpen(true);

  const sheet = (
    <ManualLookSheet open={makeOpen} onClose={() => setMakeOpen(false)}
      items={items || []} onSave={createManualLook} />
  );

  if (saved.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        <EmptyState
          icon="bookmark"
          title="저장한 코디가 없어요"
          wide={wide}
          action={(
            <>
              <Btn full size="lg" icon="sparkle" onClick={startComboOrWardrobe}>
                {hasWardrobe ? '조합 추천받기' : '옷장 채우러 가기'}
              </Btn>
              {canMake && (
                <div style={{ marginTop: 10 }}>
                  <Btn full size="lg" variant="soft" icon="plus" onClick={openMake}>직접 코디 만들기</Btn>
                </div>
              )}
            </>
          )}
          hintHidden
        >
          마음에 든 코디를 모아두는 공간이에요.<br />구매와 상관없이, 편하게 저장해두세요.
        </EmptyState>
        {sheet}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: wide ? '28px 0 36px' : 'calc(env(safe-area-inset-top, 0px) + 22px) 18px 96px',
      }}>
        <div className={wide ? 'lb-wide-inner' : undefined}>
          {wide ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--gap-header)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800 }}>룩북</h1>
                <span style={{ fontSize: 13.5, color: 'var(--ink-3)', fontWeight: 600 }}>{saved.length}개</span>
              </div>
              {canMake && <Btn size="sm" variant="secondary" icon="plus" onClick={openMake}>직접 만들기</Btn>}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--gap-header)' }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>룩북</h1>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>{saved.length}개</span>
            </div>
          )}
          <div className="lb-grid">
            {saved.map((lk) => <SavedCard key={lk.id} look={lk} onOpen={() => openDetail(lk)} />)}
          </div>
        </div>
      </div>
      {/* 모바일은 상단바가 없어서 진입점을 하단 도크에 둔다 */}
      {!wide && canMake && (
        <div className="lb-cta-dock">
          <Btn full size="lg" variant="primary" icon="plus" onClick={openMake}>직접 코디 만들기</Btn>
        </div>
      )}
      {sheet}
    </div>
  );
}

/* ============================================================
   E · Coordi detail
   ============================================================ */
/* 데스크탑 우측 레일 — 룩북의 나머지 코디를 흐리게 깔아두고 눌러서 바로 전환 */
function RailCard({ look, active, onClick }) {
  const o = LB_DATA.OUTFIT_BY_ID[look.outfitId];
  if (!o) return null;
  const its = (o.itemIds || []).map((id) => LB_DATA.ALL[id]).filter(Boolean);
  return (
    <button onClick={onClick} className="lb-rail-card" aria-current={active ? 'true' : undefined} style={{
      textAlign: 'left', display: 'block', padding: 8, borderRadius: 'var(--r-lg)',
      background: active ? 'var(--surface)' : 'transparent',
      boxShadow: active ? 'inset 0 0 0 2px var(--ink)' : 'none',
      opacity: active ? 1 : 0.45,
    }}>
      <LookComposite outfit={o} items={its} ratio="1 / 1" />
      <div style={{ padding: '8px 2px 2px', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{look.label}</div>
    </button>
  );
}

function DetailScreen({ ctx }) {
  const { back, detailLook, addedItemIds, addToWardrobe, detailIndex, detailTotal, gotoLook, wide, savedLooks, openDetail } = ctx;
  const outfit = LB_DATA.OUTFIT_BY_ID[detailLook.outfitId];
  const items = (outfit.itemIds || []).map((id) => LB_DATA.ALL[id]).filter(Boolean);
  const multi = detailTotal > 1;

  // swipe + slide-direction animation
  const startX = React.useRef(0);
  const [dir, setDir] = React.useState(0);
  const nav = (d) => { if (!multi) return; setDir(d); gotoLook(d); };
  const onStart = (e) => { startX.current = e.touches ? e.touches[0].clientX : e.clientX; };
  const onEnd = (e) => {
    const x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const dx = x - startX.current;
    if (Math.abs(dx) > 48) nav(dx < 0 ? 1 : -1);
  };

  // 데스크탑: 우측 레일을 방향키로 이동. 좌우는 한 칸, 위아래는 한 줄(레일의 실제 열 수)씩.
  const railRef = React.useRef(null);
  React.useEffect(() => {
    if (!wide || !multi) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = ((e.target && e.target.tagName) || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;
      // 시트·뷰어가 떠 있으면 뒤 화면이 따라 움직이지 않게 둔다.
      if (document.querySelector('.lb-sheet-scrim')) return;
      const cols = railRef.current
        ? window.getComputedStyle(railRef.current).gridTemplateColumns.split(' ').filter(Boolean).length
        : 1;
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
      if (!step) return;
      const next = detailIndex + step;
      if (next < 0 || next >= detailTotal) return;   // 레일 밖으로는 넘기지 않는다
      e.preventDefault();
      openDetail(savedLooks[next]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wide, multi, detailIndex, detailTotal, savedLooks, openDetail]);

  // 레일이 길어져도 지금 보는 코디가 화면 밖에 있지 않게
  React.useEffect(() => {
    if (!wide || !railRef.current) return;
    const active = railRef.current.querySelector('[aria-current="true"]');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }, [wide, detailLook]);

  // 코디 이미지 위에 얹는다. 카드 높이(품목 수)가 달라져도 늘 같은 자리에 오도록.
  const ArrowBtn = ({ d, name, side }) => (
    <button onClick={() => nav(d)} aria-label={d > 0 ? '다음 코디' : '이전 코디'} className="lb-iconbtn lb-detail-arrow" style={{
      position: 'absolute', [side]: 8, top: '50%', transform: 'translateY(-50%)',
      width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center',
      background: 'color-mix(in srgb, var(--surface) 88%, transparent)', color: 'var(--ink)',
      boxShadow: 'inset 0 0 0 1px var(--line-2)', backdropFilter: 'blur(4px)',
    }}>
      <Icon name={name} size={19} />
    </button>
  );

  // 코디 카드 — 데스크탑·모바일이 같은 카드를 쓰고, 바깥 껍데기만 화면 폭에 따라 달라진다.
  const card = (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 'var(--s4)' }}>
      <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 'var(--s3)' }}>{outfit.mood} · {items.length}개 품목</div>

      <div style={{ position: 'relative' }}>
        <LookComposite outfit={outfit} items={items} ratio="4 / 5" />
        {!wide && multi && (
          <>
            <ArrowBtn d={-1} name="chevL" side="left" />
            <ArrowBtn d={1} name="chevR" side="right" />
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'var(--s3)' }}>
        {items.map((it, i) => {
          const justAdded = it.isAnchor && addedItemIds.includes(it.id);
          return (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)', padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
              <div style={{ width: 44, flex: 'none' }}><Thumb item={it} radius="var(--r-sm)" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, textWrap: 'pretty' }}>{it.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>{it.category} · {it.color}</div>
              </div>
              <div style={{ flex: 'none' }}>
                {justAdded ? <Badge tone="good" icon="check">추가됨</Badge>
                  : !it.isAnchor ? <Badge tone="neutral">옷장에 있음</Badge>
                  : <Btn size="sm" variant="secondary" icon="plus" onClick={() => addToWardrobe(it.id)}>옷장에 추가</Btn>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const topBar = (
    <TopBar
      left={<IconBtn name="chevL" label="뒤로" onClick={back} style={{ marginLeft: -8 }} />}
      title={detailLook.label}
      right={multi ? <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' }}>{detailIndex + 1} / {detailTotal}</span> : null}
    />
  );

  /* ---- 데스크탑: 왼쪽에 지금 보는 코디, 오른쪽에 룩북의 나머지를 흐리게 깔아 한눈에 ---- */
  if (wide) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {topBar}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--gap-header) 0 40px' }}>
          <div style={{
            display: 'grid', gap: 28, alignItems: 'start', padding: '0 22px',
            gridTemplateColumns: multi ? 'minmax(300px, 400px) minmax(0, 1fr)' : 'minmax(300px, 440px)',
            justifyContent: multi ? 'start' : 'center',
          }}>
            <div key={detailLook.id} className="lb-anim-in">{card}</div>
            {multi && (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>룩북의 다른 코디</span>
                  <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>{detailTotal}개</span>
                </div>
                <div ref={railRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12 }}>
                  {(savedLooks || []).map((lk) => (
                    <RailCard key={lk.id} look={lk} active={lk.id === detailLook.id} onClick={() => openDetail(lk)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---- 모바일: 카드 하나를 좌우로 넘긴다. 인디케이터는 카드 길이와 무관하게 늘 같은 자리 ---- */
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {topBar}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--gap-header) 18px 16px' }}>
        <div
          key={detailLook.id}
          className={dir ? (dir > 0 ? 'lb-slide-l' : 'lb-slide-r') : ''}
          onTouchStart={onStart} onTouchEnd={onEnd}
        >
          {card}
        </div>
      </div>

      <div style={{
        flex: 'none', padding: '12px 14px max(env(safe-area-inset-bottom), 14px)',
        borderTop: '1px solid var(--line)', background: 'var(--ivory)',
      }}>
        {multi && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
            {Array.from({ length: detailTotal }).map((_, i) => (
              <span key={i} style={{ width: i === detailIndex ? 18 : 6, height: 6, borderRadius: 999, background: i === detailIndex ? 'var(--accent)' : 'var(--line-2)', transition: 'all var(--dur) var(--ease)' }} />
            ))}
          </div>
        )}
        <p style={{ margin: multi ? '10px 0 0' : 0, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, textAlign: 'center' }}>
          {multi ? '좌우로 넘겨 다른 코디도 볼 수 있어요.' : '실제로 산 옷이라면 한 번에 옷장으로 옮겨둘 수 있어요.'}
        </p>
      </div>
    </div>
  );
}

Object.assign(window, { LookComposite, OutfitCard, OutfitSkeleton, ResultsScreen, LookbookScreen, DetailScreen, SavedCard, MetaChips });
