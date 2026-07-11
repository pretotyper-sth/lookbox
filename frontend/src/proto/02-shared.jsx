/* @prototype-ported */
const React = window.React;

/* global React */
// LOOKBOX — shared UI components + inline icon set.
// Exported to window at the bottom.

const { useState, useRef, useEffect } = React;

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
  // 아우터 — open coat: V-lapel, center opening, longer body (distinct from 상의)
  '아우터': 'M12 6 L7.5 8 L5 13.5 L8.5 15 V27 H23.5 V15 L27 13.5 L24.5 8 L20 6 L16 9.5 Z M16 9.5 V27',
  // 신발 — side-profile loafer
  '신발':   'M5 18.5 C5 16.5 7.5 16 9.5 16.8 L14.5 19 C17.5 20 20.5 20 23.5 20.4 C26 20.7 27 21.4 27 22.6 V23.6 H5 Z M9.5 16.8 L11 19',
  // 액세서리 — shoulder bag with arc handle
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
   Thumb — square garment tile. Photo OR silhouette, both on ivory.
---------------------------------------------------------------- */
function Thumb({ item, radius = 'var(--r-md)', ratio = '1 / 1', fit = 'contain' }) {
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: ratio,
      background: 'var(--surface-2)', borderRadius: radius, overflow: 'hidden',
      boxShadow: 'inset 0 0 0 1px var(--line)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {item && item.img
        ? <img src={item.img} alt={item.name || ''} loading="lazy" decoding="async"
               style={{ width: '100%', height: '100%', objectFit: fit, padding: '8%', boxSizing: 'border-box' }} />
        : <Silhouette category={item ? item.category : '상의'} />}
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
function IconBtn({ name, onClick, label, active, size = 40, iconSize = 21, style }) {
  return (
    <button onClick={onClick} aria-label={label} className="lb-iconbtn" style={{
      width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center',
      color: active ? 'var(--accent-ink)' : 'var(--ink)',
      background: active ? 'var(--accent)' : 'transparent',
      transition: 'all var(--dur) var(--ease)', ...style,
    }}>
      <Icon name={name} size={iconSize} fill={active && name === 'heart' ? 'currentColor' : 'none'} />
    </button>
  );
}

/* ----------------------------------------------------------------
   BottomSheet — bottom sheet on mobile, centered modal on desktop
---------------------------------------------------------------- */
function BottomSheet({ open, onClose, children, maxW = 460 }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [wide, setWide] = useState(typeof window !== 'undefined' && window.innerWidth >= 760);
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
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 60, display: 'flex',
      alignItems: wide ? 'center' : 'flex-end', justifyContent: 'center',
      background: shown ? 'rgba(30,27,21,0.42)' : 'rgba(30,27,21,0)',
      transition: 'background var(--dur) var(--ease)', padding: wide ? 24 : 0,
    }} className="lb-sheet-scrim">
      <div onClick={(e) => e.stopPropagation()} className="lb-sheet" style={{
        width: '100%', maxWidth: wide ? 420 : maxW, background: 'var(--surface)',
        borderRadius: wide ? 'var(--r-lg)' : 'var(--r-lg) var(--r-lg) 0 0',
        boxShadow: wide ? 'var(--pop-shadow)' : 'var(--sheet-shadow)',
        transform: shown ? 'translateY(0) scale(1)' : hiddenTf,
        opacity: wide ? (shown ? 1 : 0) : 1,
        transition: 'transform var(--dur) var(--ease), opacity var(--dur) var(--ease)',
        paddingBottom: wide ? 6 : 'max(env(safe-area-inset-bottom), 12px)',
      }}>
        {!wide && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
            <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--line-2)' }} />
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
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>{label}</div>
      {multiline
        ? <textarea className="lb-input" rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={common} />
        : <input className="lb-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={common} />}
    </label>
  );
}

function ItemDetailSheet({ open, item, onClose, onSave }) {
  const [draft, setDraft] = useState({});
  useEffect(() => { if (open && item) setDraft({ brand: item.brand || '', size: item.size || '', store: item.store || '', note: item.note || '' }); }, [open, item && item.id]);
  if (!item) return null;
  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '10px 24px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
            <div style={{ width: 64, flex: 'none' }}><Thumb item={item} radius="var(--r-md)" /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25, textWrap: 'pretty' }}>{item.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{item.category} · {item.color}</div>
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
          <LabeledField label="구매처" value={draft.store} onChange={set('store')} placeholder="예) 무신사 · 오프라인" />
          <LabeledField label="메모" value={draft.note} onChange={set('note')} placeholder="코디 팁, 세탁 주의 등" multiline />
        </div>

        <div style={{ marginTop: 26 }}>
          <Btn full size="lg" icon="check" onClick={() => onSave(item.id, draft)}>저장</Btn>
        </div>
      </div>
    </BottomSheet>
  );
}

/* ----------------------------------------------------------------
   ItemRemoveSheet — 옷 카드 우상단 X → 보관 / 삭제 선택
   보관: 옷장에서 숨김(archived) · 삭제: 완전 삭제(파괴적, 되돌릴 수 없음)
---------------------------------------------------------------- */
function ItemRemoveSheet({ open, item, onClose, onArchive, onRestore, onDelete }) {
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
        <p style={{ margin: '18px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
          {isArchived
            ? <>옷장으로 꺼내면 다시 조합 추천에 사용돼요. 삭제하면 완전히 지워지고 <b style={{ color: 'var(--ink)', fontWeight: 700 }}>되돌릴 수 없어요.</b></>
            : <>보관 시 옷장에서 숨겨지고, 삭제 시 완전히 지워지고 <b style={{ color: 'var(--ink)', fontWeight: 700 }}>되돌릴 수 없어요.</b></>}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 22 }}>
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

Object.assign(window, { Icon, Silhouette, Thumb, Skeleton, Btn, Chip, Badge, IconBtn, BottomSheet, ItemDetailSheet, ItemRemoveSheet, LabeledField });
