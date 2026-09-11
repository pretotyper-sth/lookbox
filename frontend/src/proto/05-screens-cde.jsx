/* @prototype-ported */
const React = window.React;
const { useScrollTopOn, Badge, BottomSheet, Btn, Chip, EmptyState, Eyebrow, Icon, IconBtn, LB_DATA, OUTFITS, PullRefresh, Silhouette, Skeleton, Thumb, TopBar } = window;

/* global React, Thumb, Silhouette, Skeleton, Btn, Chip, Badge, IconBtn, Icon, LB_DATA, TopBar, Eyebrow, EmptyState, LookExpandBadge */
// RealCloset — screens C (results), D (lookbook), E (detail). Exported to window.

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
   가방이 우하단을 잡고, 선글라스 같은 소품은 더 작게 모서리에 둔다.
   같은 색·비슷한 크기면 가운데에 포개지 않는다. 값은 가로폭 대비 %. */
const LOOK_SIZE = {
  '아우터': 46, '상의': 44, '하의': 44, '스커트': 42, '원피스': 52,
  '신발': 36, '가방': 30, '모자': 22, '소품': 16,
  '액세서리': 16, // 구버전 데이터 호환
};
/* 아이템이 카드에서 너무 작게 보여 배율을 올렸다. 너무 키우면 소품이 오른쪽
   벽에 붙고 잘린다. 1.16이면 상의·하의가 겹치면서도 가장자리 여백이 남는다.
   개수마다 덩어리 크기가 달라져 3장은 작고 4장은 커 보인다. 오늘 코디는
   그린 뒤 LOOK_PACK으로 한 덩어리를 맞춘다. 1.03은 0.86의 1.2배,
   패킹 전 4개짜리 2번 카드의 약 95%다. 룩북은 pack=false. */
const LOOK_SCALE = 1.16;
const LOOK_PAD = 12;
const LOOK_PACK = 1.03;
/* 상의가 커서 기하 가운데가 위로 보인다. 카드 높이의 이만큼만 내린다. */
const LOOK_NUDGE_Y = 0.024;

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
  outer:  { cx: 36, cy: 38, z: 2 },
  top:    { cx: 36, cy: 40, z: 3 },
  layer:  { cx: 40, cy: 44, z: 4 }, // 아우터+상의일 때 상의를 살짝 앞·안쪽
  dress:  { cx: 38, cy: 42, z: 2 },
  // 우상 · 하의
  bottom: { cx: 66, cy: 40, z: 2 },
  // 좌하 · 신발
  shoes:  { cx: 32, cy: 74, z: 5 },
};
/* 우하 · 악세서리 후보. 0번은 가방 자리, 나머지는 모서리·옆이라
   검정 선글라스가 검정 가방 한가운데에 앉지 않는다. */
const LOOK_ACC_CANDIDATES = [
  { cx: 70, cy: 76, z: 6 },
  { cx: 88, cy: 56, z: 8 },
  { cx: 50, cy: 60, z: 8 },
  { cx: 84, cy: 64, z: 8 },
  { cx: 54, cy: 66, z: 8 },
  { cx: 82, cy: 86, z: 7 },
  { cx: 56, cy: 86, z: 7 },
  { cx: 74, cy: 60, z: 8 },
];
const LOOK_ROLE = {
  '하의': 'bottom', '스커트': 'bottom', '원피스': 'dress',
  '아우터': 'outer', '상의': 'top',
  '신발': 'shoes',
  '가방': 'acc', '모자': 'acc', '액세서리': 'acc', '소품': 'acc',
};

function lookItemSize(it, scale) {
  return Math.min(100, (LOOK_SIZE[it && it.category] || LOOK_SIZE['상의']) * (scale || LOOK_SCALE));
}

function lookTone(it) {
  const s = `${(it && it.color) || ''} ${(it && it.name) || ''}`;
  if (/검|블랙|흑|차콜|네이비|잉크|black|navy|charcoal/i.test(s)) return 'dark';
  if (/흰|화이트|아이보리|베이지|크림|실버|회색|그레이|white|ivory|beige|cream|silver|grey|gray/i.test(s)) return 'light';
  return 'other';
}

function lookAccRank(it) {
  if (it.category === '가방') return 0;
  if (it.category === '모자') return 1;
  return 2;
}

function pickAccSpot(placed, size, tone) {
  if (!placed.length) return { ...LOOK_ACC_CANDIDATES[0] };
  let best = LOOK_ACC_CANDIDATES[1];
  let bestScore = -1e9;
  LOOK_ACC_CANDIDATES.forEach((c, idx) => {
    if (idx === 0) return;
    let minD = 99;
    let clash = 0;
    placed.forEach((p) => {
      const d = Math.hypot(c.cx - p.cx, c.cy - p.cy);
      minD = Math.min(minD, d);
      const same = tone === p.tone && tone !== 'other';
      const need = (size + p.size) * (same ? 0.42 : 0.28);
      if (d < need) clash += same ? 4 : 1;
    });
    const score = minD * 2 - clash * 14 - idx * 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  });
  return { cx: best.cx, cy: best.cy, z: 6 + placed.length };
}

function drawLookCutout(ctx, im, x, y, dw, dh) {
  ctx.drawImage(im, x, y, dw, dh);
}

/** 아이템별 자리를 정한다. 같은 분면에 둘 이상이면 조금씩 밀어 겹쳐 놓는다. */
function lookPlacement(items) {
  const owned = (items || []).filter(Boolean);
  const hasOuter = owned.some((it) => LOOK_ROLE[it.category] === 'outer');
  const hasLower = owned.some((it) => {
    const role = LOOK_ROLE[it.category];
    return role === 'shoes' || role === 'acc';
  });
  const dy = hasLower ? 0 : 12;
  const taken = {};
  const out = {};
  owned.forEach((it) => {
    const role = LOOK_ROLE[it.category] || 'top';
    if (role === 'acc') return;
    const spot = role === 'top' && hasOuter ? 'layer' : role;
    const base = LOOK_SPOT[spot] || LOOK_SPOT.top;
    const n = taken[spot] || 0;
    taken[spot] = n + 1;
    out[it.id] = { cx: base.cx + n * 4, cy: base.cy + n * 4 + dy, z: base.z + n };
  });
  const accs = owned.filter((it) => LOOK_ROLE[it.category] === 'acc')
    .slice()
    .sort((a, b) => lookAccRank(a) - lookAccRank(b));
  const placedAcc = [];
  accs.forEach((it) => {
    const size = lookItemSize(it);
    const at = pickAccSpot(placedAcc, size, lookTone(it));
    out[it.id] = at;
    placedAcc.push({ cx: at.cx, cy: at.cy, size, tone: lookTone(it) });
  });
  Object.keys(out).forEach((id) => {
    const it = owned.find((x) => x.id === id);
    const size = lookItemSize(it);
    const half = size / 2;
    const minC = LOOK_PAD + half * 0.55;
    const maxC = 100 - LOOK_PAD - half * 0.55;
    out[id] = {
      cx: Math.min(maxC, Math.max(minC, out[id].cx)),
      cy: Math.min(maxC, Math.max(minC, out[id].cy)),
      z: out[id].z,
    };
  });
  return out;
}

// 서버가 흘려보내는 실제 단계. 지어낸 순환 문구가 아니라 그때 도는 작업 이름이다.
const LOOK_STAGE_LABEL = {
  queued: '차례를 기다리는 중',
  prep: '옷장 사진을 모으는 중',
  dress: 'AI가 옷을 입히는 중',
  finish: '배경을 카드에 맞추는 중',
  save: '이미지를 저장하는 중',
  draw: '제안 아이템을 그리는 중',
};

function lookPendingStage(outfit) {
  if (!outfit || !outfit.id) return null;
  return LB_DATA.LOOK_STAGE[outfit.id] || LB_DATA.WISH_STAGE[outfit.id] || null;
}

function LookPendingMarks({ stage }) {
  return (
    <>
      <div className="lb-look-wave" aria-hidden />
      <p className="lb-look-status">
        <Icon name="sparkle" size={13} stroke={1.9} />
        <span>{LOOK_STAGE_LABEL[stage] || LOOK_STAGE_LABEL.queued}</span>
      </p>
    </>
  );
}

function parseLookRatio(ratio) {
  const p = String(ratio || '4 / 5').split('/').map((x) => parseFloat(x));
  return (p[0] && p[1]) ? p[0] / p[1] : 0.8;
}

function loadLookImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

function packLookRects(rects, w, h) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  rects.forEach((r) => {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.dw);
    maxY = Math.max(maxY, r.y + r.dh);
  });
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const s = Math.min((w * LOOK_PACK) / bw, (h * LOOK_PACK) / bh);
  const ox = w / 2 - ((minX + maxX) / 2) * s;
  const oy = h / 2 - ((minY + maxY) / 2) * s;
  return rects.map((r) => ({
    ...r,
    x: r.x * s + ox,
    y: r.y * s + oy,
    dw: r.dw * s,
    dh: r.dh * s,
  }));
}

function nudgeLookRects(rects, h) {
  const dy = h * LOOK_NUDGE_Y;
  return rects.map((r) => ({ ...r, y: r.y + dy }));
}

function flattenLookBoard(items, place, scale, ratio, pack) {
  const w = 720;
  const h = Math.round(w / parseLookRatio(ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#E5E3DE';
  ctx.fillRect(0, 0, w, h);
  return Promise.all(items.map((it) => loadLookImage(it.thumb || it.img))).then((images) => {
    const layered = items.map((it, i) => ({ it, im: images[i], z: (place[it.id] || LOOK_SPOT.top).z }))
      .filter((x) => x.im)
      .sort((a, b) => a.z - b.z);
    if (layered.length !== items.length) return '';
    const rects = layered.map(({ it, im }) => {
      const at = place[it.id] || LOOK_SPOT.top;
      const size = lookItemSize(it, scale);
      const zoom = lookImageZoom(it.category);
      const box = (size / 100) * Math.min(w, h) * zoom;
      const cx = (at.cx / 100) * w;
      const cy = (at.cy / 100) * h;
      const s = Math.min(box / im.naturalWidth, box / im.naturalHeight);
      const dw = im.naturalWidth * s;
      const dh = im.naturalHeight * s;
      return { im, x: cx - dw / 2, y: cy - dh / 2, dw, dh };
    });
    const drawn = nudgeLookRects(pack ? packLookRects(rects, w, h) : rects, h);
    drawn.forEach((r) => {
      drawLookCutout(ctx, r.im, r.x, r.y, r.dw, r.dh);
    });
    try {
      return canvas.toDataURL('image/png');
    } catch (e) {
      return '';
    }
  });
}

const LOOK_FLAT_CACHE = {};

function LookComposite({ outfit, items, ratio = '4 / 5', bg = 'var(--thumb-bg)', scale = LOOK_SCALE, looking, lined, pack = true, aiMark = 'full' }) {
  const cleanItems = (items || []).filter(Boolean);
  const shown = cleanItems.filter((it) => it.img);
  const place = lookPlacement(shown);
  const key = shown.map((it) => String(it.id) + ':' + (it.thumb || it.img || '')).join('|') + (pack ? '|flat7' : '|flat1');
  const [flat, setFlat] = useSc(LOOK_FLAT_CACHE[key] || '');
  useEc(() => {
    if ((outfit && outfit.lookImg) || !shown.length) {
      setFlat('');
      return undefined;
    }
    if (LOOK_FLAT_CACHE[key]) {
      setFlat(LOOK_FLAT_CACHE[key]);
      return undefined;
    }
    let dead = false;
    flattenLookBoard(shown, place, scale, ratio, pack).then((url) => {
      if (url) LOOK_FLAT_CACHE[key] = url;
      if (!dead) setFlat(url);
    });
    return () => { dead = true; };
  }, [key, scale, ratio, pack, !!(outfit && outfit.lookImg)]);

  // 착장 원본은 4:5 전체 전신이다. 레일도 같은 비율로 보여 잘라내지 않는다.
  // flex 자식 img는 min-width:auto가 원본(1024px)이라 칸이 줄어들어도 비트맵이 그대로다.
  // 옷 컷아웃은 % 배치라 줌에 따라 작아지는데 착장만 남던 이유. 박스를 절대배치로 채운다.
  if (outfit && outfit.lookImg) {
    return (
      <div style={{
        position: 'relative', width: '100%', minWidth: 0, minHeight: 0,
        background: bg, borderRadius: 'var(--r-md)', overflow: 'hidden', aspectRatio: ratio,
        boxShadow: lined ? 'inset 0 0 0 1px var(--line)' : undefined,
      }}>
        <img
          src={outfit.lookImg}
          alt={cleanItems.map((i) => i.name).join(' · ')}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            maxWidth: '100%', maxHeight: '100%', minWidth: 0, minHeight: 0,
            objectFit: 'contain', objectPosition: 'center',
            boxSizing: 'border-box',
          }}
        />
        <span className={'lb-look-ai-mark' + (aiMark === 'icon' ? ' icon' : '')}>
          {aiMark === 'icon' ? '✦' : '✦ AI로 생성'}
        </span>
      </div>
    );
  }
  const pending = looking || !!(outfit && lookPendingStage(outfit));
  return (
    <div
      aria-busy={pending ? 'true' : undefined}
      aria-label={pending ? '코디 이미지를 만드는 중' : undefined}
      style={{
        position: 'relative', width: '100%', background: bg, borderRadius: 'var(--r-md)', overflow: 'hidden', aspectRatio: ratio,
        boxShadow: lined ? 'inset 0 0 0 1px var(--line)' : undefined,
      }}
    >
      {flat ? (
        <img
          src={flat}
          alt={shown.map((i) => i.name).join(' · ')}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center', display: 'block',
          }}
        />
      ) : shown.map((it) => {
        const at = place[it.id] || LOOK_SPOT.top;
        const size = lookItemSize(it, scale);
        const frame = {
          position: 'absolute', left: at.cx + '%', top: at.cy + '%', width: size + '%', aspectRatio: '1',
          transform: 'translate(-50%,-50%)', zIndex: at.z,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        };
        return (
          <div key={it.id} style={frame}>
            <img src={it.thumb || it.img} alt={it.name} loading="lazy" decoding="async" style={{
              width: '100%', height: '100%', objectFit: 'contain', display: 'block',
              transform: `scale(${lookImageZoom(it.category)})`,
            }} />
          </div>
        );
      })}
      {pending ? <LookPendingMarks stage={lookPendingStage(outfit)} /> : null}
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
                        {items.filter((it) => it.img).length}개 품목{items.some((it) => it.wish) ? ' · 새 아이템 포함' : ''}
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
            {loading ? '만드는 중…' : '코디 2개 더 받기'}
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
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 'var(--s3)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
          {items.length}개 조합
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
                {moreBusy ? '추천 만드는 중…' : '2개 더 추천받기'}
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
/* 옷장 카드와 같은 뼈대: 정사각 썸네일 + 아래 두 줄. 빼기는 선택 모드에서만. */
function SavedCard({ look, onOpen, onMore, selected, showSel, onToggleSel, inSelectUx, wide }) {
  const outfit = LB_DATA.OUTFIT_BY_ID[look.outfitId];
  if (!outfit) return null;
  const items = (outfit.itemIds || []).map((id) => LB_DATA.ALL[id]).filter(Boolean);
  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <div style={{ position: 'relative' }}>
        <button onClick={onOpen} className="lb-itembtn" style={{ display: 'block', width: '100%', textAlign: 'left', padding: 0 }}>
          <LookComposite outfit={outfit} items={items} ratio="1 / 1" lined pack={false} />
        </button>
        {onToggleSel && (showSel || wide) && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSel(); }}
            aria-label={selected ? '선택 해제' : '선택'}
            aria-pressed={selected}
            style={{
              position: 'absolute', left: 5, top: 5, width: 18, height: 18, borderRadius: '50%',
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
            {selected && <Icon name="check" size={10} stroke={2.6} />}
          </button>
        )}
        {!inSelectUx && onMore && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMore(look); }}
            aria-label={look.label + ' 더보기'}
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
      <button onClick={onOpen} className="lb-itembtn" style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 6 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 600, lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{look.label}</div>
        <div style={{
          fontSize: 11, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{(items.length || (outfit.itemIds || []).length)}개 품목 · {look.savedAt}</div>
      </button>
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
  const { saved, openDetail, hasWardrobe, startComboOrWardrobe, wide, items, createManualLook, bulkUnsave, refreshLive, renameSavedLook, lookbookLoading } = ctx;
  const [makeOpen, setMakeOpen] = useSc(false);
  const [moreLook, setMoreLook] = useSc(null);
  const [renameLook, setRenameLook] = useSc(null);
  const [renameVal, setRenameVal] = useSc('');
  // 여러 개 정리 — 옷장 선택 모드와 같은 규칙. 데스크탑은 hover로 체크가 뜨고,
  // 모바일은 hover가 없어서 헤더의 '선택'으로 모드를 켠다.
  const [sel, setSel] = useSc([]);
  const [selectMode, setSelectMode] = useSc(false);
  const [hoverId, setHoverId] = useSc(null);
  const [bulkAsk, setBulkAsk] = useSc(false);
  const [askIds, setAskIds] = useSc(null);
  // 수동 조합도 추천과 같은 기준(상의+하의)이 필요해서, 옷장이 준비됐을 때만 연다.
  const canMake = hasWardrobe && (items || []).length >= 2;
  const openMake = () => setMakeOpen(true);

  const selCount = sel.length;
  const selecting = selCount > 0;
  const inSelectUx = selectMode || selecting;
  // 선택 중에는 개수 자리를 안내 문구가 대신한다. 문구를 따로 한 줄 깔면 켤 때마다
  // 아래 카드가 밀려서, 옷장처럼 자리는 그대로 두고 글자만 바뀌게 한다.
  const countLabel = inSelectUx ? '코디를 눌러 고르세요' : saved.length + '개';
  const toggleSel = (id) => setSel((arr) => {
    const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
    if (next.length === 0) setSelectMode(false);
    return next;
  });
  const exitSelectMode = () => { setSel([]); setSelectMode(false); setBulkAsk(false); setAskIds(null); };
  const askList = askIds || sel;
  const askCount = askList.length;
  const runBulkUnsave = () => { bulkUnsave(askList); exitSelectMode(); };
  // 직접 만든 코디가 섞여 있으면 되돌릴 수 없다는 걸 확인 단계에서 알려준다.
  const manualCount = askList.filter((id) => {
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

  if (lookbookLoading && saved.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        <div style={{
          flex: 1,
          paddingTop: wide ? 28 : 'calc(env(safe-area-inset-top, 0px) + 22px)',
          paddingLeft: wide ? 0 : 18,
          paddingRight: wide ? 0 : 18,
        }}>
          <div className={wide ? 'lb-wide-inner' : undefined}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: wide ? 10 : 8, marginBottom: 'var(--gap-header)' }}>
              <h1 style={{ margin: 0, fontSize: wide ? 25 : 20, fontWeight: 800 }}>룩북</h1>
            </div>
            <div className="lb-grid">
              {[0, 1, 2].map((i) => (
                <div key={'sk' + i} aria-hidden="true">
                  <div className="lb-skel" style={{ aspectRatio: '1 / 1', borderRadius: 'var(--r-md)' }} />
                  <div className="lb-skel" style={{ height: 12, marginTop: 8, borderRadius: 6, width: '80%' }} />
                  <div className="lb-skel" style={{ height: 10, marginTop: 6, borderRadius: 6, width: '55%' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
      <PullRefresh
        onRefresh={refreshLive}
        disabled={wide || !refreshLive}
        style={{
        flex: 1,
        paddingTop: wide ? 28 : 'calc(env(safe-area-inset-top, 0px) + 22px)',
        paddingLeft: wide ? 0 : 18,
        paddingRight: wide ? 0 : 18,
        paddingBottom: wide ? (selecting ? 88 : 36) : (selecting ? 96 : 88),
      }}>
        <div className={wide ? 'lb-wide-inner' : undefined}>
          {wide ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--gap-header)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800 }}>룩북</h1>
                <span style={{ fontSize: 13.5, color: 'var(--ink-3)', fontWeight: 600 }}>{countLabel}</span>
              </div>
              {selectBtn}
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
            {!inSelectUx && (
              <button
                onClick={canMake ? openMake : startComboOrWardrobe}
                className="lb-addtile"
                style={{
                  position: 'relative', display: 'block', width: '100%', textAlign: 'center',
                  borderRadius: 'var(--r-md)', color: 'var(--ink-3)',
                  boxShadow: 'inset 0 0 0 1.5px var(--line)', background: 'transparent',
                }}
              >
                <div aria-hidden="true" style={{ visibility: 'hidden' }}>
                  <div style={{ aspectRatio: '1 / 1' }}></div>
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, height: '1.3em' }}>코디</div>
                    <div style={{ fontSize: 11, marginTop: 2, lineHeight: 1.3 }}>코디</div>
                  </div>
                </div>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon name="plus" size={26} /><span style={{ fontSize: 12.5, fontWeight: 600 }}>직접 만들기</span>
                </div>
              </button>
            )}
            {saved.map((lk) => {
              const on = sel.includes(lk.id);
              return (
                <div key={lk.id} style={{ minWidth: 0 }}
                  onMouseEnter={() => wide && setHoverId(lk.id)}
                  onMouseLeave={() => wide && setHoverId((h) => (h === lk.id ? null : h))}>
                  <SavedCard
                    look={lk}
                    onOpen={() => (inSelectUx ? toggleSel(lk.id) : openDetail(lk, saved, '룩북의 다른 코디', { fromLookbook: true }))}
                    onMore={(look) => setMoreLook(look)}
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
      </PullRefresh>

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
            <button onClick={exitSelectMode} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', padding: '4px 2px' }}>선택 해제</button>
            <Btn size="sm" icon="x" onClick={() => setBulkAsk(true)}
              style={{ background: '#B0573C', color: '#fff', fontSize: 12, padding: '7px 12px' }}>룩북에서 빼기</Btn>
          </div>
        </div>
      )}

      <BottomSheet open={!!moreLook} onClose={() => setMoreLook(null)}>
        {moreLook && (() => {
          const o = LB_DATA.OUTFIT_BY_ID[moreLook.outfitId];
          const its = o ? (o.itemIds || []).map((id) => LB_DATA.ALL[id]).filter(Boolean) : [];
          return (
            <div style={{ padding: '10px 24px 26px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <div style={{ width: 56, flex: 'none' }}>
                  {o ? <LookComposite outfit={o} items={its} ratio="1 / 1" lined /> : null}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16.5, fontWeight: 700, lineHeight: 1.25, textWrap: 'pretty' }}>{moreLook.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{its.length}개 품목</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 22 }}>
                <Btn full size="lg" variant="soft" icon="pencil" onClick={() => {
                  setRenameLook(moreLook);
                  setRenameVal(moreLook.label || '');
                  setMoreLook(null);
                }}>이름 수정하기</Btn>
                <Btn full size="lg" icon="x" onClick={() => {
                  setAskIds([moreLook.id]);
                  setMoreLook(null);
                  setBulkAsk(true);
                }} style={{ background: '#B0573C', color: '#fff' }}>룩북에서 빼기</Btn>
                <Btn full variant="ghost" onClick={() => setMoreLook(null)}>취소</Btn>
              </div>
            </div>
          );
        })()}
      </BottomSheet>

      <BottomSheet open={!!renameLook} onClose={() => setRenameLook(null)}>
        {renameLook && (
          <div style={{ padding: '10px 24px 26px' }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>이름 수정하기</h3>
            <input
              className="lb-input"
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              maxLength={40}
              aria-label="코디 이름"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameVal.trim() && renameSavedLook) {
                  renameSavedLook(renameLook.outfitId, renameVal);
                  setRenameLook(null);
                }
              }}
              style={{
                width: '100%', marginTop: 16, padding: '11px 14px', borderRadius: 'var(--r-md)',
                fontSize: 16, background: 'var(--ivory)', border: '1px solid var(--line)',
                color: 'var(--ink)', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <Btn variant="soft" onClick={() => setRenameLook(null)} style={{ flex: 1 }}>취소</Btn>
              <Btn
                icon="check"
                disabled={!renameVal.trim()}
                onClick={() => {
                  if (renameSavedLook) renameSavedLook(renameLook.outfitId, renameVal);
                  setRenameLook(null);
                }}
                style={{ flex: 1 }}
              >저장</Btn>
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={bulkAsk} onClose={() => { setBulkAsk(false); setAskIds(null); }}>
        <div style={{ padding: '10px 24px 26px', textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {askCount > 1 ? `선택한 ${askCount}개를 룩북에서 뺄까요?` : '룩북에서 뺄까요?'}
          </h3>
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
      textAlign: 'left', display: 'block', width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 'var(--r-lg)',
      background: active ? 'var(--surface)' : 'transparent',
      border: active ? '2px solid var(--ink)' : '2px solid transparent',
      opacity: active ? 1 : 0.45,
    }}>
      <LookComposite outfit={o} items={its} ratio="4 / 5" aiMark="icon" />
      <div style={{
        padding: '8px 2px 0', fontSize: 12.5, fontWeight: 700, lineHeight: 1.3,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{look.label}</div>
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
  // 다른 코디로 넘기면 위부터 본다. 아래 목록을 보다 넘기면 새 코디의 사진이 화면 밖이다.
  const detailScrollRef = React.useRef(null);
  useScrollTopOn(detailScrollRef, detailLook.id);

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

  // 데스크탑: 우측 레일은 한 줄짜리 가로 목록이라 좌우 방향키로만 한 칸씩 옮긴다.
  const railRef = React.useRef(null);
  React.useEffect(() => {
    if (!wide || !multi) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = ((e.target && e.target.tagName) || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;
      // 시트·뷰어가 떠 있으면 뒤 화면이 따라 움직이지 않게 둔다.
      if (document.querySelector('.lb-sheet-scrim')) return;
      const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (!step) return;
      const next = detailIndex + step;
      if (next < 0 || next >= detailTotal) return;   // 레일 밖으로는 넘기지 않는다
      e.preventDefault();
      openDetail(looks[next], detailFromLookbook ? null : looks, detailListLabel);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wide, multi, detailIndex, detailTotal, looks, openDetail, detailFromLookbook, detailListLabel]);

  // 코디가 레일 폭을 넘치면 화살표로 넘긴다. 끝에 닿으면 그쪽 화살표를 죽인다.
  const [railEnds, setRailEnds] = useSc({ prev: false, next: false });
  const syncRail = React.useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setRailEnds({
      prev: el.scrollLeft > 4,
      next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);
  const pageRail = (dir) => {
    const el = railRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.8), behavior: 'smooth' });
  };
  const RailPageBtn = ({ dir }) => {
    const on = dir > 0 ? railEnds.next : railEnds.prev;
    return (
      <button type="button" onClick={() => pageRail(dir)} disabled={!on}
        aria-label={dir > 0 ? '코디 더 보기' : '코디 이전으로'} className="lb-iconbtn" style={{
          width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
          boxShadow: 'inset 0 0 0 1px var(--line-2)', color: 'var(--ink)',
          opacity: on ? 1 : 0.3, cursor: on ? 'pointer' : 'default',
        }}>
        <Icon name={dir > 0 ? 'chevR' : 'chevL'} size={14} />
      </button>
    );
  };

  // 레일이 길어져도 지금 보는 코디가 가로로 화면 밖에 있지 않게.
  // scrollIntoView(block:nearest)는 overflow-y 조상까지 밀어 카드가 내려오며
  // 위 테두리가 뒤늦게 보이는 현상이 난다. 좌우만 맞춘다.
  React.useEffect(() => {
    if (!wide || !railRef.current) return;
    const rail = railRef.current;
    const active = rail.querySelector('[aria-current="true"]');
    if (active) {
      const r = active.getBoundingClientRect();
      const p = rail.getBoundingClientRect();
      if (r.left < p.left + 4) rail.scrollLeft -= (p.left + 4 - r.left);
      else if (r.right > p.right - 4) rail.scrollLeft += (r.right - (p.right - 4));
    }
    syncRail();
  }, [wide, detailLook, looks.length, syncRail]);

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

  // 사진과 품목 목록을 따로 만든다. 모바일은 한 카드에 위아래로 붙이고,
  // 데스크탑은 사진만 왼쪽에 두고 목록은 오른쪽 레일 아래로 내린다 —
  // 그래야 100% 배율에서 코디 목록이 스크롤 없이 보인다.
  const photoBlock = (
      <div style={{ position: 'relative' }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => openOutfitViewer && openOutfitViewer(outfit, items)}
          onKeyDown={(e) => {
            if (!openOutfitViewer) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openOutfitViewer(outfit, items);
            }
          }}
          aria-label="코디 크게 보기"
          style={{
            display: 'block', width: '100%', cursor: openOutfitViewer ? 'zoom-in' : 'default',
            textAlign: 'left', position: 'relative',
          }}
        >
          <LookComposite outfit={outfit} items={items} ratio="4 / 5" />
          {openOutfitViewer ? <LookExpandBadge /> : null}
        </div>
        {/* 오늘 코디에서 연 상세만 하트. 룩북은 카드 더보기·선택 빼기. */}
        {!detailFromLookbook && (
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
        )}
        {!wide && multi && (
          <>
            <ArrowBtn d={-1} name="chevL" side="left" />
            <ArrowBtn d={1} name="chevR" side="right" />
          </>
        )}
      </div>
  );

  const itemsBlock = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((it, i) => {
          const justAdded = it.isAnchor && addedItemIds.includes(it.id);
          return (
            <div key={it.id} title={it.wish && it.reason ? it.reason : undefined} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--s3)',
              minHeight: 62, padding: '9px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--line)',
            }}>
              <div style={{ width: 44, flex: 'none' }}><Thumb item={it} radius="var(--r-sm)" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13.5, fontWeight: 600, lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{it.name}</div>
                <div style={{
                  fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{it.category}{it.color ? ` · ${it.color}` : ''}</div>
              </div>
              <div style={{ flex: 'none' }}>
                {it.wish ? <Badge tone="neutral">새 아이템</Badge>
                  : justAdded ? <Badge tone="good" icon="check">추가됨</Badge>
                  : !it.isAnchor ? <Badge tone="neutral">옷장에 있음</Badge>
                  : <Btn size="sm" variant="secondary" icon="plus" onClick={() => addToWardrobe(it.id)}>옷장에 추가</Btn>}
              </div>
            </div>
          );
        })}
      </div>
  );

  const surface = (children, extra) => (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 'var(--s4)', ...extra }}>
      {children}
    </div>
  );
  // 모바일(과 데스크탑에서 코디가 하나뿐일 때)은 사진과 목록이 한 카드다.
  const card = surface(
    <>
      {photoBlock}
      <div style={{ marginTop: 'var(--s3)' }}>{itemsBlock}</div>
    </>,
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
            gridTemplateColumns: 'minmax(300px, 400px) minmax(0, 1fr)',
            justifyContent: 'start',
          }}>
            <div key={detailLook.id} className="lb-anim-in">
              {surface(photoBlock)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>{detailListLabel}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>{detailIndex + 1} / {detailTotal}</span>
                  <RailPageBtn dir={-1} />
                  <RailPageBtn dir={1} />
                </div>
              </div>
              {/* 코디가 늘면 세로로 쌓지 않고 이 줄에 가로로 붙는다. 넘치면 화살표로 넘긴다. */}
              <div ref={railRef} onScroll={syncRail} className="lb-scrollable" style={{
                display: 'flex', gap: 12, overflowX: 'auto', overflowY: 'hidden',
                scrollBehavior: 'smooth', padding: '2px 0 4px',
              }}>
                {looks.map((lk) => (
                  // 148px에서 시작해 줄을 채울 때까지 늘어난다. 상한 188px은 예전
                  // auto-fill 그리드가 한 칸에 줄 수 있던 최대 폭이라, 코디가 둘뿐일 때도
                  // 카드가 혼자 커지지 않는다.
                  <div key={lk.id} style={{ flex: '1 1 148px', minWidth: 148, maxWidth: 188, overflow: 'hidden' }}>
                    <RailCard look={lk} active={lk.id === detailLook.id}
                      onClick={() => openDetail(lk, looks, detailListLabel, { fromLookbook: detailFromLookbook })} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 20 }}>{surface(itemsBlock)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---- 모바일: 카드 하나를 좌우로 넘긴다. 인디케이터는 카드 길이와 무관하게 늘 같은 자리 ---- */
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {topBar}
      <div ref={detailScrollRef} className="lb-scrollable" style={{
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
