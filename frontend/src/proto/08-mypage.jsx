/* @prototype-ported */
const React = window.React;
const { BottomSheet, Btn, Chip, Icon, LB_DATA, LabeledField, PALETTE, PERSONAL_COLORS, STYLES } = window;

/* global React, Btn, Icon, Chip, BottomSheet, LabeledField, LB_DATA */
// LOOKBOX — 마이페이지: 개인 정보(계정) + 내 스타일(취향) 허브. 실서비스 IA 기준.

const { useState: useMp, useEffect: useMe } = React;

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

function ProfileAvatar({ src, size = 60, onChange }) {
  const inputRef = React.useRef(null);
  const onPick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !onChange) return;
    try {
      const dataUrl = await readAvatarFile(file);
      onChange(dataUrl);
    } catch (err) {
      /* noop — toast는 상위 setAvatar에서 */
    }
  };
  return (
    <button
      type="button"
      onClick={() => inputRef.current && inputRef.current.click()}
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
        : <Icon name="user" size={Math.round(size * 0.47)} stroke={1.6} />}
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

/* ---- action row ---- */
function ActionRow({ icon, label, onClick, danger, last, right }) {
  return (
    <button onClick={onClick} className="lb-navitem" style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
      padding: '13px 12px', borderRadius: 'var(--r-md)', background: 'transparent',
      color: danger ? '#B0573C' : 'var(--ink)', fontSize: 14, fontWeight: 600,
    }}>
      <Icon name={icon} size={19} stroke={1.8} />
      <span style={{ flex: 1 }}>{label}</span>
      {right || (!danger && <Icon name="chevR" size={18} stroke={1.8} style={{ color: 'var(--ink-3)' }} />)}
    </button>
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
  const { prefs, wide, openPrefs, openAccount, setAvatar, logout, dailyEnabled, setDailyEnabled } = ctx;
  const [notif, setNotif] = useMp(true);
  const [confirmDel, setConfirmDel] = useMp(false);
  const [confirmOut, setConfirmOut] = useMp(false);

  const styleNames = (prefs.styles || []).map((id) => (LB_DATA.STYLES.find((s) => s.id === id) || {}).name).filter(Boolean);
  const pc = LB_DATA.PERSONAL_COLORS.find((p) => p.id === prefs.personalColor);
  const paletteNames = (prefs.palettes || []).map((id) => (LB_DATA.PALETTE.find((p) => p.id === id) || {}).name).filter(Boolean);
  const metaBits = [prefs.gender, prefs.age].filter(Boolean);

  const personalBody = (
    <>
      <InfoRow label="이메일" value={prefs.email} />
      <InfoRow label="비밀번호" value={prefs.email ? '••••••••' : ''} />
      <InfoRow label="성별" value={prefs.gender} />
      <InfoRow label="연령대" value={prefs.age} last />
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

  const settingsCard = (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 6, height: '100%', boxSizing: 'border-box' }}>
      <div style={{ padding: '10px 12px 4px', fontSize: 14.5, fontWeight: 800 }}>설정</div>
      <ActionRow
        icon="sparkle"
        label="오늘의 추천 코디"
        right={<Switch on={!!dailyEnabled} onToggle={() => setDailyEnabled && setDailyEnabled(!dailyEnabled)} />}
      />
      <ActionRow icon="bell" label="추천·코디 알림" right={<Switch on={notif} onToggle={() => setNotif((v) => !v)} />} />
      <ActionRow icon="help" label="고객센터" onClick={() => {}} />
      <ActionRow icon="shield" label="약관 및 개인정보 처리방침" onClick={() => {}} />
    </div>
  );

  const accountCard = (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 6, height: '100%', boxSizing: 'border-box' }}>
      <div style={{ padding: '10px 12px 4px', fontSize: 14.5, fontWeight: 800 }}>계정</div>
      <ActionRow icon="logout" label="로그아웃" onClick={() => setConfirmOut(true)} />
      <ActionRow icon="trash" label="회원탈퇴" danger onClick={() => setConfirmDel(true)} />
    </div>
  );

  const sheets = (
    <>
      <DeleteAccountSheet open={confirmDel} email={prefs.email} onClose={() => setConfirmDel(false)} onConfirm={() => { setConfirmDel(false); logout(); }} />
      <LogoutSheet open={confirmOut} email={prefs.email} onClose={() => setConfirmOut(false)} onConfirm={() => { setConfirmOut(false); logout(); }} />
    </>
  );

  /* PC: 옷장과 같은 타이틀 프레임 + 풀폭 대시보드 */
  if (wide) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 0 36px' }}>
          <div className="lb-wide-inner">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22 }}>
              <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800 }}>마이페이지</h1>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 18,
              padding: '20px 22px', marginBottom: 16,
              background: 'var(--surface)', borderRadius: 'var(--r-lg)',
            }}>
              <ProfileAvatar src={prefs.avatar} size={64} onChange={setAvatar} />
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, alignItems: 'stretch', marginBottom: 18 }}>
              {settingsCard}
              {accountCard}
            </div>

            <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ink-3)', paddingBottom: 8 }}>LOOKBOX v1.0.0</div>
            {sheets}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: 'calc(env(safe-area-inset-top, 0px) + 22px) 18px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '4px 4px 22px' }}>
          <ProfileAvatar src={prefs.avatar} size={60} onChange={setAvatar} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prefs.email || '게스트'}</div>
          </div>
        </div>
        <Section title="개인 정보" action={<EditLink onClick={openAccount} />}>{personalBody}</Section>
        <Section title="내 스타일" action={<EditLink onClick={openPrefs} />}>{styleBody}</Section>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 6, marginBottom: 14 }}>
          <ActionRow
            icon="sparkle"
            label="오늘의 추천 코디"
            right={<Switch on={!!dailyEnabled} onToggle={() => setDailyEnabled && setDailyEnabled(!dailyEnabled)} />}
          />
          <ActionRow icon="bell" label="추천·코디 알림" right={<Switch on={notif} onToggle={() => setNotif((v) => !v)} />} />
          <ActionRow icon="help" label="고객센터" onClick={() => {}} />
          <ActionRow icon="shield" label="약관 및 개인정보 처리방침" onClick={() => {}} />
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 6, marginBottom: 20 }}>
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
  const [d, setD] = useMp({ email: '', pw: '', pw2: '', gender: '', age: '' });
  useMe(() => { if (open) setD({ email: prefs.email || '', pw: '', pw2: '', gender: prefs.gender || '', age: prefs.age || '' }); }, [open]);
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
            <AccountChips options={['10대', '20대', '30대', '40대 이상']} value={d.age} onPick={set('age')} />
          </div>
        </div>

        <div style={{ marginTop: 26 }}>
          <Btn full size="lg" icon="check" disabled={!emailOk || !pwOk} onClick={() => onSave({ email: d.email, gender: d.gender, age: d.age })}>저장</Btn>
        </div>
      </div>
    </BottomSheet>
  );
}

Object.assign(window, { MyPageScreen, AccountEditSheet, DeleteAccountSheet });
