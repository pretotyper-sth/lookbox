/* @prototype-ported */
const React = window.React;
const { Badge, BottomSheet, Btn, CATEGORIES, Chip, EmptyState, Icon, IconBtn, LB_DATA, LabeledField, Skeleton, Thumb } = window;

/* global React, Thumb, Skeleton, Btn, Chip, Badge, IconBtn, Icon, BottomSheet, LB_DATA, EmptyState */
// LOOKBOX — screens A–E + layout chrome. Exported to window.

const { useState: useS, useEffect: useE, useRef: useR } = React;

/* ============================================================
   Layout chrome
   ============================================================ */
// onClick — 앱 안에서는 홈(옷장) 버튼. 가입 전 화면(랜딩·로그인·온보딩)은 넘기지 않아 그냥 로고로 남는다.
function Wordmark({ size = 19, onClick }) {
  const box = { display: 'inline-flex', alignItems: 'center', gap: 5, userSelect: 'none', height: 24 };
  const mark = (
    <>
      <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-0.03em', color: 'var(--ink)', lineHeight: 1 }}>LOOK</span>
      <span style={{
        fontWeight: 800, fontSize: size - 2, letterSpacing: '-0.01em', lineHeight: 1,
        background: 'var(--accent)', color: 'var(--accent-ink)',
        padding: '3px 7px', borderRadius: 7,
      }}>BOX</span>
    </>
  );
  if (!onClick) return <div style={box}>{mark}</div>;
  return (
    <button type="button" onClick={onClick} aria-label="옷장으로 이동"
      style={{ ...box, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}>
      {mark}
    </button>
  );
}

/** 탭 공통 좌측 타이틀 — Wordmark와 같은 시각 높이 */
function NavTitle({ children }) {
  return (
    <div style={{
      fontWeight: 800, fontSize: 19, letterSpacing: '-0.03em',
      lineHeight: 1, color: 'var(--ink)', height: 24,
      display: 'flex', alignItems: 'center',
    }}>{children}</div>
  );
}

function TopBar({ left, title, right, sticky = true, border = true }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--s2)',
      paddingTop: sticky ? 'calc(env(safe-area-inset-top, 0px) + 18px)' : 16,
      paddingBottom: 14,
      paddingLeft: 18,
      paddingRight: 18,
      minHeight: sticky ? 'calc(env(safe-area-inset-top, 0px) + 60px)' : 58,
      boxSizing: 'border-box',
      position: 'relative',
      flex: 'none',
      zIndex: 20,
      background: 'var(--ivory)',
      borderBottom: border ? '1px solid color-mix(in srgb, var(--line) 85%, transparent)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 44, minHeight: 32 }}>{left}</div>
      <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 44, minHeight: 32, gap: 4 }}>{right}</div>
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
// 옷장 정렬. 기본은 최신순 — 방금 담은 옷을 바로 확인하는 흐름이 가장 잦다.
const WARDROBE_SORTS = [
  { id: 'recent', label: '최신순', hint: '최근에 담은 옷부터' },
  { id: 'oldest', label: '오래된순', hint: '먼저 담은 옷부터' },
  { id: 'category', label: '카테고리순', hint: '아우터 → 상의 → 하의 순' },
  { id: 'season', label: '계절순', hint: '봄 → 여름 → 가을 → 겨울' },
  { id: 'name', label: '이름순', hint: '가나다 순' },
];

function sortWardrobe(list, sortId) {
  const cats = LB_DATA.CATEGORIES;
  const seasonIds = LB_DATA.SEASONS.map((s) => s.id);
  const time = (i) => {
    const t = Date.parse(i.createdAt || '');
    return Number.isNaN(t) ? 0 : t;
  };
  const catRank = (i) => {
    const idx = cats.indexOf(i.category);
    return idx < 0 ? cats.length : idx;
  };
  // 다중 계절 태그는 가장 이른 계절을 기준으로 본다 (봄+가을 → 봄)
  const seasonRank = (i) => {
    const ranks = (i.seasons || []).map((s) => seasonIds.indexOf(s)).filter((n) => n >= 0);
    return ranks.length ? Math.min(...ranks) : seasonIds.length;
  };
  const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko');
  const arr = [...list];
  if (sortId === 'oldest') return arr.sort((a, b) => time(a) - time(b) || byName(a, b));
  if (sortId === 'category') return arr.sort((a, b) => catRank(a) - catRank(b) || byName(a, b));
  if (sortId === 'season') return arr.sort((a, b) => seasonRank(a) - seasonRank(b) || catRank(a) - catRank(b));
  if (sortId === 'name') return arr.sort(byName);
  return arr.sort((a, b) => time(b) - time(a) || byName(a, b));
}
function WardrobeScreen({ ctx }) {
  const {
    items, archived = [], openAdd, wide, openItem, requestRemove,
    bulkArchive, bulkRestore, bulkDelete,
    comboReady, comboGate, comboNeed, comboProgress, wardrobeLoading, goHome,
  } = ctx;
  const [cat, setCat] = useS('전체');
  const [seasonFilter, setSeasonFilter] = useS([]); // multi-select season ids, [] = 전체
  const [sel, setSel] = useS([]); // multi-select ids
  const [selectMode, setSelectMode] = useS(false); // mobile: explicit select mode (no hover)
  const [hoverId, setHoverId] = useS(null);
  const [bulkDelAsk, setBulkDelAsk] = useS(false);
  const [sortId, setSortId] = useS('recent');
  const [sortOpen, setSortOpen] = useS(false);
  const cats = LB_DATA.CATEGORIES;
  const seasons = LB_DATA.SEASONS;
  const viewingArchive = cat === '보관';
  const toggleSeason = (id) => setSeasonFilter((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  // 보관함이 비어도 탭에 머문다 — 빈 상태 화면을 보여주는 편이, 마지막 옷을
  // 꺼낸 순간 전체 탭으로 튕겨 나가는 것보다 덜 어색하다.
  useE(() => { setSel([]); setSelectMode(false); setBulkDelAsk(false); }, [cat, seasonFilter]);
  const bySeason = (i) => seasonFilter.length === 0 || (i.seasons || []).some((s) => seasonFilter.includes(s));
  const filtered = sortWardrobe(
    (viewingArchive ? archived : (cat === '전체' ? items : items.filter((i) => i.category === cat))).filter(bySeason),
    sortId,
  );
  const activeSort = WARDROBE_SORTS.find((s) => s.id === sortId) || WARDROBE_SORTS[0];
  const count = items.length;
  const ready = comboReady;
  const selCount = sel.length;
  const selecting = selCount > 0;
  const mobileSelect = !wide && selectMode;
  const inSelectUx = wide ? selecting : (selectMode || selecting);

  const toggleSel = (id) => setSel((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  const clearSel = () => { setSel([]); setBulkDelAsk(false); };
  const exitSelectMode = () => { clearSel(); setSelectMode(false); };
  const runBulkArchive = () => { if (viewingArchive) bulkRestore(sel); else bulkArchive(sel); exitSelectMode(); };
  const runBulkDelete = () => { bulkDelete(sel); exitSelectMode(); };

  /* ---- Empty state (소유·보관 모두 없을 때만; 최초 로딩 중엔 스켈레톤 우선) ---- */
  if (count === 0 && archived.length === 0 && !wardrobeLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!wide && <TopBar left={<Wordmark onClick={goHome} />} right={<IconBtn name="plus" label="아이템 추가" onClick={() => openAdd('wardrobe')} />} />}
        <EmptyState
          icon="hanger"
          iconSize={40}
          title="옷장에 아이템을 담아보세요"
          wide={wide}
          padTop={false}
          action={<Btn full size="lg" icon="plus" onClick={() => openAdd('wardrobe')}>아이템 추가</Btn>}
          hint={<><Icon name="lock" size={14} /> 상의·하의를 담으면 조합 추천이 열려요</>}
        >
          가진 아이템을 모아두면, 구매 전<br />어울리는 조합을 미리 확인할 수 있어요.
        </EmptyState>
      </div>
    );
  }

  /* ---- Partial / Full ---- */
  const chips = (
    <div style={{
      display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      overscrollBehaviorX: 'contain', minWidth: 0, width: '100%',
      padding: wide ? '0 0 8px' : '4px 18px 8px',
    }}>
      {cats.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
      {/* 보관함은 비어 있어도 노출한다 — 숨기면 보관한 옷을 다시 볼 방법이 없다 */}
      <span style={{ flex: 'none', width: 1, alignSelf: 'stretch', margin: '4px 2px', background: 'var(--line)' }} />
      <Chip key="보관" active={viewingArchive} onClick={() => setCat('보관')}>
        {archived.length > 0 ? `보관 ${archived.length}` : '보관'}
      </Chip>
    </div>
  );

  // 정렬 트리거 — 계절 칩과 같은 줄 오른쪽 끝. PC는 버튼 아래 드롭다운,
  // 모바일은 손이 닿는 바텀시트로 갈라진다.
  const sortTrigger = (
    <button
      type="button"
      onClick={() => setSortOpen((v) => !v)}
      aria-haspopup="listbox"
      aria-expanded={sortOpen}
      style={{
        flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '5px 8px 5px 10px', borderRadius: 'var(--r-pill)',
        fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)',
        background: 'transparent', border: 'none', cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {activeSort.label}
      <Icon name="chevD" size={14} stroke={2.2} />
    </button>
  );

  const sortOptions = (
    <div role="listbox" aria-label="정렬 기준">
      {WARDROBE_SORTS.map((o) => {
        const on = o.id === sortId;
        return (
          <button
            key={o.id}
            type="button"
            role="option"
            aria-selected={on}
            onClick={() => { setSortId(o.id); setSortOpen(false); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: wide ? '9px 12px' : '13px 4px', border: 'none', background: 'transparent',
              textAlign: 'left', cursor: 'pointer', borderRadius: 'var(--r-sm)',
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: on ? 700 : 600, color: 'var(--ink)' }}>{o.label}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{o.hint}</span>
            </span>
            {on && <Icon name="check" size={17} stroke={2.4} />}
          </button>
        );
      })}
    </div>
  );

  // 계절은 카테고리와 AND로 겹치는 부가 필터. 구분선 없이 '그리고' 라벨 + 살짝 옅은 글자색으로만 구분.
  const seasonChips = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, width: '100%',
      // 칩 아래 첫 카드까지가 --gap-header. 모바일은 헤더 블록(12px)과
      // 스크롤 영역 상단 패딩(16px)으로 나뉘어 합이 같아진다.
      padding: wide ? '4px 0 var(--gap-header)' : '0 18px 12px',
    }}>
      <span style={{ flex: 'none', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)' }}>그리고</span>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', minWidth: 0, flex: 1 }}>
        {seasons.map((s) => (
          <button key={s.id} onClick={() => toggleSeason(s.id)} className="lb-chip" style={{
            flex: 'none', padding: '5px 12px', borderRadius: 'var(--r-pill)',
            fontSize: 12.5, fontWeight: seasonFilter.includes(s.id) ? 600 : 500,
            color: seasonFilter.includes(s.id) ? 'var(--accent-ink)' : 'var(--ink-3)',
            background: seasonFilter.includes(s.id) ? 'var(--accent)' : 'transparent',
            boxShadow: seasonFilter.includes(s.id) ? 'none' : 'inset 0 0 0 1px color-mix(in srgb, var(--line) 65%, transparent)',
            transition: 'all var(--dur) var(--ease)',
          }}>{s.name}</button>
        ))}
      </div>
      <div style={{ flex: 'none', position: 'relative' }}>
        {sortTrigger}
        {wide && sortOpen && (
          <>
            {/* 바깥 클릭으로 닫기 */}
            <div onClick={() => setSortOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 41,
              width: 226, padding: 6, background: 'var(--surface)',
              borderRadius: 'var(--r-md)', boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
              border: '1px solid var(--line)',
            }}>
              {sortOptions}
            </div>
          </>
        )}
      </div>
    </div>
  );
  const sortSheet = !wide && (
    <BottomSheet open={sortOpen} onClose={() => setSortOpen(false)}>
      <div className="lb-sheet-body" style={{ padding: '10px 24px 26px' }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>정렬</h2>
        <div style={{ marginTop: 'var(--s4)' }}>{sortOptions}</div>
      </div>
    </BottomSheet>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      {sortSheet}
      {!wide && (
        <div style={{
          flex: 'none',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
          background: 'var(--ivory)',
          borderBottom: '1px solid color-mix(in srgb, var(--line) 85%, transparent)',
        }}>
          <TopBar
            sticky={false}
            border={false}
            left={<Wordmark onClick={goHome} />}
            right={(
              <>
                {(count > 0 || archived.length > 0) && (
                  <button
                    type="button"
                    onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                    style={{
                      fontSize: 13, fontWeight: 700, padding: '6px 8px',
                      color: selectMode ? 'var(--ink)' : 'var(--ink-2)',
                    }}
                  >
                    {selectMode ? '완료' : '선택'}
                  </button>
                )}
                {!selectMode && <IconBtn name="plus" label="아이템 추가" onClick={() => openAdd('wardrobe')} />}
              </>
            )}
          />
          {chips}
          {seasonChips}
        </div>
      )}

      <div style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: wide ? '28px 0 36px' : '16px 18px',
        paddingBottom: selecting ? (!wide ? 96 : 88) : (!wide ? 110 : 72),
      }}>
       <div className={wide ? 'lb-wide-inner' : ''}>
        {wide && (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
            <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800 }}>{viewingArchive ? '보관함' : '옷장'}</h1>
            <span style={{ fontSize: 13.5, color: 'var(--ink-3)', fontWeight: 600 }}>{(viewingArchive ? archived.length : count)}개</span>
          </div>
        )}
        {wide && chips}
        {wide && seasonChips}
        {!viewingArchive && !ready && !wardrobeLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)', padding: 'var(--s4)', background: 'var(--surface)', borderRadius: 'var(--r-md)', marginBottom: 'var(--s4)' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--ivory)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flex: 'none' }}>
              <Icon name="lock" size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{comboNeed}를 추가로 담으면 코디 조합을 추천받을 수 있어요</div>
              <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i < comboProgress ? 'var(--accent)' : 'var(--line-2)' }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {viewingArchive && archived.length > 0 && (
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
            보관한 옷은 조합 추천에 쓰이지 않아요. 카드의 <b style={{ color: 'var(--ink-2)', fontWeight: 700 }}>···</b>에서 다시 꺼내거나 삭제할 수 있어요.
          </p>
        )}

        {mobileSelect && !selecting && (
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>
            옷을 눌러 여러 개를 선택한 뒤 보관·삭제할 수 있어요.
          </p>
        )}

        {viewingArchive && archived.length === 0 ? (
          <EmptyState
            icon="archive"
            iconSize={40}
            title="보관한 옷이 없어요"
            wide={wide}
            padTop={false}
            hint={<><Icon name="lock" size={14} /> 보관한 옷은 조합 추천에 쓰이지 않아요</>}
          >
            지금 안 입는 옷을 보관하면,<br />옷장은 그대로 두고 추천에서만 빼둘 수 있어요.
          </EmptyState>
        ) : (
        <div className="lb-grid">
          {!viewingArchive && !mobileSelect && (
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
                <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, height: '1.3em' }}>옷</div>
                <div style={{ fontSize: 11, marginTop: 2, lineHeight: 1.3 }}>옷</div>
              </div>
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="plus" size={26} /><span style={{ fontSize: 12.5, fontWeight: 600 }}>아이템 추가</span>
            </div>
          </button>
          )}
          {wardrobeLoading && !viewingArchive && filtered.length === 0 && [0, 1, 2].map((i) => (
            <div key={'sk' + i} aria-hidden="true">
              <div className="lb-skel" style={{ aspectRatio: '1 / 1', borderRadius: 'var(--r-md)' }} />
              <div className="lb-skel" style={{ height: 12, marginTop: 8, borderRadius: 6, width: '80%' }} />
              <div className="lb-skel" style={{ height: 10, marginTop: 6, borderRadius: 6, width: '55%' }} />
            </div>
          ))}
          {filtered.map((it) => {
            const on = sel.includes(it.id);
            const showSel = wide
              ? (on || selecting || hoverId === it.id)
              : (selectMode || on);
            const onCardTap = () => {
              if (!wide && (selectMode || selecting)) toggleSel(it.id);
              else openItem(it);
            };
            return (
            <div
              key={it.id}
              style={{ position: 'relative', minWidth: 0 }}
              onMouseEnter={() => wide && setHoverId(it.id)}
              onMouseLeave={() => wide && setHoverId((h) => (h === it.id ? null : h))}
            >
              <div style={{ position: 'relative' }}>
                <button onClick={onCardTap} className="lb-itembtn" style={{ display: 'block', width: '100%', textAlign: 'left', padding: 0 }}>
                  <Thumb item={it} />
                </button>
                {(wide || selectMode || on) && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (!wide && !selectMode) setSelectMode(true); toggleSel(it.id); }}
                    aria-label={on ? '선택 해제' : '선택'}
                    aria-pressed={on}
                    style={{
                      position: 'absolute', left: 5, top: 5, width: 18, height: 18, borderRadius: '50%',
                      display: 'grid', placeItems: 'center', zIndex: 3,
                      opacity: showSel ? 1 : 0,
                      pointerEvents: showSel ? 'auto' : 'none',
                      background: on ? 'var(--accent)' : 'color-mix(in srgb, var(--surface-2) 90%, transparent)',
                      color: on ? 'var(--accent-ink)' : 'transparent',
                      boxShadow: on ? 'none' : 'inset 0 0 0 1.5px var(--line-2)',
                      backdropFilter: 'blur(6px)',
                      transition: 'opacity var(--dur) var(--ease), background var(--dur) var(--ease)',
                    }}
                  >
                    {on && <Icon name="check" size={10} stroke={2.6} />}
                  </button>
                )}
                {!inSelectUx && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); requestRemove(it); }}
                  aria-label={it.name + ' 더보기'}
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
              <button onClick={onCardTap} className="lb-itembtn" style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 6 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 600, lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{it.name}</div>
                <div style={{
                  fontSize: 11, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{[it.brand, it.category, it.color].filter(Boolean).join(' · ')}</div>
              </button>
            </div>
            );
          })}
        </div>
        )}
       </div>
      </div>

      {/* 선택 시 하단 플로팅 메뉴 */}
      {selecting && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: wide ? 22 : 12, zIndex: 30,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
          padding: wide ? '0 24px' : '0 14px',
        }}>
          <div style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            maxWidth: '100%',
            padding: '10px 22px',
            borderRadius: 'var(--r-pill)',
            background: 'color-mix(in srgb, var(--surface) 94%, transparent)',
            boxShadow: '0 10px 32px -10px color-mix(in srgb, var(--ink) 28%, transparent), inset 0 0 0 1px var(--line)',
            backdropFilter: 'blur(10px)',
          }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }} className="tnum">{selCount}개 선택됨</span>
            <button onClick={clearSel} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', padding: '4px 2px' }}>선택 해제</button>
            <Btn size="sm" variant="soft" icon={viewingArchive ? 'hanger' : 'archive'} onClick={runBulkArchive}
              style={{ fontSize: 12, padding: '7px 12px' }}>
              {viewingArchive ? '옷장으로' : '보관'}
            </Btn>
            <Btn size="sm" icon="trash" onClick={() => setBulkDelAsk(true)}
              style={{ background: '#B0573C', color: '#fff', fontSize: 12, padding: '7px 12px' }}>삭제</Btn>
          </div>
        </div>
      )}

      <BottomSheet open={bulkDelAsk} onClose={() => setBulkDelAsk(false)}>
        <div style={{ padding: '10px 24px 26px', textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>선택한 {selCount}개를 삭제할까요?</h3>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
            완전히 지워지고 <b style={{ color: 'var(--ink)', fontWeight: 700 }}>되돌릴 수 없어요.</b>
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <Btn variant="soft" onClick={() => setBulkDelAsk(false)} style={{ flex: 1 }}>취소</Btn>
            <Btn icon="trash" onClick={runBulkDelete} style={{ flex: 1, background: '#B0573C', color: '#fff' }}>삭제</Btn>
          </div>
        </div>
      </BottomSheet>

      {!wide && !selectMode && !selecting && (
        <div className="lb-cta-dock">
          <Btn full size="lg" icon="sparkle" variant={comboReady ? 'primary' : 'soft'} onClick={comboGate}>조합 추천받기</Btn>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   B · Add sheet — staged flow
   wardrobe:  input → analyzing → select → register (sequential)
   anchor:    input → analyzing → anchor-ready → combo recommend
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

const URL_IMPORT_BLOCKED_MSG = '이미지 불러오기가 제한되는 URL이에요. 사진으로 추가해 주세요.';
const URL_IMPORT_BLOCKED_HOST = /(^|\.)(coupang\.com|smartstore\.naver\.com|brand\.naver\.com|shopping\.naver\.com|11st\.co\.kr|gmarket\.co\.kr|auction\.co\.kr|ssg\.com|kurly\.com|wemakeprice\.com|tmon\.co\.kr)$/i;

// 추출 힌트 — 배달의민족 '사장님께'처럼 최근 문구를 골라 넣는다.
const EXTRACT_HINT_KEY = 'lb_extract_hints_v1';
const EXTRACT_HINT_MAX = 8;
function readExtractHints() {
  try {
    const raw = JSON.parse(localStorage.getItem(EXTRACT_HINT_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string' && s.trim()).slice(0, EXTRACT_HINT_MAX) : [];
  } catch (e) { return []; }
}
function rememberExtractHint(text) {
  const t = String(text || '').trim();
  if (!t) return;
  const next = [t, ...readExtractHints().filter((h) => h !== t)].slice(0, EXTRACT_HINT_MAX);
  try { localStorage.setItem(EXTRACT_HINT_KEY, JSON.stringify(next)); } catch (e) { /* noop */ }
}

function urlImportBlockedHint(raw) {
  try {
    const href = /^https?:\/\//i.test(raw) ? raw : ('https://' + String(raw || '').replace(/^\/+/, ''));
    const host = new URL(href).hostname.replace(/^www\./i, '');
    if (URL_IMPORT_BLOCKED_HOST.test(host)) return URL_IMPORT_BLOCKED_MSG;
  } catch (e) { /* noop */ }
  return null;
}

// 서버가 보내는 세부 단계(_IMPORT_STEPS)를 체크리스트용 4단계로 묶는다. 상세
// 문구는 서버 라벨을 그대로 쓰고, 체크리스트는 지금 어디쯤인지만 보여준다.
const IMPORT_PHASES = [
  { short: '사진 확인', keys: ['send', 'fetch', 'cache'] },
  { short: '옷 인식', keys: ['classify', 'upload'] },
  { short: '배경 정리', keys: ['cutout', 'polish'] },
  // 이 단계에서 옷장에 담기는 게 아니다 — 확인 화면에서 사용자가 결정한다
  { short: '결과 정리', keys: ['save'] },
];

// 첫 서버 단계는 사진 업로드가 끝난 뒤에야 온다 — 모바일에서 몇 초씩 걸리므로
// 그동안 0%에 멈춰 있지 않게 클라이언트가 이 단계부터 시작한다.
const IMPORT_STEP_SEND = { key: 'send', label: '사진을 보내고 있어요', pct: 0, until: 10, eta: 6 };

// 업로드 진행률. 단계 경계(%)는 서버가 알려주고, 한 단계 안에서의 움직임은
// 그 단계의 평소 소요 시간(eta)으로 보간한다. 지수 감쇠라 끝 %를 넘지 않으면서
// 오래 걸릴수록 느려져, 멈춘 것처럼 보이지 않는다.
function useImportProgress(active) {
  const [step, setStep] = useS(null);
  const [pct, setPct] = useS(0);
  const stepRef = useR(null);
  // 표시 중인 %를 ref로도 들고 있는다. report는 렌더 사이에 불려서 state 값이
  // 최신이 아닐 수 있고, 뒤로 가는지 판단하려면 '지금 보이는 숫자'가 필요하다.
  const pctRef = useR(0);

  const advance = (value) => {
    if (value <= pctRef.current) return;
    pctRef.current = value;
    setPct(value);
  };

  useE(() => {
    if (!active) {
      stepRef.current = null;
      pctRef.current = 0;
      setStep(null);
      setPct(0);
      return undefined;
    }
    const id = setInterval(() => {
      const s = stepRef.current;
      if (!s) return;
      const elapsed = (Date.now() - s.at) / 1000;
      const eased = 1 - Math.exp(-elapsed / Math.max(1, s.eta));
      advance(Math.round(s.pct + (s.until - s.pct) * eased));
    }, 200);
    return () => clearInterval(id);
  }, [active]);

  const report = (next) => {
    if (!next || !next.label) return;
    // 이미 지나온 구간의 단계는 버린다. 비교 기준은 표시된 %다 — 단계의 시작 %와
    // 비교하면, 앞 단계가 구간 끝까지 차오른 뒤 다음 이벤트가 오는 순간 뒤로 간다.
    if (stepRef.current && next.until <= pctRef.current) return;
    stepRef.current = { ...next, at: Date.now() };
    setStep(next);
    advance(next.pct);
  };
  return { step, pct, report };
}

function AddSheet({ ctx }) {
  const {
    addSheet, closeAdd, confirmAdd, addItemsBatch, liveImportSource, discardLiveItems,
    autoAddDetails, detectCount, liveReplaceItemImage, liveConfirmReplaceImage, applyReextractItem, showToast,
    openTryOn, openTryOnSetup, prefs, wide, comboReady, openImageViewer,
  } = ctx;
  const mode = addSheet.mode; // 'wardrobe' | 'anchor' | 'reextract'
  const anchor = mode === 'anchor';
  const reextract = mode === 'reextract';
  const replaceItem = addSheet.replaceItem || null;
  const CATS = LB_DATA.CATEGORIES.filter((c) => c !== '전체');
  const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0);

  // input
  const [tab, setTab] = useS('photo');
  const [picked, setPicked] = useS(false);
  const [url, setUrl] = useS('');
  const [file, setFile] = useS(null);
  const [previewUrl, setPreviewUrl] = useS('');
  const [hint, setHint] = useS('');
  const [showHint, setShowHint] = useS(false);
  const [hintHistory, setHintHistory] = useS(() => readExtractHints());
  const [busy, setBusy] = useS(false);
  const [err, setErr] = useS('');
  const fileInput = useR(null);
  const previewUrlRef = useR('');
  const tryOnFileRef = useR(null);
  const [tryOnLocal, setTryOnLocal] = useS('');
  const [tryOnErr, setTryOnErr] = useS('');
  const [tryOnChecking, setTryOnChecking] = useS(false);
  const [tryOnCleared, setTryOnCleared] = useS(false);

  const setPreviewFromFile = (f) => {
    if (previewUrlRef.current) {
      try { URL.revokeObjectURL(previewUrlRef.current); } catch (e) { /* ignore */ }
      previewUrlRef.current = '';
    }
    if (!f) {
      setPreviewUrl('');
      return;
    }
    const next = URL.createObjectURL(f);
    previewUrlRef.current = next;
    setPreviewUrl(next);
  };

  // stage machine
  const [stage, setStage] = useS('input'); // input | analyzing | select | register | anchor-ready | reextract-confirm
  const [detected, setDetected] = useS([]);
  const [sel, setSel] = useS([]); // selected detected ids
  const [steps, setSteps] = useS([]); // ordered queue for sequential register
  const [stepIdx, setStepIdx] = useS(0);
  const [pendingReplace, setPendingReplace] = useS(null); // { item, pending } — 이미지 변경 미리보기 (아직 DB 미반영)
  const progress = useImportProgress(stage === 'analyzing');

  // 닫기/ESC 시 진행 중 인식·draft를 폐기하기 위한 세션 플래그
  const cancelledRef = useR(false);
  const draftIdsRef = useR([]);
  const detectedRef = useR([]);
  const stepsRef = useR([]);
  detectedRef.current = detected;
  stepsRef.current = steps;

  const resetLocalDraft = () => {
    setPreviewFromFile(null);
    setTab(addSheet.initialSourceTab || 'photo'); setPicked(false); setUrl(''); setFile(null); setHint(''); setShowHint(false);
    setHintHistory(readExtractHints());
    setBusy(false); setErr('');
    setTryOnLocal(''); setTryOnErr(''); setTryOnChecking(false); setTryOnCleared(false);
    setStage('input'); setDetected([]); setSel([]); setSteps([]); setStepIdx(0); setPendingReplace(null);
    draftIdsRef.current = [];
  };

  const discardDraftIds = (ids) => {
    const clean = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!clean.length || typeof discardLiveItems !== 'function') return;
    discardLiveItems(clean);
  };

  const requestClose = () => {
    cancelledRef.current = true;
    const ids = [
      ...draftIdsRef.current,
      ...detectedRef.current.map((d) => d && d.id),
      ...stepsRef.current.map((s) => s && s.id),
    ];
    discardDraftIds(ids);
    resetLocalDraft();
    closeAdd();
  };

  useE(() => {
    if (!addSheet.open) return;
    cancelledRef.current = false;
    resetLocalDraft();
  }, [addSheet.open, addSheet.mode, addSheet.replaceItem && addSheet.replaceItem.id]);

  // ---- detection: API "separates" one source image into N garments ----
  const runDetect = async (source = {}) => {
    cancelledRef.current = false;
    draftIdsRef.current = [];
    setErr('');
    setBusy(true);
    setStage('analyzing');
    progress.report(IMPORT_STEP_SEND);
    try {
      // 이미지만 변경: 새 소스로 추출만 먼저 해보고, DB에는 바로 반영하지 않는다.
      // (결과가 마음에 안 들 수 있어 확인 단계를 거친 뒤에만 실제로 반영)
      if (reextract && replaceItem) {
        const itemId = replaceItem.serverId || replaceItem.id;
        const result = await liveReplaceItemImage({
          itemId,
          sourceType: source.sourceType || tab,
          file: source.file || file,
          url: source.url != null ? source.url : url,
          extractHint: source.extractHint != null ? source.extractHint : hint,
          commit: false,
          onProgress: progress.report,
        });
        if (cancelledRef.current) return;
        if (!result || !result.item) throw new Error('이미지를 바꾸지 못했어요');
        setPendingReplace(result);
        setStage('reextract-confirm');
        return;
      }
      const data = await liveImportSource({
        sourceType: source.sourceType || tab,
        file: source.file || file,
        url: source.url != null ? source.url : url,
        status: anchor ? 'considering' : 'pending',
        extractHint: source.extractHint != null ? source.extractHint : hint,
        onProgress: progress.report,
      });
      const list = (data.items || []).slice(0, detectCount).map((d, i) => ({ ...d, id: d.id || 'det' + i, cat: d.category, conf: d.conf || 0.95 }));
      const ids = list.map((d) => d.id).filter(Boolean);
      draftIdsRef.current = ids;
      if (cancelledRef.current) {
        discardDraftIds(ids);
        draftIdsRef.current = [];
        return;
      }
      if (!list.length) throw new Error('사진에서 옷을 찾지 못했어요');
      // AI 추출이 지연/실패해 임시 이미지로 저장된 경우 안내
      const warn = (data.items || []).map((d) => d && d.extractWarning).find(Boolean);
      if (warn && typeof showToast === 'function') showToast(warn + ' 이미지 변경으로 다시 시도할 수 있어요.');
      setDetected(list);
      const primaryIdx = Math.min(data.primary_idx || 0, list.length - 1);
      const primary = list[primaryIdx] || list[0];
      setSel([primary.id]);
      if (anchor) {
        // 고민 중인 옷: 인식 결과 미리보기 → 조합 추천
        setStage('anchor-ready');
        return;
      }
      setStage(() => {
        if (list.length === 1) {
          setSteps(list.map((d) => ({ ...d, cat: d.category, draft: { brand: d.brand || '', size: '', color: d.color || '', store: d.store || '', note: '' }, showDetails: !!autoAddDetails || !!d.brand || !!d.store || !!d.color })));
          setStepIdx(0);
          return 'register';
        }
        return 'select';
      });
    } catch (e) {
      if (cancelledRef.current) return;
      setErr(e.message || 'AI 분석에 실패했어요');
      setStage('input');
    } finally {
      if (!cancelledRef.current) setBusy(false);
    }
  };
  const onPickPhoto = () => { if (fileInput.current) fileInput.current.click(); };
  const onFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
    setPicked(true);
    setPreviewFromFile(f);
    setErr('');
    // 같은 파일을 다시 고를 수 있게 초기화
    e.target.value = '';
  };
  const clearPhoto = () => {
    setFile(null);
    setPicked(false);
    setPreviewFromFile(null);
    setErr('');
  };
  const onTryOnPick = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setTryOnErr('');
    setTryOnChecking(true);
    try {
      const read = window.readBodyFile;
      if (typeof read !== 'function') throw new Error('사진을 준비하지 못했어요.');
      const dataUrl = await read(f);
      const faces = window.countFacesInImage
        ? await window.countFacesInImage(dataUrl)
        : -1;
      if (faces === 0) {
        setTryOnErr('전신이 잘 나오는 사진으로 올려주세요. 얼굴이 보여야 해요.');
        return;
      }
      if (faces > 1) {
        setTryOnErr('한 명만 나온 전신 사진을 선택해주세요.');
        return;
      }
      if (faces !== 1) {
        setTryOnErr(window.faceCountError
          ? window.faceCountError(faces)
          : '얼굴을 확인하지 못했어요. 잠시 후 다시 시도해주세요.');
        return;
      }
      setTryOnLocal(dataUrl);
      setTryOnCleared(false);
    } catch (err) {
      setTryOnErr((err && err.message) || '사진을 확인하지 못했어요.');
    } finally {
      setTryOnChecking(false);
    }
  };
  const clearTryOn = () => {
    setTryOnLocal('');
    setTryOnErr('');
    setTryOnCleared(true);
  };
  const tryOnPreview = tryOnLocal || (!tryOnCleared && prefs && prefs.tryOnFrame) || '';
  const canTryOn = !!tryOnPreview;
  const onTryOnSubmit = () => {
    if (wide || tryOnChecking || !canTryOn) return;
    if (tryOnLocal) {
      closeAdd();
      openTryOnSetup && openTryOnSetup(tryOnLocal);
      return;
    }
    closeAdd();
    openTryOn && openTryOn();
  };
  const canSubmit = tab === 'photo' ? !!file : tab === 'url' ? !!url.trim() : false;
  const onSubmitAdd = async () => {
    setErr('');
    if (tab === 'tryon') return;
    if (tab === 'photo') {
      if (!file) { setErr('사진을 먼저 넣어 주세요'); return; }
      rememberExtractHint(hint);
      setHintHistory(readExtractHints());
      await runDetect({ sourceType: 'photo', file, extractHint: hint });
      return;
    }
    const raw = url.trim();
    if (!raw) { setErr('상품 URL을 입력해 주세요'); return; }
    const blocked = urlImportBlockedHint(raw);
    if (blocked) {
      setErr(blocked);
      return;
    }
    const normalized = /^https?:\/\//i.test(raw) ? raw : ('https://' + raw.replace(/^\/+/, ''));
    if (normalized !== raw) setUrl(normalized);
    rememberExtractHint(hint);
    setHintHistory(readExtractHints());
    await runDetect({ sourceType: 'url', url: normalized, extractHint: hint });
  };

  // ---- clipboard paste (PC: Ctrl/⌘+V, 모바일: 꾹 눌러 붙여넣기) ----
  // runDetect가 매 렌더 새로 만들어지므로 최신 참조를 ref로 유지한다.
  const runDetectRef = useR(runDetect);
  runDetectRef.current = runDetect;
  const handlePasteImage = (e) => {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it && it.kind === 'file' && it.type && it.type.indexOf('image') === 0) {
        const f = it.getAsFile();
        if (f) {
          e.preventDefault();
          setTab('photo');
          setFile(f);
          setPicked(true);
          setPreviewFromFile(f);
          setErr('');
          return true;
        }
      }
    }
    return false;
  };
  // 시트가 열려 input 단계일 때만 문서 전역 붙여넣기를 가로챈다.
  useE(() => {
    if (!addSheet.open || stage !== 'input') return undefined;
    const onDocPaste = (e) => { handlePasteImage(e); };
    document.addEventListener('paste', onDocPaste);
    return () => document.removeEventListener('paste', onDocPaste);
  }, [addSheet.open, stage]);

  const anchorPrimary = detected.find((d) => sel.includes(d.id)) || detected[0] || null;

  // ---- select ----
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allOn = detected.length > 0 && sel.length === detected.length;
  const startRegister = () => {
    const q = detected.filter((d) => sel.includes(d.id));
    setSteps(q.map((d) => ({ ...d, cat: d.category, draft: { brand: d.brand || '', size: '', color: d.color || '', store: d.store || '', note: '' }, showDetails: !!autoAddDetails || !!d.brand || !!d.store || !!d.color })));
    setStepIdx(0);
    setStage('register');
  };

  // ---- register (sequential) ----
  const cur = steps[stepIdx] || null;
  const patchStep = (patch) => setSteps((arr) => arr.map((x, i) => (i === stepIdx ? { ...x, ...patch } : x)));
  const setStepDraft = (k) => (v) => setSteps((arr) => arr.map((x, i) => (i === stepIdx ? { ...x, draft: { ...x.draft, [k]: v } } : x)));
  const toItem = (s) => {
    const clean = Object.fromEntries(Object.entries(s.draft || {}).filter(([, v]) => v && String(v).trim()));
    const cat = s.cat || s.category || '상의';
    return {
      ...s,
      name: (s.name || '').trim() || (cat + ' 아이템'),
      category: cat,
      cat,
      color: (clean.color || s.color || '').trim() || '뉴트럴',
      img: s.img || null,
      brand: clean.brand || s.brand || '',
      size: clean.size || s.size || '',
      store: clean.store || s.store || '',
      note: clean.note || s.note || '',
    };
  };
  const advance = (keep) => {
    const updated = steps.map((x, i) => (i === stepIdx ? { ...x, added: keep } : x));
    setSteps(updated);
    if (stepIdx >= steps.length - 1) {
      const kept = updated.filter((s) => s.added).map(toItem);
      const skipped = detected.filter((d) => !updated.some((s) => s.id === d.id && s.added)).map((d) => d.id);
      draftIdsRef.current = [];
      addItemsBatch(kept, skipped);
    } else setStepIdx(stepIdx + 1);
  };
  const doneCount = steps.filter((s) => s.added).length;

  const goBack = () => {
    if (stage === 'select' || stage === 'anchor-ready') {
      discardDraftIds(detected.map((d) => d && d.id));
      draftIdsRef.current = [];
      setStage('input'); setDetected([]); setSel([]);
    } else if (stage === 'register') {
      if (stepIdx > 0) setStepIdx(stepIdx - 1); else setStage('select');
    } else if (stage === 'reextract-confirm') {
      setPendingReplace(null);
      setStage('input');
    }
  };

  // ---- reextract confirm: 미리보기를 실제로 반영할지, 다시 시도할지 ----
  const confirmReplace = async () => {
    if (!pendingReplace || !replaceItem) return;
    setBusy(true);
    setErr('');
    try {
      const itemId = replaceItem.serverId || replaceItem.id;
      const finalItem = await liveConfirmReplaceImage(itemId, pendingReplace.pending);
      if (!finalItem) throw new Error('반영하지 못했어요');
      applyReextractItem(finalItem);
      closeAdd();
    } catch (e) {
      setErr(e.message || '반영하지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  const retryReplace = () => {
    setPendingReplace(null);
    setStage('input');
  };

  // ---- header copy ----
  let header, sub;
  if (stage === 'select') { header = '담을 아이템을 골라주세요'; sub = `사진에서 ${detected.length}개를 찾았어요 · 고른 아이템을 하나씩 담아요`; }
  else if (stage === 'register') { header = null; sub = null; }
  else if (stage === 'analyzing') {
    header = reextract ? '이미지만 변경' : (anchor ? '고민 중인 옷 추가' : '옷장에 아이템 추가');
    sub = null; // 본문 로딩 카피로만 안내 (헤더 중복 방지)
  }
  else if (stage === 'anchor-ready') { header = '고민 중인 옷 추가'; sub = '이 옷이 내 옷장 옷들과 어울리는지 확인해볼게요.'; }
  else if (stage === 'reextract-confirm') { header = '추출 결과 확인'; sub = '반영할지 다시 시도할지 골라주세요'; }
  else if (reextract) {
    header = '이미지만 변경';
    sub = replaceItem
      ? `"${replaceItem.name || '이 옷'}"의 이름·색상은 그대로 두고 제품 컷만 바꿔요.`
      : '이름·색상은 그대로 두고 제품 컷만 바꿔요.';
  }
  else { header = anchor ? '고민 중인 옷 추가' : '옷장에 아이템 추가'; sub = anchor ? '이 옷이 내 옷장 옷들과 어울리는지 확인해볼게요.' : '사진 한 장 속 여러 개를 자동으로 분리해 드려요.'; }

  const showBack = stage === 'select' || stage === 'register' || stage === 'anchor-ready' || stage === 'reextract-confirm';

  return (
    // 추출(analyzing) 중에는 실수로 바깥을 눌러도 닫히지 않게 — X 버튼/ESC로만 닫기
    <BottomSheet open={addSheet.open} onClose={requestClose} dismissOnScrim={stage !== 'analyzing'}>
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
                  {doneCount > 0 ? `지금까지 ${doneCount}개 담음 · ` : ''}내용을 확인하고 하나씩 담아요.
                </p>
              </div>
            ) : (
              <div>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{header}</h2>
                {sub ? (
                  <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>{sub}</p>
                ) : null}
              </div>
            )}
          </div>
          <IconBtn name="x" label="닫기" onClick={requestClose} style={{ marginRight: -8, flex: 'none' }} />
        </div>

        {/* ---------- INPUT ---------- */}
        {stage === 'input' && (
          <>
            <div style={{ display: 'flex', gap: 4, background: 'var(--ivory)', borderRadius: 'var(--r-pill)', padding: 4, marginTop: 'var(--s5)' }}>
              {(anchor
                ? [['photo', '사진', 'camera'], ['url', 'URL', 'link'], ['tryon', '바로 보기', 'cutout']]
                : [['photo', '사진', 'camera'], ['url', 'URL', 'link']]
              ).map(([id, label, ic]) => (
                <button key={id} onClick={() => {
                  setTab(id); setErr(''); setTryOnErr('');
                  if (id === 'tryon') setShowHint(false);
                }} style={{
                  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '11px 4px', borderRadius: 'var(--r-pill)', fontSize: anchor ? 12.5 : 14, fontWeight: 600,
                  background: tab === id ? 'var(--surface-2)' : 'transparent',
                  color: tab === id ? 'var(--ink)' : 'var(--ink-3)',
                  boxShadow: tab === id ? '0 1px 3px rgba(40,36,28,0.10)' : 'none',
                  transition: 'all var(--dur) var(--ease)',
                  whiteSpace: 'nowrap',
                }}>
                  <Icon name={ic} size={16} />{label}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 'var(--s5)' }}>
              {/* 탭마다 본문 높이가 달라지지 않도록 미디어 패널·힌트·푸터 슬롯을 고정 */}
              {(() => {
                const panelH = 168;
                const stagePanel = {
                  width: '100%', height: panelH, borderRadius: 'var(--r-md)',
                  boxSizing: 'border-box', overflow: 'hidden',
                };
                const dropBase = {
                  ...stagePanel,
                  background: 'var(--ivory)', border: '1.5px dashed var(--line-2)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 10, color: 'var(--ink-2)', outline: 'none',
                };
                const errBanner = (msg) => (
                  <div
                    role="alert"
                    style={{
                      marginTop: 'var(--s3)', padding: '10px 12px', borderRadius: 'var(--r-sm)',
                      background: 'color-mix(in srgb, #B0573C 10%, transparent)',
                      color: '#9D472F', fontSize: 12.5, lineHeight: 1.45, fontWeight: 600,
                      wordBreak: 'keep-all',
                    }}
                  >
                    {msg}
                  </div>
                );
                const previewBox = (src, onClear, clearLabel) => (
                  <div style={{
                    ...stagePanel, position: 'relative',
                    background: 'var(--thumb-bg)', boxShadow: 'inset 0 0 0 1px var(--line)',
                  }}>
                    <img src={src} alt="" aria-hidden style={{
                      position: 'absolute', inset: 0, width: '100%', height: '100%',
                      objectFit: 'cover', filter: 'blur(26px)', transform: 'scale(1.2)',
                    }} />
                    <img src={src} alt="" style={{
                      position: 'relative', width: '100%', height: '100%',
                      objectFit: 'contain', display: 'block',
                    }} />
                    <button
                      type="button"
                      onClick={onClear}
                      aria-label={clearLabel}
                      className="lb-iconbtn"
                      style={{
                        position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: '50%',
                        background: 'color-mix(in srgb, var(--surface) 88%, transparent)', color: 'var(--ink-2)',
                        display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px var(--line)',
                      }}
                    >
                      <Icon name="x" size={18} />
                    </button>
                  </div>
                );
                const tabErr = tab === 'tryon' ? tryOnErr : err;
                return (
                  <>
                    {tab === 'tryon' ? (
                      <>
                        <input ref={tryOnFileRef} type="file" accept="image/*" onChange={onTryOnPick} style={{ display: 'none' }} />
                        {tryOnPreview ? previewBox(tryOnPreview, clearTryOn, '사진 지우기') : (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => { if (!tryOnChecking && tryOnFileRef.current) tryOnFileRef.current.click(); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (!tryOnChecking && tryOnFileRef.current) tryOnFileRef.current.click();
                              }
                            }}
                            className="lb-drop"
                            style={{ ...dropBase, cursor: tryOnChecking ? 'wait' : 'pointer' }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, pointerEvents: 'none', padding: '0 16px' }}>
                              <Icon name={tryOnChecking ? 'sparkle' : 'camera'} size={30} stroke={1.5} />
                              <span style={{ fontSize: 14, fontWeight: 600 }}>
                                {tryOnChecking ? '사진 확인 중…' : '전신 사진 업로드'}
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', wordBreak: 'keep-all' }}>
                                본인 얼굴에 옷을 바로 비춰 볼 수 있어요 (휴대폰 전용)
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : tab === 'photo' ? (
                      <>
                        <input ref={fileInput} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
                        {picked && previewUrl ? previewBox(previewUrl, clearPhoto, '사진 지우기') : (
                          <div
                            role="button"
                            tabIndex={0}
                            contentEditable
                            suppressContentEditableWarning
                            inputMode="none"
                            onClick={onPickPhoto}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickPhoto(); } }}
                            onInput={(e) => { e.currentTarget.textContent = ''; }}
                            onCut={(e) => e.preventDefault()}
                            className="lb-drop"
                            style={{ ...dropBase, cursor: 'pointer', caretColor: 'transparent' }}
                          >
                            <div contentEditable={false} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, pointerEvents: 'none', padding: '0 16px' }}>
                              <Icon name="camera" size={30} stroke={1.5} />
                              <span style={{ fontSize: 14, fontWeight: 600 }}>사진 업로드</span>
                              <span style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>
                                {isTouch ? '탭하여 선택 · 꾹 눌러 붙여넣기' : '탭하여 선택 · Ctrl/⌘+V로 붙여넣기'}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{
                        ...dropBase, cursor: 'default', padding: '0 18px',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%' }}>
                          <input
                            value={url}
                            onChange={(e) => { setUrl(e.target.value); setErr(''); }}
                            placeholder="https://…"
                            className="lb-input"
                            style={{
                              width: '100%', padding: '12px 14px', borderRadius: 'var(--r-md)', fontSize: 14,
                              background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)',
                              outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                          <span style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', wordBreak: 'keep-all' }}>
                            무신사·29CM 등 상품 페이지 주소를 붙여넣어요
                          </span>
                        </div>
                      </div>
                    )}

                    <div style={{ minHeight: tabErr ? undefined : 0 }}>
                      {tabErr ? errBanner(tabErr) : null}
                    </div>

                    {anchor && !comboReady && (
                      <div style={{
                        marginTop: 'var(--s4)', padding: '10px 12px', borderRadius: 'var(--r-md)',
                        background: 'var(--ivory)', fontSize: 12.5, color: 'var(--ink-2)',
                        lineHeight: 1.45, wordBreak: 'keep-all', minHeight: 44, boxSizing: 'border-box',
                      }}>
                        {tab === 'tryon'
                          ? '옷장이 적어도 바로 보기로 매장 옷을 카메라에 비춰 볼 수 있어요.'
                          : <>AI 조합 추천은 상의·하의가 더 필요해요. 급하면 위 탭의 <b style={{ fontWeight: 700, color: 'var(--ink)' }}>바로 보기</b>를 써 보세요.</>}
                      </div>
                    )}

                    <div style={{
                      marginTop: 'var(--s4)', minHeight: 28, display: 'flex', alignItems: 'center',
                      visibility: tab === 'tryon' ? 'hidden' : 'visible',
                      pointerEvents: tab === 'tryon' ? 'none' : 'auto',
                    }} aria-hidden={tab === 'tryon'}>
                      <button
                        type="button"
                        onClick={() => setShowHint((v) => !v)}
                        tabIndex={tab === 'tryon' ? -1 : undefined}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', padding: '4px 2px',
                        }}
                      >
                        <Icon name="plus" size={15} /> 추출 힌트 추가
                        <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>선택</span>
                        {hintHistory.length > 0 && !showHint && (
                          <span style={{
                            marginLeft: 2, fontSize: 11, fontWeight: 700, color: 'var(--ink-3)',
                            padding: '2px 7px', borderRadius: 'var(--r-pill)',
                            background: 'var(--ivory)', boxShadow: 'inset 0 0 0 1px var(--line)',
                          }}>{hintHistory.length}</span>
                        )}
                        <span style={{ color: 'var(--ink-3)', transform: showHint ? 'rotate(-90deg)' : 'rotate(90deg)', display: 'inline-flex' }}>
                          <Icon name="chevL" size={14} />
                        </span>
                      </button>
                    </div>
                    {showHint && tab !== 'tryon' && (
                      <div style={{ marginTop: 8 }}>
                        {hintHistory.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 7 }}>최근에 쓴 힌트</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                              {hintHistory.map((h) => {
                                const on = hint === h;
                                return (
                                  <button
                                    key={h}
                                    type="button"
                                    onClick={() => setHint(h)}
                                    style={{
                                      maxWidth: '100%', padding: '7px 11px', borderRadius: 'var(--r-pill)',
                                      fontSize: 12.5, fontWeight: on ? 700 : 550, textAlign: 'left',
                                      color: on ? 'var(--accent-ink)' : 'var(--ink-2)',
                                      background: on ? 'var(--accent)' : 'var(--surface)',
                                      boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--line)',
                                      lineHeight: 1.35, wordBreak: 'keep-all',
                                    }}
                                  >
                                    {h.length > 28 ? h.slice(0, 28) + '…' : h}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <textarea
                          className="lb-input"
                          rows={2}
                          value={hint}
                          onChange={(e) => setHint(e.target.value)}
                          placeholder={'예) 이 이미지에서 가방만 추출해줘'}
                          style={{
                            width: '100%', padding: '12px 14px', borderRadius: 'var(--r-md)', fontSize: 14,
                            background: 'var(--ivory)', border: '1px solid var(--line)', color: 'var(--ink)',
                            outline: 'none', resize: 'none', lineHeight: 1.45, boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4 }}>
                          {hintHistory.length
                            ? '칩을 누르면 그대로 들어가고, 고친 뒤 추가하면 다음에 또 쓸 수 있어요.'
                            : '여러 아이템이 한 장에 있을 때 원하는 것만 지정할 수 있어요.'}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 'var(--s5)' }}>
                      {tab === 'tryon' ? (
                        <Btn
                          full
                          size="lg"
                          icon="cutout"
                          onClick={onTryOnSubmit}
                          disabled={wide || tryOnChecking || !canTryOn}
                        >
                          옷 대보기
                        </Btn>
                      ) : (
                        <Btn full size="lg" icon="sparkle" onClick={onSubmitAdd} disabled={!canSubmit || busy}>
                          {busy ? '인식 중…' : (reextract ? '이미지 변경' : (anchor ? '조합 추천받기' : '추가하기'))}
                        </Btn>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {reextract ? (
              <div style={{ marginTop: 'var(--s4)', display: 'flex', alignItems: 'center', gap: 7, color: 'var(--ink-3)', fontSize: 12.5 }}>
                <Icon name="sparkle" size={15} /> 새 사진·URL로 추출해도 상세 정보는 유지돼요
              </div>
            ) : (!anchor && tab !== 'tryon') ? (
              <div style={{ marginTop: 'var(--s4)', display: 'flex', alignItems: 'center', gap: 7, color: 'var(--ink-3)', fontSize: 12.5 }}>
                <Icon name="sparkle" size={15} /> 사진 속 상의·하의·신발까지 따로따로 찾아드려요
              </div>
            ) : null}
          </>
        )}

        {/* ---------- ANALYZING ---------- */}
        {/* skeleton mirrors the DetectRow result cards (same 54px thumb + 2 text
            lines + check slot) so the loading state previews what's coming */}
        {stage === 'analyzing' && (
          <div style={{ marginTop: 'var(--s6)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="lb-scan" style={{ width: '100%', borderRadius: 'var(--r-md)' }}>
              <div className="lb-detect-in" style={{
                display: 'flex', alignItems: 'center', gap: 'var(--s3)',
                padding: 'var(--s3)', borderRadius: 'var(--r-md)', background: 'var(--ivory)',
                boxShadow: 'inset 0 0 0 1px var(--line)',
              }}>
                <div className="lb-skel" style={{ width: 54, height: 54, flex: 'none', borderRadius: 'var(--r-sm)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="lb-skel" style={{ height: 13, borderRadius: 999, width: '62%' }} />
                  <div className="lb-skel" style={{ height: 11, borderRadius: 999, width: '40%', marginTop: 8 }} />
                </div>
                <div className="lb-skel" style={{ width: 24, height: 24, flex: 'none', borderRadius: '50%' }} />
              </div>
            </div>
            <div style={{ width: '100%', marginTop: 'var(--s5)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--s3)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  {(progress.step && progress.step.label) || IMPORT_STEP_SEND.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
                  {progress.pct}%
                </div>
              </div>
              <div style={{
                marginTop: 10, height: 6, borderRadius: 999,
                background: 'var(--line)', overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.max(2, Math.min(100, progress.pct))}%`, height: '100%', borderRadius: 999,
                  background: 'var(--ink)', transition: 'width 240ms linear',
                }} />
              </div>
              <div style={{
                marginTop: 8, fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)',
                letterSpacing: '-0.01em', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
              }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{(() => {
                  const key = (progress.step && progress.step.key) || '';
                  const at = IMPORT_PHASES.findIndex((p) => p.keys.indexOf(key) !== -1);
                  return IMPORT_PHASES.map((p, i) => (
                    <span key={p.short} style={{ color: at >= i ? 'var(--ink)' : 'var(--ink-3)', opacity: at >= i ? 1 : 0.5 }}>
                      {i > 0 ? ' · ' : ''}{at > i ? '✓ ' : ''}{p.short}
                    </span>
                  ));
                })()}</span>
                <span style={{ opacity: 0.5, flex: 'none' }}>최대 2분</span>
              </div>
            </div>
          </div>
        )}

        {/* ---------- ANCHOR READY (recognized preview) ---------- */}
        {stage === 'anchor-ready' && anchorPrimary && (
          <>
            <div className="lb-anim-in" style={{
              display: 'flex', gap: 'var(--s4)', alignItems: 'center',
              padding: 'var(--s3)', background: 'var(--ivory)', borderRadius: 'var(--r-md)', marginTop: 'var(--s5)',
            }}>
              <div style={{ width: 76, flex: 'none' }}><Thumb item={anchorPrimary} radius="var(--r-sm)" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>{anchorPrimary.name || '불러온 상품'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>
                  <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{anchorPrimary.category || anchorPrimary.cat}</span>
                  {anchorPrimary.color ? ` · ${anchorPrimary.color}` : ''}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 'var(--s7)' }}>
              <Btn full size="lg" icon="sparkle" onClick={() => confirmAdd(mode, { anchorItem: anchorPrimary })}>
                조합 추천받기
              </Btn>
            </div>
          </>
        )}

        {/* ---------- REEXTRACT CONFIRM (새로 추출된 이미지를 실제 반영 전에 확인) ---------- */}
        {stage === 'reextract-confirm' && pendingReplace && (
          <>
            <div style={{
              position: 'relative', width: '100%', borderRadius: 'var(--r-md)', overflow: 'hidden',
              background: 'var(--thumb-bg)', boxShadow: 'inset 0 0 0 1px var(--line)', marginTop: 'var(--s5)',
            }}>
              {/* 축소해서 보여주면 잘렸는지 판단이 안 되니, 원본 비율 그대로 + 스크롤로 전체 확인 */}
              <div style={{ maxHeight: 420, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <img src={pendingReplace.item.img} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
            </div>
            <div style={{ marginTop: 'var(--s6)', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <Btn full size="lg" icon="check" onClick={confirmReplace} disabled={busy}>
                {busy ? '반영 중…' : '이대로 변경'}
              </Btn>
              <Btn full size="lg" variant="soft" icon="sparkle" onClick={retryReplace} disabled={busy}>
                다른 이미지로 다시 시도
              </Btn>
            </div>
            {err && (
              <div style={{
                marginTop: 'var(--s3)', color: '#B91C1C', fontSize: 13, fontWeight: 600,
                lineHeight: 1.45, textWrap: 'pretty',
              }}>{err}</div>
            )}
          </>
        )}

        {/* ---------- SELECT ---------- */}
        {stage === 'select' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--s5)', marginBottom: 'var(--s3)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }} className="tnum">{sel.length}개 선택됨</span>
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
                {sel.length > 0 ? `선택한 ${sel.length}개 담기` : '담을 아이템을 선택하세요'}
              </Btn>
              <Btn full variant="ghost" onClick={goBack}>다른 사진 올리기</Btn>
            </div>
          </>
        )}

        {/* ---------- REGISTER (sequential stepper) ---------- */}
        {stage === 'register' && cur && (
          <div className="lb-anim-in" key={stepIdx}>
            <div style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'center', marginTop: 'var(--s5)' }}>
              {/* 추출 결과를 여기서 바로 확대해 볼 수 있게 — 담기 전에 누끼가
                  제대로 됐는지 확인하려면 72px 썸네일로는 부족하다 */}
              <button
                type="button"
                onClick={() => cur.img && openImageViewer && openImageViewer({ ...cur, category: cur.cat })}
                disabled={!cur.img}
                aria-label={cur.img ? '이미지 크게 보기' : undefined}
                style={{
                  width: 72, flex: 'none', padding: 0, border: 'none', background: 'transparent',
                  cursor: cur.img ? 'zoom-in' : 'default',
                }}
              >
                <Thumb item={{ ...cur, category: cur.cat }} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 6 }}>이름</div>
                <input value={cur.name} onChange={(e) => patchStep({ name: e.target.value.slice(0, 48) })} maxLength={48} className="lb-input" placeholder="예) 코튼 셔츠" style={{
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
                    <LabeledField label="컬러" value={cur.draft.color} onChange={setStepDraft('color')} placeholder="예) 블루" />
                    <LabeledField label="구매처" value={cur.draft.store} onChange={setStepDraft('store')} placeholder="예) 무신사 · 오프라인" />
                    <LabeledField label="메모" value={cur.draft.note} onChange={setStepDraft('note')} placeholder="코디 팁, 세탁 주의 등" multiline />
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 'var(--s7)', display: 'flex', gap: 10 }}>
              <Btn variant="ghost" onClick={() => advance(false)} style={{ flex: '0 0 auto' }}>{steps.length <= 1 ? '취소' : '건너뛰기'}</Btn>
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

window.LB_SCREENS_AB = { Wordmark, NavTitle, TopBar, BottomNav, Eyebrow, WardrobeScreen, AddSheet };
Object.assign(window, { Wordmark, NavTitle, TopBar, BottomNav, Eyebrow, WardrobeScreen, AddSheet });
