/* @prototype-ported */
const React = window.React;
const { Badge, BottomSheet, Btn, Chip, EmptyState, Eyebrow, Icon, IconBtn, LB_DATA, OUTFITS, Silhouette, Skeleton, Thumb, TopBar } = window;

/* global React, Thumb, Silhouette, Skeleton, Btn, Chip, Badge, IconBtn, Icon, LB_DATA, TopBar, Eyebrow, EmptyState, LookExpandBadge */
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
/* 4사분면 플랫레이: 상의 | 하의 / 신발 | 악세서리.
   악세서리는 우하단을 다시 2×2로 나눠 안 겹치게 둔다.
   값은 코디 가로폭 대비 정사각 프레임 비율(%). */
const LOOK_SIZE = {
  '아우터': 48, '상의': 46, '하의': 46, '스커트': 44, '원피스': 54,
  '신발': 40, '가방': 30, '모자': 28, '소품': 26,
  '액세서리': 28, // 구버전 데이터 호환
};
/* 아이템이 카드에서 너무 작게 보여 배율을 올렸다. 1.29면 상의·하의 프레임이 각 59%가
   되어 서로 겹치고, 카드 좌우를 남기지 않고 다 쓴다. */
const LOOK_SCALE = 1.29;

/* 프레임을 키워도 옷이 여전히 작아 보이는 이유는 축소가 두 번 걸려서다: 아이템
   이미지 자체가 카테고리별 비율(backend _CATEGORY_FILL)로 캔버스 안에 작게 앉아
   있고, 그 위에 LOOK_SIZE가 또 카테고리별로 줄인다. 신발·모자처럼 캔버스 비율이
   낮은 항목이 특히 심하다. 캔버스 여백만큼 이미지를 확대해 상쇄하면 크기 조절은
   LOOK_SIZE 하나로 정리된다. 오래된 데이터가 과확대되지 않게 상한을 둔다. */
const LOOK_CANVAS_FILL = {
  '아우터': 0.90, '상의': 0.90, '하의': 0.90, '스커트': 0.80, '원피스': 0.90,
  '신발': 0.62, '가방': 0.74, '모자': 0.56, '소품': 0.66, '액세서리': 0.66,
};
const LOOK_ZOOM_MAX = 1.35;
function lookImageZoom(category) {
  const fill = LOOK_CANVAS_FILL[category] || 0.9;
  return Math.min(LOOK_ZOOM_MAX, 1 / fill);
}

/* 4분면 자리. 상의는 이미지가 프레임을 가로로 꽉 채우는데 하의(바지·스커트)는 좁고
   길어서 프레임 안에 좌우 여백을 남긴다. 그래서 프레임을 좌우 벽에 붙이면 상의만
   벽에 닿고 하의 쪽엔 빈 공간이 남는다. 두 벌을 한 덩어리로 보고 그 덩어리를 카드
   가운데 놓는다 — 상의는 오른쪽으로, 하의는 왼쪽으로 당겨 살짝 겹친다. */
const LOOK_SPOT = {
  // 좌상 · 상의(아우터/상의/원피스)
  outer:  { cx: 34, cy: 38, z: 2 },
  top:    { cx: 34, cy: 40, z: 3 },
  layer:  { cx: 39, cy: 44, z: 4 }, // 아우터+상의일 때 상의를 살짝 앞·안쪽
  dress:  { cx: 35, cy: 42, z: 2 },
  // 우상 · 하의
  bottom: { cx: 71, cy: 40, z: 2 },
  // 좌하 · 신발
  shoes:  { cx: 29, cy: 75, z: 5 },
};
/* 우하 · 악세서리 2×2 (가방·모자·소품 등) */
const LOOK_ACC_SPOTS = [
  { cx: 65, cy: 74, z: 6 },
  { cx: 87, cy: 74, z: 6 },
  { cx: 65, cy: 92, z: 6 },
  { cx: 87, cy: 92, z: 6 },
];
const LOOK_ROLE = {
  '하의': 'bottom', '스커트': 'bottom', '원피스': 'dress',
  '아우터': 'outer', '상의': 'top',
  '신발': 'shoes',
  '가방': 'acc', '모자': 'acc', '액세서리': 'acc', '소품': 'acc',
};

/** 아이템별 자리를 정한다. 같은 분면에 둘 이상이면 조금씩 밀어 겹쳐 놓는다. */
function lookPlacement(items) {
  const hasOuter = items.some((it) => LOOK_ROLE[it.category] === 'outer');
  // 상·하의만 있는 코디는 아래 절반이 통째로 비어 위로 쏠려 보인다. 그럴 때만 내려 앉힌다.
  const hasLower = items.some((it) => {
    const role = LOOK_ROLE[it.category];
    return role === 'shoes' || role === 'acc';
  });
  const dy = hasLower ? 0 : 12;
  const taken = {};
  const out = {};
  let accIdx = 0;
  items.forEach((it) => {
    const role = LOOK_ROLE[it.category] || 'top';
    if (role === 'acc') {
      const base = LOOK_ACC_SPOTS[accIdx % LOOK_ACC_SPOTS.length];
      const lap = Math.floor(accIdx / LOOK_ACC_SPOTS.length);
      out[it.id] = {
        cx: base.cx + lap * 3,
        cy: base.cy + lap * 3,
        z: base.z + accIdx,
      };
      accIdx += 1;
      return;
    }
    const spot = role === 'top' && hasOuter ? 'layer' : role;
    const base = LOOK_SPOT[spot] || LOOK_SPOT.top;
    const n = taken[spot] || 0;
    taken[spot] = n + 1;
    out[it.id] = { cx: base.cx + n * 4, cy: base.cy + n * 4 + dy, z: base.z + n };
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
        if (it.img) {
          return (
            <div key={it.id} style={frame}>
              <img src={it.thumb || it.img} alt={it.name} loading="lazy" decoding="async" style={{
                width: '100%', height: '100%', objectFit: 'contain', display: 'block',
                transform: `scale(${lookImageZoom(it.category)})`,
              }} />
            </div>
          );
        }
        // 옷장에 없는 제안 아이템은 사진이 없다. 점선 자리로 그려 '아직 없는 옷'임을 드러낸다.
        if (it.wish) {
          return (
            <div key={it.id} style={{ ...frame, flexDirection: 'column', gap: 3, padding: 4, boxSizing: 'border-box' }}>
              <div style={{
                width: '78%', height: '78%', borderRadius: 'var(--r-md)',
                border: '1.5px dashed var(--line-2)', color: 'var(--ink-3)',
                display: 'grid', placeItems: 'center', boxSizing: 'border-box',
                background: 'color-mix(in srgb, var(--surface) 70%, transparent)',
              }}>
                <Silhouette category={it.category} />
              </div>
            </div>
          );
        }
        return <div key={it.id} style={{ ...frame, color: 'var(--ink-3)' }}><Silhouette category={it.category} /></div>;
      })}
    </div>
  );
}

/* 아이템 상세 Thumb 확대 뱃지와 같은 자리·톤 — 코디도 크게 볼 수 있음을 드러낸다. */
function LookExpandBadge({ size = 28, inset = 8 }) {
  const icon = Math.max(11, Math.round(size * 0.46));
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute', right: inset, bottom: inset, width: size, height: size, borderRadius: '50%',
        background: 'color-mix(in srgb, var(--ink) 72%, transparent)', color: '#fff',
        display: 'grid', placeItems: 'center', zIndex: 2, pointerEvents: 'none',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.12)',
      }}
    >
      <Icon name="search" size={icon} stroke={2.4} />
    </span>
  );
}



/* ============================================================
   PickedOutfitsModal — 옷장에서 고른 옷으로 만든 코디
   룩북 카드와 같은 레이아웃·같은 동작(탭하면 상세, 하트로 저장)을 쓴다.
   탭을 갈아타지 않고 모달로 얹어, 옷장에서 고르던 흐름을 끊지 않는다.
   ============================================================ */
function PickedOutfitsModal({ state, onClose, onMore, savedOutfitIds = [], onSave, onOpen, wide }) {
  const { ids = [], loading, outfits = [], error } = state || {};
  const picked = ids.map((id) => LB_DATA.ALL[id]).filter(Boolean);
  const looks = outfits.map((o) => ({ id: 'pick-' + o.id, outfitId: o.id, label: o.label }));
  const first = loading && !outfits.length;

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: wide ? 20 : 18.5, fontWeight: 800, lineHeight: 1.3 }}>
            고른 옷으로 만든 코디
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, wordBreak: 'keep-all' }}>
            {picked.map((it) => it.name).join(' · ') || '고른 아이템'}
          </p>
        </div>
        <IconBtn name="x" label="닫기" onClick={onClose} style={{ flex: 'none', marginTop: -4, marginRight: -6 }} />
      </div>

      <div style={{ marginTop: 'var(--s4)' }}>
        {error ? (
          <div style={{ padding: '28px 4px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>{error}</p>
            <div style={{ marginTop: 16 }}>
              <Btn variant="soft" icon="sparkle" onClick={onMore}>다시 시도</Btn>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: wide ? 'repeat(auto-fill, minmax(178px, 1fr))' : 'repeat(2, minmax(0, 1fr))',
            gap: wide ? 14 : 12,
          }}>
            {outfits.map((o, i) => {
              const items = (o.itemIds || []).map((id) => LB_DATA.ALL[id]).filter(Boolean);
              const saved = savedOutfitIds.includes(o.id);
              return (
                <div key={o.id} className="lb-anim-in" style={{ position: 'relative', minWidth: 0, background: 'var(--ivory)', borderRadius: 'var(--r-lg)', padding: 10 }}>
                  <button
                    onClick={() => onOpen && onOpen(looks[i], looks)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', padding: 0 }}
                  >
                    <LookComposite outfit={o} items={items} ratio="1 / 1" bg="var(--surface-2)" />
                    <div style={{ padding: '10px 4px 4px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, textWrap: 'pretty' }}>{o.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>
                        {items.length}개 품목{items.some((it) => it.wish) ? ' · 새 아이템 포함' : ''}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSave && onSave(o.id); }}
                    className="lb-save"
                    aria-label={saved ? '룩북에서 빼기' : '룩북에 저장'}
                    style={{
                      position: 'absolute', right: 12, top: 12, width: 30, height: 30, borderRadius: '50%',
                      display: 'grid', placeItems: 'center', zIndex: 2,
                      color: saved ? 'var(--accent-ink)' : 'var(--ink)',
                      background: saved ? 'var(--accent)' : 'color-mix(in srgb, var(--surface) 88%, transparent)',
                      boxShadow: saved ? 'none' : 'inset 0 0 0 1px var(--line-2)', backdropFilter: 'blur(4px)',
                    }}
                  >
                    <Icon name="heart" size={14} fill={saved ? 'currentColor' : 'none'} stroke={saved ? 0 : 2} />
                  </button>
                </div>
              );
            })}
            {(first || loading) && Array.from({ length: first ? 4 : 2 }).map((_, i) => (
              <div key={'sk' + i} style={{ background: 'var(--ivory)', borderRadius: 'var(--r-lg)', padding: 10 }}>
                <div style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', aspectRatio: '1 / 1' }}><Skeleton h="100%" radius="0" /></div>
                <div style={{ padding: '10px 4px 4px' }}><Skeleton w="70%" h={14} /><Skeleton w="45%" h={11} style={{ marginTop: 7 }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!error && !!outfits.length && (
        <div style={{ marginTop: 'var(--s4)' }}>
          <Btn full variant="soft" icon="sparkle" onClick={onMore} disabled={loading}>
            {loading ? '만드는 중… 최대 10초' : '코디 2개 더 받기'}
          </Btn>
        </div>
      )}
    </>
  );

  if (!wide) {
    return (
      <BottomSheet open onClose={onClose}>
        <div className="lb-sheet-body lb-scrollable" style={{ padding: '10px 18px 24px', maxHeight: '78vh' }}>{body}</div>
      </BottomSheet>
    );
  }
  return (
    <div
      className="lb-sheet-scrim"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'color-mix(in srgb, var(--ink) 42%, transparent)', display: 'grid', placeItems: 'center', padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="lb-anim-in lb-scrollable"
        style={{
          width: 'min(860px, 100%)', maxHeight: '84vh', background: 'var(--surface)',
          borderRadius: 'var(--r-lg)', padding: '22px 24px 24px', boxSizing: 'border-box',
          boxShadow: '0 24px 60px -20px rgba(0,0,0,0.4)',
        }}
      >
        {body}
      </div>
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
            cursor: onView ? 'zoom-in' : 'default', textAlign: 'left', position: 'relative',
          }}
        >
          <LookComposite outfit={outfit} items={items} ratio="4 / 5" />
          {onView ? <LookExpandBadge /> : null}
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
      <div className="lb-scrollable" style={{ flex: 1,  padding: wide ? 'var(--gap-header) 0 36px' : 'var(--gap-header) 18px 32px' }}>
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
      <div className="lb-scrollable" style={{ height: '38vh',  padding: '2px 20px 12px',  }}>
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
      <div className="lb-scrollable" style={{
        flex: 1,
        // 단축(padding)과 롱핸드(paddingBottom)를 같이 주면 나머지 방향이 비어 버린다.
        // 하단은 '직접 코디 만들기' 도크(약 90px)를 가리지 않을 만큼 반드시 비워 둔다.
        paddingTop: wide ? 28 : 'calc(env(safe-area-inset-top, 0px) + 22px)',
        paddingLeft: wide ? 0 : 18,
        paddingRight: wide ? 0 : 18,
        paddingBottom: wide ? (selecting ? 88 : 36) : (selecting ? 148 : 124),
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
  const {
    back, detailLook, addedItemIds, addToWardrobe, detailIndex, detailTotal, gotoLook, wide,
    savedLooks, openDetail, requestUnsave, saveOutfit, openOutfitViewer,
    detailLooks, detailListLabel, detailFromLookbook,
  } = ctx;
  // 룩북에서 왔으면 룩북의 나머지를, 오늘 코디에서 왔으면 그날 코디를 옆에 깐다.
  const looks = (detailLooks && detailLooks.length ? detailLooks : savedLooks) || [];
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
      openDetail(looks[next], detailFromLookbook ? null : looks, detailListLabel);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wide, multi, detailIndex, detailTotal, looks, openDetail, detailFromLookbook, detailListLabel]);

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

  // 룩북에서 보던 코디를 빼면 그 자리에 다음 코디를 앉힌다. 마지막 하나였다면 목록으로.
  const removeThis = () => {
    const rest = (savedLooks || []).filter((l) => l.id !== detailLook.id);
    requestUnsave(detailLook.outfitId, () => {
      if (!rest.length) { back(); return; }
      openDetail(rest[Math.min(Math.max(detailIndex, 0), rest.length - 1)]);
    });
  };
  const isSaved = (savedLooks || []).some((l) => l.outfitId === detailLook.outfitId);
  // 오늘 코디에서 열었으면 이 화면을 떠나지 않는다 — 저장 여부만 바뀐다.
  const onHeart = detailFromLookbook
    ? removeThis
    : () => (isSaved ? requestUnsave(detailLook.outfitId) : saveOutfit(detailLook.outfitId));

  // 코디 카드 — 데스크탑·모바일이 같은 카드를 쓰고, 바깥 껍데기만 화면 폭에 따라 달라진다.
  const card = (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 'var(--s4)' }}>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => openOutfitViewer && openOutfitViewer(outfit, items)}
          aria-label="코디 크게 보기"
          style={{
            display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent',
            cursor: openOutfitViewer ? 'zoom-in' : 'default', textAlign: 'left', position: 'relative',
          }}
        >
          <LookComposite outfit={outfit} items={items} ratio="4 / 5" />
          {openOutfitViewer ? <LookExpandBadge /> : null}
        </button>
        {/* 오늘 코디·룩북 카드와 같은 자리의 같은 하트. 상단바에 두면 코디가 아니라
            화면에 달린 버튼처럼 보여서, 코디 이미지에 붙여 둔다. */}
        <button onClick={onHeart} className="lb-save" aria-label={isSaved ? '룩북에서 빼기' : '룩북에 저장'} style={{
          position: 'absolute', right: 8, top: 8, width: 32, height: 32, borderRadius: '50%',
          display: 'grid', placeItems: 'center', zIndex: 2,
          color: isSaved ? 'var(--accent-ink)' : 'var(--ink)',
          background: isSaved ? 'var(--accent)' : 'color-mix(in srgb, var(--surface-2) 88%, transparent)',
          boxShadow: isSaved ? 'none' : 'inset 0 0 0 1px var(--line-2)', backdropFilter: 'blur(4px)',
          transition: 'all var(--dur) var(--ease)',
        }}>
          <Icon name="heart" size={15} fill={isSaved ? 'currentColor' : 'none'} stroke={isSaved ? 0 : 2} />
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
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>{it.category}{it.color ? ` · ${it.color}` : ''}</div>
                {it.wish && it.reason ? (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.45 }}>{it.reason}</div>
                ) : null}
              </div>
              <div style={{ flex: 'none' }}>
                {it.wish ? <Badge tone="neutral">옷장에 없어요</Badge>
                  : justAdded ? <Badge tone="good" icon="check">추가됨</Badge>
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
        <div className="lb-scrollable" style={{ flex: 1,  padding: 'var(--gap-header) 0 40px' }}>
          <div style={{
            display: 'grid', gap: 28, alignItems: 'start', padding: '0 22px',
            gridTemplateColumns: multi ? 'minmax(300px, 400px) minmax(0, 1fr)' : 'minmax(300px, 440px)',
            justifyContent: multi ? 'start' : 'center',
          }}>
            <div key={detailLook.id} className="lb-anim-in">{card}</div>
            {multi && (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>{detailListLabel}</span>
                  <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>{detailIndex + 1} / {detailTotal}</span>
                </div>
                <div ref={railRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12 }}>
                  {looks.map((lk) => (
                    <RailCard key={lk.id} look={lk} active={lk.id === detailLook.id}
                      onClick={() => openDetail(lk, detailFromLookbook ? null : looks, detailListLabel)} />
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
      <div className="lb-scrollable" style={{
        flex: 1,  
         padding: 'var(--gap-header) 18px 16px',
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
        {(multi || detailFromLookbook) && (
          <p style={{ margin: multi ? '10px 0 0' : 0, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, textAlign: 'center' }}>
            {multi ? '좌우로 넘겨 다른 코디도 볼 수 있어요.' : '실제로 산 옷이라면 한 번에 옷장으로 옮겨둘 수 있어요.'}
          </p>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { LookComposite, LookExpandBadge, PickedOutfitsModal, OutfitCard, OutfitSkeleton, ResultsScreen, LookbookScreen, DetailScreen, SavedCard, MetaChips });
