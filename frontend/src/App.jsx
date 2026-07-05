import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

const tabs = [
  { id: 'wardrobe', label: '옷장' },
  { id: 'daily', label: '오늘 코디' },
  { id: 'lookbook', label: '룩북' },
  { id: 'account', label: '마이' },
]

const styles = [
  ['dandy', '댄디', '깔끔하고 단정하게'],
  ['minimal', '미니멀', '색을 줄이고 담백하게'],
  ['casual', '캐주얼', '편하게 매일 입기 좋게'],
  ['office', '오피스', '출근과 미팅에 안전하게'],
]

const onboardingStyles = [
  { id: 'minimal', name: '미니멀', en: 'MINIMAL', desc: '군더더기 없는 기본기', img: '/prototype-assets/style-minimal.png' },
  { id: 'casual', name: '캐주얼', en: 'CASUAL', desc: '편안한 데일리 무드', img: '/prototype-assets/style-casual.png' },
  { id: 'sporty', name: '스포티', en: 'SPORTY', desc: '활동적이고 가벼운', img: '/prototype-assets/style-sporty.png' },
  { id: 'amekaji', name: '아메카지', en: 'AMEKAJI', desc: '빈티지 워크웨어', img: '/prototype-assets/style-amekaji.png' },
  { id: 'dandy', name: '댄디', en: 'DANDY', desc: '단정한 클래식 신사', img: '/prototype-assets/style-dandy.png' },
  { id: 'street', name: '스트릿', en: 'STREET', desc: '자유로운 시티 무드', img: '/prototype-assets/style-street.png' },
  { id: 'chic', name: '시크', en: 'CHIC', desc: '모던하고 절제된', img: '/prototype-assets/style-chic.png' },
  { id: 'classic', name: '클래식', en: 'CLASSIC', desc: '격식 있는 정통', img: '/prototype-assets/style-classic.png' },
]

const fits = ['슬림', '레귤러', '오버핏', '상관없음']
const palettes = [
  { id: 'mono', name: '모노톤', swatch: ['#1A1A1A', '#8A857C', '#FFFFFF'] },
  { id: 'earth', name: '어스톤', swatch: ['#7C6748', '#A98C5A', '#D8C7A6'] },
  { id: 'navy', name: '네이비·블루', swatch: ['#1F2A44', '#3E5A86', '#9FB4D4'] },
  { id: 'warm', name: '웜 뉴트럴', swatch: ['#B0573C', '#D49A6A', '#EAD9C4'] },
]
const personalColors = [
  { id: 'spring', name: '봄 웜', sub: 'Spring Warm', swatch: ['#FF8C69', '#FFD25A', '#9DCB6A'] },
  { id: 'summer', name: '여름 쿨', sub: 'Summer Cool', swatch: ['#C9A2C8', '#E8A0B0', '#A8C4DE'] },
  { id: 'autumn', name: '가을 웜', sub: 'Autumn Warm', swatch: ['#C18A3D', '#A8503A', '#7B7A3A'] },
  { id: 'winter', name: '겨울 쿨', sub: 'Winter Cool', swatch: ['#C0246B', '#1F2A57', '#3FA7C9'] },
]

const initialPrefs = {
  gender: '',
  age: '',
  styles: [],
  fit: '',
  palettes: [],
  personalColor: '',
}

async function api(path, { token, method = 'GET', body, headers } = {}) {
  const isForm = body instanceof FormData
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(headers || {}),
    },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || data.error || '요청에 실패했어요')
  return data
}

function App() {
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [signupStep, setSignupStep] = useState(0)
  const [prefs, setPrefs] = useState(initialPrefs)
  const [tab, setTab] = useState('wardrobe')
  const [items, setItems] = useState([])
  const [outfits, setOutfits] = useState([])
  const [credits, setCredits] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [tutorialDone, setTutorialDone] = useState(() => localStorage.getItem('lookbox_tutorial') === '1')
  const token = session?.access_token
  const ownedItems = useMemo(() => items.filter((item) => item.status === 'owned'), [items])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => subscription.unsubscribe()
  }, [])

  const loadAll = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [wardrobe, creditData, outfitData] = await Promise.all([
        api('/wardrobe', { token }),
        api('/usage/credits', { token }),
        api('/outfits', { token }),
      ])
      setItems(wardrobe.items || [])
      setCredits(creditData)
      setOutfits(outfitData.outfits || [])
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  async function submitAuth(event) {
    event.preventDefault()
    if (!supabase) return
    setAuthError('')
    const action =
      authMode === 'signup'
        ? supabase.auth.signUp({ email, password, options: { data: { preferences: prefs } } })
        : supabase.auth.signInWithPassword({ email, password })
    const { error } = await action
    if (error) setAuthError(error.message)
  }

  function startSignup() {
    setAuthMode('signup')
    setSignupStep(0)
    setAuthError('')
  }

  function startLogin() {
    setAuthMode('login')
    setSignupStep(0)
    setAuthError('')
  }

  async function uploadWardrobe(file, status = 'owned') {
    if (!file) return
    setLoading(true)
    setMessage('옷을 분석하고 있어요. 잠시만 기다려주세요.')
    const form = new FormData()
    form.append('file', file)
    try {
      const data = await api(`/wardrobe/upload?status=${status}`, { token, method: 'POST', body: form })
      setItems((prev) => [data.item, ...prev])
      setCredits({ ...(credits || {}), remaining: data.credits })
      setMessage(status === 'considering' ? '고민 중인 옷을 추가했어요.' : '옷장에 추가했어요.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function recommendDaily(style = 'dandy') {
    if (ownedItems.length < 2) {
      setMessage('추천을 받으려면 옷을 2벌 이상 추가해주세요.')
      return
    }
    setLoading(true)
    setMessage('오늘 입을 조합을 만들고 있어요.')
    try {
      const data = await api('/recommend/daily', {
        token,
        method: 'POST',
        body: { style, max_combos: 4, make_images: true },
      })
      setOutfits((prev) => [...data.outfits, ...prev])
      setCredits({ ...(credits || {}), remaining: data.credits })
      setTab('daily')
      setMessage('오늘의 코디를 만들었어요.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function purchaseCheck(file) {
    if (!file) return
    if (ownedItems.length < 2) {
      setMessage('구매 전 조합을 보려면 내 옷장에 옷을 2벌 이상 추가해주세요.')
      return
    }
    setLoading(true)
    setMessage('고민 중인 옷을 분석하고 조합을 찾는 중이에요.')
    const form = new FormData()
    form.append('file', file)
    try {
      const uploaded = await api('/wardrobe/upload?status=considering', { token, method: 'POST', body: form })
      setItems((prev) => [uploaded.item, ...prev])
      const data = await api('/recommend/purchase-check', {
        token,
        method: 'POST',
        body: { anchor_id: uploaded.item.id, style: 'dandy', max_combos: 4, make_images: true },
      })
      setOutfits((prev) => [...data.outfits, ...prev])
      setCredits({ ...(credits || {}), remaining: data.credits })
      setTab('lookbook')
      setMessage('구매 전 조합을 만들었어요.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleSave(outfit) {
    try {
      await api(`/outfits/${outfit.id}/save`, {
        token,
        method: 'POST',
        body: { saved: !outfit.saved },
      })
      setOutfits((prev) =>
        prev.map((item) => (item.id === outfit.id ? { ...item, saved: !outfit.saved } : item)),
      )
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function markWorn(outfit) {
    try {
      await api(`/outfits/${outfit.id}/save`, { token, method: 'POST', body: { worn: true } })
      setOutfits((prev) =>
        prev.map((item) => (item.id === outfit.id ? { ...item, wornAt: new Date().toISOString() } : item)),
      )
      setMessage('오늘 입은 코디로 기록했어요.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  function finishTutorial() {
    localStorage.setItem('lookbox_tutorial', '1')
    setTutorialDone(true)
  }

  if (!supabase) {
    return <SetupMissing />
  }

  if (!session) {
    return (
      <LandingAuth
        authMode={authMode}
        setAuthMode={setAuthMode}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        authError={authError}
        submitAuth={submitAuth}
        signupStep={signupStep}
        setSignupStep={setSignupStep}
        prefs={prefs}
        setPrefs={setPrefs}
        startSignup={startSignup}
        startLogin={startLogin}
      />
    )
  }


  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <nav>
          {tabs.map((item) => (
            <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-actions">
          <UploadButton label="옷 추가" onFile={(file) => uploadWardrobe(file, 'owned')} />
          <UploadButton label="구매 전 조합" variant="dark" onFile={purchaseCheck} />
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">LOOKBOX</span>
            <h1>{tabTitle(tab)}</h1>
          </div>
          <div className="credits">이미지 크레딧 {credits?.remaining ?? '-'}장</div>
        </header>

        {message && <div className="notice">{message}</div>}
        {loading && <div className="notice muted">처리 중입니다. 이미지 생성은 20초 이상 걸릴 수 있어요.</div>}

        {tab === 'wardrobe' && <Wardrobe items={items} onUpload={(file) => uploadWardrobe(file, 'owned')} />}
        {tab === 'daily' && (
          <Daily
            ready={ownedItems.length >= 2}
            outfits={outfits.filter((item) => item.type === 'daily')}
            onRecommend={recommendDaily}
            onSave={toggleSave}
            onWear={markWorn}
          />
        )}
        {tab === 'lookbook' && (
          <Lookbook
            outfits={outfits.filter((item) => item.saved || item.type === 'purchase')}
            onSave={toggleSave}
            onWear={markWorn}
          />
        )}
        {tab === 'account' && (
          <Account
            email={session.user.email}
            onLogout={() => supabase.auth.signOut()}
            onReload={loadAll}
          />
        )}
      </main>

      {!tutorialDone && (
        <div className="overlay">
          <section className="tutorial">
            <span className="eyebrow">처음 시작하기</span>
            <h2>옷을 먼저 추가해 주세요</h2>
            <p>LOOKBOX는 내 옷장을 기준으로 코디를 보여줘요. 사진 몇 장만 넣으면 바로 시작할 수 있습니다.</p>
            <div className="steps">
              {[
                ['1', '사진으로 옷 추가', '상의·하의·신발을 자동으로 분류합니다.'],
                ['2', '옷장 확인', '분류와 색상이 맞는지 가볍게 확인합니다.'],
                ['3', '추천 사용', '옷이 모이면 구매 전 조합과 오늘 코디를 봅니다.'],
              ].map(([num, title, desc]) => (
                <div className="step" key={num}>
                  <span>{num}</span>
                  <div>
                    <b>{title}</b>
                    <small>{desc}</small>
                  </div>
                </div>
              ))}
            </div>
            <UploadButton label="옷 추가하기" variant="dark" onFile={(file) => { finishTutorial(); uploadWardrobe(file, 'owned') }} />
            <button className="link-button" onClick={finishTutorial}>나중에 할게요</button>
          </section>
        </div>
      )}
    </div>
  )
}

function Logo() {
  return <div className="logo">LOOK<span>BOX</span></div>
}

function LandingAuth({
  authMode,
  email,
  setEmail,
  password,
  setPassword,
  authError,
  submitAuth,
  signupStep,
  setSignupStep,
  prefs,
  setPrefs,
  startSignup,
  startLogin,
}) {
  const setPref = (key, value) => setPrefs((prev) => ({ ...prev, [key]: value }))
  const signupSteps = [
    {
      eyebrow: '계정 만들기',
      title: '이메일로 시작하기',
      sub: '옷장과 추천 기록을 저장할 계정이 필요해요.',
      valid: /\S+@\S+\.\S+/.test(email) && password.length >= 6,
      content: (
        <div className="auth-form fields-only">
          <label>이메일</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
          <label>비밀번호</label>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" />
          <small className="helper">비밀번호는 6자 이상 입력해주세요.</small>
        </div>
      ),
    },
    {
      eyebrow: '기본 정보',
      title: '나를 알려주세요',
      sub: '더 잘 맞는 옷을 추천하기 위한 기본 정보예요.',
      valid: prefs.gender && prefs.age,
      content: (
        <div className="onboarding-section">
          <ChoiceGroup label="성별" options={['여성', '남성', '선택 안 함']} value={prefs.gender} onPick={(v) => setPref('gender', v)} />
          <ChoiceGroup label="연령대" options={['10대', '20대', '30대', '40대 이상']} value={prefs.age} onPick={(v) => setPref('age', v)} />
        </div>
      ),
    },
    {
      eyebrow: '선호 스타일',
      title: '어떤 무드를 좋아하세요?',
      sub: '마음에 드는 스타일을 모두 골라주세요.',
      valid: prefs.styles.length >= 1,
      content: (
        <div className="style-card-grid">
          {onboardingStyles.map((style) => {
            const selected = prefs.styles.includes(style.id)
            return (
              <button
                className={`style-card ${selected ? 'selected' : ''}`}
                key={style.id}
                onClick={() => setPref('styles', selected ? prefs.styles.filter((id) => id !== style.id) : [...prefs.styles, style.id])}
                type="button"
              >
                <img src={style.img} alt="" />
                <span className="style-en">{style.en}</span>
                <b>{style.name}</b>
                <small>{style.desc}</small>
              </button>
            )
          })}
        </div>
      ),
    },
    {
      eyebrow: '핏과 컬러',
      title: '핏과 컬러 취향은요?',
      sub: '추천 옷의 실루엣과 색감을 맞춰드릴게요.',
      valid: !!prefs.fit,
      content: (
        <div className="onboarding-section">
          <ChoiceGroup label="선호하는 핏" options={fits} value={prefs.fit} onPick={(v) => setPref('fit', v)} />
          <SwatchGroup label="퍼스널 컬러" options={personalColors} value={prefs.personalColor} onPick={(v) => setPref('personalColor', v)} />
          <SwatchGroup label="선호 컬러 팔레트" options={palettes} value={prefs.palettes} multi onPick={(v) => setPref('palettes', v)} />
        </div>
      ),
    },
  ]
  const step = signupSteps[signupStep]

  if (authMode === 'signup') {
    return (
      <main className="landing-page">
        <section className="landing-shell onboarding-shell">
          <div className="landing-brand"><Logo /></div>
          <span className="eyebrow">{step.eyebrow}</span>
          <h1 className="onboarding-title">{step.title}</h1>
          <p className="onboarding-sub">{step.sub}</p>
          <div className="progress-dots">
            {signupSteps.map((_, index) => <span className={index <= signupStep ? 'on' : ''} key={index} />)}
          </div>
          {step.content}
          {authError && <div className="error">{authError}</div>}
          <div className="onboarding-actions">
            {signupStep > 0 && <button className="secondary" onClick={() => setSignupStep((s) => s - 1)} type="button">이전</button>}
            {signupStep < signupSteps.length - 1 ? (
              <button className="primary" disabled={!step.valid} onClick={() => setSignupStep((s) => s + 1)} type="button">다음</button>
            ) : (
              <button className="primary" disabled={!step.valid} onClick={submitAuth} type="button">가입하고 시작</button>
            )}
          </div>
          <button className="link-button" onClick={startLogin}>이미 계정이 있어요</button>
        </section>
      </main>
    )
  }

  return (
    <main className="landing-page">
      <section className="landing-shell">
        <div className="landing-brand"><Logo /></div>
        <HeroPreview />
        <section className="landing-copy">
          <span className="eyebrow">AI wardrobe</span>
          <h1>내 옷장이 곧<br />나만의 스타일리스트</h1>
          <p>사고 싶은 옷이 내 옷장과 어울리는지 먼저 확인하세요. 가진 옷으로 오늘 입을 코디도 추천받을 수 있어요.</p>
        </section>
        <form className="auth-form" onSubmit={submitAuth}>
          <label>이메일</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
          <label>비밀번호</label>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
          {authError && <div className="error">{authError}</div>}
          <button type="submit">로그인</button>
        </form>
        <button className="link-button" onClick={startSignup}>처음이면 가입하기</button>
      </section>
    </main>
  )
}

function ChoiceGroup({ label, options, value, onPick }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="chip-row">
        {options.map((option) => (
          <button className={value === option ? 'on' : ''} key={option} onClick={() => onPick(option)} type="button">{option}</button>
        ))}
      </div>
    </div>
  )
}

function SwatchGroup({ label, options, value, onPick, multi }) {
  const values = multi ? value || [] : [value]
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="swatch-grid">
        {options.map((option) => {
          const selected = values.includes(option.id)
          return (
            <button
              className={selected ? 'selected' : ''}
              key={option.id}
              onClick={() => {
                if (!multi) return onPick(option.id)
                onPick(selected ? values.filter((id) => id !== option.id) : [...values, option.id])
              }}
              type="button"
            >
              <span className="swatches">{option.swatch.map((color) => <i style={{ background: color }} key={color} />)}</span>
              <b>{option.name}</b>
              {option.sub && <small>{option.sub}</small>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function HeroPreview() {
  return (
    <div className="hero-preview" aria-hidden="true">
      <div className="hero-preview-head">
        <span>오늘의 추천 코디</span>
        <small>옷장 기반</small>
      </div>
      <div className="hero-preview-grid">
        <img src="/prototype-assets/top-navy.png" alt="" />
        <img src="/prototype-assets/skirt-white.png" alt="" />
        <img src="/prototype-assets/sandal-black.png" alt="" />
      </div>
    </div>
  )
}

function tabTitle(tab) {
  return {
    wardrobe: '옷장',
    daily: '오늘 코디',
    lookbook: '룩북',
    account: '마이페이지',
  }[tab]
}

function UploadButton({ label, onFile, variant }) {
  return (
    <label className={`upload-button ${variant === 'dark' ? 'dark' : ''}`}>
      {label}
      <input type="file" accept="image/*" onChange={(event) => onFile(event.target.files?.[0])} />
    </label>
  )
}

function Wardrobe({ items, onUpload }) {
  if (!items.length) {
    return (
      <Empty
        title="아직 옷장이 비어 있어요"
        description="사진을 올려 옷장을 먼저 채워주세요."
        action={<UploadButton label="첫 옷 추가하기" variant="dark" onFile={onUpload} />}
      />
    )
  }
  return <div className="grid">{items.map((item) => <ItemCard item={item} key={item.id} />)}</div>
}

function ItemCard({ item }) {
  return (
    <article className="item-card">
      <img src={item.imageUrl} alt={item.name} />
      <div>
        <b>{item.name}</b>
        <span>{item.category} · {item.color}</span>
      </div>
    </article>
  )
}

function Daily({ ready, outfits, onRecommend, onSave, onWear }) {
  const [style, setStyle] = useState('dandy')
  if (!ready) {
    return <Empty title="옷이 조금 더 필요해요" description="오늘 코디는 옷장에 옷이 2벌 이상 있어야 만들 수 있어요." />
  }
  return (
    <>
      <section className="panel">
        <h2>오늘 입을 무드를 골라주세요</h2>
        <p>원하는 분위기를 고르면 내 옷장에 있는 옷만으로 오늘 입을 조합을 만들어드릴게요.</p>
        <div className="style-row">
          {styles.map(([id, label, desc]) => (
            <button className={style === id ? 'selected' : ''} key={id} onClick={() => setStyle(id)}>
              <b>{label}</b>
              <small>{desc}</small>
            </button>
          ))}
        </div>
        <button className="primary" onClick={() => onRecommend(style)}>오늘의 코디 추천받기</button>
      </section>
      <OutfitGrid outfits={outfits} onSave={onSave} onWear={onWear} />
    </>
  )
}

function Lookbook({ outfits, onSave, onWear }) {
  if (!outfits.length) return <Empty title="저장한 코디가 없어요" description="마음에 드는 추천을 저장하면 여기에 모입니다." />
  return <OutfitGrid outfits={outfits} onSave={onSave} onWear={onWear} />
}

function OutfitGrid({ outfits, onSave, onWear }) {
  return (
    <div className="outfit-grid">
      {outfits.map((outfit) => (
        <article className="outfit-card" key={outfit.id}>
          <div className="look">
            {outfit.lookImageUrl ? <img src={outfit.lookImageUrl} alt={outfit.label} /> : <LookFallback items={outfit.items} />}
            <button onClick={() => onSave(outfit)}>{outfit.saved ? '저장됨' : '저장'}</button>
          </div>
          <h3>{outfit.label}</h3>
          <p>{outfit.mood || `${outfit.items.length}개 아이템`}</p>
          <button className="wear" onClick={() => onWear(outfit)}>{outfit.wornAt ? '입음' : '오늘 입기'}</button>
        </article>
      ))}
    </div>
  )
}

function LookFallback({ items }) {
  return (
    <div className="fallback-look">
      {items.slice(0, 4).map((item) => <img src={item.imageUrl} alt={item.name} key={item.id} />)}
    </div>
  )
}

function Account({ email, onLogout, onReload }) {
  return (
    <section className="panel">
      <h2>{email}</h2>
      <p>옷장 데이터와 추천 기록은 계정 기준으로 저장됩니다.</p>
      <button className="secondary" onClick={onReload}>새로고침</button>
      <button className="secondary" onClick={onLogout}>로그아웃</button>
    </section>
  )
}

function Empty({ title, description, action }) {
  return (
    <section className="empty">
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  )
}

function SetupMissing() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Logo />
        <h1>환경변수가 필요합니다</h1>
        <p>Vercel에 Supabase URL과 publishable key를 설정해주세요.</p>
      </section>
    </main>
  )
}

export default App
