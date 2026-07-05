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

async function ensureToken() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  let session = data.session
  if (!session) {
    const { data: signed } = await supabase.auth.signInAnonymously()
    session = signed.session
  }
  return session?.access_token || null
}

function installFetchBridge() {
  const original = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input && input.url) || ''
    if (!configured || !url.startsWith('/api/live')) {
      return original(input, init)
    }
    const headers = new Headers(init.headers || undefined)
    const token = await ensureToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return original(`${API_BASE}${url}`, { ...init, headers })
  }
}

// Bootstrap: install the bridge and pre-warm the anonymous session so the very
// first wardrobe fetch already carries a token.
export async function initLiveBridge() {
  if (!configured) return
  installFetchBridge()
  try {
    await ensureToken()
  } catch {
    /* offline / not configured — prototype falls back to sample data */
  }
}
