/* @prototype-ported */
const React = window.React;
const { Btn, Chip, Eyebrow, Icon, LB_DATA, LabeledField, PALETTE, PERSONAL_COLORS, useEscapeClose, WARDROBE, Wordmark } = window;

/* global React, Btn, Chip, Icon, Wordmark, Eyebrow, LabeledField, Thumb, LB_DATA */
// LOOKBOX — 회원가입 / 선호 정보 온보딩. 단계별(step) 흐름.
// 가입 시 선호 정보(스타일·핏·컬러)를 필수로 받고, 이후 '내 스타일'에서 수정 가능.

const { useState } = React;

// ── 얼굴 감지 (퍼스널 컬러 진단 전 유효성) ──────────────────────────
// MediaPipe FaceDetector를 지연 로드(진단 시점에만) → 초기 번들 영향 없음.
// 얼굴이 없거나 불명확하면 진단을 막고 다시 올리도록 유도한다.
let _faceDetectorPromise = null;
function getFaceDetector() {
  if (!_faceDetectorPromise) {
    _faceDetectorPromise = (async () => {
      const V = '0.10.35';
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${V}/wasm`);
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite' },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      });
    })().catch((e) => { _faceDetectorPromise = null; throw e; });
  }
  return _faceDetectorPromise;
}

// dataURL 이미지에서 감지된 얼굴 수. 디코드/모델 로드 실패 시 -1(판정 불가 → 차단 안 함).
async function countFacesInImage(dataURL) {
  try {
    const img = new Image();
    img.src = dataURL;
    await (img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; }));
    const detector = await getFaceDetector();
    const result = detector.detect(img);
    return (result && result.detections ? result.detections.length : 0);
  } catch (e) {
    return -1;
  }
}

// 퍼스널 컬러별 진단 결과 상세 — 추천 컬러 팔레트 + 한 줄 설명 + 키워드.
const PC_DETAIL = {
  spring: { tone: '봄 웜 · 라이트', desc: '맑고 화사한 따뜻한 색이 얼굴을 밝혀줘요.',
    best: ['#FF8C69', '#FFD25A', '#9DCB6A', '#FF9EB5', '#FFE3B3'],
    avoid: ['#3A3A3A', '#5B6B7B'], keywords: ['생기있는', '화사한', '따뜻한'] },
  summer: { tone: '여름 쿨 · 뮤트', desc: '부드럽고 시원한 파스텔 톤이 잘 어울려요.',
    best: ['#C9A2C8', '#E8A0B0', '#A8C4DE', '#B9C7E2', '#E7D3E4'],
    avoid: ['#C18A3D', '#7B5A2A'], keywords: ['부드러운', '시원한', '우아한'] },
  autumn: { tone: '가을 웜 · 딥', desc: '깊고 차분한 어스 톤이 분위기를 살려줘요.',
    best: ['#C18A3D', '#A8503A', '#7B7A3A', '#9C6B3F', '#D8B27E'],
    avoid: ['#3FA7C9', '#C0246B'], keywords: ['차분한', '고급스러운', '따뜻한'] },
  winter: { tone: '겨울 쿨 · 비비드', desc: '선명하고 대비가 강한 색이 또렷하게 빛나요.',
    best: ['#C0246B', '#1F2A57', '#3FA7C9', '#0E0E12', '#E7E9EF'],
    avoid: ['#D8B27E', '#9DCB6A'], keywords: ['선명한', '도시적인', '시크한'] },
};


/* ----------------------------------------------------------------
   Landing — 첫 진입(홈) 화면. '시작하기'를 누르면 회원가입 단계로 진입.
---------------------------------------------------------------- */
// 한국어 본문은 기본값(break-word)이면 어절 중간에서 잘려 어색하다.
// keep-all + balance/pretty = '띄어쓰기 단위 + 줄 길이 균등' 자동 줄바꿈.
const KEEP = { wordBreak: 'keep-all' };

// 랜딩 히어로 — 어드민 계정 옷장에서 가져온 실제 누끼 리소스로 구성한 코디 3벌.
// '사고 싶은 옷'(앵커)은 고정, 내 옷장 아이템만 바뀐다. 겹침 합성 대신
// 각 옷이 잘리지 않고 온전히 보이는 그리드 타일 — 결과물이 깔끔해야 신뢰를 준다.
const HERO_ANCHOR = { id: 'hero-anchor', name: '수피마 코튼 셔츠', key: 'lookAnchorShirt' };
const HERO_LOOKS = [
  { id: 'l1', label: '주말 데님 캐주얼', items: [
    { id: 'l1a', name: '스트레이트 데님', key: 'lookDenimBlue' },
    { id: 'l1b', name: '아디다스 삼바', key: 'lookSamba' },
    { id: 'l1c', name: '브라운 숄더백', key: 'lookBagBrown' },
  ] },
  { id: 'l2', label: '차분한 시티 미니멀', items: [
    { id: 'l2a', name: '와이드 데님', key: 'lookDenimWide' },
    { id: 'l2b', name: '뉴발란스 993', key: 'lookNb993' },
    { id: 'l2c', name: '블랙 선글라스', key: 'lookSunglasses' },
  ] },
  { id: 'l3', label: '쌀쌀한 날 레이어드', items: [
    { id: 'l3a', name: '블랙 가디건', key: 'lookCardigan' },
    { id: 'l3b', name: '블랙 와이드 데님', key: 'lookDenimBlack' },
    { id: 'l3c', name: '스웨이드 부츠', key: 'lookBoots' },
  ] },
];

// 코디 타일 — 옷 하나가 한 칸을 온전히 차지한다 (objectFit:contain, 잘림 없음).
// 앵커는 링 + 강조 칩, 옷장 아이템은 중립 칩으로 '새 옷 1 + 내 옷 3' 구조를 즉시 읽힌다.
function HeroTile({ img, name, anchor, swap }) {
  return (
    <div className={swap ? 'lb-fade-swap' : undefined} style={{
      position: 'relative', aspectRatio: '1 / 1', borderRadius: 'var(--r-md)',
      background: 'var(--thumb-bg, var(--ivory))', overflow: 'hidden',
      boxShadow: anchor ? 'inset 0 0 0 2px var(--accent)' : 'inset 0 0 0 1px var(--line)',
    }}>
      <img src={img} alt={name} loading="eager" decoding="async" style={{
        position: 'absolute', inset: '5%', width: '90%', height: '90%', objectFit: 'contain',
        filter: 'drop-shadow(0 6px 8px rgba(40,33,20,0.08))',
      }} />
      <span style={{
        position: 'absolute', top: 6, left: 6, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.01em',
        padding: '2px 7px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap',
        background: anchor ? 'var(--accent)' : 'rgba(255,255,255,0.85)',
        color: anchor ? 'var(--accent-ink)' : 'var(--ink-2)',
        boxShadow: anchor ? 'none' : 'inset 0 0 0 1px var(--line)',
      }}>
        {anchor ? '사고 싶은 옷' : '내 옷장'}
      </span>
    </div>
  );
}

// '올리면 → 매칭 → 결정' 3단계 — 그리드(결과물)를 보기 전에 서비스 동작을 한 줄로 심는다.
// 모바일에서도 절대 줄바꿈되지 않도록 짧게 유지한다 (폰트도 뷰포트에 맞춰 줄어듦).
const HERO_STEPS = ['옷 올리기', '내 옷장 매칭', '코디 보고 결정'];

function Landing({ onStart, onLogin }) {
  // 화면 순서는 '질문 → 동작 → 답 → 행동'. 카드는 판정("잘 어울려요")이 아니라
  // 결과물(입을 수 있는 조합)만 보여준다 — 그게 제품의 약속이라서.
  const anchor = { ...HERO_ANCHOR, img: LB_DATA.IMG[HERO_ANCHOR.key] };
  const looks = HERO_LOOKS
    .map((lk) => ({ ...lk, items: lk.items.map((it) => ({ ...it, img: LB_DATA.IMG[it.key] })).filter((it) => it.img) }))
    .filter((lk) => lk.items.length);

  const [idx, setIdx] = useState(0);
  const [manual, setManual] = useState(false);
  const touchX = React.useRef(null);

  // 4초마다 자동 슬라이드. 점 탭·스와이프로 한 번이라도 직접 옮기면 멈춘다.
  // prefers-reduced-motion이면 자동 전환만 끄고, 수동 전환은 그대로 둔다.
  React.useEffect(() => {
    if (manual || looks.length < 2) return undefined;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % looks.length), 4000);
    return () => clearInterval(t);
  }, [manual, looks.length]);

  const goTo = (i) => {
    setManual(true);
    setIdx(((i % looks.length) + looks.length) % looks.length);
  };
  // pointer 이벤트 하나로 터치·마우스 스와이프를 처리 (touch+pointer 이중 발화 방지)
  const onSwipeStart = (e) => { touchX.current = e.clientX; };
  const onSwipeEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 40) return;
    setManual(true);
    setIdx((i) => (i + (dx < 0 ? 1 : -1) + looks.length) % looks.length);
  };

  const look = looks[idx] || looks[0];

  return (
    <div className="lb-app" style={{ alignItems: 'center' }}>
      {/* overflow:hidden — 짧은 모바일에서도 스크롤 없이 한 화면에 맞춤.
          남는 세로가 부족하면 코디 그리드만 비율 유지하며 줄어든다. */}
      <div style={{
        width: '100%', maxWidth: 480, flex: 1, display: 'flex', flexDirection: 'column',
        minHeight: 0, margin: '0 auto', padding: '0 20px', overflow: 'hidden',
      }}>
        <div style={{ flex: 'none', paddingTop: 14 }}><Wordmark size={18} /></div>

        {/* 텍스트는 로고 아래 여유 두고 위쪽, 코디는 아래 빈 공간을 쓰며 내려감.
            가운데 spacer가 둘 사이를 벌려 주고, 짧은 화면에선 그리드만 줄어듦. */}
        <div style={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          // 텍스트만 로고에서 조금 더 아래로 (직전 +10의 절반인 +5 추가 → 27)
          paddingTop: 27, paddingBottom: 4, overflow: 'hidden',
        }}>
          {/* 데스크탑만 .lb-landing-copy로 +10px 하향. 모바일은 그대로, 이미지 y는 spacer가 흡수. */}
          <div className="lb-landing-copy" style={{ flex: 'none' }}>
            <h1 style={{
              margin: '0 0 6px', fontSize: 'clamp(22px, 6.2vw, 28px)', fontWeight: 800,
              lineHeight: 1.25, letterSpacing: '-0.03em', textWrap: 'balance', ...KEEP,
            }}>
              내 옷들이랑 어울릴까?
            </h1>
            <p style={{ margin: 0, fontSize: 'clamp(14px, 3.9vw, 16px)', color: 'var(--ink-2)', lineHeight: 1.45, ...KEEP }}>
              <span style={{ display: 'block' }}>고민 중인 옷을 올리면,</span>
              <span style={{ display: 'block' }}>이미 갖고 있는 옷들로 코디를 만들어 보여드려요.</span>
            </p>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              whiteSpace: 'nowrap', marginTop: 14,
            }}>
              {HERO_STEPS.map((s, n) => (
                <React.Fragment key={s}>
                  {n > 0 && <Icon name="chevR" size={10} style={{ color: 'var(--ink-3)', flex: 'none' }} />}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 'clamp(12px, 3.3vw, 14px)', fontWeight: 600, color: 'var(--ink-2)',
                  }}>
                    <span style={{
                      width: 14, height: 14, borderRadius: '50%', display: 'grid', placeItems: 'center',
                      fontSize: 8.5, fontWeight: 800, background: 'var(--accent)', color: 'var(--accent-ink)', flex: 'none',
                    }}>{n + 1}</span>
                    {s}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* 프로세스 ↔ 코디. 아래 spacer보다 grow가 커서 코디가 위로 붙고, 점↔CTA 여백이 늘어난다. */}
          <div style={{ flex: '5 1 16px', minHeight: 12 }} />

          <div
            onPointerDown={onSwipeStart}
            onPointerUp={onSwipeEnd}
            onPointerCancel={() => { touchX.current = null; }}
            style={{
              flex: 'none', width: 'min(100%, calc(100dvh - 360px))', maxWidth: '100%',
              margin: '0 auto', alignSelf: 'center', touchAction: 'pan-y', userSelect: 'none',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <HeroTile img={anchor.img} name={anchor.name} anchor />
              {look.items.map((it) => (
                <HeroTile key={look.id + it.id} img={it.img} name={it.name} swap />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: 4 }}>
              {looks.map((lk, i) => (
                <button
                  key={lk.id}
                  onClick={() => goTo(i)}
                  aria-label={`${lk.label} 코디 보기`}
                  aria-current={i === idx}
                  style={{
                    border: 0, background: 'transparent', cursor: 'pointer', lineHeight: 0,
                    height: 24, width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  <span style={{
                    display: 'block', width: i === idx ? 14 : 5, height: 5, borderRadius: 3,
                    background: i === idx ? 'var(--accent)' : 'var(--line-2)',
                    transition: 'width var(--dur) var(--ease), background var(--dur) var(--ease)',
                  }} />
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: '3 1 8px', minHeight: 4 }} />
        </div>

        {/* CTA와 로그인은 탭 영역이 겹치지 않게 확실히 띄운다. */}
        <div style={{ flex: 'none', paddingTop: 6, paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
          <Btn full size="lg" icon="sparkle" onClick={onStart}>시작하기</Btn>
          <div style={{
            marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 2, fontSize: 13, color: 'var(--ink-2)', ...KEEP,
          }}>
            이미 계정이 있으신가요?
            <button onClick={onLogin} className="lb-btn" style={{
              background: 'transparent', color: 'var(--ink)', fontSize: 13, fontWeight: 700,
              padding: '11px 12px', textDecoration: 'underline', textUnderlineOffset: 3,
            }}>로그인</button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ----------------------------------------------------------------
   Login — 이미 계정이 있는 사용자. 가입 온보딩과 분리된 화면.
---------------------------------------------------------------- */
function Login({ onDone, onCancel, onSignup }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const valid = /\S+@\S+\.\S+/.test(email) && pw.length >= 6;
  const submit = () => { if (valid) onDone(email.trim()); };

  const field = {
    width: '100%', padding: '12px 14px', borderRadius: 'var(--r-md)', fontSize: 14,
    background: 'var(--ivory)', border: '1px solid var(--line)', color: 'var(--ink)',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div className="lb-app" style={{ alignItems: 'center' }}>
      {/* 랜딩과 같은 셸: 좌우 20px, 로고 상단 14px. 닫기 버튼은 absolute라 로고 위치를 밀지 않는다. */}
      <div style={{
        width: '100%', maxWidth: 480, flex: 1, display: 'flex', flexDirection: 'column',
        minHeight: 0, margin: '0 auto', padding: '0 20px',
      }}>
        <div style={{ flex: 'none', paddingTop: 14 }}>
          <div style={{ position: 'relative' }}>
            <Wordmark size={18} />
            <button onClick={onCancel} aria-label="닫기" className="lb-iconbtn"
              style={{
                position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)',
                width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
              }}>
              <Icon name="x" size={20} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: 27 }}>
          <Eyebrow>로그인</Eyebrow>
          <h1 style={{ margin: '10px 0 8px', fontSize: 24, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.01em' }}>다시 만나서 반가워요</h1>
          <p style={{ margin: '0 0 24px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            가입한 이메일로 로그인하면 옷장과 룩북을 이어서 볼 수 있어요.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>이메일</div>
              <input className="lb-input" type="email" autoComplete="email" value={email} placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)} style={field} />
            </label>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>비밀번호</div>
              <input className="lb-input" type="password" autoComplete="current-password" value={pw} placeholder="6자 이상"
                onChange={(e) => setPw(e.target.value)} style={field} />
            </label>
            {/* 엔터로 제출되도록 하는 숨김 버튼 */}
            <button type="submit" aria-hidden style={{ display: 'none' }} />
          </form>
        </div>

        <div style={{ flex: 'none', paddingTop: 6, paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
          <Btn full size="lg" disabled={!valid} onClick={submit}>로그인</Btn>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 13, color: 'var(--ink-2)' }}>
            아직 계정이 없으신가요?
            <button onClick={onSignup} className="lb-btn" style={{
              background: 'transparent', color: 'var(--ink)', fontSize: 13, fontWeight: 700,
              padding: '11px 12px', textDecoration: 'underline', textUnderlineOffset: 3,
            }}>회원가입</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   선호 스타일 카드 — 대표 이미지는 빈칸(placeholder). style.img 가 있으면 사진 표시.
---------------------------------------------------------------- */
function StyleCard({ style, selected, onToggle }) {
  return (
    <button onClick={onToggle} className="lb-stylecard" style={{
      display: 'block', width: '100%', textAlign: 'left', padding: 0,
      background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', overflow: 'hidden',
      boxShadow: 'inset 0 0 0 1px var(--line)',
      transition: 'transform var(--dur) var(--ease)',
    }}>
      {/* 대표 이미지 자리 (4:5 — 풀룩 프레이밍은 유지하되 모바일 높이를 줄임) */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '4 / 5',
        background: 'var(--ivory)', display: 'grid', placeItems: 'center',
      }}>
        {style.img
          ? <img src={style.img} alt={style.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--ink-3)' }}>
              <Icon name="image" size={26} stroke={1.5} />
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em' }}>이미지 준비 중</span>
            </div>
          )}
        {/* 선택 체크 */}
        <span style={{
          position: 'absolute', top: 9, right: 9, width: 24, height: 24, borderRadius: '50%',
          display: 'grid', placeItems: 'center',
          background: selected ? 'var(--accent)' : 'rgba(255,255,255,0.7)',
          color: selected ? 'var(--accent-ink)' : 'transparent',
          boxShadow: selected ? 'none' : 'inset 0 0 0 1px var(--line-2)',
          transition: 'all var(--dur) var(--ease)',
        }}>
          <Icon name="check" size={14} stroke={2.8} />
        </span>
      </div>
      {/* 구분선 — 카드 전체 폭, 잘리지 않게 별도 블록으로. 선택 표시는 체크/테두리로 충분해 항상 중립색 유지 */}
      <div style={{ height: 1, background: 'var(--line-2)' }} />
      <div style={{ padding: '10px 13px 12px', background: 'var(--surface-2)' }}>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{style.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{style.desc}</div>
      </div>
    </button>
  );
}

/* small row of selectable chips */
function ChipRow({ options, value, onPick, multi }) {
  const arr = multi ? (value || []) : value;
  const on = (o) => multi ? arr.includes(o) : arr === o;
  const pick = (o) => {
    if (!multi) return onPick(o);
    onPick(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
      {options.map((o) => <Chip key={o} active={on(o)} onClick={() => pick(o)}>{o}</Chip>)}
    </div>
  );
}

/* palette swatch card (multi-select) */
function PaletteCard({ p, selected, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
      padding: '11px 13px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)',
      boxShadow: selected ? 'inset 0 0 0 2px var(--accent)' : 'inset 0 0 0 1px var(--line)',
      transition: 'box-shadow var(--dur) var(--ease)',
    }}>
      <span style={{ display: 'flex', flex: 'none', borderRadius: 'var(--r-pill)', overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}>
        {p.swatch.map((c, i) => <span key={i} style={{ width: 18, height: 28, background: c }} />)}
      </span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{p.name}</span>
      <span style={{
        width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none',
        background: selected ? 'var(--accent)' : 'transparent', color: selected ? 'var(--accent-ink)' : 'transparent',
        boxShadow: selected ? 'none' : 'inset 0 0 0 1px var(--line-2)',
      }}><Icon name="check" size={13} stroke={2.8} /></span>
    </button>
  );
}

/* personal-color season card */
function PCCard({ pc, selected, diagnosed, onSelect }) {
  return (
    <button onClick={onSelect} style={{
      display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
      padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)',
      boxShadow: selected ? 'inset 0 0 0 2px var(--accent)' : 'inset 0 0 0 1px var(--line)',
      transition: 'box-shadow var(--dur) var(--ease)',
    }}>
      <span style={{ display: 'flex', flex: 'none', width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}>
        {pc.swatch.map((c, i) => <span key={i} style={{ flex: 1, background: c }} />)}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{pc.name}</span>
        <span style={{ display: 'block', fontSize: 10.5, color: diagnosed ? 'var(--accent)' : 'var(--ink-3)', letterSpacing: '0.04em', fontWeight: diagnosed ? 700 : 400 }}>{diagnosed ? 'AI 진단 결과' : pc.sub}</span>
      </span>
      {selected && <Icon name="check" size={16} stroke={2.6} style={{ color: 'var(--accent)', flex: 'none' }} />}
    </button>
  );
}

/* ----------------------------------------------------------------
   Onboarding — mode: 'signup' (계정 포함) | 'edit' (선호 정보만 수정)
---------------------------------------------------------------- */
function Onboarding({ mode = 'signup', initial, onDone, onCancel }) {
  const isEdit = mode === 'edit';
  const [d, setD] = useState(() => ({ ...LB_DATA.DEFAULT_PREFS, ...(initial || {}) }));
  const [pw, setPw] = useState('');
  const [pcModal, setPcModal] = useState(false);
  const [pcPhase, setPcPhase] = useState('intro');   // intro → upload → analyzing
  const [pcPhoto, setPcPhoto] = useState(null);      // 업로드한 얼굴 사진 (dataURL)
  const [pcResult, setPcResult] = useState(null);    // 진단된 퍼스널 컴러 id
  const [pcError, setPcError] = useState('');        // 얼굴 미감지 등 안내
  const openPc = () => { setPcPhoto(null); setPcResult(null); setPcError(''); setPcPhase('intro'); setPcModal(true); };
  const closePc = () => { if (pcPhase !== 'analyzing') setPcModal(false); };
  useEscapeClose(pcModal && pcPhase !== 'analyzing', closePc);
  const onPickPhoto = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setPcError('');
    const r = new FileReader();
    r.onload = () => setPcPhoto(r.result);
    r.readAsDataURL(f);
  };
  const runDiagnosis = async () => {
    setPcError('');
    setPcPhase('analyzing');
    const started = Date.now();
    const faces = await countFacesInImage(pcPhoto);
    // 얼굴이 정확히 하나로 잘 잡힐 때만 진행. 0개면 얼굴 사진이 아니거나 불명확.
    if (faces === 0) {
      setPcError('얼굴이 잘 보이는 정면 사진으로 다시 올려주세요.');
      setPcPhase('upload');
      return;
    }
    // 분석 중 화면이 너무 빨리 지나가지 않도록 최소 시간 확보
    const wait = Math.max(0, 1200 - (Date.now() - started));
    if (wait) await new Promise((res) => setTimeout(res, wait));
    const pick = LB_DATA.PERSONAL_COLORS[Math.floor(Math.random() * LB_DATA.PERSONAL_COLORS.length)].id;
    setPcResult(pick);
    setPcPhase('result');
  };
  // 진단 결과를 선호 정보에 반영
  const applyDiagnosis = () => {
    setD((s) => ({ ...s, personalColor: pcResult, pcDiagnosed: true }));
    setPcModal(false);
  };
  const set = (k) => (v) => setD((s) => ({ ...s, [k]: v }));

  // 단계 정의 — 가입은 계정부터, 수정은 선호 정보만.
  const ACCOUNT = {
    key: 'account', eyebrow: '계정 만들기', title: '이메일로 시작하기',
    sub: 'LOOKBOX 계정을 만들어 옷장과 추천을 저장해요.',
    valid: () => /\S+@\S+\.\S+/.test(d.email) && pw.length >= 6,
    render: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <LabeledField label="이메일" value={d.email} onChange={set('email')} placeholder="you@example.com" />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>비밀번호</div>
          <input className="lb-input" type="password" value={pw} placeholder="6자 이상" onChange={(e) => setPw(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--r-md)', fontSize: 14, background: 'var(--ivory)', border: '1px solid var(--line)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>
    ),
  };

  const BASIC = {
    key: 'basic', eyebrow: '기본 정보', title: '나를 알려주세요',
    sub: '더 잘 맞는 옷을 추천하기 위한 기본 정보예요.',
    valid: () => d.gender && d.age,
    render: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>성별</div>
          <ChipRow options={['여성', '남성', '선택 안 함']} value={d.gender} onPick={set('gender')} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>연령대</div>
          <ChipRow options={LB_DATA.AGES} value={d.age} onPick={set('age')} />
        </div>
      </div>
    ),
  };

  const STYLES = {
    key: 'styles', eyebrow: '선호 스타일', title: '어떤 무드를 좋아하세요?',
    sub: '마음에 드는 스타일을 모두 골라주세요. (최소 1개)',
    valid: () => d.styles.length >= 1,
    render: () => (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {LB_DATA.STYLES.map((s) => (
          <StyleCard key={s.id} style={s} selected={d.styles.includes(s.id)}
            onToggle={() => set('styles')(d.styles.includes(s.id) ? d.styles.filter((x) => x !== s.id) : [...d.styles, s.id])} />
        ))}
      </div>
    ),
  };

  const FITPREF = {
    key: 'fit', eyebrow: '선호 핏 · 컬러', title: '핏과 컬러 취향은요?',
    sub: '추천 옷의 실루엣과 색감을 맞춰드릴게요.',
    valid: () => !!d.fit,
    render: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 42 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>선호하는 핏</div>
          <ChipRow options={LB_DATA.FITS} value={d.fit} onPick={set('fit')} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>퍼스널 컬러</div>
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>선택 사항</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {LB_DATA.PERSONAL_COLORS.map((pc) => (
              <PCCard key={pc.id} pc={pc} selected={d.personalColor === pc.id} diagnosed={d.pcDiagnosed && d.personalColor === pc.id}
                onSelect={() => setD((s) => ({ ...s, personalColor: pc.id, pcDiagnosed: false }))} />
            ))}
          </div>
          <button onClick={openPc} className="lb-btn" style={{
            width: '100%', marginTop: 10, background: 'var(--surface)', color: 'var(--ink-2)',
            boxShadow: 'inset 0 0 0 1px var(--line)', fontSize: 13, fontWeight: 600, padding: '12px', gap: 7,
          }}>
            <Icon name="sparkle" size={16} /> 잘 모르겠어요 · 퍼스널 컬러 진단받기
          </button>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>선호하는 컬러 팔레트</div>
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>여러 개 선택 가능</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {LB_DATA.PALETTE.map((p) => (
              <PaletteCard key={p.id} p={p} selected={d.palettes.includes(p.id)}
                onToggle={() => set('palettes')(d.palettes.includes(p.id) ? d.palettes.filter((x) => x !== p.id) : [...d.palettes, p.id])} />
            ))}
          </div>
        </div>
      </div>
    ),
  };

  const steps = isEdit ? [STYLES, FITPREF] : [ACCOUNT, BASIC, STYLES, FITPREF];
  const [i, setI] = useState(0);
  const step = steps[i];
  const last = i === steps.length - 1;
  const canNext = step.valid();

  const next = () => { if (!canNext) return; last ? onDone(d) : setI(i + 1); };
  const prev = () => (i === 0 ? (onCancel && onCancel()) : setI(i - 1));

  return (
    <div className="lb-app" style={{ alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, margin: '0 auto' }}>
        {/* 헤더: 워드마크 + 진행 바 */}
        <div style={{ padding: '14px 20px 4px' }}>
          <div style={{ position: 'relative' }}>
            <Wordmark size={18} />
            <button onClick={() => (onCancel ? onCancel() : null)} aria-label="닫기" className="lb-iconbtn"
              style={{
                position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)',
                width: 36, height: 36, borderRadius: '50%', display: onCancel ? 'grid' : 'none', placeItems: 'center', color: 'var(--ink-2)',
              }}>
              <Icon name="x" size={20} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '12px 20px 0' }}>
          {steps.map((s, n) => (
            <div key={s.key} style={{ flex: 1, height: 4, borderRadius: 999, background: n <= i ? 'var(--accent)' : 'var(--line-2)', transition: 'background var(--dur) var(--ease)' }} />
          ))}
        </div>

        {/* 본문 (스크롤) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '26px 20px 16px' }}>
          <div className="lb-anim-in" key={step.key}>
            <Eyebrow>{`${i + 1} / ${steps.length} · ${step.eyebrow}`}</Eyebrow>
            <h1 style={{ margin: '10px 0 8px', fontSize: 24, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.01em' }}>{step.title}</h1>
            <p style={{ margin: '0 0 24px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{step.sub}</p>
            {step.render()}
          </div>
        </div>

        {/* 푸터 */}
        <div style={{ display: 'flex', gap: 10, padding: '12px 20px max(env(safe-area-inset-bottom), 16px)', borderTop: '1px solid var(--line)', background: 'var(--ivory)' }}>
          {(i > 0 || onCancel) && (
            <Btn variant="soft" size="lg" onClick={prev} style={{ flex: 'none', paddingLeft: 22, paddingRight: 22 }}>
              {i === 0 ? '취소' : '이전'}
            </Btn>
          )}
          <Btn full size="lg" disabled={!canNext} onClick={next} icon={last ? (isEdit ? 'check' : 'sparkle') : undefined}>
            {last ? (isEdit ? '저장' : '시작하기') : '다음'}
          </Btn>
        </div>
      </div>

      {pcModal && (
        <div onClick={closePc} style={{ position: 'absolute', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(30,27,21,0.45)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--pop-shadow)', padding: '26px 24px', textAlign: 'center' }}>

            {/* 1) 소개 */}
            {pcPhase === 'intro' && (
              <div>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--ivory)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', color: 'var(--accent)' }}>
                  <Icon name="sparkle" size={24} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>퍼스널 컬러를 모르시나요?</div>
                <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 22px' }}>
                  얼굴이 잘 나온 사진 한 장이면 돼요.<br />어울리는 색을 찾아 더 잘 맞는 옷을 추천해 드려요.
                </p>
                <Btn full size="lg" icon="camera" onClick={() => setPcPhase('upload')}>진단 시작하기</Btn>
                <button onClick={() => setPcModal(false)} className="lb-btn" style={{ width: '100%', marginTop: 10, background: 'transparent', color: 'var(--ink-2)', fontSize: 13.5, fontWeight: 600, padding: '8px' }}>나중에 하기</button>
              </div>
            )}

            {/* 2) 얼굴 사진 업로드 */}
            {pcPhase === 'upload' && (
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>얼굴 사진을 올려주세요</div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, margin: '0 0 18px' }}>
                  자연광에서 정면으로 찍은 사진이 가장 정확해요.
                </p>
                {pcError && (
                  <div style={{ padding: '11px 13px', margin: '0 0 18px', borderRadius: 'var(--r-md)', background: 'color-mix(in srgb, #B0573C 10%, transparent)', color: '#8F4531', fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, textAlign: 'left' }}>
                    {pcError}
                  </div>
                )}
                <label style={{
                  display: 'block', position: 'relative', width: 168, height: 168, margin: '0 auto', borderRadius: '50%',
                  overflow: 'hidden', cursor: 'pointer', background: 'var(--ivory)',
                  boxShadow: pcPhoto ? 'inset 0 0 0 3px var(--accent)' : 'inset 0 0 0 2px var(--line-2)',
                }}>
                  <input type="file" accept="image/*" onChange={onPickPhoto} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                  {pcPhoto
                    ? <img src={pcPhoto} alt="얼굴 사진" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (
                      <span style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--ink-3)' }}>
                        <Icon name="camera" size={30} stroke={1.5} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>사진 선택</span>
                      </span>
                    )}
                </label>
                {pcPhoto && (
                  <label style={{ display: 'inline-block', marginTop: 14, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>
                    <input type="file" accept="image/*" onChange={onPickPhoto} style={{ display: 'none' }} />
                    다른 사진 선택
                  </label>
                )}
                <div style={{ marginTop: 22 }}>
                  <Btn full size="lg" icon="sparkle" disabled={!pcPhoto} onClick={runDiagnosis}>이 사진으로 진단하기</Btn>
                  <button onClick={() => setPcPhase('intro')} className="lb-btn" style={{ width: '100%', marginTop: 10, background: 'transparent', color: 'var(--ink-2)', fontSize: 13.5, fontWeight: 600, padding: '8px' }}>이전</button>
                </div>
              </div>
            )}

            {/* 3) 분석 중 */}
            {pcPhase === 'analyzing' && (
              <div>
                {pcPhoto && (
                  <div style={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 18px', boxShadow: 'inset 0 0 0 3px var(--accent)' }}>
                    <img src={pcPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>퍼스널 컬러 분석 중…</div>
                <div className="lb-skel" style={{ height: 8, borderRadius: 999, width: '78%', margin: '0 auto' }} />
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 14 }}>잠시만 기다려 주세요</div>
              </div>
            )}

            {/* 4) 진단 결과 */}
            {pcPhase === 'result' && pcResult && (() => {
              const pc = LB_DATA.PERSONAL_COLORS.find((x) => x.id === pcResult);
              const det = PC_DETAIL[pcResult];
              return (
                <div style={{ textAlign: 'left' }}>
                  {/* 헤더: 사진 + 결과 시즌 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                    <div style={{ position: 'relative', flex: 'none' }}>
                      {pcPhoto && (
                        <div style={{ width: 66, height: 66, borderRadius: '50%', overflow: 'hidden', boxShadow: 'inset 0 0 0 3px var(--accent)' }}>
                          <img src={pcPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                      <span style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 3px var(--surface)' }}>
                        <Icon name="check" size={13} stroke={3} />
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-3)' }}>AI 진단 결과</div>
                      <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.15 }}>{pc.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{det.tone}</div>
                    </div>
                  </div>

                  <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55, margin: '0 0 18px', textWrap: 'pretty' }}>{det.desc}</p>

                  {/* 키워드 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
                    {det.keywords.map((k) => (
                      <span key={k} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-ink)', background: 'var(--accent)', padding: '5px 11px', borderRadius: 'var(--r-pill)' }}>{k}</span>
                    ))}
                  </div>

                  {/* 추천 컬러 */}
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 9 }}>이런 색이 잘 어울려요</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {det.best.map((c, i) => (
                      <span key={i} style={{ flex: 1, height: 38, borderRadius: 'var(--r-sm)', background: c, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }} />
                    ))}
                  </div>

                  {/* 피해야 할 색 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: 'var(--ivory)', borderRadius: 'var(--r-md)', marginBottom: 22 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-3)', flex: 1 }}>피하면 좋은 색</span>
                    <span style={{ display: 'flex', gap: 6 }}>
                      {det.avoid.map((c, i) => (
                        <span key={i} style={{ width: 20, height: 20, borderRadius: '50%', background: c, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)', opacity: 0.85 }} />
                      ))}
                    </span>
                  </div>

                  <Btn full size="lg" icon="check" onClick={applyDiagnosis}>이 결과로 적용하기</Btn>
                  <button onClick={() => setPcPhase('upload')} className="lb-btn" style={{ width: '100%', marginTop: 10, background: 'transparent', color: 'var(--ink-2)', fontSize: 13.5, fontWeight: 600, padding: '8px' }}>다시 진단하기</button>
                </div>
              );
            })()}

          </div>
        </div>
      )}
    </div>
  );
}

// 프로필 사진 등록도 퍼스널 컬러와 같은 얼굴 판정을 쓰도록 공유한다.
Object.assign(window, { Onboarding, Landing, Login, countFacesInImage });
