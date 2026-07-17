/* @prototype-ported */
const React = window.React;
const { BottomSheet, Btn, Chip, EmptyState, Eyebrow, Icon, IconBtn, LB_DATA, LookComposite, Silhouette, Skeleton, Thumb } = window;

/* global React, Thumb, Silhouette, Skeleton, Btn, Chip, Icon, IconBtn, LB_DATA, Eyebrow, LookComposite, BottomSheet, EmptyState */
// LOOKBOX — 오늘의 코디 (데일리 추천). 옷장에 이미 있는 옷만으로 매일 N개를 추천.
// 구매 흐름과 달리 앵커(고민 중인 옷)가 없고, '오늘 입기'로 착장을 기록한다.

const { useState: useTd, useEffect: useTe } = React;

const WD = ['일', '월', '화', '수', '목', '금', '토'];
function todayLabel() {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;
}

/* 날씨 · 날짜 메타 라인 — 날짜는 눌러서 지난 추천을 되짚어보는 진입점 */
function ContextStrip({ selected, today, calOpen, setCalOpen, view, setView, onSelect, action }) {
  const w = LB_DATA.WEATHER;
  const pill = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-pill)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--line)' };
  const isToday = ymd(selected) === ymd(today);
  const dlabel = `${selected.getMonth() + 1}월 ${selected.getDate()}일 (${WD[selected.getDay()]})`;
  const btnRef = React.useRef(null);
  const [calPos, setCalPos] = useTd(null);

  useTe(() => {
    if (!calOpen || !btnRef.current) {
      setCalPos(null);
      return undefined;
    }
    const place = () => {
      const r = btnRef.current.getBoundingClientRect();
      const width = Math.min(300, window.innerWidth - 24);
      let left = r.left;
      if (left + width > window.innerWidth - 12) left = Math.max(12, window.innerWidth - width - 12);
      setCalPos({ top: r.bottom + 8, left, width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [calOpen]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginTop: 'var(--s4)',
      minWidth: 0,
    }}>
      <div style={{ flex: 'none' }}>
        <button ref={btnRef} type="button" onClick={() => setCalOpen((o) => !o)} aria-label="날짜 선택" aria-expanded={calOpen}
          style={{ ...pill, cursor: 'pointer', color: isToday ? 'var(--ink-2)' : 'var(--accent-ink)', background: isToday ? 'var(--surface)' : 'var(--accent)', boxShadow: isToday ? 'inset 0 0 0 1px var(--line)' : 'none', whiteSpace: 'nowrap' }}>
          {isToday ? `오늘 · ${dlabel}` : dlabel}
          <Icon name="chevD" size={13} stroke={2} style={{ transform: calOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur) var(--ease)' }} />
        </button>
      </div>
      <div style={{
        display: 'flex', flexWrap: 'nowrap', gap: 8, flex: 1, minWidth: 0,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        marginLeft: -2, paddingLeft: 2, paddingRight: 2,
      }}>
        <span style={{ ...pill, flex: 'none', whiteSpace: 'nowrap' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
          {w.city} {w.temp}° {w.cond}
        </span>
        <span style={{ ...pill, flex: 'none', whiteSpace: 'nowrap' }}>최고 {w.hi}° · 최저 {w.lo}°</span>
      </div>
      {action ? <div style={{ flex: 'none' }}>{action}</div> : null}
      {calOpen && calPos && (
        <>
          <div onClick={() => setCalOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80 }} />
          <div style={{
            position: 'fixed', top: calPos.top, left: calPos.left, zIndex: 90,
            width: calPos.width,
            background: 'var(--surface)', borderRadius: 'var(--r-md)',
            boxShadow: '0 12px 36px -8px color-mix(in srgb, var(--ink) 26%, transparent), 0 0 0 1px var(--line)',
          }}>
            <HistoryCalendar today={today} selected={selected}
              onSelect={(d) => { onSelect(d); setCalOpen(false); }}
              view={view} onPrevMonth={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
              onNextMonth={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))} />
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   TodayCard — 옷장 옷만으로 구성한 하루치 코디 (2꾭 그리드용 컴팩트)
   ============================================================ */
function TodayCard({ outfit, saved, onSave, worn, onWear, styleLabel, onView }) {
  const items = (outfit.itemIds || []).map((id) => LB_DATA.ALL[id]).filter(Boolean);
  const moodBasis = outfit.styleLabel || styleLabel || '';
  return (
    <div className="lb-anim-in" style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 'var(--s3)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* HERO — 조합 전체를 하나의 룩 이미지로, 상황 태그·저장은 오버레이 */}
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
        {outfit.note ? (
          <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 7, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{outfit.note}</div>
        ) : null}
      </div>

      {/* 오늘 입기 — 데일리 추천 고유 액션 */}
      <div style={{ marginTop: 'var(--s3)' }}>
        <Btn full size="sm" variant={worn ? 'soft' : 'primary'} icon={worn ? 'check' : 'hanger'} onClick={onWear}>
          {worn ? '오늘 입음' : '오늘 입기'}
        </Btn>
      </div>
    </div>
  );
}

function TodayCardSkeleton() {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 'var(--s3)' }}>
      <div style={{ background: 'var(--thumb-bg)', borderRadius: 'var(--r-md)', overflow: 'hidden', aspectRatio: '4 / 5' }}><Skeleton h="100%" radius="0" /></div>
      <div style={{ padding: '11px 3px 0' }}><Skeleton w="70%" h={15} /><Skeleton w="50%" h={11} style={{ marginTop: 8 }} /><Skeleton w="90%" h={11} style={{ marginTop: 9 }} /></div>
      <Skeleton h={34} radius="var(--r-pill)" style={{ marginTop: 'var(--s3)' }} />
    </div>
  );
}

/* 기본 4칸 중 고유 조합이 부족할 때 채우는 빈 슬롯 */
function EmptyTodaySlot({ wardrobeGrew, onRecommend, onAdd }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 'var(--s3)',
      display: 'flex', flexDirection: 'column', minHeight: 0,
      boxShadow: 'inset 0 0 0 1.5px dashed var(--line-2)',
    }}>
      <div style={{
        flex: 1, minHeight: 0, aspectRatio: '4 / 5', borderRadius: 'var(--r-md)', background: 'var(--thumb-bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '14px 10px', color: 'var(--ink-3)',
      }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface)', display: 'grid', placeItems: 'center', marginBottom: 10, color: 'var(--ink-2)' }}>
          <Icon name={wardrobeGrew ? 'sparkle' : 'plus'} size={20} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.35, wordBreak: 'keep-all' }}>
          {wardrobeGrew ? '옷장이 늘었어요' : '더 많은 코디'}
        </div>
        <div style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.4, color: 'var(--ink-3)', wordBreak: 'keep-all' }}>
          {wardrobeGrew ? '새 조합을 받아보세요' : '옷을 추가해 보세요'}
        </div>
      </div>
      <div style={{ marginTop: 'var(--s3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {wardrobeGrew ? (
          <Btn full size="sm" variant="soft" icon="sparkle" onClick={onRecommend}>새 코디 받기</Btn>
        ) : (
          <Btn full size="sm" variant="soft" icon="plus" onClick={onAdd}>아이템 추가</Btn>
        )}
      </div>
    </div>
  );
}

function uniqueDailyOutfits(list) {
  const seen = {};
  const out = [];
  (list || []).forEach((o) => {
    if (!o) return;
    const key = (o.itemIds || []).slice().sort().join(',') || o.id;
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push(o);
  });
  return out;
}

/* ============================================================
   지난 추천 히스토리 — 날짜별로 그날 추천되었던 코디를 되집어보기
   ============================================================ */
const HWD = ['일', '월', '화', '수', '목', '금', '토'];
const HMON = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function ymd(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

// 특정 날짜에 그날 추천받았던 코디를 결정적으로 생성 (데모용)
function buildDayFor(date) {
  const pool = LB_DATA.DAILY;
  const seed = Math.floor(startOfDay(date).getTime() / 86400000);
  const picks = [0, 1, 2, 3].map((i) => pool[(seed * 3 + i) % pool.length]);
  const wornId = seed % 2 === 0 ? picks[seed % picks.length].id : null;
  return { picks, wornId };
}

function HistoryLook({ outfit, worn, saved, onSave }) {
  const items = outfit.itemIds.map((id) => LB_DATA.ALL[id]);
  return (
    <div>
      <div style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        <LookComposite outfit={outfit} items={items} ratio="4 / 5" />
        {worn && (
          <span style={{ position: 'absolute', left: 7, top: 7, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#fff', background: 'color-mix(in srgb, var(--ink) 78%, transparent)', padding: '3px 8px', borderRadius: 'var(--r-pill)', backdropFilter: 'blur(4px)' }}>
            <Icon name="check" size={11} stroke={3} /> 입음
          </span>
        )}
        <button onClick={onSave} aria-label="룩북에 저장" style={{
          position: 'absolute', right: 7, top: 7, width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center',
          color: saved ? 'var(--accent-ink)' : 'var(--ink)',
          background: saved ? 'var(--accent)' : 'color-mix(in srgb, var(--surface-2) 86%, transparent)',
          boxShadow: saved ? 'none' : 'inset 0 0 0 1px var(--line-2)', backdropFilter: 'blur(4px)',
          transition: 'all var(--dur) var(--ease)',
        }}>
          <Icon name="heart" size={13} fill={saved ? 'currentColor' : 'none'} stroke={saved ? 0 : 2} />
        </button>
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 6, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{outfit.label}</div>
    </div>
  );
}

/* ---- 달력: 원하는 날짜를 선택하면 그날 추천 코디를 보여준다 ---- */
function HistoryCalendar({ today, selected, onSelect, view, onPrevMonth, onNextMonth }) {
  const y = view.getFullYear(), m = view.getMonth();
  const first = new Date(y, m, 1);
  const lead = first.getDay();                       // 그 달 1일의 요일
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayYmd = ymd(today), selYmd = ymd(selected);
  // 다음 달로 이동 가능? (미래는 추천 데이터 없음)
  const canNext = new Date(y, m + 1, 1) <= startOfDay(today);

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', padding: 'var(--s3)' }}>
      {/* 월 네비게이션 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button onClick={onPrevMonth} aria-label="이전 달" style={calNavStyle}>
          <Icon name="chevL" size={15} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>{y}년 {HMON[m]}</span>
        <button onClick={canNext ? onNextMonth : undefined} aria-label="다음 달" disabled={!canNext}
          style={{ ...calNavStyle, opacity: canNext ? 1 : 0.3, cursor: canNext ? 'pointer' : 'default' }}>
          <Icon name="chevR" size={15} />
        </button>
      </div>
      {/* 요일 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
        {HWD.map((w, i) => (
          <div key={w} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, padding: '2px 0', color: i === 0 ? 'var(--accent-strong, var(--accent-ink))' : 'var(--ink-3)' }}>{w}</div>
        ))}
      </div>
      {/* 날짜 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 1 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={'e' + i} />;
          const cy = ymd(d);
          const future = cy > todayYmd;
          const isSel = cy === selYmd;
          const isTodayCell = cy === todayYmd;
          return (
            <button key={cy} type="button" onClick={future ? undefined : () => onSelect(d)} disabled={future}
              style={{
                height: 30, border: 'none', borderRadius: 'var(--r-sm)', position: 'relative',
                display: 'grid', placeItems: 'center', fontSize: 12.5,
                fontWeight: isSel ? 800 : isTodayCell ? 700 : 500,
                cursor: future ? 'default' : 'pointer',
                color: future ? 'var(--ink-4, color-mix(in srgb, var(--ink-3) 55%, transparent))'
                  : isSel ? 'var(--accent-ink)' : 'var(--ink)',
                background: isSel ? 'var(--accent)' : 'transparent',
                outline: isTodayCell && !isSel ? '1.5px solid var(--line-2)' : 'none', outlineOffset: -1.5,
              }}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const calNavStyle = {
  width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'transparent',
  display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-2)',
};

/* ============================================================
   TodayScreen — 오늘의 코디 (홈)
   ============================================================ */
function TodayScreen({ ctx }) {
  const {
    items, wide, savedOutfitIds, toggleSaveOutfit, wornToday, wearToday,
    dailyCount, startComboOrWardrobe, openAdd, go,
    dailyAllowed, dailyLoading, requestDailyOutfits, comboReady,
    dailyEnabled, setDailyEnabled,
    preferredDailyStyle, preferredStyleLabel,
    dailyWardrobeGrew, dailyTick,
    openOutfitViewer,
  } = ctx;
  const pool = LB_DATA.DAILY;
  const ready = comboReady;
  const COLS = Math.max(1, parseInt(dailyCount, 10) || 4);

  const [loading, setLoading] = useTd(false);
  const [needMoreOpen, setNeedMoreOpen] = useTd(false);
  // exhausted | grewButNone — API 실패 없이 0건일 때 팝업 문구 분기
  const [needMoreKind, setNeedMoreKind] = useTd('exhausted');

  // 날짜 선택 — 오늘이면 데일리 추천, 지난 날짜면 그날 추천 기록
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const [selected, setSelected] = useTd(today);
  const [calOpen, setCalOpen] = useTd(false);
  const [view, setView] = useTd(new Date(today.getFullYear(), today.getMonth(), 1));
  const isToday = ymd(selected) === ymd(today);
  const pastDay = isToday ? null : buildDayFor(selected);

  // 설정에서 허용한 경우에만 자동 추천 (비용 효율)
  useTe(() => {
    if (!dailyEnabled || !ready || !isToday) return;
    if (dailyAllowed || dailyLoading) return;
    requestDailyOutfits(preferredDailyStyle);
  }, [dailyEnabled, ready, isToday, dailyAllowed, dailyLoading, preferredDailyStyle, requestDailyOutfits]);

  // owned에 없는 아이템·상의/하의 미달 코디는 화면에서도 제외
  const ownedIds = React.useMemo(
    () => new Set((items || []).map((it) => String(it.id))),
    [items],
  );
  const picks = uniqueDailyOutfits(pool).filter((o) => {
    const ids = o.itemIds || [];
    if (ids.length < 2 || !ids.every((id) => ownedIds.has(String(id)))) return false;
    const buckets = ids.map((id) => {
      const it = LB_DATA.ALL[id] || items.find((x) => String(x.id) === String(id));
      const cat = ((it && it.category) || '').toLowerCase();
      if (cat === '상의' || cat === '아우터' || cat === 'top' || cat === 'outer') return 'top';
      if (cat === '하의' || cat === 'bottom') return 'bottom';
      if (cat === '원피스' || cat === 'dress') return 'dress';
      return 'other';
    });
    if (buckets.includes('dress')) return true;
    return buckets.includes('top') && buckets.includes('bottom');
  });
  void dailyTick; // prune/append 후 리렌더 트리거
  // 첫 줄(COLS)을 못 채울 때만 빈 슬롯. 4개 이상은 빈 칸 없이 아래 CTA로 2개씩 추가
  const emptySlots = isToday && picks.length < COLS ? COLS - picks.length : 0;
  const wardrobeGrew = !!dailyWardrobeGrew;

  const reshuffle = async () => {
    setLoading(true);
    const result = await requestDailyOutfits(preferredDailyStyle, { force: true, quiet: true });
    setLoading(false);
    if (!result || result.error) return;
    if (result.added > 0) return;
    setNeedMoreKind(result.wardrobeGrew || wardrobeGrew ? 'grewButNone' : 'exhausted');
    setNeedMoreOpen(true);
  };

  /* ---- 설정에서 미허용 (디폴트 off) ---- */
  if (!dailyEnabled) {
    return (
      <EmptyState
        icon="sparkle"
        title="오늘의 추천 코디"
        wide={wide}
        action={<Btn full size="lg" icon="user" onClick={() => go ? go('mypage') : null}>마이페이지로 이동</Btn>}
        hintHidden
      >
        마이페이지에서 <b style={{ color: 'var(--ink)', fontWeight: 700 }}>오늘의 추천 코디</b>를<br />
        허용해야 매일 코디를 받을 수 있어요.
      </EmptyState>
    );
  }

  /* ---- 잠금 상태 (상의·하의 미달) ---- */
  if (!ready) {
    return (
      <EmptyState
        icon="sparkle"
        title="오늘의 코디를 받아보세요"
        wide={wide}
        action={<Btn full size="lg" icon="plus" onClick={startComboOrWardrobe}>옷장 채우러 가기</Btn>}
        hint={<><Icon name="lock" size={14} /> 상의·하의를 담으면 조합 추천이 열려요</>}
      >
        옷장에 옷이 모이면,<br />가진 옷으로 매일 코디를 추천해요.
      </EmptyState>
    );
  }

  const isFirstLoad = isToday && picks.length === 0 && (dailyLoading || !dailyAllowed || loading);
  const isAppending = isToday && picks.length > 0 && (loading || dailyLoading);
  const busy = isFirstLoad;
  // 헤더에는 지난날짜 복귀만. 추가 추천 CTA는 카드 아래 풀너비.
  const stripAction = (!isToday && wide) ? (
    <Btn size="sm" variant="ghost" onClick={() => setSelected(today)}>오늘 추천으로 돌아가기</Btn>
  ) : null;
  const ctxStrip = (
    <ContextStrip selected={selected} today={today}
      calOpen={calOpen} setCalOpen={setCalOpen} view={view} setView={setView}
      onSelect={(d) => setSelected(startOfDay(d))}
      action={stripAction} />
  );

  const header = isToday ? (
    <div style={{ marginBottom: 'var(--s5)' }}>
      <Eyebrow>오늘의 추천 코디</Eyebrow>
      <p style={{ margin: '10px 0 0', fontSize: wide ? 16 : 15, color: 'var(--ink)', lineHeight: 1.5, fontWeight: 600 }}>
        {busy ? (
          <>오늘의 추천을 준비 중이에요 <span style={{ fontWeight: 500, color: 'var(--ink-3)', fontSize: 13 }}>· 최대 10초</span></>
        ) : (
          <>
            옷장 속 <b style={{ fontWeight: 800 }}>{items.length}개</b>
            {picks.length > 0 ? <>로 만든 오늘의 추천 <b style={{ fontWeight: 800 }}>{picks.length}개</b>예요.</> : <>로 오늘의 추천을 준비 중이에요.</>}
          </>
        )}
      </p>
      {ctxStrip}
    </div>
  ) : (
    <div style={{ marginBottom: 'var(--s5)' }}>
      <Eyebrow>지난 추천 코디</Eyebrow>
      <p style={{ margin: '10px 0 0', fontSize: wide ? 16 : 15, color: 'var(--ink)', lineHeight: 1.5, fontWeight: 600 }}>
        <b style={{ fontWeight: 800 }}>{selected.getMonth() + 1}월 {selected.getDate()}일</b>에 추천받았던 코디예요.
      </p>
      {ctxStrip}
    </div>
  );

  const shown = isToday ? picks : uniqueDailyOutfits(pastDay.picks).slice(0, COLS);
  const empty = isToday ? emptySlots : Math.max(0, COLS - shown.length);
  const gridCols = wide
    ? `repeat(${COLS}, minmax(0, 1fr))`
    : 'repeat(2, minmax(0,1fr))';

  const list = (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        gap: wide ? 'var(--s4)' : 'var(--s3)',
      }}>
        {isFirstLoad
          ? Array.from({ length: COLS }).map((_, i) => <TodayCardSkeleton key={'sk' + i} />)
          : (
            <>
              {shown.map((o, i) => (
                <TodayCard key={(isToday ? '' : ymd(selected) + '-') + o.id + '-' + i} outfit={o}
                  styleLabel={preferredStyleLabel}
                  saved={savedOutfitIds.includes(o.id)} onSave={() => toggleSaveOutfit(o.id)}
                  worn={wornToday.includes(o.id)} onWear={() => wearToday(o.id)}
                  onView={openOutfitViewer} />
              ))}
              {Array.from({ length: empty }).map((_, i) => (
                <EmptyTodaySlot
                  key={'empty' + i}
                  wardrobeGrew={wardrobeGrew}
                  onRecommend={reshuffle}
                  onAdd={() => openAdd ? openAdd('wardrobe') : startComboOrWardrobe()}
                />
              ))}
              {/* 추가 추천 중: 기존 카드는 유지하고 새 자리만 스켈레톤 */}
              {isAppending && Array.from({ length: 2 }).map((_, i) => (
                <TodayCardSkeleton key={'ask' + i} />
              ))}
            </>
          )}
      </div>
      {/* 4칸이 찬 뒤에만 풀너비 CTA — 2개씩 append, 계속 유지 */}
      {isToday && picks.length >= COLS && (
        <div style={{ marginTop: 'var(--s5)' }}>
          <Btn full size="lg" variant="soft" icon="sparkle" onClick={reshuffle} disabled={loading || dailyLoading}>
            {loading || dailyLoading ? '만드는 중… 최대 10초' : '추가로 코디 추천받기'}
          </Btn>
          <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>
            지금 추천은 유지하고 코디 2개를 더 받아요
          </p>
        </div>
      )}
      {!isToday && (
        <div style={{ marginTop: 'var(--s5)' }}>
          <Btn full variant="ghost" onClick={() => setSelected(today)}>오늘 추천으로 돌아가기</Btn>
        </div>
      )}
    </>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: wide ? '28px 0 36px' : 'calc(env(safe-area-inset-top, 0px) + 22px) 18px 28px',
      }}>
        <div className={wide ? 'lb-wide-inner' : undefined}>
          {header}
          {list}
        </div>
      </div>
      <BottomSheet open={needMoreOpen} onClose={() => setNeedMoreOpen(false)}>
        <div style={{ padding: '28px 24px 26px', textAlign: 'center' }}>
          {needMoreKind === 'grewButNone' ? (
            <>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>새 조합을 찾지 못했어요</h3>
              <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                옷장에 옷이 늘었지만,<br />지금 추천과 겹치지 않는 새 코디를<br />더 만들지 못했어요.<br />다른 스타일 옷을 담아보거나<br />내일 다시 받아보세요.
              </p>
            </>
          ) : (
            <>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>더 추천할 코디가 없어요</h3>
              <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                지금 옷장으로는 만들 수 있는 조합을<br />모두 보여드렸어요.<br />옷을 더 담으면 새로운 코디를 추천해드려요.
              </p>
            </>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 20 }}>
            <Btn full size="lg" icon="plus" onClick={() => { setNeedMoreOpen(false); openAdd ? openAdd('wardrobe') : startComboOrWardrobe(); }}>아이템 추가</Btn>
            <Btn full variant="ghost" onClick={() => setNeedMoreOpen(false)}>취소</Btn>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

Object.assign(window, { TodayScreen, TodayCard });
