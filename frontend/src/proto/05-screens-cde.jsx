/* @prototype-ported */
const React = window.React;
const { Badge, Btn, Chip, Eyebrow, Icon, IconBtn, LB_DATA, OUTFITS, Silhouette, Skeleton, Thumb, TopBar } = window;

/* global React, Thumb, Silhouette, Skeleton, Btn, Chip, Badge, IconBtn, Icon, LB_DATA, TopBar, Eyebrow */
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
   LookComposite — 조합 전체를 '하나의 룩 이미지'처럼 한 배경 위에 겹쳍 배치.
   outfit.lookImg 가 있으면 실제 합성 사진을 우선 사용(추후 교체 가능).
   개별 구분은 아래 스와이프 스트립으로 제공.
   ============================================================ */
const LOOK_SLOT = {
  '아우터':   { cx: 44, cy: 39, w: 58, h: 58, z: 1, rot: 0 },
  '상의':     { cx: 58, cy: 28, w: 43, h: 36, z: 3, rot: 0 },
  '하의':     { cx: 40, cy: 61, w: 44, h: 47, z: 2, rot: 0 },
  '원피스':   { cx: 48, cy: 53, w: 54, h: 64, z: 2, rot: 0 },
  '신발':     { cx: 68, cy: 84, w: 33, h: 22, z: 4, rot: 0 },
  '액세서리': { cx: 78, cy: 58, w: 24, h: 24, z: 5, rot: 0 },
};
function LookComposite({ outfit, items, ratio = '4 / 5' }) {
  const cleanItems = (items || []).filter(Boolean);
  if (outfit && outfit.lookImg) {
    return (
      <div style={{ background: 'var(--ivory)', borderRadius: 'var(--r-md)', overflow: 'hidden', aspectRatio: ratio }}>
        <img src={outfit.lookImg} alt={cleanItems.map((i) => i.name).join(' · ')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  const used = {};
  return (
    <div style={{ position: 'relative', background: 'var(--ivory)', borderRadius: 'var(--r-md)', overflow: 'hidden', aspectRatio: ratio }}>
      {cleanItems.map((it) => {
        const base = LOOK_SLOT[it.category] || LOOK_SLOT['상의'];
        const n = used[it.category] || 0; used[it.category] = n + 1;
        const cx = base.cx + n * 8, cy = base.cy + n * 5;
        const frame = {
          position: 'absolute', left: cx + '%', top: cy + '%', width: base.w + '%', height: base.h + '%',
          transform: `translate(-50%,-50%) rotate(${base.rot}deg)`, zIndex: base.z,
          display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        };
        return it.img
          ? (
            <div key={it.id} style={frame}>
              <img src={it.img} alt={it.name} loading="lazy" style={{
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
   Outfit card — 조합 룩 이미지를 히어로, 구성 아이템은 아래 스와이프.
   ============================================================ */
function OutfitCard({ outfit, saved, onSave }) {
  const items = outfit.itemIds.map((id) => LB_DATA.ALL[id]);
  return (
    <div className="lb-anim-in" style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 'var(--s4)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--s3)' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{outfit.label}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>{outfit.mood}</div>
        </div>
        <button onClick={onSave} className="lb-save" aria-label="이 코디 저장" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none',
          padding: '8px 13px 8px 11px', borderRadius: 'var(--r-pill)', fontSize: 12.5, fontWeight: 700,
          color: saved ? 'var(--accent-ink)' : 'var(--ink)',
          background: saved ? 'var(--accent)' : 'transparent',
          boxShadow: saved ? 'none' : 'inset 0 0 0 1.4px var(--line-2)',
          transition: 'all var(--dur) var(--ease)',
        }}>
          <Icon name="heart" size={15} fill={saved ? 'currentColor' : 'none'} stroke={saved ? 0 : 2} />
          {saved ? '저장됨' : '저장'}
        </button>
      </div>

      {/* HERO — 조합 전체를 하나의 룩 이미지로 */}
      <LookComposite outfit={outfit} items={items} ratio="4 / 5" />

      {/* 개별 아이템 — 옆으로 스와이프 */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: 'var(--s4) 0 8px' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>구성 아이템</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>옆으로 넘겨보기</span>
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2, scrollSnapType: 'x proximity' }}>
        {items.map((it) => (
          <div key={it.id} style={{ width: 62, flex: 'none', scrollSnapAlign: 'start' }}>
            <div style={{ padding: it.isAnchor ? 2.5 : 0, background: it.isAnchor ? 'var(--accent)' : 'transparent', borderRadius: it.isAnchor ? 11 : 'var(--r-sm)' }}>
              <div style={{ borderRadius: it.isAnchor ? 8 : 'var(--r-sm)', overflow: 'hidden', boxShadow: it.isAnchor ? 'none' : 'inset 0 0 0 1px var(--line)' }}>
                <Thumb item={it} radius={it.isAnchor ? '8px' : 'var(--r-sm)'} />
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 5, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
            <div style={{ fontSize: 10, fontWeight: 700, marginTop: 1, color: it.isAnchor ? 'var(--accent)' : 'var(--ink-3)' }}>{it.isAnchor ? '고민 중' : '내 옷장'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutfitSkeleton() {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 'var(--s4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--s3)' }}>
        <div><Skeleton w={120} h={16} /><Skeleton w={84} h={11} style={{ marginTop: 8 }} /></div>
        <Skeleton w={62} h={32} radius="var(--r-pill)" />
      </div>
      <div style={{ background: 'var(--ivory)', borderRadius: 'var(--r-md)', overflow: 'hidden', aspectRatio: '4 / 5' }}><Skeleton h="100%" radius="0" /></div>
      <div style={{ display: 'flex', gap: 10, marginTop: 'var(--s4)' }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} w={62} h={78} radius="var(--r-sm)" />)}</div>
    </div>
  );
}

/* ============================================================
   C · Combo results (AI)
   ============================================================ */
function ResultsScreen({ ctx }) {
  const { back, anchor, loading, savedOutfitIds, saveOutfit } = ctx;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <TopBar
        left={<IconBtn name="chevL" label="뒤로" onClick={back} style={{ marginLeft: -8 }} />}
        title="조합 추천"
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 18px 32px' }}>
        {/* anchor block */}
        <div style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'center', padding: 'var(--s4)', background: 'var(--surface)', borderRadius: 'var(--r-lg)', marginBottom: 'var(--s5)' }}>
          <div style={{ width: 92, flex: 'none' }}><Thumb item={anchor} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Eyebrow>고민 중인 옷</Eyebrow>
            <div style={{ fontSize: 17, fontWeight: 700, margin: '6px 0 8px', textWrap: 'pretty' }}>{anchor.name}</div>
            <MetaChips item={anchor} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--s3)' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{loading ? '어울리는 조합을 찾는 중' : '내 옷장과 어울리는 코디'}</div>
          {!loading && <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{LB_DATA.OUTFITS.length}벌</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
          {loading
            ? [0, 1, 2].map((i) => <OutfitSkeleton key={i} />)
            : LB_DATA.OUTFITS.map((o) => (
                <OutfitCard key={o.id} outfit={o}
                  saved={savedOutfitIds.includes(o.id)} onSave={() => saveOutfit(o.id)} />
              ))}
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

function LookbookScreen({ ctx }) {
  const { saved, openDetail, tab, hasWardrobe, startComboOrWardrobe, wide } = ctx;

  if (saved.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar left={<div style={{ fontWeight: 800, fontSize: 19 }}>룩북</div>} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 40px 80px' }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)', marginBottom: 'var(--s5)' }}>
            <Icon name="bookmark" size={38} stroke={1.4} />
          </div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>저장한 코디가 없어요</h1>
          <p style={{ margin: '10px 0 0', fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.5, maxWidth: 250 }}>
            마음에 드는 조합을 저장하면 여기에 모여요. 구매가 아니라, 그냥 기록이에요.
          </p>
          <div style={{ marginTop: 'var(--s7)', width: '100%', maxWidth: 280 }}>
            <Btn full size="lg" icon="sparkle" onClick={startComboOrWardrobe}>{hasWardrobe ? '조합 추천받기' : '옷장 채우러 가기'}</Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {!wide && <TopBar left={<div style={{ fontWeight: 800, fontSize: 19 }}>룩북</div>} right={<span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>{saved.length}개</span>} />}
      <div style={{ flex: 1, overflowY: 'auto', padding: wide ? '28px 0 36px' : '4px 18px 28px' }}>
       <div className={wide ? 'lb-wide-inner' : ''}>
        {wide && (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
            <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800 }}>룩북</h1>
            <span style={{ fontSize: 13.5, color: 'var(--ink-3)', fontWeight: 600 }}>{saved.length}개</span>
          </div>
        )}
        <div className="lb-grid">
          {saved.map((lk) => <SavedCard key={lk.id} look={lk} onOpen={() => openDetail(lk)} />)}
        </div>
       </div>
      </div>
    </div>
  );
}

/* ============================================================
   E · Coordi detail
   ============================================================ */
function DetailScreen({ ctx }) {
  const { back, detailLook, addedItemIds, addToWardrobe, detailIndex, detailTotal, gotoLook, wide } = ctx;
  const outfit = LB_DATA.OUTFIT_BY_ID[detailLook.outfitId];
  const items = outfit.itemIds.map((id) => LB_DATA.ALL[id]);
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

  const ArrowBtn = ({ d, name }) => (
    <button onClick={() => nav(d)} aria-label={d > 0 ? '다음 코디' : '이전 코디'} className="lb-iconbtn lb-detail-arrow" style={{
      width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none',
      background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'inset 0 0 0 1px var(--line)',
    }}>
      <Icon name={name} size={20} />
    </button>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <TopBar
        left={<IconBtn name="chevL" label="뒤로" onClick={back} style={{ marginLeft: -8 }} />}
        title={detailLook.label}
        right={multi ? <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' }}>{detailIndex + 1} / {detailTotal}</span> : null}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
          {multi && <div style={{ display: 'flex', alignItems: 'center' }}><ArrowBtn d={-1} name="chevL" /></div>}

          <div
            key={detailLook.id}
            className={dir ? (dir > 0 ? 'lb-slide-l' : 'lb-slide-r') : ''}
            onTouchStart={onStart} onTouchEnd={onEnd}
            style={{ flex: 1, minWidth: 0 }}
          >
            {/* one card: main coordi flatlay + item list (matches the recommendation card) */}
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 'var(--s4)' }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 'var(--s3)' }}>{outfit.mood} · {items.length}개 품목</div>

              <LookComposite outfit={outfit} items={items} ratio="4 / 5" />

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

            <p style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, marginTop: 'var(--s4)', textAlign: 'center' }}>
              {multi ? '좌우로 넘겨 다른 코디도 볼 수 있어요.' : '실제로 산 옷이라면 한 번에 옷장으로 옮겨둘 수 있어요.'}
            </p>
          </div>

          {multi && <div style={{ display: 'flex', alignItems: 'center' }}><ArrowBtn d={1} name="chevR" /></div>}
        </div>

        {/* dots */}
        {multi && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 'var(--s2)' }}>
            {Array.from({ length: detailTotal }).map((_, i) => (
              <span key={i} style={{ width: i === detailIndex ? 18 : 6, height: 6, borderRadius: 999, background: i === detailIndex ? 'var(--accent)' : 'var(--line-2)', transition: 'all var(--dur) var(--ease)' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { LookComposite, OutfitCard, OutfitSkeleton, ResultsScreen, LookbookScreen, DetailScreen, SavedCard, MetaChips });
