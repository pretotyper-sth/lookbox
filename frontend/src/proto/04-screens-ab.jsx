/* @prototype-ported */
const React = window.React;
const { useScrollTopOn, Badge, BottomSheet, Btn, CATEGORIES, Chip, ChipMultiField, EmptyState, Icon, IconBtn, LB_DATA, LabeledField, PullRefresh, RecentTagField, STORE_RECENT_KEY, rememberStore, Skeleton, Thumb } = window;

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
  { id: 'color', label: '색상순', hint: '화이트 → 컬러 → 블랙 순' },
  { id: 'name', label: '이름순', hint: '가나다 순' },
];

// 컬러값은 '블루 스트라이프', '미드 블루', '오프화이트'처럼 자유 문구라 문자열
// 정렬은 의미가 없다. 색 계열로 묶어 밝은 무채색 → 웜 → 쿨 → 어두운 무채색 순으로
// 늘어놓는다(옷장을 눈으로 훑는 순서). 키워드 포함으로 판정한다.
const COLOR_FAMILIES = [
  ['화이트', '아이보리', '크림', '에크루', '오트밀', 'white', 'ivory', 'cream', 'ecru'],
  ['베이지', '샌드', '카멜', '탄', '모카', '브라운', '카키', 'beige', 'sand', 'camel', 'brown', 'khaki'],
  ['옐로우', '머스타드', '골드', 'yellow', 'mustard', 'gold'],
  ['오렌지', '코랄', 'orange', 'coral'],
  ['레드', '와인', '버건디', '마룬', '로즈', 'red', 'wine', 'burgundy', 'maroon', 'rose'],
  ['핑크', '라벤더', '라일락', '퍼플', 'pink', 'lavender', 'lilac', 'purple'],
  ['그린', '올리브', '세이지', '민트', '틸', '터콰이즈', 'green', 'olive', 'sage', 'mint', 'teal'],
  ['네이비', '블루', '소라', '삭스', '색스', '코발트', '청', '데님', '인디고',
    'navy', 'blue', 'saxe', 'denim', 'indigo'],
  ['그레이', '그레이지', '차콜', '실버', '멜란지', 'gray', 'grey', 'charcoal', 'silver'],
  ['블랙', 'black'],
];

function colorRank(value) {
  const v = String(value || '').toLowerCase();
  if (!v) return COLOR_FAMILIES.length + 1;
  for (let i = 0; i < COLOR_FAMILIES.length; i += 1) {
    if (COLOR_FAMILIES[i].some((k) => v.indexOf(k) !== -1)) return i;
  }
  return COLOR_FAMILIES.length;
}

/* 옷장 검색 — 의류 커머스에서 쓰는 방식 그대로.
   1) 여러 필드를 한 번에 본다: 이름·브랜드·카테고리·색상·구매처·메모·계절.
      사용자는 "포터리"(브랜드)로도, "블랙"(색)으로도, "무신사"(구매처)로도 찾는다.
   2) 토큰 AND: 공백으로 끊고 모든 토큰이 어딘가에 맞아야 한다. "포터리 셔츠"는
      브랜드와 이름에 나눠 맞아도 통과 — 한 필드에 다 있어야 하는 게 아니다.
   3) 초성 검색: "ㅋㅌ" → "코튼". 한국 앱에서 이게 없으면 검색이 안 되는 느낌이 든다.
   4) 붙여쓰기 무시: "29 CM"과 "29cm", "와이드데님"과 "와이드 데님"이 같게 걸린다.
   정렬은 사용자가 고른 기준을 그대로 둔다. 관련도로 재정렬하면 '최신순'을 골라둔
   사용자가 순서가 왜 바뀌었는지 알 수 없다. 수십 벌 규모에서는 걸러내는 게 값이다. */
const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ',
  'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

function toChosung(text) {
  let out = '';
  for (const ch of String(text || '')) {
    const code = ch.charCodeAt(0);
    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      out += CHOSUNG[Math.floor((code - HANGUL_BASE) / 588)];
    } else {
      out += ch;
    }
  }
  return out;
}
const isChosungOnly = (t) => /^[ㄱ-ㅎ]+$/.test(t);
const compact = (t) => t.replace(/[\s·・\-_/]+/g, '');

function searchHaystack(item) {
  const seasons = (item.seasons || [])
    .map((id) => ((LB_DATA.SEASONS || []).find((s) => s.id === id) || {}).name || '')
    .join(' ');
  return [item.name, item.brand, item.category, item.cat, item.color, item.store, item.note, seasons]
    .filter(Boolean).join(' ').toLowerCase();
}

function matchesQuery(item, tokens) {
  if (!tokens.length) return true;
  const hay = searchHaystack(item);
  const hayCompact = compact(hay);
  const hayChosung = toChosung(hayCompact);
  return tokens.every((t) => {
    if (hayCompact.indexOf(compact(t)) !== -1) return true;
    // 초성만 입력한 토큰은 초성 인덱스로만 비교한다
    return isChosungOnly(t) && hayChosung.indexOf(t) !== -1;
  });
}

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
  if (sortId === 'color') {
    return arr.sort((a, b) => colorRank(a.color) - colorRank(b.color) || catRank(a) - catRank(b) || byName(a, b));
  }
  if (sortId === 'name') return arr.sort(byName);
  return arr.sort((a, b) => time(b) - time(a) || byName(a, b));
}
function WardrobeScreen({ ctx }) {
  const {
    items, archived = [], openAdd, wide, openItem, requestRemove,
    bulkArchive, bulkRestore, bulkDelete,
    comboReady, comboGate, comboNeed, comboProgress, wardrobeLoading,
    requestPickedOutfits, refreshLive,
  } = ctx;
  const [cat, setCat] = useS('전체');
  const [seasonFilter, setSeasonFilter] = useS([]); // multi-select season ids, [] = 전체
  const [sel, setSel] = useS([]); // multi-select ids
  const [selectMode, setSelectMode] = useS(false); // mobile: explicit select mode (no hover)
  const [hoverId, setHoverId] = useS(null);
  const [bulkDelAsk, setBulkDelAsk] = useS(false);
  const [sortId, setSortId] = useS('recent');
  const [sortOpen, setSortOpen] = useS(false);
  const [moreOpen, setMoreOpen] = useS(false);
  const [query, setQuery] = useS('');
  const cats = LB_DATA.CATEGORIES;
  const seasons = LB_DATA.SEASONS;
  const viewingArchive = cat === '보관';
  const toggleSeason = (id) => setSeasonFilter((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  // 보관함이 비어도 탭에 머문다 — 빈 상태 화면을 보여주는 편이, 마지막 옷을
  // 꺼낸 순간 전체 탭으로 튕겨 나가는 것보다 덜 어색하다.
  useE(() => { setSel([]); setSelectMode(false); setBulkDelAsk(false); }, [cat, seasonFilter, query]);
  const queryTokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const bySeason = (i) => seasonFilter.length === 0 || (i.seasons || []).some((s) => seasonFilter.includes(s));
  const filtered = sortWardrobe(
    (viewingArchive ? archived : (cat === '전체' ? items : items.filter((i) => i.category === cat)))
      .filter(bySeason)
      .filter((i) => matchesQuery(i, queryTokens)),
    sortId,
  );
  const activeSort = WARDROBE_SORTS.find((s) => s.id === sortId) || WARDROBE_SORTS[0];
  const count = items.length;
  // 개수는 지금 보고 있는 목록을 따른다. 카테고리·계절·검색으로 좁혀 놓고도 늘 전체
  // 개수만 떠 있으면 화면과 숫자가 어긋난다. 좁혀졌을 때만 전체를 뒤에 덧붙인다.
  const totalCount = viewingArchive ? archived.length : count;
  const narrowed = (!viewingArchive && cat !== '전체') || seasonFilter.length > 0 || queryTokens.length > 0;
  const countLabel = narrowed ? `${filtered.length}개 · 전체 ${totalCount}개` : `${totalCount}개`;
  const ready = comboReady;
  const selCount = sel.length;
  const selecting = selCount > 0;
  const mobileSelect = !wide && selectMode;
  const inSelectUx = wide ? selecting : (selectMode || selecting);

  const toggleSel = (id) => setSel((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  const clearSel = () => { setSel([]); setBulkDelAsk(false); setMoreOpen(false); };
  const exitSelectMode = () => { clearSel(); setSelectMode(false); };
  const runBulkArchive = () => { if (viewingArchive) bulkRestore(sel); else bulkArchive(sel); exitSelectMode(); };
  const runBulkDelete = () => { bulkDelete(sel); exitSelectMode(); };

  /* ---- Empty state (소유·보관 모두 없을 때만; 최초 로딩 중엔 스켈레톤 우선) ---- */
  if (count === 0 && archived.length === 0 && !wardrobeLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!wide && <TopBar left={null} right={<IconBtn name="plus" label="아이템 추가" onClick={() => openAdd('wardrobe')} />} />}
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

  // 검색 — 이름만으로는 못 찾는다. 브랜드·색·구매처까지 훑고 초성도 받는다.
  const searchField = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: wide ? '0 12px' : '0 10px', height: wide ? 40 : 34, borderRadius: 'var(--r-pill)',
      background: 'var(--ivory)', boxShadow: 'inset 0 0 0 1px var(--line)',
      minWidth: 0, flex: 1, width: '100%',
    }}>
      <span style={{ color: 'var(--ink-3)', flex: 'none', display: 'inline-flex' }}>
        <Icon name="search" size={15} stroke={2.2} />
      </span>
      <input
        className="lb-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="이름·브랜드·색·구매처 검색"
        aria-label="옷장 검색"
        style={{
          flex: 1, minWidth: 0, padding: 0, border: 'none', background: 'transparent',
          fontSize: wide ? 13.5 : 13, fontWeight: 500, color: 'var(--ink)', outline: 'none',
        }}
      />
      {query && (
        <button type="button" onClick={() => setQuery('')} aria-label="검색어 지우기"
          style={{
            flex: 'none', display: 'grid', placeItems: 'center', width: 22, height: 22,
            borderRadius: '50%', background: 'var(--surface)', color: 'var(--ink-2)',
          }}>
          <Icon name="x" size={12} stroke={2.4} />
        </button>
      )}
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

  // 선택한 옷으로 할 수 있는 일. 지금은 '코디 추천' 하나지만, 여기 모아두면
  // 플로팅 바가 길어지지 않고 나중에 늘리기도 쉽다.
  const runPickedCoord = () => {
    setMoreOpen(false);
    const ids = sel.slice();
    exitSelectMode();
    if (requestPickedOutfits) requestPickedOutfits(ids);
  };
  const moreOptions = (
    <div role="none">
      <button
        type="button"
        role="menuitem"
        onClick={runPickedCoord}
        disabled={viewingArchive}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: wide ? '9px 12px' : '13px 4px', border: 'none', background: 'transparent',
          textAlign: 'left', cursor: viewingArchive ? 'default' : 'pointer', borderRadius: 'var(--r-sm)',
          opacity: viewingArchive ? 0.45 : 1,
        }}
      >
        <Icon name="sparkle" size={18} stroke={1.9} style={{ flex: 'none' }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>코디 추천</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
            {viewingArchive ? '보관한 옷은 추천에 쓰이지 않아요' : `고른 ${selCount}개가 들어간 코디를 만들어요`}
          </span>
        </span>
      </button>
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
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          background: 'var(--ivory)',
          borderBottom: '1px solid color-mix(in srgb, var(--line) 85%, transparent)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '0 18px 8px',
          }}>
            {searchField}
            {(count > 0 || archived.length > 0) && (
              <button
                type="button"
                onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                style={{
                  flex: 'none', fontSize: 13, fontWeight: 700, padding: '6px 4px',
                  minWidth: 36, textAlign: 'center',
                  color: selectMode ? 'var(--ink)' : 'var(--ink-2)',
                }}
              >
                {selectMode ? '완료' : '선택'}
              </button>
            )}
            <IconBtn
              name="plus"
              label="아이템 추가"
              onClick={() => openAdd('wardrobe')}
              style={selectMode ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
              aria-hidden={selectMode || undefined}
              tabIndex={selectMode ? -1 : undefined}
            />
          </div>
          {chips}
          {seasonChips}
        </div>
      )}

      <PullRefresh
        onRefresh={refreshLive}
        disabled={wide || !refreshLive}
        style={{
        flex: 1,
        // 단축과 롱핸드를 섞지 않는다(섞으면 나머지 방향 패딩이 사라진다).
        paddingTop: wide ? 28 : 16,
        paddingLeft: wide ? 0 : 18,
        paddingRight: wide ? 0 : 18,
        paddingBottom: wide ? (selecting ? 88 : 72) : (selecting ? 96 : 88),
      }}>
       <div className={wide ? 'lb-wide-inner' : ''}>
        {wide && (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
            <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800 }}>{viewingArchive ? '보관함' : '옷장'}</h1>
            <span className="tnum" style={{ fontSize: 13.5, color: 'var(--ink-3)', fontWeight: 600 }}>{countLabel}</span>
          </div>
        )}
        {/* 데스크탑은 카테고리 칩과 검색을 한 줄에 둔다 — 타이틀 행에 있을 때보다
            필터끼리 모여 읽기 쉽고, 세로 한 줄을 아낀다. 모바일은 폭이 없어 그대로 둔다. */}
        {wide && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)', minWidth: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>{chips}</div>
            {/* 칩 줄로 옮기고 나서 폭이 195px까지 쪼그라들었다(감싼 div가 content 폭).
                타이틀 행에 있던 300px보다 조금 넉넉하게 고정한다. */}
            <div style={{ flex: 'none', width: 320, paddingBottom: 8 }}>{searchField}</div>
          </div>
        )}
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

        {/* 검색 결과 0건 — 빈 그리드만 남기면 앱이 고장난 것처럼 보인다.
            찾던 말과 나갈 길(검색어 지우기)을 같이 준다. */}
        {queryTokens.length > 0 && filtered.length === 0 ? (
          <EmptyState
            icon="search"
            iconSize={38}
            title={`'${query.trim()}' 검색 결과가 없어요`}
            wide={wide}
            padTop={false}
            hint={false}
            action={<Btn full size="lg" variant="soft" icon="x" onClick={() => setQuery('')}>검색어 지우기</Btn>}
          >
            이름·브랜드·색상·구매처를 찾아봤어요.<br />초성으로도 검색할 수 있어요.
          </EmptyState>
        ) : viewingArchive && archived.length === 0 ? (
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
      </PullRefresh>

      {/* 선택 시 하단 플로팅 메뉴 */}
      {selecting && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: wide ? 22 : 10, zIndex: 30,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
          padding: wide ? '0 24px' : '0 18px',
        }}>
          <div style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: wide ? 8 : 6,
            flexWrap: wide ? 'wrap' : 'nowrap',
            width: wide ? 'auto' : '100%',
            maxWidth: '100%',
            padding: wide ? '10px 22px' : '8px 8px 8px 14px',
            borderRadius: 'var(--r-pill)',
            background: 'color-mix(in srgb, var(--surface) 94%, transparent)',
            boxShadow: '0 10px 32px -10px color-mix(in srgb, var(--ink) 28%, transparent), inset 0 0 0 1px var(--line)',
            backdropFilter: 'blur(10px)',
          }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', flex: 'none' }} className="tnum">{selCount}개</span>
            <button onClick={clearSel} style={{
              fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', padding: '4px 2px',
              marginRight: wide ? 0 : 'auto', flex: 'none',
            }}>{wide ? '선택 해제' : '해제'}</button>
            <Btn size="sm" variant="soft" icon={viewingArchive ? 'hanger' : 'archive'} onClick={runBulkArchive}
              style={{ fontSize: 12, padding: wide ? '7px 12px' : '6px 10px', flex: 'none' }}>
              {viewingArchive ? '옷장으로' : '보관'}
            </Btn>
            <Btn size="sm" icon="trash" onClick={() => setBulkDelAsk(true)}
              style={{ background: '#B0573C', color: '#fff', fontSize: 12, padding: wide ? '7px 12px' : '6px 10px', flex: 'none' }}>삭제</Btn>
            {/* 고른 옷으로 할 수 있는 일 — 바를 늘리지 않고 더보기 안에 둔다 */}
            <div style={{ position: 'relative', flex: 'none' }}>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-label="더보기"
                style={{
                  width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  background: 'var(--ivory)', color: 'var(--ink)', boxShadow: 'inset 0 0 0 1px var(--line-2)',
                }}
              >
                <Icon name="more" size={16} stroke={2.2} />
              </button>
              {wide && moreOpen && (
                <>
                  <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div role="menu" style={{
                    position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, zIndex: 41,
                    width: 234, padding: 6, background: 'var(--surface)',
                    borderRadius: 'var(--r-md)', boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
                    border: '1px solid var(--line)',
                  }}>
                    {moreOptions}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {!wide && (
        <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)}>
          <div className="lb-sheet-body" style={{ padding: '10px 24px 26px' }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>선택한 {selCount}개</h2>
            <div style={{ marginTop: 'var(--s4)' }}>{moreOptions}</div>
          </div>
        </BottomSheet>
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
        <button
          type="button"
          className={'lb-fab' + (comboReady ? '' : ' soft')}
          onClick={comboGate}
          aria-label="조합 추천받기"
        >
          <Icon name="sparkle" size={26} stroke={1.7} fill={comboReady ? 'currentColor' : 'none'} />
        </button>
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

/* 붙여넣기 한 덩어리에서 상품 목록을 뽑는다.
   ① 수집기(tools/order-collector)가 만든 JSON  ② 그냥 여러 줄의 상품 URL
   둘 다 받는다. 하나짜리 URL은 기존 단건 등록 흐름을 그대로 쓴다. */
function normalizeForDup(raw) {
  const str = String(raw || '').trim();
  if (!str) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(str) ? str : 'https://' + str);
    const keep = [];
    u.searchParams.forEach((v, k) => {
      if (/^(goodsno|productno|itemid|prdno|goods_no|product_id|id|no)$/i.test(k)) keep.push(`${k.toLowerCase()}=${v}`);
    });
    return u.hostname.replace(/^www\./, '').toLowerCase()
      + u.pathname.replace(/\/+$/, '').toLowerCase()
      + (keep.length ? '?' + keep.sort().join('&') : '');
  } catch (e) {
    return str.toLowerCase();
  }
}

function parseBulkPaste(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : (data.items || []);
      return list
        .filter((it) => it && it.url)
        .map((it) => ({
          url: String(it.url),
          name: String(it.name || '').trim(),
          store: String(it.platform || it.store || '').trim(),
          price: String(it.price || '').trim(),
          purchasedAt: String(it.purchasedAt || '').trim(),
        }));
    } catch (e) { /* JSON이 아니면 아래 URL 스캔으로 */ }
  }
  const urls = raw.match(/https?:\/\/[^\s"'<>)]+/gi) || [];
  const seen = new Set();
  return urls
    .map((u) => u.replace(/[.,)]+$/, ''))
    .filter((u) => { const k = u.split('#')[0]; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((u) => ({ url: u, name: '', store: '', price: '', purchasedAt: '' }));
}

function AddSheet({ ctx }) {
  const {
    addSheet, closeAdd, confirmAdd, addItemsBatch, liveImportSource, discardLiveItems,
    detectCount, liveReplaceItemImage, liveConfirmReplaceImage, applyReextractItem, showToast,
    importOrders, checkDuplicates, knownSourceUrls = [],
    openTryOn, openTryOnSetup, prefs, wide, comboReady, comboNeed, comboProgress, openAdd, openImageViewer,
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
  // 여러 개 붙여넣었을 때(구매내역 수집기 JSON 또는 URL 여러 줄)의 후보 목록
  const [bulk, setBulk] = useS(null);       // [{url,name,store,price,purchasedAt,pick,state,error}]
  const [bulkRun, setBulkRun] = useS(null); // {index,total,label} 진행 상황
  const [bulkResult, setBulkResult] = useS(null); // {ok, dup, fail, failed[], skipped[]}
  const [bulkChecking, setBulkChecking] = useS(false);
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
  // 단계·등록 중인 옷이 바뀌면 시트 안 스크롤을 위로. 아래까지 내려 본 상태로 다음
  // 항목에 들어가면 이름 입력칸부터가 화면 밖이라 뭘 해야 하는지 알 수 없다.
  const sheetBodyRef = useR(null);
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
          setSteps(list.map((d) => ({ ...d, cat: d.category, draft: { brand: d.brand || '', size: '', color: d.color || '', store: d.store || '', note: '' } })));
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
        setTryOnErr('얼굴이 잘 나온 사진으로 올려주세요.');
        return;
      }
      if (faces > 1) {
        setTryOnErr('한 명만 나온 사진을 선택해주세요.');
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
  // 붙여넣기·입력에서 상품이 2개 이상 잡히면 단건 입력을 후보 목록으로 바꾼다.
  const takeBulk = (text) => {
    const found = parseBulkPaste(text);
    if (found.length < 2) return false;
    const known = new Set(knownSourceUrls);
    const rows = found.map((it) => {
      const dup = known.has(normalizeForDup(it.url));
      return { ...it, pick: !dup, dup, dupReason: dup ? '같은 상품 주소예요' : '', state: 'idle', error: '' };
    });
    setBulk(rows);
    setUrl('');
    setErr('');
    setBulkResult(null);
    // 주소만으로는 같은 상품을 다른 경로로 담은 경우를 놓친다. 서버가 상품코드·이름·
    // 사진 지문까지 보고 알려준다(AI 아님, 비용 없음).
    if (checkDuplicates) {
      setBulkChecking(true);
      checkDuplicates(rows)
        .then((map) => {
          setBulk((arr) => (arr || []).map((b) => {
            const hit = map[b.url];
            if (!hit || !hit.duplicate) return b;
            return { ...b, dup: true, dupReason: hit.reason || '이미 옷장에 있어요', matchedName: hit.matchedName || '', pick: false };
          }));
        })
        .finally(() => setBulkChecking(false));
    }
    return true;
  };
  const onUrlChange = (e) => {
    const v = e.target.value;
    if (takeBulk(v)) return;
    setUrl(v);
    setErr('');
  };
  const onUrlPaste = (e) => {
    const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
    if (takeBulk(text)) e.preventDefault();
  };
  const bulkPicked = (bulk || []).filter((b) => b.pick);
  const runBulk = async () => {
    if (!importOrders || !bulkPicked.length) return;
    setErr('');
    const targets = bulkPicked.slice();
    const preSkipped = (bulk || []).filter((b) => b.dup && !b.pick);
    setBulkRun({ index: 0, total: targets.length });
    setBulk((arr) => arr.map((b) => (b.pick ? { ...b, state: 'wait', error: '' } : b)));
    const mark = (url2, patch) => setBulk((arr) => arr.map((b) => (b.url === url2 ? { ...b, ...patch } : b)));
    const { done, failed, skipped } = await importOrders(targets, (p) => {
      setBulkRun({ index: p.index, total: p.total, label: p.item.name || p.item.url });
      if (p.state === 'run') mark(p.item.url, { state: 'run' });
      if (p.state === 'ok') mark(p.item.url, { state: 'ok', pick: false });
      if (p.state === 'dup') mark(p.item.url, { state: 'dup', pick: false, dup: true, dupReason: p.reason || '이미 옷장에 있어요' });
      if (p.state === 'fail') mark(p.item.url, { state: 'fail', error: p.error || '실패' });
    });
    setBulkRun(null);
    setBulkResult({
      ok: done.length,
      dup: skipped.length + preSkipped.length,
      fail: failed.length,
      failed,
      skipped: [...skipped, ...preSkipped.map((b) => ({ ...b, reason: b.dupReason || '이미 옷장에 있어요' }))],
    });
  };
  const retryFailed = () => {
    const again = (bulkResult && bulkResult.failed) || [];
    if (!again.length) return;
    setBulkResult(null);
    setBulk((arr) => (arr || []).map((b) => (again.some((f) => f.url === b.url) ? { ...b, pick: true, state: 'idle', error: '' } : b)));
  };
  const canSubmit = tab === 'photo' ? !!file : tab === 'url' ? (bulk ? !!bulkPicked.length : !!url.trim()) : false;
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
    setSteps(q.map((d) => ({ ...d, cat: d.category, draft: { brand: d.brand || '', size: '', color: d.color || '', store: d.store || '', note: '' } })));
    setStepIdx(0);
    setStage('register');
  };

  // ---- register (sequential) ----
  useScrollTopOn(sheetBodyRef, `${stage}:${stepIdx}`, addSheet.open);
  const cur = steps[stepIdx] || null;
  const patchStep = (patch) => setSteps((arr) => arr.map((x, i) => (i === stepIdx ? { ...x, ...patch } : x)));
  const setStepDraft = (k) => (v) => setSteps((arr) => arr.map((x, i) => (i === stepIdx ? { ...x, draft: { ...x.draft, [k]: v } } : x)));
  const toItem = (s) => {
    const clean = Object.fromEntries(Object.entries(s.draft || {}).filter(([, v]) => v && String(v).trim()));
    const cat = s.cat || s.category || '상의';
    return {
      ...s,
      seasons: s.seasons || [],
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
      kept.forEach((it) => rememberStore(it.store));
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
      <div ref={sheetBodyRef} className="lb-sheet-body" style={{ padding: '10px 24px 26px' }}>
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
              ).map(([id, label, ic]) => {
                // 옷장에 맞춰 볼 옷이 없으면 사진·URL로 고민 중인 옷을 올려도 할 게 없다.
                // 눌렀을 때 아무 일도 안 일어나는 것보다, 아직 못 쓴다는 걸 보여주고 잠근다.
                const locked = anchor && !comboReady && id !== 'tryon';
                return (
                  <button key={id} disabled={locked} aria-disabled={locked} onClick={() => {
                    if (locked) return;
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
                    opacity: locked ? 0.4 : 1,
                    cursor: locked ? 'default' : 'pointer',
                  }}>
                    {locked ? <Icon name="lock" size={14} /> : <Icon name={ic} size={16} />}{label}
                  </button>
                );
              })}
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
                // 잠긴 탭이 선택돼 있을 때는 그 탭의 업로드 UI를 띄우지 않는다 —
                // 올려도 할 수 있는 게 없으니 아래 안내와 CTA만 남긴다.
                const tabLocked = anchor && !comboReady && tab !== 'tryon';
                return (
                  <>
                    {tabLocked ? null : tab === 'tryon' ? (
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
                                {tryOnChecking ? '사진 확인 중…' : '프로필 사진 올리기'}
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', wordBreak: 'keep-all' }}>
                                얼굴이 나온 사진으로 옷을 바로 비춰 볼 수 있어요 (휴대폰 전용)
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
                    ) : bulkResult ? (
                      /* 다 담고 난 뒤 요약. 중복으로 건너뛴 것과 실패한 것을 이유까지 보여준다. */
                      <div style={{
                        borderRadius: 'var(--r-md)', background: 'var(--ivory)',
                        boxShadow: 'inset 0 0 0 1px var(--line)', padding: '16px 14px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            width: 30, height: 30, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center',
                            background: bulkResult.ok ? 'var(--accent)' : 'var(--surface-2)',
                            color: bulkResult.ok ? 'var(--accent-ink)' : 'var(--ink-2)',
                          }}>
                            <Icon name={bulkResult.ok ? 'check' : 'hanger'} size={16} stroke={2.4} />
                          </span>
                          <span style={{ fontSize: 15.5, fontWeight: 800 }}>
                            {bulkResult.ok ? `${bulkResult.ok}개를 옷장에 담았어요` : '새로 담을 옷이 없었어요'}
                          </span>
                        </div>
                        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                          {bulkResult.dup > 0 && (
                            <div>이미 있는 옷 <b style={{ color: 'var(--ink)', fontWeight: 700 }}>{bulkResult.dup}건</b>은 건너뛰었어요.</div>
                          )}
                          {bulkResult.fail > 0 && (
                            <div>가져오지 못한 <b style={{ color: 'var(--ink)', fontWeight: 700 }}>{bulkResult.fail}건</b>은 아래에 남겨 뒀어요.</div>
                          )}
                          {bulkResult.dup === 0 && bulkResult.fail === 0 && <div>중복이나 실패 없이 전부 담겼어요.</div>}
                        </div>
                        {(bulkResult.skipped.length > 0 || bulkResult.failed.length > 0) && (
                          <div className="lb-scrollable" style={{ marginTop: 12, maxHeight: 150, overflowY: 'auto' }}>
                            {bulkResult.skipped.map((x) => (
                              <div key={'s' + x.url} style={{ display: 'flex', gap: 8, padding: '6px 2px', borderTop: '1px solid var(--line)', fontSize: 12 }}>
                                <span style={{ flex: 1, minWidth: 0, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {x.name || x.url}
                                </span>
                                <span style={{ flex: 'none', color: 'var(--ink-3)' }}>{x.reason || '이미 있음'}</span>
                              </div>
                            ))}
                            {bulkResult.failed.map((x) => (
                              <div key={'f' + x.url} style={{ display: 'flex', gap: 8, padding: '6px 2px', borderTop: '1px solid var(--line)', fontSize: 12 }}>
                                <span style={{ flex: 1, minWidth: 0, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {x.name || x.url}
                                </span>
                                <span style={{ flex: 'none', color: '#B0573C' }}>{String(x.error || '실패').slice(0, 22)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : bulk ? (
                      /* 여러 개를 붙여넣었을 때: 후보를 고르고 한 번에 담는다.
                         이미 옷장에 있는 것은 미리 체크를 풀어 둔다(주소·상품코드·이름·사진). */
                      <div style={{
                        borderRadius: 'var(--r-md)', background: 'var(--ivory)',
                        boxShadow: 'inset 0 0 0 1px var(--line)', padding: 10,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 8px' }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>
                            {bulk.length}개 중 <span className="tnum">{bulkPicked.length}</span>개 선택
                          </span>
                          {bulkChecking && <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>중복 확인 중…</span>}
                          <button type="button" onClick={() => setBulk((arr) => arr.map((b) => ({ ...b, pick: b.state !== 'ok' })))}
                            style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', padding: '2px 4px' }}>전체 선택</button>
                          <button type="button" onClick={() => setBulk((arr) => arr.map((b) => ({ ...b, pick: false })))}
                            style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', padding: '2px 4px' }}>해제</button>
                          <span style={{ flex: 1 }} />
                          <button type="button" onClick={() => { setBulk(null); setBulkRun(null); }}
                            style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', padding: '2px 4px' }}>지우기</button>
                        </div>
                        <div className="lb-scrollable" style={{ maxHeight: 236, overflowY: 'auto' }}>
                          {bulk.map((b) => {
                            const host = (() => { try { return new URL(b.url).hostname.replace(/^www\./, ''); } catch (e) { return b.url; } })();
                            const busy = b.state === 'run' || b.state === 'wait';
                            return (
                              <label key={b.url} style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px',
                                borderTop: '1px solid var(--line)', cursor: busy ? 'default' : 'pointer',
                                opacity: b.state === 'ok' ? 0.55 : 1,
                              }}>
                                <input
                                  type="checkbox"
                                  checked={!!b.pick}
                                  disabled={busy || b.state === 'ok'}
                                  onChange={() => setBulk((arr) => arr.map((x) => (x.url === b.url ? { ...x, pick: !x.pick } : x)))}
                                  style={{ flex: 'none', width: 16, height: 16, accentColor: 'var(--ink)' }}
                                />
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {b.name || host}
                                  </span>
                                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {[b.store || host, b.price, b.purchasedAt].filter(Boolean).join(' · ')}
                                  </span>
                                </span>
                                <span style={{ flex: 'none', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>
                                  {b.state === 'run' ? '등록 중…'
                                    : b.state === 'ok' ? '담았어요'
                                    : b.state === 'dup' ? (b.dupReason || '이미 있음')
                                    : b.state === 'fail' ? (b.error || '실패')
                                    : b.dup ? (b.dupReason || '이미 있음') : ''}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        {bulkRun ? (
                          <div style={{ padding: '10px 6px 2px' }}>
                            <div style={{ height: 4, borderRadius: 999, background: 'var(--line-2)', overflow: 'hidden' }}>
                              <div style={{
                                width: `${Math.round(((bulkRun.index + 1) / Math.max(1, bulkRun.total)) * 100)}%`,
                                height: '100%', background: 'var(--accent)', transition: 'width var(--dur) var(--ease)',
                              }} />
                            </div>
                            <div className="tnum" style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-2)' }}>
                              {bulkRun.index + 1} / {bulkRun.total} · {String(bulkRun.label || '').slice(0, 28)}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div style={{
                        ...dropBase, cursor: 'default', padding: '0 18px',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%' }}>
                          <input
                            value={url}
                            onChange={onUrlChange}
                            onPaste={onUrlPaste}
                            placeholder="https://…"
                            className="lb-input"
                            style={{
                              width: '100%', padding: '12px 14px', borderRadius: 'var(--r-md)', fontSize: 14,
                              background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)',
                              outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                          <span style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', wordBreak: 'keep-all' }}>
                            상품 주소 하나, 또는 여러 개를 한 번에 붙여넣어도 돼요
                          </span>
                        </div>
                      </div>
                    )}

                    <div style={{ minHeight: tabErr ? undefined : 0 }}>
                      {tabErr ? errBanner(tabErr) : null}
                    </div>

                    {/* 조합 추천은 옷장이 있어야 되고 바로 보기는 없어도 된다. 두 전제가 한
                        시트에 섞여 있어서 문장으로 설명해야 했는데, 설명보다 상태로 드러내는 게
                        낫다: 아직 안 되는 탭은 잠그고, 여기서 바로 옷을 담게 한다. */}
                    {anchor && !comboReady && tab !== 'tryon' && (
                      <div style={{
                        marginTop: 'var(--s4)', padding: '14px', borderRadius: 'var(--r-md)',
                        background: 'var(--ivory)', boxShadow: 'inset 0 0 0 1px var(--line)',
                      }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.4 }}>
                          옷장에 옷을 먼저 담아주세요
                        </div>
                        <div style={{ marginTop: 5, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45, wordBreak: 'keep-all' }}>
                          고민 중인 옷과 맞춰 볼 옷이 있어야 조합을 만들 수 있어요.
                          {comboNeed ? ` ${comboNeed}가 더 필요해요.` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
                          {[0, 1, 2, 3].map((n) => (
                            <div key={n} style={{
                              flex: 1, height: 4, borderRadius: 999,
                              background: n < (comboProgress || 0) ? 'var(--accent)' : 'var(--line-2)',
                            }} />
                          ))}
                        </div>
                        <Btn full size="lg" icon="plus" style={{ marginTop: 'var(--s4)' }}
                          onClick={() => { closeAdd(); openAdd && openAdd('wardrobe'); }}>
                          옷장에 아이템 추가
                        </Btn>
                      </div>
                    )}

                    <div style={{
                      marginTop: 'var(--s4)', minHeight: tabLocked ? 0 : 28, display: 'flex', alignItems: 'center',
                      visibility: (tab === 'tryon' || tabLocked) ? 'hidden' : 'visible',
                      pointerEvents: (tab === 'tryon' || tabLocked) ? 'none' : 'auto',
                      height: tabLocked ? 0 : undefined, overflow: tabLocked ? 'hidden' : undefined,
                    }} aria-hidden={tab === 'tryon' || tabLocked}>
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
                        <span style={{ color: 'var(--ink-3)', transform: showHint ? 'rotate(-90deg)' : 'rotate(90deg)', display: 'inline-flex' }}>
                          <Icon name="chevL" size={14} />
                        </span>
                      </button>
                    </div>
                    {showHint && tab !== 'tryon' && (
                      <div style={{ marginTop: 'var(--s4)' }}>
                        {hintHistory.length > 0 && (
                          <div style={{ marginBottom: 'var(--s5)' }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10 }}>최근에 쓴 힌트</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
                        {!hintHistory.length && (
                          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4 }}>
                            여러 아이템이 한 장에 있을 때 원하는 것만 지정할 수 있어요.
                          </div>
                        )}
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
                          바로 보기
                        </Btn>
                      ) : bulkResult ? (
                          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                            {bulkResult.fail > 0 && (
                              <Btn variant="soft" icon="sparkle" onClick={retryFailed} style={{ flex: 1 }}>
                                {bulkResult.fail}건 다시 시도
                              </Btn>
                            )}
                            <Btn icon="check" onClick={closeAdd} style={{ flex: 1 }}>확인</Btn>
                          </div>
                      ) : (
                        <Btn
                          full size="lg" icon="sparkle"
                          onClick={bulk ? runBulk : onSubmitAdd}
                          disabled={!canSubmit || busy || !!bulkRun}
                        >
                          {bulkRun ? '담는 중…'
                            : bulk ? `${bulkPicked.length}개 옷장에 담기`
                            : busy ? '인식 중…'
                            : (reextract ? '이미지 변경' : (anchor ? '조합 추천받기' : '추가하기'))}
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
              <div className="lb-scrollable" style={{ maxHeight: 420,   }}>
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
                  cursor: cur.img ? 'zoom-in' : 'default', position: 'relative',
                  outline: 'none', boxShadow: 'none', WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Thumb item={{ ...cur, category: cur.cat }} />
                {cur.img && (
                  <span style={{
                    position: 'absolute', right: 4, bottom: 4, width: 22, height: 22, borderRadius: '50%',
                    background: 'color-mix(in srgb, var(--ink) 72%, transparent)', color: '#fff',
                    display: 'grid', placeItems: 'center',
                  }}>
                    <Icon name="search" size={11} stroke={2.4} />
                  </span>
                )}
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

            {/* 상세 정보 — 아이템 상세 시트와 같은 구성·같은 순서로 둔다.
                접지 않는 것도 상세 시트와 같다: 계절이 여기 들어가 있고, 접히면
                AI가 넣은 값을 고칠 방법이 없어진다. */}
            <div style={{ marginTop: 'var(--s6)', borderTop: '1px solid var(--line)', paddingTop: 'var(--s5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>상세 정보</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>선택 입력</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}><LabeledField label="브랜드" value={cur.draft.brand} onChange={setStepDraft('brand')} placeholder="예) 코스" /></div>
                  <div style={{ flex: 1 }}><LabeledField label="사이즈" value={cur.draft.size} onChange={setStepDraft('size')} placeholder="예) M" /></div>
                </div>
                <LabeledField label="컬러" value={cur.draft.color} onChange={setStepDraft('color')} placeholder="예) 그레이시 그린" />
                <ChipMultiField
                  label="계절"
                  options={LB_DATA.SEASONS}
                  value={cur.seasons || []}
                  onChange={(next) => patchStep({ seasons: next })}
                />
                <RecentTagField label="구매처" value={cur.draft.store} onChange={setStepDraft('store')} placeholder="구매처 이름을 입력해 주세요" storeKey={STORE_RECENT_KEY} />
                <LabeledField label="메모" value={cur.draft.note} onChange={setStepDraft('note')} placeholder="코디 팁, 세탁 주의 등" multiline />
              </div>
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
