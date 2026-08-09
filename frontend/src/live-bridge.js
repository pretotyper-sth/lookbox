import { createClient } from '@supabase/supabase-js'

// Bridges the ported prototype (which calls same-origin `/api/live/*` with no
// auth) to the FastAPI + Supabase backend, without touching the prototype code.
// We keep an anonymous Supabase session and rewrite `/api/live/*` requests to the
// API base URL with a Bearer token attached.

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const configured = Boolean(API_BASE && SUPABASE_URL && SUPABASE_ANON_KEY)

let supabase = null
if (configured) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
}

// De-dupe concurrent token fetches (background warm-up + first request) so we
// don't kick off two anonymous sign-ins. Reset after settle so later calls can
// still pick up a refreshed session token.
let tokenInFlight = null
async function ensureToken() {
  if (!supabase) return null
  if (tokenInFlight) return tokenInFlight
  tokenInFlight = (async () => {
    const { data } = await supabase.auth.getSession()
    let session = data.session
    if (!session) {
      const { data: signed, error } = await supabase.auth.signInAnonymously()
      if (error) {
        console.error('[LOOKBOX] Anonymous sign-in failed:', error.status, error.message, error)
        return null
      }
      session = signed.session
    }
    return session?.access_token || null
  })()
  try {
    return await tokenInFlight
  } finally {
    tokenInFlight = null
  }
}

// Warm up TCP/TLS to the API and Supabase origins early so the first request is
// faster (DNS/handshake already done).
function addPreconnect(url) {
  if (!url || typeof document === 'undefined') return
  try {
    const { origin } = new URL(url)
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = origin
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  } catch {
    /* ignore malformed URL */
  }
}

// 토큰이 만료됐거나 다른 탭이 먼저 갱신해 무효가 됐을 때 익명 세션을 새로 판다.
// 여기 세션은 전부 익명이라 새로 파도 잃을 계정이 없다.
//
// 기존 세션을 먼저 지우지 않는다. 익명 로그인은 Supabase가 IP 단위로 횟수를 제한해서
// (429) 실패할 수 있는데, 미리 지워 두면 그나마 있던 세션까지 잃고 화면이 통째로 빈다.
// 같은 이유로 한 번 실패하면 그 페이지에서는 더 시도하지 않는다 — 계속 두드려 봐야
// 제한만 더 깎는다. 부팅 직후엔 요청이 한꺼번에 나가므로 겹치는 갱신은 하나로 묶는다.
let renewInFlight = null
let renewBlocked = false
async function renewAnonymousSession() {
  if (!supabase || renewBlocked) return null
  if (renewInFlight) return renewInFlight
  renewInFlight = (async () => {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      renewBlocked = true
      const hint = error.status === 429
        ? ' — 익명 로그인 횟수 제한입니다. 잠시 뒤 다시 시도하세요.'
        : ''
      console.error(`[LOOKBOX] Anonymous re-sign-in failed: ${error.status} ${error.message}${hint}`)
      return null
    }
    return data.session?.access_token || null
  })()
  try {
    return await renewInFlight
  } finally {
    renewInFlight = null
  }
}

function installFetchBridge() {
  const original = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input && input.url) || ''
    if (!configured || !url.startsWith('/api/live')) {
      return original(input, init)
    }
    const send = (token) => {
      const headers = new Headers(init.headers || undefined)
      if (token) headers.set('Authorization', `Bearer ${token}`)
      return original(`${API_BASE}${url}`, { ...init, headers })
    }
    const token = await ensureToken()
    const res = await send(token)
    // 401은 대부분 토큰이 죽은 것이다. 그냥 두면 탭을 열어둔 사이 세션이 만료됐을 때
    // 모든 요청이 계속 401로 떨어지고 화면이 빈 채로 남는다. 한 번만 다시 인증해 본다.
    if (res.status !== 401) return res
    const current = await ensureToken()
    const fresh = current && current !== token ? current : await renewAnonymousSession()
    return fresh ? send(fresh) : res
  }
}

// Bootstrap: install the bridge synchronously and warm the anonymous session in
// the BACKGROUND. We intentionally do NOT block first paint on the auth network
// round trip — the fetch bridge awaits the (already in-flight) token per request.
export function initLiveBridge() {
  if (!configured) {
    const missing = [
      !API_BASE && 'VITE_API_BASE_URL',
      !SUPABASE_URL && 'VITE_SUPABASE_URL',
      !SUPABASE_ANON_KEY && 'VITE_SUPABASE_ANON_KEY',
    ].filter(Boolean)
    console.warn(
      `[LOOKBOX] Backend not connected — missing build-time env: ${missing.join(', ')}. ` +
        'Set these in Vercel and redeploy to enable the real service.',
    )
    return
  }
  installFetchBridge()
  addPreconnect(API_BASE)
  addPreconnect(SUPABASE_URL)
  // fire-and-forget: don't await, so module import + render start immediately
  ensureToken().catch(() => {
    /* offline / not configured — prototype falls back to sample data */
  })
}
