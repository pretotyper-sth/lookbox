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
        ? supabase.auth.signUp({ email, password })
        : supabase.auth.signInWithPassword({ email, password })
    const { error } = await action
    if (error) setAuthError(error.message)
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
      <main className="landing-page">
        <section className="landing-shell">
          <div className="landing-brand"><Logo /></div>
          <HeroPreview />
          <section className="landing-copy">
            <span className="eyebrow">AI wardrobe</span>
            <h1>내 옷장이 곧<br />나만의 스타일리스트</h1>
            <p>가진 옷으로 매일의 코디를 추천받고, 사고 싶은 옷과의 조합까지 미리 확인하세요.</p>
          </section>
          <form className="auth-form" onSubmit={submitAuth}>
            <label>이메일</label>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
            <label>비밀번호</label>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} />
            {authError && <div className="error">{authError}</div>}
            <button type="submit">{authMode === 'signup' ? '가입하고 시작' : '로그인'}</button>
          </form>
          <button className="link-button" onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}>
            {authMode === 'signup' ? '이미 계정이 있어요' : '처음이면 가입하기'}
          </button>
        </section>
      </main>
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
