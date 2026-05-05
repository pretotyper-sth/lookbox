// shared.jsx — Common building blocks used by every LOOKBOX variation.

const LB_FONTS = `'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;

// Theme tokens — light/dark
function lbTheme(dark, accent = '#000') {
  return dark ? {
    bg: '#0E0E10', surface: '#18181B', surfaceAlt: '#1F1F23',
    line: 'rgba(255,255,255,0.08)', textHigh: '#FAFAFA',
    textMid: 'rgba(255,255,255,0.62)', textLow: 'rgba(255,255,255,0.38)',
    chipBg: '#222226', chipBgActive: '#FAFAFA', chipTextActive: '#0E0E10',
    cardBg: '#1A1A1D', accent,
  } : {
    bg: '#FAF8F4', surface: '#FFFFFF', surfaceAlt: '#F2EFE8',
    line: 'rgba(0,0,0,0.06)', textHigh: '#0E0E10',
    textMid: 'rgba(14,14,16,0.62)', textLow: 'rgba(14,14,16,0.38)',
    chipBg: '#F2EFE8', chipBgActive: '#0E0E10', chipTextActive: '#FFFFFF',
    cardBg: '#FFFFFF', accent,
  };
}

// Top header — LOOKBOX wordmark (no greeting/avatar per latest direction)
function LBHeader({ dark }) {
  const t = lbTheme(dark);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 18px' }}>
      <div style={{
        fontSize: 18, fontWeight: 900, color: t.textHigh,
        letterSpacing: -0.4, fontFamily: LB_FONTS,
      }}>
        LOOK<span style={{ color: t.accent && t.accent !== '#000' ? t.accent : t.textHigh, fontWeight: 900 }}>BOX</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <IconBtn dark={dark} icon={(
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        )}/>
        <IconBtn dark={dark} icon={(
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
        )}/>
      </div>
    </div>
  );
}

function IconBtn({ dark, icon, onClick }) {
  const t = lbTheme(dark);
  return (
    <button onClick={onClick} style={{
      border: 'none', background: 'transparent', color: t.textHigh, padding: 4,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{icon}</button>
  );
}

// Category tabs — top scrolling row
function LBCategoryTabs({ dark, active = 0, items = ['전체', '상의', '바지', '아우터', '신발', '가방', '모자'] }) {
  const t = lbTheme(dark);
  return (
    <div style={{ display: 'flex', gap: 18, padding: '4px 20px 14px', overflow: 'auto' }}>
      {items.map((it, i) => (
        <div key={it} style={{
          fontSize: 15, fontWeight: i === active ? 700 : 500,
          color: i === active ? t.textHigh : t.textLow,
          paddingBottom: 8, borderBottom: i === active ? `2px solid ${t.textHigh}` : '2px solid transparent',
          flexShrink: 0, letterSpacing: -0.3,
        }}>{it}</div>
      ))}
    </div>
  );
}

// Filter chip row — second-level
function LBFilterChips({ dark, items = ['모든 옷', '계절', '컬러', '핏'] }) {
  const t = lbTheme(dark);
  return (
    <div style={{ display: 'flex', gap: 8, padding: '0 20px 14px', alignItems: 'center' }}>
      <button style={{
        width: 32, height: 32, borderRadius: 16, border: 'none',
        background: t.chipBg, color: t.textHigh, display: 'flex',
        alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><circle cx="6" cy="12" r="2"/><circle cx="9" cy="18" r="2"/></svg>
      </button>
      {items.map((it, i) => (
        <div key={it} style={{
          padding: '7px 14px', borderRadius: 16, background: t.chipBg, color: t.textHigh,
          fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
        }}>
          {it}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2, opacity: 0.6 }}><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      ))}
    </div>
  );
}

// Bottom navigation
function LBBottomNav({ dark, active = 1 }) {
  const t = lbTheme(dark);
  const items = [
    { label: 'Home', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg> },
    { label: '옷장', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="1"/><line x1="12" y1="3" x2="12" y2="21"/><circle cx="9" cy="12" r="0.5" fill="currentColor"/><circle cx="15" cy="12" r="0.5" fill="currentColor"/></svg> },
    { label: '추가', icon: 'plus' },
    { label: '코디', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 7v6c0 4.4 3.4 8 8 9 4.6-1 8-4.6 8-9V7l-8-4z"/></svg> },
    { label: '탐색', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polygon points="16 8 14 14 8 16 10 10"/></svg> },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
      background: t.surface, borderTop: `1px solid ${t.line}`,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around',
      paddingTop: 10, zIndex: 30,
    }}>
      {items.map((it, i) => {
        const isActive = i === active;
        if (it.icon === 'plus') {
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: t.textHigh, color: t.surface,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: -16,
                boxShadow: '0 8px 18px rgba(0,0,0,0.18)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
            </div>
          );
        }
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: isActive ? t.textHigh : t.textLow }}>
            {it.icon}
            <div style={{ fontSize: 10, fontWeight: isActive ? 600 : 500 }}>{it.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// White-card item with cloth illustration centered
function LBItemCard({ dark, children, brand, label, density = 'normal' }) {
  const t = lbTheme(dark);
  const showText = density !== 'minimal';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        background: dark ? '#FFFFFF' : '#FFFFFF', // always white for clothing pop
        borderRadius: 14, aspectRatio: '1 / 1.1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: dark ? 'none' : `1px solid ${t.line}`,
        overflow: 'hidden',
      }}>{children}</div>
      {showText && (
        <div style={{ paddingLeft: 2 }}>
          {brand && <div style={{ fontSize: 11, fontWeight: 700, color: t.textHigh, letterSpacing: 0.4, textTransform: 'uppercase' }}>{brand}</div>}
          {label && density === 'rich' && <div style={{ fontSize: 11, color: t.textMid, marginTop: 2 }}>{label}</div>}
        </div>
      )}
    </div>
  );
}

// AI suggestion / coordi banner
function LBCoordiBanner({ dark, accent }) {
  const t = lbTheme(dark, accent);
  return (
    <div style={{
      margin: '0 20px 18px', padding: '16px 18px',
      background: `linear-gradient(135deg, ${t.surfaceAlt}, ${dark ? '#15151A' : '#FFFFFF'})`,
      borderRadius: 18, border: `1px solid ${t.line}`,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, background: t.accent, color: dark ? '#0E0E10' : '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6"/><path d="M12 16v6"/><path d="M4.93 4.93l4.24 4.24"/><path d="M14.83 14.83l4.24 4.24"/><path d="M2 12h6"/><path d="M16 12h6"/><path d="M4.93 19.07l4.24-4.24"/><path d="M14.83 9.17l4.24-4.24"/></svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: t.accent, letterSpacing: 0.6, marginBottom: 2 }}>AI 스타일리스트</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.textHigh }}>오늘의 코디 추천</div>
        <div style={{ fontSize: 11, color: t.textMid, marginTop: 1 }}>뉴욕 · 8°/-2° · 추운 겨울</div>
      </div>
      <div style={{
        width: 28, height: 28, borderRadius: 14, background: t.chipBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: t.textHigh }}><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>
  );
}

Object.assign(window, {
  LB_FONTS, lbTheme, LBHeader, LBCategoryTabs, LBFilterChips,
  LBBottomNav, LBItemCard, LBCoordiBanner, IconBtn,
});
