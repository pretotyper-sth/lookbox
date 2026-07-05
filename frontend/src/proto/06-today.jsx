/* @prototype-ported */
const React = window.React;
const { Btn, Chip, Eyebrow, Icon, IconBtn, LB_DATA, LookComposite, Silhouette, Skeleton, Thumb, TopBar, Wordmark } = window;

/* global React, Thumb, Silhouette, Skeleton, Btn, Chip, Icon, IconBtn, LB_DATA, TopBar, Eyebrow, Wordmark, LookComposite */
// LOOKBOX — 오늘의 코디 (데일리 추천). 옷장에 이미 있는 옷만으로 매일 N개를 추천.
// 구매 흐름과 달리 앵커(고민 중인 옷)가 없고, '오늘 입기'로 착장을 기록한다.

const { useState: useTd, useEffect: useTe } = React;

const WD = ['일', '월', '화', '수', '목', '금', '토'];
function todayLabel() {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;
}

/* 날씨 · 날짜 메타 라인 — 날짜는 눌러서 지난 추천을 되짚어보는 진입점 */
function ContextStrip({ selected, today, calOpen, setCalOpen, view, setView, onSelect }) {
  const w = LB_DATA.WEATHER;
  const pill = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-pill)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--line)' };
  const isToday = ymd(selected) === ymd(today);
  const dlabel = `${selected.getMonth() + 1}월 ${selected.getDate()}일 (${WD[selected.getDay()]})`;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 'var(--s4)' }}>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setCalOpen((o) => !o)} aria-label="날짜 선택"
          style={{ ...pill, cursor: 'pointer', color: isToday ? 'var(--ink-2)' : 'var(--accent-ink)', background: isToday ? 'var(--surface)' : 'var(--accent)', boxShadow: isToday ? 'inset 0 0 0 1px var(--line)' : 'none' }}>
          {isToday ? `오늘 · ${dlabel}` : dlabel}
          <Icon name="chevD" size={13} stroke={2} style={{ transform: calOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur) var(--ease)' }} />
        </button>
        {calOpen && (
          <>
            <div onClick={() => setCalOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50, width: 300, maxWidth: '86vw', background: 'var(--surface)', borderRadius: 'var(--r-md)', boxShadow: '0 12px 36px -8px color-mix(in srgb, var(--ink) 26%, transparent), 0 0 0 1px var(--line)' }}>
              <HistoryCalendar today={today} selected={selected}
                onSelect={(d) => { onSelect(d); setCalOpen(false); }}
                view={view} onPrevMonth={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
                onNextMonth={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))} />
            </div>
          </>
        )}
      </div>
      <span style={pill}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
        {w.city} {w.temp}° {w.cond}
      </span>
      <span style={pill}>최고 {w.hi}° · 최저 {w.lo}°</span>
    </div>
  );
}

/* ============================================================
   TodayCard — 옷장 옷만으로 구성한 하루치 코디 (2꾭 그리드용 컴팩트)
   ============================================================ */
function TodayCard({ outfit, saved, onSave, worn, onWear }) {
  const items = outfit.itemIds.map((id) => LB_DATA.ALL[id]);
  return (
    <div className="lb-anim-in" style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 'var(--s3)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* HERO — 조합 전체를 하나의 룩 이미지로, 상황 태그·저장은 오버레이 */}
      <div style={{ position: 'relative' }}>
        <LookComposite outfit={outfit} items={items} ratio="4 / 5" />
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
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>{outfit.mood} · {items.length}개</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 7, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{outfit.note}</div>
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
      <div style={{ background: 'var(--ivory)', borderRadius: 'var(--r-md)', overflow: 'hidden', aspectRatio: '4 / 5' }}><Skeleton h="100%" radius="0" /></div>
      <div style={{ padding: '11px 3px 0' }}><Skeleton w="70%" h={15} /><Skeleton w="50%" h={11} style={{ marginTop: 8 }} /><Skeleton w="90%" h={11} style={{ marginTop: 9 }} /></div>
      <Skeleton h={34} radius="var(--r-pill)" style={{ marginTop: 'var(--s3)' }} />
    </div>
  );
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
          const isToday = cy === todayYmd;
          const worn = !future && buildDayFor(d).wornId;
          return (
            <button key={cy} onClick={future ? undefined : () => onSelect(d)} disabled={future}
              style={{
                height: 30, border: 'none', borderRadius: 'var(--r-sm)', position: 'relative',
                display: 'grid', placeItems: 'center', fontSize: 12.5,
                fontWeight: isSel ? 800 : isToday ? 700 : 500,
                cursor: future ? 'default' : 'pointer',
                color: future ? 'var(--ink-4, color-mix(in srgb, var(--ink-3) 55%, transparent))'
                  : isSel ? 'var(--accent-ink)' : 'var(--ink)',
                background: isSel ? 'var(--accent)' : 'transparent',
                outline: isToday && !isSel ? '1.5px solid var(--line-2)' : 'none', outlineOffset: -1.5,
                transition: 'background var(--dur) var(--ease)',
              }}>
              {d.getDate()}
              {worn && !isSel && (
                <span style={{ position: 'absolute', bottom: 3, width: 3.5, height: 3.5, borderRadius: '50%', background: 'var(--accent-ink)' }} />
              )}
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
  const { items, wide, savedOutfitIds, toggleSaveOutfit, wornToday, wearToday, dailyCount, hasWardrobe, startComboOrWardrobe, dailyAllowed, dailyLoading, dailyStyle, requestDailyOutfits } = ctx;
  const pool = LB_DATA.DAILY;
  const ready = items.length >= 3;

  const [offset, setOffset] = useTd(0);
  const [loading, setLoading] = useTd(false);

  // 날짜 선택 — 오늘이면 데일리 추천, 지난 날짜면 그날 추천 기록
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const [selected, setSelected] = useTd(today);
  const [calOpen, setCalOpen] = useTd(false);
  const [view, setView] = useTd(new Date(today.getFullYear(), today.getMonth(), 1));
  const isToday = ymd(selected) === ymd(today);
  const pastDay = isToday ? null : buildDayFor(selected);

  // 풀에서 offset 기준 N개를 순환 선택
  const picks = [];
  for (let i = 0; i < Math.min(dailyCount, pool.length); i++) picks.push(pool[(offset + i) % pool.length]);

  const reshuffle = async () => {
    setLoading(true);
    await requestDailyOutfits(dailyStyle);
    setOffset(0);
    setLoading(false);
  };

  /* ---- 잠금 상태 (옷장 3벌 미만) ---- */
  if (!ready) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!wide && <TopBar left={<Wordmark />} />}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 40px 80px' }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)', marginBottom: 'var(--s5)' }}>
            <Icon name="sparkle" size={38} stroke={1.4} />
          </div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>오늘의 코디를 받아보세요</h1>
          <p style={{ margin: '10px 0 0', fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.5, maxWidth: 270 }}>
            옷장에 옷이 모이면,<br />가진 옷으로 매일 코디를 추천해요.
          </p>
          <div style={{ marginTop: 'var(--s7)', width: '100%', maxWidth: 280 }}>
            <Btn full size="lg" icon="plus" onClick={startComboOrWardrobe}>옷장 채우러 가기</Btn>
          </div>
          <div style={{ marginTop: 'var(--s4)', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 12.5 }}>
            <Icon name="lock" size={14} /> 3벌부터 데일리 추천이 열려요
          </div>
        </div>
      </div>
    );
  }

  if (!dailyAllowed) {
    const styles = [
      ['dandy', '댄디', '깔끔하고 단정한 출근/외출 톤'],
      ['minimal', '미니멀', '컬러를 줄인 차분한 톤'],
      ['casual', '캐주얼', '편한 데일리 톤'],
      ['office', '오피스', '회의/출근에 안전한 톤'],
    ];
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {!wide && <TopBar left={<Wordmark />} />}
        <div style={{ flex: 1, overflowY: 'auto', padding: wide ? '28px 0 36px' : '4px 18px 28px' }}>
          <div className={wide ? 'lb-wide-inner' : ''} style={{ maxWidth: 620, margin: wide ? '0 auto' : undefined }}>
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: '28px 24px', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
              <Eyebrow>오늘의 추천 코디</Eyebrow>
              <h1 style={{ margin: '12px 0 0', fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.25 }}>오늘 입을 무드를 골라주세요</h1>
              <p style={{ margin: '12px 0 0', fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.65 }}>
                원하는 분위기를 고르면, 내 옷장에 있는 옷만으로 오늘 입을 조합을 만들어드릴게요.
              </p>
              <div style={{ marginTop: 20, display: 'grid', gap: 10 }}>
                {styles.map(([id, label, desc]) => (
                  <button key={id} onClick={() => requestDailyOutfits(id)} disabled={dailyLoading} style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '14px 15px', borderRadius: 'var(--r-md)',
                    background: id === dailyStyle ? 'var(--ivory)' : 'var(--surface-2)', boxShadow: id === dailyStyle ? 'inset 0 0 0 1.5px var(--accent)' : 'inset 0 0 0 1px var(--line)',
                    opacity: dailyLoading ? 0.58 : 1,
                  }}>
                    <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none', background: id === dailyStyle ? 'var(--accent)' : 'var(--ivory)', color: id === dailyStyle ? 'var(--accent-ink)' : 'var(--ink-2)' }}>
                      <Icon name="sparkle" size={14} />
                    </span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800 }}>{label}</span>
                      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{desc}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 18 }}>
                <Btn full size="lg" icon="sparkle" onClick={() => requestDailyOutfits(dailyStyle)} disabled={dailyLoading}>{dailyLoading ? '추천 만드는 중...' : '오늘의 코디 추천받기'}</Btn>
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                다른 분위기가 필요하면 언제든 다시 고를 수 있어요.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const ctxStrip = (
    <ContextStrip selected={selected} today={today}
      calOpen={calOpen} setCalOpen={setCalOpen} view={view} setView={setView}
      onSelect={(d) => setSelected(startOfDay(d))} />
  );

  const header = isToday ? (
    <div style={{ marginBottom: 'var(--s5)' }}>
      <Eyebrow>오늘의 추천 코디</Eyebrow>
      <p style={{ margin: '10px 0 0', fontSize: 15, color: 'var(--ink)', lineHeight: 1.5, fontWeight: 600 }}>
        옷장 속 <b style={{ fontWeight: 800 }}>{items.length}벌</b>로 만든 오늘의 추천 {picks.length}개예요.
      </p>
      {ctxStrip}
    </div>
  ) : (
    <div style={{ marginBottom: 'var(--s5)' }}>
      <Eyebrow>지난 추천 코디</Eyebrow>
      <p style={{ margin: '10px 0 0', fontSize: 15, color: 'var(--ink)', lineHeight: 1.5, fontWeight: 600 }}>
        <b style={{ fontWeight: 800 }}>{selected.getMonth() + 1}월 {selected.getDate()}일</b>에 추천받았던 코디예요.
      </p>
      {ctxStrip}
    </div>
  );

  const shown = isToday ? picks : pastDay.picks;

  const list = (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: wide ? 'var(--s4)' : 'var(--s3)' }}>
        {isToday && loading
          ? Array.from({ length: picks.length }).map((_, i) => <TodayCardSkeleton key={i} />)
          : shown.map((o, i) => (
              <TodayCard key={(isToday ? '' : ymd(selected) + '-') + o.id + '-' + i} outfit={o}
                saved={savedOutfitIds.includes(o.id)} onSave={() => toggleSaveOutfit(o.id)}
                worn={wornToday.includes(o.id)} onWear={() => wearToday(o.id)} />
            ))}
      </div>
      <div style={{ marginTop: 'var(--s5)' }}>
        {isToday
          ? <Btn full variant="soft" icon="sparkle" onClick={reshuffle} disabled={loading || dailyLoading}>{(loading || dailyLoading) ? '추천 만드는 중...' : '다른 코디 추천받기'}</Btn>
          : <Btn full variant="ghost" onClick={() => setSelected(today)}>오늘 추천으로 돌아가기</Btn>}
      </div>
    </>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {!wide && <TopBar left={<Wordmark />} />}
      <div style={{ flex: 1, overflowY: 'auto', padding: wide ? '28px 0 36px' : '4px 18px 28px' }}>
        <div className={wide ? 'lb-wide-inner' : ''} style={wide ? { maxWidth: 760 } : undefined}>
          {header}
          {list}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TodayScreen, TodayCard });
