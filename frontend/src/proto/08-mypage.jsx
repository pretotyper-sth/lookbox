/* @prototype-ported */
const React = window.React;
const { BottomSheet, Btn, Chip, Icon, LB_DATA, LabeledField, PALETTE, PERSONAL_COLORS, STYLES } = window;

/* global React, Btn, Icon, Chip, BottomSheet, LabeledField, LB_DATA */
// LOOKBOX — 마이페이지: 개인 정보(계정) + 내 스타일(취향) 허브. 실서비스 IA 기준.

const { useState: useMp, useEffect: useMe } = React;

// 빌드 식별자 — 이 기기가 어떤 배포를 보고 있는지 확인용 (vite define)
const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

/* ---- 사용량 · 요금제 ---------------------------------------------------------
   AI를 쓰는 작업(등록·추천·착장 이미지)은 실제로 돈이 나간다. 얼마나 남았는지, 무엇에
   썼는지를 숫자로 보여주고, 더 필요하면 요금제를 올리는 길을 같은 카드 안에 둔다.   */
function CreditBar({ remaining, granted }) {
  const pct = granted > 0 ? Math.max(0, Math.min(100, (remaining / granted) * 100)) : 0;
  const low = pct <= 15;
  return (
    <div style={{ height: 6, borderRadius: 999, background: 'var(--line-2)', overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: 999,
        background: low ? '#B0573C' : 'var(--accent)',
        transition: 'width var(--dur) var(--ease)',
      }} />
    </div>
  );
}

function PlanSheet({ open, onClose, billing }) {
  const plans = (billing && billing.plans) || [];
  const costs = (billing && billing.costs) || [];
  // 카드와 설명 박스가 같은 톤이어야 한 화면으로 읽힌다 — 같은 배경·같은 테두리·같은 반경.
  const box = (active) => ({
    borderRadius: 'var(--r-md)',
    padding: 16,
    background: 'var(--ivory)',
    boxShadow: active ? 'inset 0 0 0 2px var(--ink)' : 'inset 0 0 0 1px var(--line)',
  });
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="lb-sheet-body lb-scrollable" style={{ padding: '10px 22px 8px', maxHeight: '80vh' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>요금제</h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55, wordBreak: 'keep-all' }}>
기능은 무료도 같아요. 쓸 수 있는 양만 달라요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="lb-iconbtn"
            style={{
              flex: 'none', width: 36, height: 36, borderRadius: '50%', marginTop: -4, marginRight: -6,
              display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
            }}
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 'var(--s4)' }}>
          {plans.map((p) => (
            <div key={p.id} style={box(p.current)}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 800 }}>{p.name}</span>
                {p.current && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-ink)', background: 'var(--accent)', padding: '2px 7px', borderRadius: 999 }}>
                    사용 중
                  </span>
                )}
                <span style={{ flex: 1 }} />
                <span className="tnum" style={{ fontSize: 15, fontWeight: 800 }}>
                  {p.priceKrw ? `${p.priceKrw.toLocaleString()}원` : '0원'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{p.priceKrw ? '/월' : ''}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{p.blurb}</div>
              <ul style={{ margin: '11px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
                {(p.perks || []).map((x) => {
                  const off = x.indexOf('프로부터') >= 0;
                  return (
                    <li key={x} style={{
                      display: 'flex', gap: 7, alignItems: 'flex-start',
                      fontSize: 13, color: off ? 'var(--ink-3)' : 'var(--ink-2)', wordBreak: 'keep-all',
                    }}>
                      <Icon name={off ? 'lock' : 'check'} size={13} stroke={2.4} style={{ marginTop: 3, flex: 'none' }} /> {x}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {costs.length > 0 && (
          <div style={{ ...box(false), marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>크레딧은 이럴 때 써요</div>
            {costs.map((c) => (
              <div key={c.action} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, color: 'var(--ink-2)', padding: '4px 0' }}>
                <span style={{ minWidth: 0, wordBreak: 'keep-all' }}>{c.label}</span>
                <span className="tnum" style={{ flex: 'none', fontWeight: 700 }}>{c.credits}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-3)' }}>
옷장·검색·바로 보기는 크레딧이 안 들어요.
            </div>
          </div>
        )}

        <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>
결제는 준비 중이에요.
        </p>
        <Btn full variant="soft" onClick={onClose} style={{ marginTop: 14 }}>닫기</Btn>
        {/* 마지막 요소가 화면 바닥에 붙지 않게 — 손가락이 닿는 자리이기도 하다 */}
        <div style={{ height: 28 }} />
      </div>
    </BottomSheet>
  );
}

function UsageCard({ billing, onOpenPlans, compact }) {
  if (!billing) {
    return (
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 16, height: '100%', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 14.5, fontWeight: 800 }}>사용량</div>
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-3)' }}>불러오는 중…</div>
      </div>
    );
  }
  const { planName, remaining, granted, used, resetsAt, byAction = [] } = billing;
  const reset = resetsAt ? new Date(resetsAt) : null;
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: compact ? 16 : 18, height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14.5, fontWeight: 800 }}>사용량</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', background: 'var(--ivory)', padding: '3px 9px', borderRadius: 999 }}>
          {planName}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onOpenPlans} style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', padding: '4px 2px' }}>
          요금제 보기
        </button>
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="tnum" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{remaining}</span>
        <span className="tnum" style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>/ {granted} 크레딧</span>
      </div>
      <div style={{ marginTop: 10 }}><CreditBar remaining={remaining} granted={granted} /></div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>
        {reset ? `${reset.getMonth() + 1}월 ${reset.getDate()}일 초기화` : ''}
        {used > 0 ? ` · ${used}개 사용` : ''}
      </div>

      {byAction.length > 0 && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          {byAction.map((a) => (
            <div key={a.action} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12.5 }}>
              <span style={{ flex: 1, minWidth: 0, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.label}
              </span>
              <span className="tnum" style={{ color: 'var(--ink-3)' }}>{a.count}회</span>
              <span className="tnum" style={{ fontWeight: 700, minWidth: 34, textAlign: 'right' }}>-{a.credits}</span>
            </div>
          ))}
        </div>
      )}
      {remaining <= Math.max(3, Math.round(granted * 0.1)) && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: '#B0573C' }}>
          크레딧이 얼마 안 남았어요.
        </div>
      )}
    </div>
  );
}

/* ---- summary chips (값 요약 표시) ---- */
function SummaryChips({ items, empty }) {
  if (!items.length) return <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{empty}</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {items.map((t, i) => (
        <span key={i} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--ivory)', padding: '5px 11px', borderRadius: 'var(--r-pill)' }}>{t}</span>
      ))}
    </div>
  );
}

/* ---- key/value row (개인 정보) ---- */
function InfoRow({ label, value, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 0', borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: value ? 'var(--ink)' : 'var(--ink-3)', textAlign: 'right' }}>{value || '미설정'}</span>
    </div>
  );
}

/* ---- pref block (라벨 + 칩) ---- */
function PrefBlock({ label, children, last }) {
  return (
    <div style={{ padding: '16px 0', borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 9 }}>{label}</div>
      {children}
    </div>
  );
}

/* ---- section card ---- */
function Section({ title, action, children, fill }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: '16px 20px 10px',
      marginBottom: fill ? 0 : 14, height: fill ? '100%' : undefined, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 24, marginBottom: 8 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800 }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function EditLink({ onClick }) {
  return (
    <button onClick={onClick} className="lb-btn" style={{ background: 'transparent', color: 'var(--ink)', fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 2px' }}>
      <Icon name="pencil" size={14} /> 수정
    </button>
  );
}

function readAvatarFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('사진을 읽지 못했어요'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('사진을 열지 못했어요'));
      img.onload = () => {
        const max = 512;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function ProfileAvatar({ src, size = 60, onChange, onInvalid }) {
  const inputRef = React.useRef(null);
  const [checking, setChecking] = useMp(false);
  const onPick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !onChange) return;
    setChecking(true);
    try {
      const dataUrl = await readAvatarFile(file);
      const faces = window.countFacesInImage
        ? await window.countFacesInImage(dataUrl)
        : -1;
      const message = window.faceCountError
        ? window.faceCountError(faces)
        : (faces === 1 ? '' : '얼굴을 확인하지 못했어요. 잠시 후 다시 시도해주세요.');
      if (message) {
        if (onInvalid) onInvalid(message);
        return;
      }
      onChange(dataUrl);
    } catch (err) {
      if (onInvalid) onInvalid(err.message || '사진을 확인하지 못했어요.');
    } finally {
      setChecking(false);
    }
  };
  return (
    <button
      type="button"
      onClick={() => inputRef.current && inputRef.current.click()}
      disabled={checking}
      aria-label="프로필 사진 변경"
      style={{
        position: 'relative', width: size, height: size, borderRadius: '50%', flex: 'none',
        padding: 0, overflow: 'hidden', cursor: 'pointer',
        background: src ? 'transparent' : 'var(--ivory)', color: 'var(--ink-2)',
        display: 'grid', placeItems: 'center',
        boxShadow: 'inset 0 0 0 1px var(--line)',
      }}
    >
      <input ref={inputRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
      {src
        ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <Icon name={checking ? 'sparkle' : 'user'} size={Math.round(size * 0.47)} stroke={1.6} />}
      <span style={{
        position: 'absolute', right: 2, bottom: 2, width: Math.max(22, Math.round(size * 0.34)), height: Math.max(22, Math.round(size * 0.34)),
        borderRadius: '50%', display: 'grid', placeItems: 'center',
        background: 'color-mix(in srgb, var(--ink) 78%, transparent)', color: '#fff',
        boxShadow: '0 0 0 2px var(--surface)',
      }}>
        <Icon name="camera" size={Math.max(11, Math.round(size * 0.17))} stroke={2} />
      </span>
    </button>
  );
}

function ModelLookAvatarSheet({ open, onClose, onSelect, src }) {
  const [error, setError] = useMp('');
  useMe(() => { if (open) setError(''); }, [open]);
  const hasPhoto = !!src;
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '6px 24px 26px', textAlign: 'center' }}>
        <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3 }}>AI 착장에 사용할 사진</div>
        <p style={{
          margin: '9px auto 20px', maxWidth: 300, fontSize: 13.5,
          color: 'var(--ink-2)', lineHeight: 1.55, wordBreak: 'keep-all',
        }}>
          프로필 사진 얼굴로 코디를 입은 모습을 만들어요.<br />
          단, 일반 추천보다 생성에 시간·비용이 더 들어요.
        </p>
        {error && (
          <div style={{
            margin: '-8px auto 16px', maxWidth: 300, padding: '9px 12px',
            borderRadius: 'var(--r-sm)', background: 'color-mix(in srgb, #B0573C 10%, transparent)',
            color: '#9D472F', fontSize: 12, lineHeight: 1.45, fontWeight: 600,
          }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ProfileAvatar
            src={src}
            size={96}
            onInvalid={setError}
            onChange={(dataUrl) => { setError(''); onSelect(dataUrl); }}
          />
        </div>
        <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700 }}>{hasPhoto ? '사진을 눌러 변경' : '사진을 눌러 등록'}</div>
        <p style={{
          margin: '7px auto 0', maxWidth: 300, fontSize: 11.5,
          color: 'var(--ink-3)', lineHeight: 1.5, wordBreak: 'keep-all',
        }}>
          등록한 사진은 마이페이지 프로필에도 동일하게 표시돼요.
        </p>
        {hasPhoto && (
          <Btn full size="lg" onClick={() => onSelect(src)} style={{ width: '100%', marginTop: 22 }}>이 사진으로 보기</Btn>
        )}
        <Btn variant="soft" onClick={onClose} style={{ width: '100%', marginTop: hasPhoto ? 10 : 22 }}>취소</Btn>
      </div>
    </BottomSheet>
  );
}

/* ---- action row ---- */
// hint — 켜기 전에 알아야 할 게 있는 항목(비용·조건)에만 한 줄 덧붙인다.
function ActionRow({ icon, label, onClick, danger, last, right, hint }) {
  // 스위치는 자체 버튼이므로 바깥을 또 button으로 감싸지 않는다.
  const Row = right ? 'div' : 'button';
  return (
    <Row onClick={right ? undefined : onClick} className="lb-navitem" style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
      padding: '13px 12px', borderRadius: 'var(--r-md)', background: 'transparent',
      color: danger ? '#B0573C' : 'var(--ink)', fontSize: 14, fontWeight: 600,
    }}>
      <Icon name={icon} size={19} stroke={1.8} style={{ flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        {label}
        {hint && <span style={{ display: 'block', marginTop: 3, fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', lineHeight: 1.45 }}>{hint}</span>}
      </span>
      {right || (!danger && <Icon name="chevR" size={18} stroke={1.8} style={{ color: 'var(--ink-3)' }} />)}
    </Row>
  );
}

/* ---- 숫자 설정(−/+) — 스위치와 같은 자리에 들어가는 작은 컨트롤 ---- */
function Stepper({ value, min, max, onChange, unit = '개' }) {
  const btn = (label, delta, disabled) => (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(value + delta); }}
      style={{
        width: 26, height: 26, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center',
        background: 'var(--ivory)', color: disabled ? 'var(--ink-3)' : 'var(--ink)',
        boxShadow: 'inset 0 0 0 1px var(--line-2)', opacity: disabled ? 0.5 : 1,
        fontSize: 15, fontWeight: 700, lineHeight: 1,
      }}
    >
      {delta < 0 ? '−' : '+'}
    </button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
      {btn('줄이기', -1, value <= min)}
      <span className="tnum" style={{ minWidth: 34, textAlign: 'center', fontSize: 13.5, fontWeight: 700 }}>
        {value}{unit}
      </span>
      {btn('늘리기', 1, value >= max)}
    </div>
  );
}

/* ---- toggle switch ---- */
function Switch({ on, onToggle }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-pressed={!!on}
      aria-label={on ? '끄기' : '켜기'}
      style={{
        width: 42, height: 25, borderRadius: 999, flex: 'none', position: 'relative',
        background: on ? 'var(--accent)' : 'var(--line-2)', transition: 'background var(--dur) var(--ease)',
      }}
    >
      <span style={{ position: 'absolute', top: 3, left: on ? 20 : 3, width: 19, height: 19, borderRadius: '50%', background: '#fff', transition: 'left var(--dur) var(--ease)', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
    </button>
  );
}

/* ============================================================
   MyPage
   ============================================================ */
function MyPageScreen({ ctx }) {
  const {
    prefs, wide, openPrefs, openAccount, setAvatar, logout, dailyEnabled, setDailyEnabled,
    modelLook, setModelLook, showToast, openTryOnTab, makeTryOnBody, tryOnMaking,
    dailyCount, wishCount, setDailyCount, setWishCount,
    billing,
  } = ctx;
  const [planSheet, setPlanSheet] = useMp(false);
  const [notif, setNotif] = useMp(true);
  const [confirmDel, setConfirmDel] = useMp(false);
  const [confirmOut, setConfirmOut] = useMp(false);
  const [modelPhoto, setModelPhoto] = useMp(false);

  const styleNames = (prefs.styles || []).map((id) => (LB_DATA.STYLES.find((s) => s.id === id) || {}).name).filter(Boolean);
  const pc = LB_DATA.PERSONAL_COLORS.find((p) => p.id === prefs.personalColor);
  const paletteNames = (prefs.palettes || []).map((id) => (LB_DATA.PALETTE.find((p) => p.id === id) || {}).name).filter(Boolean);
  const metaBits = [prefs.gender, prefs.age].filter(Boolean);

  const personalBody = (
    <>
      <InfoRow label="이메일" value={prefs.email} />
      <InfoRow label="비밀번호" value={prefs.email ? '••••••••' : ''} />
      <InfoRow label="성별" value={prefs.gender} />
      <InfoRow label="연령대" value={prefs.age} last={!(prefs.height || prefs.weight)} />
      {(prefs.height || prefs.weight) && (
        <InfoRow
          label="키 · 몸무게"
          value={[prefs.height && `${prefs.height}cm`, prefs.weight && `${prefs.weight}kg`].filter(Boolean).join(' · ')}
          last
        />
      )}
    </>
  );

  const styleBody = (
    <>
      <PrefBlock label="선호 스타일"><SummaryChips items={styleNames} empty="미설정" /></PrefBlock>
      <PrefBlock label="선호 핏"><SummaryChips items={prefs.fit ? [prefs.fit] : []} empty="미설정" /></PrefBlock>
      <PrefBlock label="퍼스널 컬러">
        {pc ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ display: 'flex', width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', flex: 'none', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}>
              {pc.swatch.map((c, i) => <span key={i} style={{ flex: 1, background: c }} />)}
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{pc.name}</span>
          </div>
        ) : <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>미설정</span>}
      </PrefBlock>
      <PrefBlock label="선호 컬러 팔레트" last><SummaryChips items={paletteNames} empty="미설정" /></PrefBlock>
    </>
  );

  const toggleModelLook = () => {
    if (modelLook) { setModelLook && setModelLook(false); return; }
    setModelPhoto(true);
  };

  // 켤 때는 항상 사진 확인 시트를 연다. 프로필에 얼굴이 있으면 그대로 보여주고, 없으면 빈 상태로 등록을 받는다.
  const modelLookRow = (
    <ActionRow
      icon="user"
      label="AI 캐릭터 착장 이미지로 보기"
      right={<Switch on={!!modelLook} onToggle={toggleModelLook} />}
    />
  );

  // 전신 사진을 직접 올리지 않아도 되게, 프로필 사진으로 만들어 준다(퍼스널 컬러와 같은 방식).
  const hasTryOn = !!(prefs.tryOnFrame);
  const tryOnRow = (
    <ActionRow
      icon="cutout"
      label="바로 보기 전신 이미지"
      hint={tryOnMaking ? '만드는 중…' : (hasTryOn ? '등록됨 · 다시 만들기' : '프로필 사진으로 만들어요')}
      onClick={() => {
        if (tryOnMaking) return;
        if (prefs.avatar && makeTryOnBody) makeTryOnBody();
        else if (openTryOnTab) openTryOnTab();
      }}
    />
  );

  // 개수 설정은 추천을 켰을 때만 의미가 있다. 설명은 한 줄을 넘기지 않게 짧게.
  const countRows = dailyEnabled ? (
    <>
      <ActionRow
        icon="sparkle"
        label="한 번에 받을 코디 수"
        right={<Stepper value={dailyCount} min={2} max={8} onChange={(n) => setDailyCount && setDailyCount(n)} />}
      />
      <ActionRow
        icon="plus"
        label="새 아이템 포함 코디"
        hint="옷장에 없는 아이템 제안"
        right={<Stepper value={wishCount} min={0} max={3} onChange={(n) => setWishCount && setWishCount(n)} />}
      />
    </>
  ) : null;

  const settingsCard = (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 6, height: '100%', boxSizing: 'border-box' }}>
      <div style={{ padding: '10px 12px 4px', fontSize: 14.5, fontWeight: 800 }}>설정</div>
      <ActionRow
        icon="sparkle"
        label="오늘의 추천 코디"
        right={<Switch on={!!dailyEnabled} onToggle={() => setDailyEnabled && setDailyEnabled(!dailyEnabled)} />}
      />
      {countRows}
      {modelLookRow}
      {tryOnRow}
      <ActionRow icon="bell" label="추천·코디 알림" right={<Switch on={notif} onToggle={() => setNotif((v) => !v)} />} />
    </div>
  );

  const accountCard = (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 6, height: '100%', boxSizing: 'border-box' }}>
      <div style={{ padding: '10px 12px 4px', fontSize: 14.5, fontWeight: 800 }}>계정 및 지원</div>
      <ActionRow icon="help" label="고객센터" onClick={() => {}} />
      <ActionRow icon="shield" label="약관 및 개인정보 처리방침" onClick={() => {}} />
      <ActionRow icon="logout" label="로그아웃" onClick={() => setConfirmOut(true)} />
      <ActionRow icon="trash" label="회원탈퇴" danger onClick={() => setConfirmDel(true)} />
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-3)', padding: '8px 0 4px' }}>
        v1.0.0 · {BUILD_ID}
      </div>
    </div>
  );

  const usageCard = <UsageCard billing={billing} onOpenPlans={() => setPlanSheet(true)} />;

  const sheets = (
    <>
      <PlanSheet open={planSheet} onClose={() => setPlanSheet(false)} billing={billing} />
      <DeleteAccountSheet open={confirmDel} email={prefs.email} onClose={() => setConfirmDel(false)} onConfirm={() => { setConfirmDel(false); logout(); }} />
      <LogoutSheet open={confirmOut} email={prefs.email} onClose={() => setConfirmOut(false)} onConfirm={() => { setConfirmOut(false); logout(); }} />
      <ModelLookAvatarSheet
        open={modelPhoto}
        src={prefs.avatar}
        onClose={() => setModelPhoto(false)}
        onSelect={(dataUrl) => {
          if (setModelLook) setModelLook(true, dataUrl);
          setModelPhoto(false);
        }}
      />
    </>
  );

  /* PC: 옷장과 같은 타이틀 프레임 + 풀폭 대시보드 */
  if (wide) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="lb-scrollable" style={{ flex: 1,  padding: '28px 0 36px' }}>
          <div className="lb-wide-inner">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--gap-header)' }}>
              <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800 }}>마이페이지</h1>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 18,
              padding: '20px 22px', marginBottom: 16,
              background: 'var(--surface)', borderRadius: 'var(--r-lg)',
            }}>
              <ProfileAvatar src={prefs.avatar} size={64} onChange={setAvatar} onInvalid={(msg) => showToast(msg, 'camera')} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {prefs.email || '게스트'}
                </div>
                <div style={{ marginTop: 5, fontSize: 13, color: 'var(--ink-3)', fontWeight: 500 }}>
                  {metaBits.length ? metaBits.join(' · ') : '계정 정보를 완성해 주세요'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, alignItems: 'stretch', marginBottom: 14 }}>
              <Section title="개인 정보" action={<EditLink onClick={openAccount} />} fill>{personalBody}</Section>
              <Section title="내 스타일" action={<EditLink onClick={openPrefs} />} fill>{styleBody}</Section>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, alignItems: 'stretch', marginBottom: 14 }}>
              {usageCard}
              {settingsCard}
            </div>

            <div style={{ marginBottom: 18 }}>{accountCard}</div>

            <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ink-3)', paddingBottom: 8 }}>
          LOOKBOX v1.0.0 <span style={{ opacity: 0.7 }}>· {BUILD_ID}</span>
        </div>
            {sheets}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="lb-scrollable" style={{
        flex: 1, 
        padding: 'calc(env(safe-area-inset-top, 0px) + 22px) 18px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '4px 4px var(--gap-header)' }}>
          <ProfileAvatar src={prefs.avatar} size={60} onChange={setAvatar} onInvalid={(msg) => showToast(msg, 'camera')} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prefs.email || '게스트'}</div>
          </div>
        </div>
        <Section title="개인 정보" action={<EditLink onClick={openAccount} />}>{personalBody}</Section>
        <Section title="내 스타일" action={<EditLink onClick={openPrefs} />}>{styleBody}</Section>
        <div style={{ marginBottom: 14 }}>{usageCard}</div>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 6, marginBottom: 14 }}>
          <ActionRow
            icon="sparkle"
            label="오늘의 추천 코디"
            right={<Switch on={!!dailyEnabled} onToggle={() => setDailyEnabled && setDailyEnabled(!dailyEnabled)} />}
          />
          {countRows}
          {modelLookRow}
          {tryOnRow}
          <ActionRow icon="bell" label="추천·코디 알림" right={<Switch on={notif} onToggle={() => setNotif((v) => !v)} />} />
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 6, marginBottom: 20 }}>
          <ActionRow icon="help" label="고객센터" onClick={() => {}} />
          <ActionRow icon="shield" label="약관 및 개인정보 처리방침" onClick={() => {}} />
          <ActionRow icon="logout" label="로그아웃" onClick={() => setConfirmOut(true)} />
          <ActionRow icon="trash" label="회원탈퇴" danger onClick={() => setConfirmDel(true)} />
        </div>
        {sheets}
        <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ink-3)', paddingBottom: 8 }}>LOOKBOX v1.0.0</div>
      </div>
    </div>
  );
}

/* ============================================================
   LogoutSheet — 로그아웃 확인 (되돌릴 수 있는 일반 동작)
   ============================================================ */
function LogoutSheet({ open, email, onClose, onConfirm }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '6px 24px 26px' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--ivory)', color: 'var(--ink-2)', marginBottom: 'var(--s4)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
          <Icon name="logout" size={23} stroke={1.8} />
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3 }}>로그아웃 할까요?</div>
        <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
          옷장과 룩북은 그대로 보관돼요. 다시 로그인하면 이어서 쓸 수 있어요.
        </p>

        {email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'var(--s5)', padding: 'var(--s3) var(--s4)', background: 'var(--ivory)', borderRadius: 'var(--r-md)' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flex: 'none', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
              <Icon name="user" size={18} stroke={1.7} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>현재 계정</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 'var(--s6)' }}>
          <Btn variant="soft" onClick={onClose} style={{ flex: 1 }}>취소</Btn>
          <Btn icon="logout" onClick={onConfirm} style={{ flex: 1 }}>로그아웃</Btn>
        </div>
      </div>
    </BottomSheet>
  );
}

/* ============================================================
   DeleteAccountSheet — 회원탈퇴 확인 (파괴적 동작 · 되돌릴 수 없음)
   ============================================================ */
function DeleteAccountSheet({ open, email, onClose, onConfirm }) {
  const DANGER = '#B0573C';
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '6px 24px 26px' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, ' + DANGER + ' 12%, transparent)', color: DANGER, marginBottom: 'var(--s4)' }}>
          <Icon name="trash" size={24} stroke={1.8} />
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3 }}>정말 탈퇴하시겠어요?</div>
        <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
          탈퇴하면 옷장에 담은 옷, 저장한 룩북, 선호 정보가 모두 삭제되며 <b style={{ color: 'var(--ink)', fontWeight: 700 }}>되돌릴 수 없어요.</b>
        </p>

        {email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'var(--s5)', padding: 'var(--s3) var(--s4)', background: 'var(--ivory)', borderRadius: 'var(--r-md)' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flex: 'none', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
              <Icon name="user" size={18} stroke={1.7} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>탈퇴할 계정</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 'var(--s6)' }}>
          <Btn variant="soft" onClick={onClose} style={{ flex: 1 }}>취소</Btn>
          <Btn icon="trash" onClick={onConfirm} style={{ flex: 1, background: DANGER, color: '#fff' }}>탈퇴하기</Btn>
        </div>
      </div>
    </BottomSheet>
  );
}

/* ============================================================
   AccountEditSheet — 개인 정보(계정) 수정
   ============================================================ */
function AccountChips({ options, value, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => <Chip key={o} active={value === o} onClick={() => onPick(o)}>{o}</Chip>)}
    </div>
  );
}

function AccountEditSheet({ open, prefs, onClose, onSave }) {
  const [d, setD] = useMp({ email: '', pw: '', pw2: '', gender: '', age: '', height: '', weight: '' });
  useMe(() => {
    if (open) setD({
      email: prefs.email || '', pw: '', pw2: '', gender: prefs.gender || '', age: prefs.age || '',
      height: prefs.height || '', weight: prefs.weight || '',
    });
  }, [open]);
  const set = (k) => (v) => setD((s) => ({ ...s, [k]: v }));
  const emailOk = /\S+@\S+\.\S+/.test(d.email);
  const pwOk = !d.pw || (d.pw.length >= 6 && d.pw === d.pw2);
  const pwMismatch = d.pw2 && d.pw !== d.pw2;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '8px 24px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>개인 정보 수정</div>
          <button onClick={onClose} aria-label="닫기" className="lb-iconbtn" style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', marginRight: -8 }}><Icon name="x" size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <LabeledField label="이메일" value={d.email} onChange={set('email')} placeholder="you@example.com" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>새 비밀번호</div>
            <input className="lb-input" type="password" value={d.pw} placeholder="변경 시에만 입력 (6자 이상)" onChange={(e) => set('pw')(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--r-md)', fontSize: 14, background: 'var(--ivory)', border: '1px solid var(--line)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {d.pw && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>새 비밀번호 확인</div>
              <input className="lb-input" type="password" value={d.pw2} placeholder="한 번 더 입력" onChange={(e) => set('pw2')(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--r-md)', fontSize: 14, background: 'var(--ivory)', border: '1px solid ' + (pwMismatch ? '#B0573C' : 'var(--line)'), color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }} />
              {pwMismatch && <div style={{ fontSize: 11.5, color: '#B0573C', marginTop: 6 }}>비밀번호가 일치하지 않아요.</div>}
            </div>
          )}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 9 }}>성별</div>
            <AccountChips options={['여성', '남성', '선택 안 함']} value={d.gender} onPick={set('gender')} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 9 }}>연령대</div>
            <AccountChips options={LB_DATA.AGES} value={d.age} onPick={set('age')} />
          </div>
          {/* 체형은 넣으면 코디 그림이 실제 몸에 가까워지지만, 굳이 밝히고 싶지 않을 수 있다.
              선택 입력으로 두고 비워도 아무 일도 없다는 걸 문구로 분명히 한다. */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 9 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>키 · 몸무게</span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>선택 · 비워둬도 돼요</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['height', 'cm', 100, 230], ['weight', 'kg', 25, 200]].map(([key, unit, lo, hi]) => (
                <div key={key} style={{ flex: 1, position: 'relative' }}>
                  <input
                    className="lb-input"
                    inputMode="numeric"
                    value={d[key]}
                    placeholder={unit === 'cm' ? '키' : '몸무게'}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                      set(key)(v && (Number(v) < lo || Number(v) > hi) && v.length >= 3 ? d[key] : v);
                    }}
                    style={{
                      width: '100%', padding: '12px 34px 12px 14px', borderRadius: 'var(--r-md)', fontSize: 14,
                      background: 'var(--ivory)', border: '1px solid var(--line)', color: 'var(--ink)',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 12.5, color: 'var(--ink-3)' }}>{unit}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 7, fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>
              넣으면 코디를 내 체형에 가깝게 그려요.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 26 }}>
          <Btn full size="lg" icon="check" disabled={!emailOk || !pwOk} onClick={() => onSave({ email: d.email, gender: d.gender, age: d.age, height: d.height, weight: d.weight })}>저장</Btn>
        </div>
      </div>
    </BottomSheet>
  );
}

Object.assign(window, { MyPageScreen, AccountEditSheet, DeleteAccountSheet });
