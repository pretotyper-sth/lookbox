/* @prototype-ported */
const React = window.React;

/* global React */
// LOOKBOX — shared UI components + inline icon set.
// Exported to window at the bottom.

const { useState, useRef, useEffect, useLayoutEffect, useMemo } = React;

/* Escape closes the topmost overlay only (stacked sheets/viewers). */
const _escapeStack = [];
function useEscapeClose(open, onClose) {
  useEffect(() => {
    if (!open || typeof onClose !== 'function') return undefined;
    const entry = { onClose };
    _escapeStack.push(entry);
    const onKey = (e) => {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      if (_escapeStack[_escapeStack.length - 1] !== entry) return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      const i = _escapeStack.indexOf(entry);
      if (i >= 0) _escapeStack.splice(i, 1);
    };
  }, [open, onClose]);
}

/* ----------------------------------------------------------------
   Icons — minimal 1.6px stroke set (Lucide-style), inline SVG.
---------------------------------------------------------------- */
const ICONS = {
  plus:     'M12 5v14M5 12h14',
  check:    'M20 6 9 17l-5-5',
  x:        'M18 6 6 18M6 6l12 12',
  heart:    'M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8z',
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  camera:   'M14.5 4l1.5 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l1.5-2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  link:     'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5',
  chevL:    'M15 18l-6-6 6-6',
  chevR:    'M9 18l6-6-6-6',
  chevD:    'M6 9l6 6 6-6',
  lock:     'M6 10V8a6 6 0 1 1 12 0v2M5 10h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z',
  sparkle:  'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.9 2.4L22 18l-2.1.6L19 21l-.9-2.4L16 18l2.1-.6z',
  hanger:   'M12 4a2 2 0 0 0-1 3.7c.6.3 1 .9 1 1.6M3 18l9-6 9 6a1 1 0 0 1-.6 1.8H3.6A1 1 0 0 1 3 18z',
  bag:      'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  grid:     'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  layers:   'M12 3 3 8l9 5 9-5zM3 14l9 5 9-5',
  user:     'M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  mail:     'M3 6.5h18v11H3zM3 7l9 6 9-6',
  image:    'M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4',
  pencil:   'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash:    'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14',
  bell:     'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  archive:  'M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4',
  logout:   'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  help:     'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  shield:   'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  expand:   'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  search:   'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  minus:    'M5 12h14',
  more:     'M5 12h.01M12 12h.01M19 12h.01',
  // 매장 맞춰보기 — 종이 구멍처럼 옷을 비워 카메라에 겹친다
  cutout:   'M4 4h16v16H4zM9 9h6v6H9zM12 2v4M12 18v4M2 12h4M18 12h4',
};

function Icon({ name, size = 22, stroke = 1.7, fill = 'none', style }) {
  const d = ICONS[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
         stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
         strokeLinejoin="round" style={{ display: 'block', flex: 'none', ...style }}>
      {d.split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}
    </svg>
  );
}

/* ----------------------------------------------------------------
   Garment placeholder silhouettes (for items with no photo).
   Soft, single-tone, on ivory — iconographic, not illustration.
---------------------------------------------------------------- */
const SILHOUETTE = {
  // 상의 — crew-neck tee with short sleeves
  '상의':   'M12 6 L8.5 8 L6 12.5 L9 14 V25 H23 V14 L26 12.5 L23.5 8 L20 6 A4 3.6 0 0 1 12 6 Z',
  // 하의 — trousers, two tapering legs
  '하의':   'M9.5 6 H22.5 L21 25.5 H16.7 L16 14 L15.3 25.5 H11 Z M9.5 6 L11 14',
  // 스커트 — simple A-line trapezoid with a waistband
  '스커트': 'M10.5 8 H21.5 L25.5 25 H6.5 Z M10.5 8 L9.5 12 M21.5 8 L22.5 12',
  // 아우터 — open coat: V-lapel, center opening, longer body (distinct from 상의)
  '아우터': 'M12 6 L7.5 8 L5 13.5 L8.5 15 V27 H23.5 V15 L27 13.5 L24.5 8 L20 6 L16 9.5 Z M16 9.5 V27',
  // 원피스 — 상의처럼 시작해 아래로 갈수록 넓어지는 A라인 원피스
  '원피스': 'M12 6 L8.5 8 L6 12.5 L9 14 V17 L5.5 26 H26.5 L23 17 V14 L26 12.5 L23.5 8 L20 6 A4 3.6 0 0 1 12 6 Z',
  // 신발 — side-profile loafer
  '신발':   'M5 18.5 C5 16.5 7.5 16 9.5 16.8 L14.5 19 C17.5 20 20.5 20 23.5 20.4 C26 20.7 27 21.4 27 22.6 V23.6 H5 Z M9.5 16.8 L11 19',
  // 가방 — shoulder bag with arc handle
  '가방':   'M10 13.5 H22 L23 25 H9 Z M12.5 13.5 C12.5 9 19.5 9 19.5 13.5',
  // 모자 — 챙 있는 캡 (돔 + 브림)
  '모자':   'M16 7 C10.5 7 7.5 11 7.5 15 H24.5 C24.5 11 21.5 7 16 7 Z M5.5 15 H26.5',
  // 소품 — 벨트(스트랩 + 버클)로 대표
  '소품':   'M6 16 H26 M13 12 H19 V20 H13 Z',
  // 액세서리 — 구버전 데이터 호환용 (가방 아이콘 재사용)
  '액세서리': 'M10 13.5 H22 L23 25 H9 Z M12.5 13.5 C12.5 9 19.5 9 19.5 13.5',
};

function Silhouette({ category, scale = 1 }) {
  const d = SILHOUETTE[category] || SILHOUETTE['상의'];
  return (
    <svg viewBox="0 0 32 32" width="60%" height="60%" fill="none"
         stroke="#B8B0A0" strokeWidth={1.35} strokeLinejoin="round" strokeLinecap="round">
      <path d={d} />
    </svg>
  );
}

/* ----------------------------------------------------------------
   SmartImg — 이미지 로드가 간헐적으로 실패해도 자동 재시도 → 폴백.
   (새로고침 때 랜덤하게 안 뜨는 문제 방지: 실패한 칸이 빈 채로 남지 않음)
---------------------------------------------------------------- */
function SmartImg({ src, alt, style, fallback, loading = 'eager', fetchPriority = 'auto' }) {
  const [attempt, setAttempt] = useState(0);
  const [dead, setDead] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    setAttempt(0);
    setDead(false);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [src]);
  if (!src || dead) return fallback || null;
  // 첫 시도는 원본 URL(디스크 캐시 활용), 재시도부터만 캐시버스트
  const url = attempt > 0 ? (src + (src.indexOf('?') >= 0 ? '&' : '?') + 'cb=' + attempt) : src;
  return (
    <img
      key={attempt}
      src={url}
      alt={alt}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      style={style}
      onError={() => {
        if (attempt >= 3) { setDead(true); return; }
        const next = attempt + 1;
        timer.current = setTimeout(() => setAttempt(next), 250 * next);
      }}
    />
  );
}

/* ----------------------------------------------------------------
   Thumb — square garment tile. Photo OR silhouette on soft gray plate.
---------------------------------------------------------------- */
function Thumb({ item, radius = 'var(--r-md)', ratio = '1 / 1', fit = 'contain', full = false, eager = false }) {
  // 목록 칸은 140~200px이라 1024px 원본이 필요 없다. 서버가 만들어 둔 썸네일을 쓰고,
  // 없으면(예전 아이템) 원본으로 떨어진다. 화면 밖 이미지는 스크롤할 때 받는다.
  const src = item && (full ? item.img : (item.thumb || item.img));
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: ratio,
      background: 'var(--thumb-bg)', borderRadius: radius, overflow: 'hidden',
      boxShadow: 'inset 0 0 0 1px var(--line)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {src
        ? <SmartImg
            src={src}
            alt={item.name || ''}
            loading={eager ? 'eager' : 'lazy'}
            style={{ width: '100%', height: '100%', objectFit: fit, padding: '8%', boxSizing: 'border-box' }}
            fallback={<Silhouette category={item ? item.category : '상의'} />}
          />
        : <Silhouette category={item ? item.category : '상의'} />}
    </div>
  );
}

/**
 * 단계가 바뀌면 스크롤을 맨 위로 — 아래까지 내려 본 상태에서 다음 단계로 넘어가면
 * 새 화면의 첫 항목이 화면 밖에 있어서, 왜 진행이 안 되는지 알 수 없다.
 * 값이 처음 세팅될 때(초기 렌더)는 건드리지 않는다.
 */
function useScrollTopOn(ref, key, enabled = true) {
  const prev = useRef(key);
  useEffect(() => {
    if (!enabled) return;
    if (prev.current === key) return;
    prev.current = key;
    const el = ref && ref.current;
    if (!el) return;
    // 부드럽게. 사용자가 '올라갔다'는 걸 인지할 수 있어야 방향 감각이 유지된다.
    try { el.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { el.scrollTop = 0; }
  }, [key, enabled, ref]);
}

/* ----------------------------------------------------------------
   ImageViewer — 아이템·코디 공통. 오버레이 + 핀치/휠/더블탭 확대.
---------------------------------------------------------------- */
const VIEWER_ZOOM_MIN = 1;
const VIEWER_ZOOM_MAX = 4;
const VIEWER_ZOOM_STEP = 0.5;

function pinchDist(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function ImageViewer({ open, item, outfit, items, onClose }) {
  const outfitItems = (items || []).filter(Boolean);
  const isOutfit = !!(outfit && (outfit.lookImg || outfitItems.length));
  const Composite = window.LookComposite;
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [pinching, setPinching] = useState(false);
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const drag = useRef(null);
  const pinch = useRef(null);
  const lastTap = useRef(0);
  const stageRef = useRef(null);

  useEscapeClose(open && (!!(item && item.img) || isOutfit), onClose);

  const commitZoom = (next, nextOffset) => {
    const z = Math.min(VIEWER_ZOOM_MAX, Math.max(VIEWER_ZOOM_MIN, next));
    zoomRef.current = z;
    setZoom(z);
    if (z <= 1) {
      offsetRef.current = { x: 0, y: 0 };
      setOffset({ x: 0, y: 0 });
      return z;
    }
    if (nextOffset) {
      offsetRef.current = nextOffset;
      setOffset(nextOffset);
    }
    return z;
  };

  useEffect(() => {
    if (!open) return undefined;
    zoomRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
    setPinching(false);
    drag.current = null;
    pinch.current = null;
    lastTap.current = 0;
    return undefined;
  }, [open, item && item.id, outfit && outfit.id]);

  // 휠·핀치는 preventDefault가 필요하다. React 합성 이벤트는 패시브라 막히지 않는다.
  useEffect(() => {
    if (!open) return undefined;
    const el = stageRef.current;
    if (!el) return undefined;

    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      commitZoom(zoomRef.current * factor);
    };
    const onTouchStart = (e) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        drag.current = null;
        setDragging(false);
        pinch.current = { dist: pinchDist(e.touches[0], e.touches[1]), zoom: zoomRef.current };
        setPinching(true);
        lastTap.current = 0;
        return;
      }
      if (e.touches.length === 1 && zoomRef.current > 1) {
        const t = e.touches[0];
        drag.current = { x: t.clientX, y: t.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y };
        setDragging(true);
      }
    };
    const onTouchMove = (e) => {
      if (pinch.current && e.touches.length >= 2) {
        e.preventDefault();
        const d = pinchDist(e.touches[0], e.touches[1]);
        if (pinch.current.dist > 0) commitZoom(pinch.current.zoom * (d / pinch.current.dist));
        return;
      }
      if (drag.current && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        const next = {
          x: drag.current.ox + (t.clientX - drag.current.x),
          y: drag.current.oy + (t.clientY - drag.current.y),
        };
        offsetRef.current = next;
        setOffset(next);
      }
    };
    const endPinch = () => { pinch.current = null; setPinching(false); };
    const onTouchEnd = (e) => {
      if (pinch.current) {
        if (e.touches.length < 2) endPinch();
        return;
      }
      if (drag.current) {
        drag.current = null;
        setDragging(false);
      }
      if (e.touches.length !== 0) return;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const now = Date.now();
      if (now - lastTap.current < 280) {
        lastTap.current = 0;
        if (zoomRef.current > 1) commitZoom(1);
        else commitZoom(2);
      } else {
        lastTap.current = now;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [open]);

  if (!open) return null;
  if (!isOutfit && !(item && item.img)) return null;

  const title = isOutfit
    ? (outfit.label || '코디')
    : (item.name || '옷');
  const subtitle = isOutfit
    ? [outfit.styleLabel || outfit.mood, outfitItems.length ? `${outfitItems.length}개 조합` : ''].filter(Boolean).join(' · ')
    : [item.category, item.color].filter(Boolean).join(' · ');

  const applyZoom = (next) => commitZoom(next);
  const zoomIn = () => applyZoom(zoomRef.current + VIEWER_ZOOM_STEP);
  const zoomOut = () => applyZoom(zoomRef.current - VIEWER_ZOOM_STEP);
  const resetZoom = () => applyZoom(1);

  const onPointerDown = (e) => {
    if (e.pointerType === 'touch') return;
    if (zoomRef.current <= 1) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y };
    setDragging(true);
  };
  const onPointerMove = (e) => {
    if (e.pointerType === 'touch') return;
    if (!drag.current) return;
    const next = {
      x: drag.current.ox + (e.clientX - drag.current.x),
      y: drag.current.oy + (e.clientY - drag.current.y),
    };
    offsetRef.current = next;
    setOffset(next);
  };
  const onPointerUp = (e) => {
    if (e && e.pointerType === 'touch') return;
    drag.current = null;
    setDragging(false);
  };

  const media = isOutfit ? (
    outfit.lookImg ? (
      <img
        src={outfit.lookImg}
        alt={title}
        draggable={false}
        style={{
          width: '100%', height: '100%', objectFit: 'contain', display: 'block',
          borderRadius: 'var(--r-lg)', background: 'var(--thumb-bg)', userSelect: 'none',
          padding: '6% 5%', boxSizing: 'border-box',
        }}
      />
    ) : (Composite ? (
      <div style={{ width: '100%' }}>
        <Composite outfit={outfit} items={outfitItems} ratio="4 / 5" />
      </div>
    ) : null)
  ) : (
    <img
      src={item.img}
      alt={item.name || ''}
      draggable={false}
      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', padding: '4%', userSelect: 'none' }}
    />
  );

  const pct = Math.round(zoom * 100);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title + ' 크게 보기'}
      style={{
        position: 'absolute', inset: 0, zIndex: 100,
        // 0.88이면 아래 시트의 버튼·날짜 텍스트가 배어 나와 뷰어 텍스트와 겹쳐 보인다
        background: 'rgba(28, 26, 22, 0.975)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12,
        padding: 'max(env(safe-area-inset-top), 14px) 18px max(env(safe-area-inset-bottom), 18px)',
        animation: 'lb-fade-in 180ms var(--ease)',
      }}
    >
      {/* 상단 바: 제목과 닫기를 같은 줄에 둔다 — 예전처럼 X를 이미지 위에 띄우면
          카드 모서리와 겹쳐서 잘 안 보였다 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 'none', width: '100%', maxWidth: 440,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, color: 'rgba(255,255,255,0.92)' }}>
          {title ? (
            <div style={{
              fontSize: 15, fontWeight: 700, lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{title}</div>
          ) : null}
          {subtitle ? (
            <div style={{
              fontSize: 12.5, marginTop: 3, opacity: 0.68,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{subtitle}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="lb-iconbtn"
          style={{
            flex: 'none', width: 40, height: 40, marginTop: -2, marginRight: -6,
            borderRadius: '50%', display: 'grid', placeItems: 'center',
            color: '#fff', background: 'rgba(255,255,255,0.12)',
          }}
        >
          <Icon name="x" size={22} />
        </button>
      </div>

      <div
        ref={stageRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 440, flex: '1 1 auto',
          minHeight: 0, maxHeight: 'min(72vh, 640px)',
          background: 'var(--thumb-bg)', borderRadius: 'var(--r-lg)',
          boxShadow: '0 20px 48px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          touchAction: 'none',
          cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
        }}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (Date.now() - lastTap.current < 400) return;
            if (zoomRef.current > 1) resetZoom();
            else applyZoom(2);
          }}
          style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: (dragging || pinching) ? 'none' : 'transform 120ms var(--ease)',
          }}
        >
          {media}
        </div>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 8px', borderRadius: 'var(--r-pill)',
          background: 'rgba(255,255,255,0.12)', color: '#fff',
        }}
      >
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= VIEWER_ZOOM_MIN}
          aria-label="축소"
          className="lb-iconbtn"
          style={{
            width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center',
            color: '#fff', opacity: zoom <= VIEWER_ZOOM_MIN ? 0.35 : 1,
          }}
        >
          <Icon name="minus" size={18} stroke={2.2} />
        </button>
        <button
          type="button"
          onClick={resetZoom}
          aria-label={`배율 ${pct}퍼센트, 누르면 원래 크기`}
          style={{
            minWidth: 64, padding: '0 6px', border: 'none', background: 'transparent',
            color: '#fff', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer',
          }}
        >
          <Icon name="search" size={14} stroke={2.2} />
          {pct}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= VIEWER_ZOOM_MAX}
          aria-label="확대"
          className="lb-iconbtn"
          style={{
            width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center',
            color: '#fff', opacity: zoom >= VIEWER_ZOOM_MAX ? 0.35 : 1,
          }}
        >
          <Icon name="plus" size={18} stroke={2.2} />
        </button>
      </div>
      <div style={{
        flex: 'none', marginTop: -4, fontSize: 11.5,
        color: 'rgba(255,255,255,0.55)', textAlign: 'center',
      }}>
        핀치 · 더블탭 · 휠로 확대할 수 있어요
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   Skeleton — shimmer placeholder
---------------------------------------------------------------- */
function Skeleton({ w = '100%', h = 16, radius = 'var(--r-sm)', style }) {
  return <div className="lb-skel" style={{ width: w, height: h, borderRadius: radius, ...style }} />;
}

/* ----------------------------------------------------------------
   Button
---------------------------------------------------------------- */
function Btn({ children, variant = 'primary', size = 'md', icon, full, onClick, disabled, style }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 'var(--s2)', fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap',
    borderRadius: 'var(--r-pill)', transition: 'transform var(--dur) var(--ease), background var(--dur) var(--ease), opacity var(--dur)',
    width: full ? '100%' : 'auto', userSelect: 'none',
    fontSize: size === 'lg' ? 16 : size === 'sm' ? 13 : 15,
    padding: size === 'lg' ? '16px 24px' : size === 'sm' ? '8px 14px' : '13px 20px',
    opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : 'auto',
  };
  const variants = {
    primary:   { background: 'var(--accent)', color: 'var(--accent-ink)' },
    secondary: { background: 'transparent', color: 'var(--ink)', boxShadow: 'inset 0 0 0 1.5px var(--line-2)' },
    ghost:     { background: 'transparent', color: 'var(--ink-2)' },
    soft:      { background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'inset 0 0 0 1px var(--line)' },
  };
  return (
    <button onClick={onClick} className="lb-btn"
      style={{ ...base, ...variants[variant], ...style }}>
      {icon && <Icon name={icon} size={size === 'lg' ? 20 : 17} />}
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------
   Chip — filter pill
---------------------------------------------------------------- */
function Chip({ children, active, onClick }) {
  return (
    <button onClick={onClick} className="lb-chip" style={{
      flex: 'none', padding: '8px 15px', borderRadius: 'var(--r-pill)',
      fontSize: 13.5, fontWeight: active ? 600 : 500,
      color: active ? 'var(--accent-ink)' : 'var(--ink-2)',
      background: active ? 'var(--accent)' : 'transparent',
      boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--line)',
      transition: 'all var(--dur) var(--ease)',
    }}>{children}</button>
  );
}

/* ----------------------------------------------------------------
   Badge — "옷장에 있음" / "추가됨"
---------------------------------------------------------------- */
function Badge({ children, tone = 'neutral', icon }) {
  const tones = {
    neutral: { background: 'var(--badge-bg)', color: 'var(--ink-2)' },
    good:    { background: 'transparent', color: 'var(--good)', boxShadow: 'inset 0 0 0 1.3px color-mix(in srgb, var(--good) 35%, transparent)' },
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none',
      padding: '5px 10px', borderRadius: 'var(--r-pill)', fontSize: 12, fontWeight: 600,
      ...tones[tone],
    }}>
      {icon && <Icon name={icon} size={13} stroke={2.2} />}
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------
   IconButton — circular
---------------------------------------------------------------- */
function IconBtn({ name, onClick, label, active, size = 40, iconSize = 21, style, ...rest }) {
  return (
    <button onClick={onClick} aria-label={label} className="lb-iconbtn" style={{
      width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center',
      color: active ? 'var(--accent-ink)' : 'var(--ink)',
      background: active ? 'var(--accent)' : 'transparent',
      transition: 'all var(--dur) var(--ease)', ...style,
    }} {...rest}>
      <Icon name={name} size={iconSize} fill={active && name === 'heart' ? 'currentColor' : 'none'} />
    </button>
  );
}

/* ----------------------------------------------------------------
   BottomSheet — bottom sheet on mobile, centered modal on desktop
---------------------------------------------------------------- */
function BottomSheet({ open, onClose, children, maxW = 460, dismissOnScrim = true, zIndex = 60, tightBottom = false }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  // 손잡이를 아래로 끌어 닫는다. 시트 안이 스크롤되는 경우(요금제 등) 배경을 누를 자리가
  // 거의 없어서 닫기가 어려웠다. 손잡이에서 시작한 드래그만 잡아 스크롤과 겹치지 않게 한다.
  const [dragY, setDragY] = useState(0);
  const dragFrom = useRef(null);
  const [wide, setWide] = useState(typeof window !== 'undefined' && window.innerWidth >= 760);
  useEscapeClose(open, onClose);
  useEffect(() => {
    const m = () => setWide(window.innerWidth >= 760);
    window.addEventListener('resize', m); return () => window.removeEventListener('resize', m);
  }, []);
  useEffect(() => {
    if (open) { setMounted(true); const r = setTimeout(() => setShown(true), 20); return () => clearTimeout(r); }
    else { setShown(false); const t = setTimeout(() => setMounted(false), 280); return () => clearTimeout(t); }
  }, [open]);
  if (!mounted) return null;
  const hiddenTf = wide ? 'translateY(10px) scale(0.97)' : 'translateY(101%)';
  return (
    <div onClick={dismissOnScrim ? onClose : undefined} style={{
      position: 'fixed', inset: 0, zIndex, display: 'flex',
      alignItems: wide ? 'center' : 'flex-end', justifyContent: 'center',
      background: shown ? 'rgba(30,27,21,0.42)' : 'rgba(30,27,21,0)',
      transition: 'background var(--dur) var(--ease)', padding: wide ? 24 : 0,
    }} className="lb-sheet-scrim">
      <div onClick={(e) => e.stopPropagation()} className="lb-sheet" style={{
        width: '100%', maxWidth: wide ? 420 : maxW, background: 'var(--surface)',
        borderRadius: wide ? 'var(--r-lg)' : 'var(--r-lg) var(--r-lg) 0 0',
        boxShadow: wide ? 'var(--pop-shadow)' : 'var(--sheet-shadow)',
        transform: shown ? (dragY ? `translateY(${dragY}px)` : 'translateY(0) scale(1)') : hiddenTf,
        opacity: wide ? (shown ? 1 : 0) : 1,
        transition: dragY ? 'none' : 'transform var(--dur) var(--ease), opacity var(--dur) var(--ease)',
        paddingBottom: wide ? 6 : (tightBottom ? 'env(safe-area-inset-bottom, 0px)' : 'max(env(safe-area-inset-bottom), 12px)'),
      }}>
        {!wide && (
          <div
            onPointerDown={(e) => { dragFrom.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (dragFrom.current != null) setDragY(Math.max(0, e.clientY - dragFrom.current)); }}
            onPointerUp={() => {
              const far = dragY > 90;
              dragFrom.current = null;
              setDragY(0);
              if (far) onClose();
            }}
            onPointerCancel={() => { dragFrom.current = null; setDragY(0); }}
            role="button"
            aria-label="내려서 닫기"
            style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px', touchAction: 'none', cursor: 'grab' }}
          >
            <div style={{ width: 44, height: 4, borderRadius: 999, background: 'var(--line-2)' }} />
          </div>
        )}
        <div style={{ height: wide ? 14 : 0 }} />
        {children}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   ItemDetailSheet — tap a garment → view large + add optional details
   (브랜드 / 사이즈 / 구매처 / 메모). All fields optional, saved optimistically.
---------------------------------------------------------------- */
function LabeledField({ label, value, onChange, placeholder, multiline }) {
  const common = {
    width: '100%', padding: multiline ? '11px 14px' : '12px 14px', borderRadius: 'var(--r-md)',
    fontSize: 14, background: 'var(--ivory)', border: '1px solid var(--line)', color: 'var(--ink)',
    outline: 'none', resize: 'none', lineHeight: 1.5, boxSizing: 'border-box',
  };
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 9 }}>{label}</div>
      {multiline
        ? <textarea className="lb-input" rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={common} />
        : <input className="lb-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={common} />}
    </label>
  );
}

/* 숫자 하나를 고르는 입력 — 키·몸무게처럼 범위가 뻔한 값은 텍스트 입력보다
   슬라이더가 더 편하다. 건드리기 전엔 "선택 안 함"으로 비어 있는 채 둔다. */
function NumberSlider({ label, hint, value, onChange, min, max, step = 1, unit = '', defaultValue }) {
  const touched = value !== '' && value != null;
  const num = touched ? Number(value) : defaultValue;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{label}</span>
          {hint ? <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{hint}</span> : null}
        </span>
        <span className="tnum" style={{ fontSize: 13.5, fontWeight: 600, color: touched ? 'var(--ink)' : 'var(--ink-3)' }}>
          {touched ? `${num}${unit}` : '선택 안 함'}
        </span>
      </div>
      <input
        type="range" className="lb-range"
        min={min} max={max} step={step} value={num}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* 최근 입력값 기억 — 구매처처럼 같은 값을 반복 입력하는 항목용.
   목록은 아이템에 딸린 값이 아니라 전역 이력이다: 어느 아이템에서 새 구매처를
   넣어도 모든 아이템의 칩에 똑같이, 맨 앞에 나타난다. */
const RECENT_MAX = 10;
const STORE_RECENT_KEY = 'lb_recent_stores';
// 최근 구매처는 '저장/담기'가 실제로 일어날 때만 기록한다. 입력 중 blur마다 넣으면
// 쓰다 만 값이 칩으로 남는다.
function rememberStore(value) { rememberRecent(STORE_RECENT_KEY, value); }
function forgetRecent(key, value) {
  const next = readRecents(key).filter((v) => v !== value);
  try { localStorage.setItem(key, JSON.stringify(next)); } catch (e) { /* noop */ }
}
function readRecents(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string' && s.trim()).slice(0, RECENT_MAX) : [];
  } catch (e) { return []; }
}
function rememberRecent(key, text) {
  const t = String(text || '').trim();
  if (!t) return;
  const list = readRecents(key);
  // 이미 있는 값이면 순서를 건드리지 않는다. 저장할 때마다 맨 앞으로 올리면, 값을
  // 바꾸지 않고 아이템을 열어 저장만 해도 목록이 뒤집혀서 아이템마다 칩 구성이
  // 달라 보인다. 맨 앞으로 오는 건 '새로 생긴' 이력뿐이다.
  if (list.indexOf(t) !== -1) return;
  try { localStorage.setItem(key, JSON.stringify([t, ...list].slice(0, RECENT_MAX))); } catch (e) { /* noop */ }
}

/* 최근값 칩 + 자유 입력 — 구매처는 대부분 늘 같은 곳이라 매번 타이핑할 이유가 없다.
   카테고리·계절과 같은 칩 UI로 맞추고, 맨 앞에 '직접 입력'을 둔다. 최근 칩을 고르면
   입력칸은 접히고(칩만 남아 지금 값이 명확) '직접 입력'을 누르면 다시 열린다.
   최근값은 최신순 RECENT_MAX개까지, 넘치면 가로로 스와이프한다. */
function RecentTagField({ label, value, onChange, placeholder, storeKey }) {
  const current = (value || '').trim();
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const anchor = useRef(null);
  // 시트 컴포넌트는 아이템마다 새로 마운트되지 않는다. mount 때 한 번만 읽으면 다른
  // 아이템을 열어도 그때의 목록이 그대로 남아, 방금 저장한 구매처가 칩에 안 뜬다.
  // value가 바뀔 때(= 다른 아이템의 draft가 들어올 때)마다 다시 읽는다.
  // purge: 칩을 지웠을 때 목록을 다시 읽게 하는 카운터 (value는 그대로일 수 있다)
  const [purge, setPurge] = useState(0);
  const recents = useMemo(() => readRecents(storeKey), [storeKey, value, purge]);
  // 입력칸 노출은 상태로 들고 있지 않고 값에서 파생시킨다. 상태로 두면 시트가 열릴 때
  // 값이 한 박자 늦게 도착해(draft를 effect에서 채운다) 칩과 어긋난 채 굳는다.
  // 최근 목록에 없는 값 = 직접 입력한 값 → 입력칸을 연다.
  const typing = !current || recents.indexOf(current) === -1;
  // 표시 순서: 직접 입력 → 지금 선택된 값 → 나머지 최신순. 저장 순서는 건드리지 않는다.
  // 선택된 값을 이력 순서 그대로 두면 새 구매처가 쌓일수록 계속 뒤로 밀려서,
  // 수정 화면을 열 때마다 지금 값이 어디 있는지 찾아야 한다.
  const shown = (current && recents.indexOf(current) !== -1)
    ? [current, ...recents.filter((v) => v !== current)]
    : recents;

  // 칩을 오갈 때마다 입력칸이 붙었다 떨어지며 시트 높이가 바뀐다. 그냥 두면 스크롤을
  // 끝까지 내려 CTA를 보고 있던 상태에서 칩을 누를 때마다 위치가 튀어 다시 내려야 한다.
  // 그래서 누르기 직전 위치를 잡아 두고, 높이가 바뀐 뒤 되돌린다 — 끝에 붙어 있었으면
  // 끝에 그대로, 아니면 같은 scrollTop으로.
  const keepScroll = () => {
    let el = rootRef.current && rootRef.current.parentElement;
    while (el) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) break;
      el = el.parentElement;
    }
    anchor.current = el ? { el, top: el.scrollTop, gap: el.scrollHeight - el.clientHeight - el.scrollTop } : null;
  };
  // 의존성 배열 없이 매 렌더 뒤에 돌린다. 칩을 눌러 anchor를 잡아 둔 렌더에서만 동작하고,
  // typing이 안 바뀐 클릭(이미 직접 입력 중에 또 누름)에서도 앵커가 남지 않는다.
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    a.el.scrollTop = a.gap <= 2 ? a.el.scrollHeight - a.el.clientHeight : a.top;
  });

  const pickChip = (v) => { keepScroll(); onChange(v); };
  // 칩으로 고른 값을 비우면 typing이 자동으로 true가 되어 입력칸이 열린다.
  // focus는 preventScroll — 브라우저가 입력칸을 보이게 하려고 스크롤을 또 움직이면
  // 방금 되돌린 위치가 다시 깨진다.
  const openTyping = () => {
    keepScroll();
    if (current) onChange('');
    setTimeout(() => inputRef.current && inputRef.current.focus({ preventScroll: true }), 0);
  };

  const chipStyle = (on) => ({
    flex: 'none', padding: '7px 13px', borderRadius: 'var(--r-pill)',
    fontSize: 12.5, fontWeight: on ? 600 : 500, whiteSpace: 'nowrap',
    color: on ? 'var(--accent-ink)' : 'var(--ink-2)',
    background: on ? 'var(--accent)' : 'transparent',
    boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--line)',
    transition: 'background var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease)',
  });

  return (
    <div ref={rootRef}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 9 }}>{label}</div>
      <div
        className="lb-chiprow"
        style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '1px 0 4px' }}
      >
        <button type="button" onClick={openTyping} className="lb-chip"
          aria-pressed={typing} style={chipStyle(typing)}>직접 입력</button>
        {shown.map((v) => {
          const on = current === v;
          return (
            // 칩 자체가 버튼이라 삭제를 중첩 버튼으로 넣을 수 없다(중첩 금지) —
            // 칩을 span으로 감싸고 선택/삭제를 형제 버튼으로 나눈다.
            <span key={v} style={{ ...chipStyle(on), display: 'inline-flex', alignItems: 'center', gap: 2, padding: '0 4px 0 13px' }}>
              <button type="button" onClick={() => pickChip(v)} className="lb-chip"
                aria-pressed={on}
                style={{
                  padding: '7px 0', background: 'transparent', color: 'inherit',
                  fontSize: 12.5, fontWeight: on ? 600 : 500, whiteSpace: 'nowrap',
                }}>{v}</button>
              <button type="button" onClick={() => { keepScroll(); forgetRecent(storeKey, v); if (on) onChange(''); setPurge((n) => n + 1); }}
                aria-label={`${v} 최근 목록에서 지우기`}
                style={{
                  display: 'grid', placeItems: 'center', width: 20, height: 20, borderRadius: '50%',
                  background: 'transparent', color: 'inherit', opacity: 0.55, flex: 'none',
                }}>
                <Icon name="x" size={12} stroke={2.4} />
              </button>
            </span>
          );
        })}
      </div>
      {typing && (
        <input
          ref={inputRef}
          className="lb-input"
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%', marginTop: 10, padding: '12px 14px', borderRadius: 'var(--r-md)',
            fontSize: 14, background: 'var(--ivory)', border: '1px solid var(--line)',
            color: 'var(--ink)', outline: 'none', boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}

/* 다중 선택 칩 필드 — 계절처럼 값 여러 개를 토글로 고르는 항목용 (LabeledField의 칩 버전) */
function ChipMultiField({ label, options, value, onChange }) {
  const picked = value || [];
  const toggle = (id) => onChange(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 9 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => (
          <Chip key={o.id} active={picked.includes(o.id)} onClick={() => toggle(o.id)}>{o.name}</Chip>
        ))}
      </div>
    </div>
  );
}

/* 'yy.mm.dd' — 생성일/수정일 표시용. 수정 불가한 값이라 입력칸이 아닌 요약줄에 텍스트로만 노출. */
function formatDotDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

function ItemDetailSheet({ open, item, onClose, onSave, onViewImage }) {
  // 다른 옷을 열면 시트 안 스크롤을 위로 (같은 시트가 재사용된다)
  const bodyRef = useRef(null);
  useScrollTopOn(bodyRef, item && item.id, !!open);
  const [draft, setDraft] = useState({});
  useEffect(() => {
    if (open && item) {
      setDraft({
        name: item.name || '',
        brand: item.brand || '',
        size: item.size || '',
        color: item.color || '',
        store: item.store || '',
        note: item.note || '',
        seasons: item.seasons || [],
        price: item.price || '',
        material: item.material || '',
      });
    }
  }, [open, item && item.id]);
  if (!item) return null;
  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));
  const canZoom = !!(item.img && onViewImage);
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div ref={bodyRef} className="lb-sheet-body" style={{ padding: '10px 24px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
            <button
              type="button"
              onClick={() => canZoom && onViewImage(item)}
              aria-label={canZoom ? '이미지 크게 보기' : undefined}
              disabled={!canZoom}
              style={{
                width: 72, flex: 'none', padding: 0, border: 'none', background: 'transparent',
                cursor: canZoom ? 'zoom-in' : 'default', position: 'relative',
                outline: 'none', boxShadow: 'none', WebkitTapHighlightColor: 'transparent',
              }}
            >
              <Thumb item={item} radius="var(--r-md)" />
              {canZoom && (
                <span style={{
                  position: 'absolute', right: 4, bottom: 4, width: 22, height: 22, borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--ink) 72%, transparent)', color: '#fff',
                  display: 'grid', placeItems: 'center',
                }}>
                  <Icon name="search" size={11} stroke={2.4} />
                </span>
              )}
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 6 }}>이름</div>
              <input
                className="lb-input"
                value={draft.name || ''}
                maxLength={48}
                placeholder="예) 코튼 셔츠"
                onChange={(e) => set('name')(e.target.value.slice(0, 48))}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--r-md)',
                  fontSize: 15, fontWeight: 700, lineHeight: 1.3,
                  background: 'var(--ivory)', border: '1px solid var(--line)', color: 'var(--ink)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6 }}>
                {item.category} · {draft.color || item.color || '색상 미정'}
              </div>
            </div>
          </div>
          <IconBtn name="x" label="닫기" onClick={onClose} style={{ marginRight: -8, flex: 'none' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '24px 0 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>상세 정보</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>선택 입력</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}><LabeledField label="브랜드" value={draft.brand} onChange={set('brand')} placeholder="예) 코스" /></div>
            <div style={{ flex: 1 }}><LabeledField label="사이즈" value={draft.size} onChange={set('size')} placeholder="예) M" /></div>
          </div>
          <LabeledField label="컬러" value={draft.color} onChange={set('color')} placeholder="예) 그레이시 그린" />
          <ChipMultiField label="계절" options={window.LB_DATA.SEASONS} value={draft.seasons} onChange={set('seasons')} />
          <LabeledField label="가격" value={draft.price} onChange={set('price')} placeholder="예) 89,000" />
          <LabeledField label="재질" value={draft.material} onChange={set('material')} placeholder="예) 코튼 100%" />
          <RecentTagField label="구매처" value={draft.store} onChange={set('store')} placeholder="구매처 이름을 입력해 주세요" storeKey={STORE_RECENT_KEY} />
          <LabeledField label="메모" value={draft.note} onChange={set('note')} placeholder="코디 팁, 세탁 주의 등" multiline />
          {formatDotDate(item.createdAt) && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
              생성 {formatDotDate(item.createdAt)} · 수정 {formatDotDate(item.updatedAt) || formatDotDate(item.createdAt)}
            </div>
          )}
        </div>

        <div style={{ marginTop: 26 }}>
          <Btn full size="lg" icon="check" onClick={() => {
            rememberStore(draft.store);
            onSave(item.id, { ...draft, name: (draft.name || '').trim() || item.name || '옷' });
          }}>저장</Btn>
        </div>
      </div>
    </BottomSheet>
  );
}

/* ----------------------------------------------------------------
   ItemRemoveSheet — 카드 ··· 더보기 → 확대 / 보관 / 삭제
---------------------------------------------------------------- */
function ItemRemoveSheet({ open, item, onClose, onArchive, onRestore, onDelete, onExpand, onReextract }) {
  const DANGER = '#B0573C';
  if (!item) return null;
  const isArchived = item.status === 'archived';
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '10px 24px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div style={{ width: 56, flex: 'none' }}><Thumb item={item} radius="var(--r-md)" /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 700, lineHeight: 1.25, textWrap: 'pretty' }}>{item.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{item.category} · {item.color}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 22 }}>
          {item.img && onExpand && (
            <Btn full size="lg" variant="soft" icon="search" onClick={onExpand}>이미지 크게 보기</Btn>
          )}
          {onReextract && (
            <Btn full size="lg" variant="soft" icon="sparkle" onClick={() => onReextract(item)}>이미지만 변경</Btn>
          )}
          {isArchived
            ? <Btn full size="lg" variant="soft" icon="hanger" onClick={onRestore}>옷장으로 꺼내기</Btn>
            : <Btn full size="lg" variant="soft" icon="archive" onClick={onArchive}>보관하기</Btn>}
          <Btn full size="lg" icon="trash" onClick={onDelete} style={{ background: DANGER, color: '#fff' }}>삭제하기</Btn>
          <Btn full variant="ghost" onClick={onClose}>취소</Btn>
        </div>
      </div>
    </BottomSheet>
  );
}

/* ============================================================
   EmptyState — shared chrome for tab empty / gate screens.
   Top-anchored (not flex-center) + fixed title/body/footer slots so
   icon → CTA stay on the same Y across wardrobe / lookbook / today.
   ============================================================ */
function EmptyState({
  icon,
  iconSize = 38,
  title,
  children,
  action,
  hint,
  hintHidden = false,
  wide = false,
  padTop = true,
}) {
  // Same optical start on every tab. flex-center shifts when copy length differs.
  // 모바일의 오늘/룩북 탭에는 상단바가 없다. 옷장 탭 TopBar 높이(안전영역 + 73px)만큼
  // 내려서 세 탭의 아이콘·타이틀·CTA가 같은 Y에 오게 맞춘다. 데스크탑(wide)은 그대로.
  const boxPad = (!padTop || wide)
    ? 'min(18vh, 168px) 40px 80px'
    : 'calc(env(safe-area-inset-top, 0px) + 73px + min(18vh, 168px)) 40px 80px';
  const footer = hint ?? (
    <>
      <Icon name="lock" size={14} /> 상의·하의를 담으면 조합 추천이 열려요
    </>
  );
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        textAlign: 'center',
        padding: boxPad,
        boxSizing: 'border-box',
      }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%', background: 'var(--surface)',
          display: 'grid', placeItems: 'center', color: 'var(--ink-3)', marginBottom: 'var(--s5)', flex: 'none',
        }}>
          <Icon name={icon} size={iconSize} stroke={1.4} />
        </div>
        <h1 style={{
          margin: 0, fontSize: 21, fontWeight: 700, lineHeight: 1.3,
          minHeight: 28, width: '100%', maxWidth: 280,
        }}>{title}</h1>
        <p style={{
          margin: '10px 0 0', fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.55,
          maxWidth: 280, width: '100%',
          minHeight: Math.round(14.5 * 1.55 * 2),
        }}>
          {children}
        </p>
        <div style={{ marginTop: 'var(--s7)', width: '100%', maxWidth: 280, flex: 'none' }}>
          {action}
        </div>
        <div
          aria-hidden={hintHidden || undefined}
          style={{
            marginTop: 'var(--s4)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            color: 'var(--ink-3)',
            fontSize: 12.5,
            lineHeight: 1.4,
            minHeight: 20,
            width: '100%',
            maxWidth: 280,
            visibility: hintHidden ? 'hidden' : 'visible',
          }}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   PullRefresh — 모바일에서 목록을 끌어 내리면 서버 값을 다시 받는다.
   네이티브 러버밴드를 끄고(overscroll contain) 있어서 직접 당김을 그린다.
---------------------------------------------------------------- */
function PullRefresh({ onRefresh, disabled, children, style, className, scrollRef }) {
  const local = useRef(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullRef = useRef(0);
  const busyRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const setNode = (node) => {
    local.current = node;
    if (scrollRef) scrollRef.current = node;
  };

  useEffect(() => {
    const el = local.current;
    if (!el || disabled) return undefined;
    const THRESHOLD = 56;
    const onStart = (e) => {
      if (busyRef.current || e.touches.length !== 1) return;
      if (el.scrollTop > 1) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };
    const onMove = (e) => {
      if (!pulling.current || busyRef.current) return;
      if (el.scrollTop > 1) {
        pulling.current = false;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      e.preventDefault();
      const next = Math.min(72, dy * 0.42);
      pullRef.current = next;
      setPull(next);
    };
    const onEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      const should = pullRef.current >= THRESHOLD && onRefreshRef.current;
      pullRef.current = 0;
      setPull(0);
      if (!should) return;
      busyRef.current = true;
      setBusy(true);
      Promise.resolve(onRefreshRef.current())
        .catch(() => {})
        .finally(() => { busyRef.current = false; setBusy(false); });
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [disabled]);

  const show = busy || pull > 6;
  const h = busy ? 40 : pull;

  return (
    <div ref={setNode} className={'lb-scrollable' + (className ? ' ' + className : '')} style={style}>
      <div aria-hidden={!show} style={{
        height: h, flex: 'none', overflow: 'hidden',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        paddingBottom: show ? 8 : 0,
      }}>
        {show ? <span className="lb-spin" /> : null}
      </div>
      {children}
    </div>
  );
}

Object.assign(window, { useScrollTopOn, Icon, Silhouette, Thumb, ImageViewer, Skeleton, Btn, Chip, Badge, IconBtn, BottomSheet, ItemDetailSheet, ItemRemoveSheet, LabeledField, NumberSlider, ChipMultiField, RecentTagField, STORE_RECENT_KEY, rememberStore, useEscapeClose, EmptyState, SmartImg, PullRefresh });
