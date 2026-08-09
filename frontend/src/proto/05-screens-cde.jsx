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
/* 정사각으로 정규화된 제품 컷을 Codimap식 플랫레이로 펼친다.
   사람 실루엣처럼 포개지지 않도록 주 의류는 좌우로 나누고, 신발·소품은 남은
   가장자리에 충분히 크게 둔다. 값은 코디 가로폭 대비 정사각 프레임의 비율이다. */
const LOOK_SIZE = {
  '아우터': 60, '상의': 56, '하의': 56, '스커트': 50, '원피스': 72,
  '신발': 47, '가방': 43, '모자': 37, '소품': 33,
  '액세서리': 37, // 구버전 데이터 호환
};
const LOOK_SCALE = 1;

/* 주 의류는 서로의 중심선을 침범하지 않고, 액세서리는 빈 모서리를 쓴다. */
const LOOK_SPOT = {
  bottom: { cx: 28, cy: 45, z: 2 },
  dress:  { cx: 48, cy: 46, z: 2 },
  outer:  { cx: 72, cy: 38, z: 2 },
  top:    { cx: 70, cy: 46, z: 3 },
  layer:  { cx: 56, cy: 57, z: 4 }, // 아우터가 있을 때만 중앙 앞쪽
  shoes:  { cx: 64, cy: 86, z: 5 },
  bag:    { cx: 83, cy: 75, z: 5 },
  hat:    { cx: 84, cy: 60, z: 6 },
  small:  { cx: 23, cy: 13, z: 6 },
};
const LOOK_ROLE = {
  '하의': 'bottom', '스커트': 'bottom', '원피스': 'dress',
  '아우터': 'outer', '상의': 'top',
  '신발': 'shoes', '가방': 'bag',
  '모자': 'hat', '액세서리': 'hat', '소품': 'small',
};

/** 아이템별 자리를 정한다. 같은 자리에 둘 이상이면 조금씩 밀어 겹쳐 놓는다. */
function lookPlacement(items) {
  const hasOuter = items.some((it) => LOOK_ROLE[it.category] === 'outer');
  const taken = {};
  const out = {};
  items.forEach((it) => {
    const role = LOOK_ROLE[it.category] || 'top';
    const spot = role === 'top' && hasOuter ? 'layer' : role;
    const base = LOOK_SPOT[spot] || LOOK_SPOT.top;
    const n = taken[spot] || 0; taken[spot] = n + 1;
    out[it.id] = { cx: base.cx + n * 5, cy: base.cy + n * 4, z: base.z + n };
  });
  return out;
}

function LookComposite({ outfit, items, ratio = '4 / 5', bg = 'var(--thumb-bg)', scale = LOOK_SCALE }) {
  const cleanItems = (items || []).filter(Boolean);
  // AI 착장 이미지는 세로로 길어(2:3) 카드 비율에 맞춰 자르면 머리나 신발이 날아간다. 통째로 넣는다.
  if (outfit && outfit.lookImg) {
    return (
      <div style={{ background: bg, borderRadius: 'var(--r-md)', overflow: 'hidden', aspectRatio: ratio }}>
        <img src={outfit.lookImg} alt={cleanItems.map((i) => i.name).join(' · ')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    );
  }
  const place = lookPlacement(cleanItems);
  return (
    <div style={{ position: 'relative', background: bg, borderRadius: 'var(--r-md)', overflow: 'hidden', aspectRatio: ratio }}>
      {cleanItems.map((it) => {
        const at = place[it.id] || LOOK_SPOT.top;
        const size = Math.min(100, (LOOK_SIZE[it.category] || LOOK_SIZE['상의']) * scale);
        const frame = {
          position: 'absolute', left: at.cx + '%', top: at.cy + '%', width: size + '%', aspectRatio: '1',
          transform: 'translate(-50%,-50%)', zIndex: at.z,
          display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        };
        return it.img
          ? (
            <div key={it.id} style={frame}>
              <img src={it.img} alt={it.name} loading="lazy" decoding="async" style={{
                width: '100%', height: '100%', objectFit: 'contain', display: 'block',
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
/* 카드 위 보조 버튼은 옷장 카드와 같은 자리를 쓴다. 오른쪽 하트는 오늘 코디에서 눌러
   담았던 그 하트 그대로라, 채워져 있으면 담긴 것이고 다시 누르면 뺀다.
   inSelectUx일 때 하트를 감추는 것도 옷장과 같다 — 두 버튼이 함께 뜨면 오조작이 난다. */
function SavedCard({ look, onOpen, onRemove, selected, showSel, onToggleSel, inSelectUx, wide }) {
  const outfit = LB_DATA.OUTFIT_BY_ID[look.outfitId];
  const items = outfit.itemIds.map((id) => LB_DATA.ALL[id]);
  return (
    <div className="lb-anim-in lb-savedcard" style={{ position: 'relative', minWidth: 0, background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 10 }}>
      <button onClick={onOpen} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', padding: 0 }}>
        <LookComposite outfit={outfit} items={items} ratio="1 / 1" />
        <div style={{ padding: '10px 4px 4px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{look.label}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{items.length}개 품목 · {look.savedAt}</div>
        </div>
      </button>

      {onToggleSel && (showSel || wide) && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSel(); }}
          aria-label={selected ? '선택 해제' : '선택'}
          aria-pressed={selected}
          style={{
            position: 'absolute', left: 14, top: 14, width: 20, height: 20, borderRadius: '50%',
            display: 'grid', placeItems: 'center', zIndex: 3,
            opacity: showSel ? 1 : 0,
            pointerEvents: showSel ? 'auto' : 'none',
            background: selected ? 'var(--accent)' : 'color-mix(in srgb, var(--surface-2) 90%, transparent)',
            color: selected ? 'var(--accent-ink)' : 'transparent',
            boxShadow: selected ? 'none' : 'inset 0 0 0 1.5px var(--line-2)',
            backdropFilter: 'blur(6px)',
            transition: 'opacity var(--dur) var(--ease), background var(--dur) var(--ease)',
          }}
        >
          {selected && <Icon name="check" size={11} stroke={2.6} />}
        </button>
      )}

      {!inSelectUx && onRemove && (
        <button
          type="button"
          className="lb-save"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={look.label + ' 룩북에서 빼기'}
          style={{
            position: 'absolute', right: 11, top: 11, width: 26, height: 26, borderRadius: '50%',
            display: 'grid', placeItems: 'center', zIndex: 2,
            color: 'var(--accent-ink)', background: 'var(--accent)',
          }}
        >
          <Icon name="heart" size={14} fill="currentColor" stroke={0} />
        </button>
      )}
    </div>
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

      {/* 고른 것 미리보기 — 비어 있어도 담길 자리를 네모로 그려둔다. 빈 칸이 보여야
          '고르면 여기 들어온다'가 읽히고, 고르는 동안 시트 높이도 들썩이지 않는다. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, height: 60,
        margin: '10px 0 0', padding: '4px 20px',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {picked.map((it) => (
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
        {/* 빈 자리는 최소 세 칸으로 시작하고, 다 채워도 한 칸은 남겨 더 담을 수 있다고 알린다.
            바로 다음에 채워질 칸에만 +를 띄워 시선이 한 곳으로 모이게 한다. */}
        {Array.from({ length: Math.max(3 - picked.length, 1) }).map((_, i) => (
          <div key={'slot' + i} aria-hidden="true" style={{
            flex: 'none', width: 52, height: 52, boxSizing: 'border-box',
            borderRadius: 'var(--r-sm)',
            // 아이템 썸네일과 같은 판을 깔아서, 빈 칸이 '아직 안 올라온 자리'로 읽히게 한다
            background: 'var(--thumb-bg)',
            border: '1.5px dashed var(--line-2)',
            display: 'grid', placeItems: 'center',
            color: i === 0 ? 'var(--ink-3)' : 'transparent',
          }}>
            <Icon name="plus" size={16} stroke={2.2} />
          </div>
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
  const { saved, openDetail, tab, hasWardrobe, startComboOrWardrobe, wide, items, createManualLook, requestUnsave, bulkUnsave } = ctx;
  const [makeOpen, setMakeOpen] = useSc(false);
  // 여러 개 정리 — 옷장 선택 모드와 같은 규칙. 데스크탑은 hover로 체크가 뜨고,
  // 모바일은 hover가 없어서 헤더의 '선택'으로 모드를 켠다.
  const [sel, setSel] = useSc([]);
  const [selectMode, setSelectMode] = useSc(false);
  const [hoverId, setHoverId] = useSc(null);
  const [bulkAsk, setBulkAsk] = useSc(false);
  // 수동 조합도 추천과 같은 기준(상의+하의)이 필요해서, 옷장이 준비됐을 때만 연다.
  const canMake = hasWardrobe && (items || []).length >= 2;
  const openMake = () => setMakeOpen(true);

  const selCount = sel.length;
  const selecting = selCount > 0;
  const inSelectUx = selectMode || selecting;
  // 선택 중에는 개수 자리를 안내 문구가 대신한다. 문구를 따로 한 줄 깔면 켤 때마다
  // 아래 카드가 밀려서, 옷장처럼 자리는 그대로 두고 글자만 바뀌게 한다.
  const countLabel = inSelectUx ? '코디를 눌러 고르세요' : saved.length + '개';
  const toggleSel = (id) => setSel((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  const exitSelectMode = () => { setSel([]); setSelectMode(false); setBulkAsk(false); };
  const runBulkUnsave = () => { bulkUnsave(sel); exitSelectMode(); };
  // 직접 만든 코디가 섞여 있으면 되돌릴 수 없다는 걸 확인 단계에서 알려준다.
  const manualCount = sel.filter((id) => {
    const lk = saved.find((l) => l.id === id);
    return lk && (LB_DATA.OUTFIT_BY_ID[lk.outfitId] || {}).manual;
  }).length;

  const selectBtn = (
    <button type="button" onClick={() => (inSelectUx ? exitSelectMode() : setSelectMode(true))}
      style={{ fontSize: wide ? 13.5 : 13, fontWeight: 700, padding: '6px 8px', color: inSelectUx ? 'var(--ink)' : 'var(--ink-2)' }}>
      {inSelectUx ? '완료' : '선택'}
    </button>
  );

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
        paddingBottom: selecting ? (wide ? 88 : 96) : undefined,
      }}>
        <div className={wide ? 'lb-wide-inner' : undefined}>
          {wide ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--gap-header)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800 }}>룩북</h1>
                <span style={{ fontSize: 13.5, color: 'var(--ink-3)', fontWeight: 600 }}>{countLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {selectBtn}
                {/* 선택 중에는 감추되 자리는 남긴다. 버튼이 통째로 빠지면 이 줄 높이가
                    제목 높이로 줄면서 아래 카드가 몇 px 딸려 올라간다.
                    visibility만 끄면 탭 순서에서도 빠져서 눌릴 일이 없다. */}
                {canMake && (
                  <div style={{ visibility: inSelectUx ? 'hidden' : 'visible' }} aria-hidden={inSelectUx || undefined}>
                    <Btn size="sm" variant="secondary" icon="plus" onClick={openMake}>직접 만들기</Btn>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--gap-header)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>룩북</h1>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>{countLabel}</span>
              </div>
              {selectBtn}
            </div>
          )}
          <div className="lb-grid">
            {saved.map((lk) => {
              const on = sel.includes(lk.id);
              return (
                <div key={lk.id} style={{ minWidth: 0 }}
                  onMouseEnter={() => wide && setHoverId(lk.id)}
                  onMouseLeave={() => wide && setHoverId((h) => (h === lk.id ? null : h))}>
                  <SavedCard
                    look={lk}
                    onOpen={() => (inSelectUx ? toggleSel(lk.id) : openDetail(lk))}
                    onRemove={() => requestUnsave(lk.outfitId)}
                    selected={on}
                    showSel={wide ? (on || inSelectUx || hoverId === lk.id) : (selectMode || on)}
                    onToggleSel={() => { if (!selectMode) setSelectMode(true); toggleSel(lk.id); }}
                    inSelectUx={inSelectUx}
                    wide={wide}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selecting && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: wide ? 22 : 12, zIndex: 30,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
          padding: wide ? '0 24px' : '0 14px',
        }}>
          <div style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', maxWidth: '100%',
            padding: '10px 22px', borderRadius: 'var(--r-pill)',
            background: 'color-mix(in srgb, var(--surface) 94%, transparent)',
            boxShadow: '0 10px 32px -10px color-mix(in srgb, var(--ink) 28%, transparent), inset 0 0 0 1px var(--line)',
            backdropFilter: 'blur(10px)',
          }}>
            <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{selCount}개 선택됨</span>
            <button onClick={() => setSel([])} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', padding: '4px 2px' }}>선택 해제</button>
            <Btn size="sm" icon="x" onClick={() => setBulkAsk(true)}
              style={{ background: '#B0573C', color: '#fff', fontSize: 12, padding: '7px 12px' }}>룩북에서 빼기</Btn>
          </div>
        </div>
      )}

      <BottomSheet open={bulkAsk} onClose={() => setBulkAsk(false)}>
        <div style={{ padding: '10px 24px 26px', textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>선택한 {selCount}개를 룩북에서 뺄까요?</h3>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, wordBreak: 'keep-all' }}>
            {manualCount > 0
              ? <>직접 만든 코디 {manualCount}개가 있어요. 다른 곳에 남지 않아 <b style={{ color: 'var(--ink)', fontWeight: 700 }}>되돌릴 수 없어요.</b></>
              : '추천에서 저장한 코디는 나중에 다시 담을 수 있어요.'}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <Btn variant="soft" onClick={() => setBulkAsk(false)} style={{ flex: 1 }}>취소</Btn>
            <Btn icon="x" onClick={runBulkUnsave} style={{ flex: 1, background: '#B0573C', color: '#fff' }}>빼기</Btn>
          </div>
        </div>
      </BottomSheet>

      {/* 모바일은 상단바가 없어서 진입점을 하단 도크에 둔다 */}
      {!wide && canMake && !inSelectUx && (
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
  const { back, detailLook, addedItemIds, addToWardrobe, detailIndex, detailTotal, gotoLook, wide, savedLooks, openDetail, requestUnsave } = ctx;
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
      width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
      background: 'color-mix(in srgb, var(--surface) 88%, transparent)', color: 'var(--ink)',
      boxShadow: 'inset 0 0 0 1px var(--line-2)',
    }}>
      <Icon name={name} size={14} />
    </button>
  );

  // 보던 코디를 빼면 그 자리에 다음 코디를 앉힌다. 마지막 하나였다면 목록으로 돌아간다.
  const removeThis = () => {
    const rest = (savedLooks || []).filter((l) => l.id !== detailLook.id);
    requestUnsave(detailLook.outfitId, () => {
      if (!rest.length) { back(); return; }
      openDetail(rest[Math.min(Math.max(detailIndex, 0), rest.length - 1)]);
    });
  };

  // 코디 카드 — 데스크탑·모바일이 같은 카드를 쓰고, 바깥 껍데기만 화면 폭에 따라 달라진다.
  const card = (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 'var(--s4)' }}>
      <div style={{ position: 'relative' }}>
        <LookComposite outfit={outfit} items={items} ratio="4 / 5" />
        {/* 오늘 코디·룩북 카드와 같은 자리의 같은 하트. 상단바에 두면 코디가 아니라
            화면에 달린 버튼처럼 보여서, 코디 이미지에 붙여 둔다. */}
        <button onClick={removeThis} className="lb-save" aria-label="룩북에서 빼기" style={{
          position: 'absolute', right: 8, top: 8, width: 32, height: 32, borderRadius: '50%',
          display: 'grid', placeItems: 'center', zIndex: 2,
          color: 'var(--accent-ink)', background: 'var(--accent)',
        }}>
          <Icon name="heart" size={15} fill="currentColor" stroke={0} />
        </button>
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

  // 몇 번째 코디인지는 데스크탑에선 오른쪽 레일 머리에 적힌다. 여기까지 달면 두 번 읽힌다.
  const topBar = (
    <TopBar
      left={<IconBtn name="chevL" label="뒤로" onClick={back} style={{ marginLeft: -8 }} />}
      title={detailLook.label}
      right={multi && !wide && <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' }}>{detailIndex + 1} / {detailTotal}</span>}
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
                  <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>{detailIndex + 1} / {detailTotal}</span>
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
      <div style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain', padding: 'var(--gap-header) 18px 16px',
      }}>
        <div
          key={detailLook.id}
          className={dir ? (dir > 0 ? 'lb-slide-l' : 'lb-slide-r') : ''}
          onPointerDown={onStart} onPointerUp={onEnd}
          style={{ touchAction: 'pan-y' }}
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
