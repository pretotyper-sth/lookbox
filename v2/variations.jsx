// variations.jsx — 5 home-screen design directions for LOOKBOX

// ─── V1 · MINIMAL GRID ────────────────────────────────
// Clean grid of items, simple category tabs. The default.
function V1MinimalGrid({ dark, columns = 3, density = 'normal', accent }) {
  const t = lbTheme(dark, accent);
  const items = [
    { brand: 'AURALEE', label: '쉐어링 자켓', cmp: <ShearlingJacket size={150}/> },
    { brand: 'ZARA', label: '데님 스커트', cmp: <DenimSkirt size={150}/> },
    { brand: 'COS', label: '크롭 탑', cmp: <CroppedTop size={150}/> },
    { brand: 'MUJI', label: '베이직 티', cmp: <BasicTee size={150}/> },
    { brand: 'INTHEMOOD', label: '첼시 부츠', cmp: <ChelseaBoots size={150}/> },
    { brand: 'STUDIO N.', label: '숄더백', cmp: <ShoulderBag size={150}/> },
    { brand: 'A.P.C.', label: '데님 셔츠', cmp: <BlueShirt size={150}/> },
    { brand: '8SECONDS', label: '쇼츠', cmp: <Shorts size={150}/> },
    { brand: 'UNIQLO', label: '후디', cmp: <GrayHoodie size={150}/> },
    { brand: 'SAINT JAMES', label: '톨 부츠', cmp: <TallBoots size={150}/> },
    { brand: 'STUDIO N.', label: '호보백', cmp: <BlackHoboBag size={150}/> },
    { brand: 'OUR LEGACY', label: '와이드 팬츠', cmp: <BlackPants size={150}/> },
  ];
  return (
    <div style={{ background: t.bg, minHeight: '100%', paddingBottom: 100, fontFamily: LB_FONTS }}>
      <LBHeader dark={dark}/>
      <LBCategoryTabs dark={dark} active={0}/>
      <LBFilterChips dark={dark} items={['모든 옷', '계절', '컬러']}/>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 10, padding: '0 20px',
      }}>
        {items.slice(0, columns * 4).map((it, i) => (
          <LBItemCard key={i} dark={dark} brand={it.brand} label={it.label} density={density}>
            {it.cmp}
          </LBItemCard>
        ))}
      </div>
      <LBBottomNav dark={dark} active={1}/>
    </div>
  );
}

// ─── V2 · MAGAZINE EDITORIAL ──────────────────────────
// Mix of large feature card + smaller items. Editorial typography.
function V2Magazine({ dark, columns = 2, density = 'rich', accent }) {
  const t = lbTheme(dark, accent);
  return (
    <div style={{ background: t.bg, minHeight: '100%', paddingBottom: 100, fontFamily: LB_FONTS }}>
      {/* large editorial title */}
      <div style={{ padding: '8px 24px 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMid, letterSpacing: 2, marginBottom: 6 }}>WARDROBE</div>
            <div style={{ fontSize: 38, fontWeight: 700, color: t.textHigh, fontFamily: '"Playfair Display", "Noto Serif KR", serif', letterSpacing: -1, lineHeight: 1 }}>
              나의 옷장
            </div>
            <div style={{ fontSize: 12, color: t.textMid, marginTop: 6 }}>총 142벌 · 12월 31일 업데이트</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: t.surfaceAlt, display:'flex',alignItems:'center',justifyContent:'center', fontSize: 13, color: t.textMid, fontWeight: 600 }}>이</div>
        </div>
      </div>
      {/* horizontal categories */}
      <div style={{ display: 'flex', gap: 6, padding: '20px 24px 18px', overflow: 'auto' }}>
        {['전체 142', '상의 38', '바지 24', '아우터 18', '신발 22'].map((it, i) => (
          <div key={i} style={{
            padding: '8px 14px', borderRadius: 100,
            background: i === 0 ? t.chipBgActive : 'transparent',
            color: i === 0 ? t.chipTextActive : t.textMid,
            border: i === 0 ? 'none' : `1px solid ${t.line}`,
            fontSize: 12, fontWeight: 600, flexShrink: 0,
          }}>{it}</div>
        ))}
      </div>
      {/* feature card */}
      <div style={{ margin: '0 20px 14px', borderRadius: 20, overflow: 'hidden', background: t.surfaceAlt, position: 'relative', height: 220 }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <OutfitA size={220}/>
        </div>
        <div style={{ position: 'absolute', top: 14, left: 16, right: 16, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textHigh, letterSpacing: 1.2, padding: '4px 8px', background: dark ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.85)', color: '#0E0E10', borderRadius: 4 }}>OUTFIT 01</div>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: 'rgba(255,255,255,0.85)', display:'flex',alignItems:'center',justifyContent:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#0E0E10"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16, color: t.textHigh }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0E0E10', textShadow: '0 0 12px rgba(255,255,255,0.6)' }}>추운 겨울 캐주얼 데일리룩</div>
          <div style={{ fontSize: 11, color: 'rgba(14,14,16,0.7)', marginTop: 2, textShadow: '0 0 12px rgba(255,255,255,0.6)' }}>5 items · AI 추천</div>
        </div>
      </div>
      {/* magazine grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 20px' }}>
        <LBItemCard dark={dark} brand="AURALEE" label="쉐어링 자켓 · Cream" density="rich"><ShearlingJacket size={170}/></LBItemCard>
        <LBItemCard dark={dark} brand="ZARA" label="A라인 데님 · Indigo" density="rich"><DenimSkirt size={170}/></LBItemCard>
        <LBItemCard dark={dark} brand="INTHEMOOD" label="첼시 부츠 · Chocolate" density="rich"><ChelseaBoots size={170}/></LBItemCard>
        <LBItemCard dark={dark} brand="STUDIO N." label="호보백 · Black" density="rich"><BlackHoboBag size={170}/></LBItemCard>
      </div>
      <LBBottomNav dark={dark} active={1}/>
    </div>
  );
}

// ─── V3 · COLOR CHIP / SECTIONED ─────────────────────
// Items grouped under colored category chips with horizontal scroll rows.
function V3Sectioned({ dark, columns, density = 'normal', accent }) {
  const t = lbTheme(dark, accent);
  const sections = [
    { name: '아우터', count: 8, color: '#EAE2D2', items: [
      <ShearlingJacket size={130} key="1"/>, <CardiganGray size={130} key="2"/>, <GrayHoodie size={130} key="3"/>,
    ]},
    { name: '상의', count: 24, color: '#D9D7D2', items: [
      <CroppedTop size={130} key="1"/>, <BlueShirt size={130} key="2"/>, <BasicTee size={130} key="3"/>,
    ]},
    { name: '바지 & 스커트', count: 16, color: '#A8BBCE', items: [
      <BlueJeans size={130} key="1"/>, <DenimSkirt size={130} key="2"/>, <BlackPants size={130} key="3"/>,
    ]},
    { name: '신발', count: 12, color: '#B89868', items: [
      <ChelseaBoots size={130} key="1"/>, <WhiteBoots size={130} key="2"/>, <TallBoots size={130} key="3"/>,
    ]},
  ];
  return (
    <div style={{ background: t.bg, minHeight: '100%', paddingBottom: 100, fontFamily: LB_FONTS }}>
      <LBHeader dark={dark}/>
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ fontSize: 13, color: t.textMid }}>총 60벌 · 카테고리 7개</div>
      </div>
      {sections.map((s, i) => (
        <div key={i} style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: s.color }}/>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.textHigh }}>{s.name}</div>
              <div style={{ fontSize: 12, color: t.textLow }}>{s.count}</div>
            </div>
            <div style={{ fontSize: 12, color: t.textMid, display: 'flex', alignItems: 'center', gap: 4 }}>
              전체보기
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, padding: '0 20px', overflow: 'auto' }}>
            {s.items.map((cmp, j) => (
              <div key={j} style={{ width: 130, flexShrink: 0 }}>
                <div style={{ background: '#FFFFFF', borderRadius: 12, aspectRatio: '1 / 1.1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${t.line}` }}>{cmp}</div>
              </div>
            ))}
            <div style={{ width: 130, flexShrink: 0, aspectRatio: '1 / 1.1',
              border: `1px dashed ${t.line}`, borderRadius: 12,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 6, color: t.textMid, fontSize: 12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              추가
            </div>
          </div>
        </div>
      ))}
      <LBBottomNav dark={dark} active={1}/>
    </div>
  );
}

// ─── V4 · LIST WITH METADATA ──────────────────────────
// Vertical list rows: thumbnail + brand + tags + last-worn date.
function V4List({ dark, columns, density = 'rich', accent }) {
  const t = lbTheme(dark, accent);
  const rows = [
    { brand: 'AURALEE', name: '쉐어링 자켓', tags: ['크림', '겨울', 'M'], wornCount: 12, lastWorn: '3일 전', cmp: <ShearlingJacket size={70}/> },
    { brand: 'ZARA', name: 'A라인 데님 스커트', tags: ['인디고', '봄/가을'], wornCount: 8, lastWorn: '1주 전', cmp: <DenimSkirt size={70}/> },
    { brand: 'COS', name: '크롭 탑', tags: ['블랙', '여름'], wornCount: 24, lastWorn: '어제', cmp: <CroppedTop size={70}/> },
    { brand: 'INTHEMOOD', name: '첼시 부츠', tags: ['브라운', '겨울'], wornCount: 5, lastWorn: '2주 전', cmp: <ChelseaBoots size={70}/> },
    { brand: 'A.P.C.', name: '데님 셔츠', tags: ['라이트 블루', '봄'], wornCount: 15, lastWorn: '5일 전', cmp: <BlueShirt size={70}/> },
    { brand: 'UNIQLO', name: '오버사이즈 후디', tags: ['그레이', '가을'], wornCount: 32, lastWorn: '오늘', cmp: <GrayHoodie size={70}/> },
  ];
  return (
    <div style={{ background: t.bg, minHeight: '100%', paddingBottom: 100, fontFamily: LB_FONTS }}>
      <LBHeader dark={dark}/>
      <LBCategoryTabs dark={dark} active={0}/>
      {/* sort + view toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 14px' }}>
        <div style={{ fontSize: 12, color: t.textMid, display: 'flex', alignItems: 'center', gap: 4 }}>
          최근 입은 순
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, display:'flex',alignItems:'center',justifyContent:'center', color: t.textLow }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </div>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: t.chipBg, display:'flex',alignItems:'center',justifyContent:'center', color: t.textHigh }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </div>
        </div>
      </div>
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r, i) => (
          <div key={i} style={{
            background: t.surface, borderRadius: 14, padding: 12,
            border: `1px solid ${t.line}`,
            display: 'flex', gap: 12, alignItems: 'center',
          }}>
            <div style={{ width: 64, height: 70, background: '#FFFFFF', borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: dark ? 'none' : `1px solid ${t.line}` }}>
              {r.cmp}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.textMid, letterSpacing: 0.6 }}>{r.brand}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.textHigh, marginTop: 1 }}>{r.name}</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                {r.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4,
                    background: t.surfaceAlt, color: t.textMid }}>{tag}</span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.textHigh, fontVariantNumeric: 'tabular-nums' }}>{r.wornCount}</div>
              <div style={{ fontSize: 9, color: t.textLow, letterSpacing: 0.4, textTransform: 'uppercase' }}>WORN</div>
              <div style={{ fontSize: 10, color: t.textMid, marginTop: 4 }}>{r.lastWorn}</div>
            </div>
          </div>
        ))}
      </div>
      <LBBottomNav dark={dark} active={1}/>
    </div>
  );
}

// ─── V5 · CURATION (matches reference) ─────────────────
// Closest to the reference image — AI banner, outfit cards, recent items.
function V5Curation({ dark, columns = 3, density = 'normal', accent }) {
  const t = lbTheme(dark, accent);
  const recent = [
    <ShearlingJacket size={110} key="1"/>,
    <DenimSkirt size={110} key="2"/>,
    <ChelseaBoots size={110} key="3"/>,
    <ShoulderBag size={110} key="4"/>,
  ];
  return (
    <div style={{ background: t.bg, minHeight: '100%', paddingBottom: 100, fontFamily: LB_FONTS }}>
      <LBHeader dark={dark}/>
      {/* AI Stylist quick actions */}
      <div style={{ padding: '0 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.textHigh, marginBottom: 10, letterSpacing: 0.3 }}>AI 스타일리스트</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          {[
            { label: '코디 추천', cmp: <BlueShirt size={50}/> },
            { label: '스타일 채팅', cmp: (
              <div style={{ width: 50, height: 50, borderRadius: 25, background: '#A8BBCE', display:'flex',alignItems:'center',justifyContent:'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0E0E10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
            )},
          ].map((it, i) => (
            <div key={i} style={{ background: t.surfaceAlt, borderRadius: 14, padding: 14, height: 100, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: -10, top: 8, opacity: 0.95 }}>{it.cmp}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.textHigh, position: 'absolute', bottom: 14, left: 14 }}>{it.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
          {[
            { label: '나의 컬러', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18"/><path d="M3 12h18"/></svg> },
            { label: '나의 핏', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="5" r="2"/><path d="M9 22V12l-2-3 5-2 5 2-2 3v10"/></svg> },
            { label: '평가', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9"/></svg> },
            { label: '가상 피팅', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg> },
          ].map((it, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: t.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textHigh }}>
                {it.icon}
              </div>
              <div style={{ fontSize: 11, color: t.textMid, fontWeight: 500 }}>{it.label}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Today's outfit */}
      <div style={{ padding: '0 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.textHigh, letterSpacing: -0.3 }}>추운 겨울 캐주얼 데일리룩</div>
          <div style={{ fontSize: 11, color: t.textMid, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📅 12월 31일</span>
            <span>📍 뉴욕</span>
            <span>☁︎ 8°/-2°</span>
          </div>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: t.surfaceAlt, display:'flex',alignItems:'center',justifyContent:'center', color: t.textMid }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, padding: '8px 20px 24px', overflow: 'auto' }}>
        {[<OutfitA size={170} key="1"/>, <OutfitB size={170} key="2"/>].map((o, i) => (
          <div key={i} style={{ width: 170, height: 170, background: '#FFFFFF', borderRadius: 14, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: dark ? 'none' : `1px solid ${t.line}` }}>{o}</div>
        ))}
      </div>
      {/* Recent items */}
      <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.textHigh, letterSpacing: -0.3 }}>최근 추가한 아이템</div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: t.textMid }}><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div style={{ display: 'flex', gap: 10, padding: '0 20px', overflow: 'auto' }}>
        {recent.map((cmp, i) => (
          <div key={i} style={{ width: 100, flexShrink: 0,
            background: '#FFFFFF', borderRadius: 12, aspectRatio: '1 / 1.1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: dark ? 'none' : `1px solid ${t.line}` }}>
            {cmp}
          </div>
        ))}
      </div>
      <LBBottomNav dark={dark} active={0}/>
    </div>
  );
}

Object.assign(window, {
  V1MinimalGrid, V2Magazine, V3Sectioned, V4List, V5Curation,
});
