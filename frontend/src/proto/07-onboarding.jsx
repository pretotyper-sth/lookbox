/* @prototype-ported */
const React = window.React;
const { Btn, Chip, Eyebrow, Icon, LB_DATA, LabeledField, PALETTE, PERSONAL_COLORS, Thumb, WARDROBE, Wordmark } = window;

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
function Landing({ onStart, onBypass }) {
  // 랜딩 히어로 미리보기 — 실서비스는 사용자 데이터(WARDROBE)를 비우므로
  // 마케팅용 샘플 이미지는 비워지지 않는 IMG 리소스에서 직접 구성한다.
  const heroItems = [
    { id: 'hero-top', category: '상의', img: LB_DATA.IMG.topNavy },
    { id: 'hero-bottom', category: '하의', img: LB_DATA.IMG.skirtWhite },
    { id: 'hero-shoes', category: '신발', img: LB_DATA.IMG.sandalBlack },
  ].filter((it) => it.img);
  return (
    <div className="lb-app" style={{ alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, margin: '0 auto', padding: '0 26px' }}>
        <div style={{ paddingTop: 28 }}><Wordmark size={20} /></div>

        {/* 본문 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, paddingBottom: 8 }}>
          {/* 코디 미리보기 (제품 느낌) */}
          <div className="lb-anim-in" style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', boxShadow: 'inset 0 0 0 1px var(--line)', padding: 16, marginBottom: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, color: 'var(--ink-2)' }}>
              <Icon name="sparkle" size={15} stroke={2} />
              <span style={{ fontSize: 12, fontWeight: 700 }}>오늘의 추천 코디</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {heroItems.map((it) => <Thumb key={it.id} item={it} radius="var(--r-md)" />)}
            </div>
          </div>

          <h1 style={{ margin: '0 0 14px', fontSize: 30, fontWeight: 800, lineHeight: 1.18, letterSpacing: '-0.02em', textWrap: 'balance' }}>
            내 옷장이 곧<br />나만의 스타일리스트
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.55, textWrap: 'pretty' }}>
            가진 옷으로 매일의 코디를 추천받고,<br />사고 싶은 옷과의 조합까지 미리 확인하세요.
          </p>
        </div>

        {/* 진입 버튼 */}
        <div style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
          <Btn full size="lg" icon="sparkle" onClick={onStart}>시작하기</Btn>
          <button onClick={onStart} className="lb-btn" style={{
            width: '100%', marginTop: 12, background: 'transparent', color: 'var(--ink-2)',
            fontSize: 13.5, fontWeight: 600, padding: '8px',
          }}>
            이미 계정이 있으신가요? <span style={{ color: 'var(--ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}>로그인</span>
          </button>
          {onBypass && (
            <button onClick={onBypass} className="lb-btn" style={{
              width: '100%', marginTop: 6, background: 'transparent', color: 'var(--ink-3)',
              fontSize: 12, fontWeight: 600, padding: '8px', gap: 6,
              border: '1px dashed var(--line-2)', borderRadius: 'var(--r-pill)',
            }}>
              <Icon name="sparkle" size={13} /> 개발용 · 로그인 없이 바로 둘러보기
            </button>
          )}
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
      setPcError('얼굴을 인식하지 못했어요. 얼굴이 정면으로 잘 나온 사진으로 다시 올려주세요.');
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
          <ChipRow options={['10대', '20대', '30대', '40대 이상']} value={d.age} onPick={set('age')} />
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
        <div style={{ padding: '20px 22px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Wordmark size={18} />
          <button onClick={() => (onCancel ? onCancel() : null)} aria-label="닫기" className="lb-iconbtn"
            style={{ width: 36, height: 36, borderRadius: '50%', display: onCancel ? 'grid' : 'none', placeItems: 'center', color: 'var(--ink-2)' }}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '12px 22px 0' }}>
          {steps.map((s, n) => (
            <div key={s.key} style={{ flex: 1, height: 4, borderRadius: 999, background: n <= i ? 'var(--accent)' : 'var(--line-2)', transition: 'background var(--dur) var(--ease)' }} />
          ))}
        </div>

        {/* 본문 (스크롤) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '26px 22px 16px' }}>
          <div className="lb-anim-in" key={step.key}>
            <Eyebrow>{`${i + 1} / ${steps.length} · ${step.eyebrow}`}</Eyebrow>
            <h1 style={{ margin: '10px 0 8px', fontSize: 24, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.01em' }}>{step.title}</h1>
            <p style={{ margin: '0 0 24px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{step.sub}</p>
            {step.render()}
          </div>
        </div>

        {/* 푸터 */}
        <div style={{ display: 'flex', gap: 10, padding: '12px 22px max(env(safe-area-inset-bottom), 18px)', borderTop: '1px solid var(--line)', background: 'var(--ivory)' }}>
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

Object.assign(window, { Onboarding, Landing });
