// Sign-in helpers for the password gate. The password goes to the proxy
// once over POST; after that a signed HttpOnly cookie carries the session.

export interface SessionInfo {
  authenticated: boolean
  /** False when the server runs with ALLOW_NO_PASSWORD (local testing only). */
  required: boolean
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export async function fetchSession(fetchImpl: FetchLike = fetch): Promise<SessionInfo> {
  const res = await fetchImpl('/api/session', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
  if (!res.ok) throw new Error(`Proxy server not reachable (${res.status}). Run: npm run dev`)
  const body = (await res.json()) as Partial<SessionInfo>
  return { authenticated: body.authenticated === true, required: body.required !== false }
}

export type LoginResult = { ok: true } | { ok: false; message: string }

export async function login(password: string, fetchImpl: FetchLike = fetch): Promise<LoginResult> {
  const res = await fetchImpl('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ password }),
    credentials: 'same-origin',
  })
  if (res.ok) return { ok: true }
  let message = res.status === 429 ? 'Too many attempts. Wait a minute and try again.' : 'Wrong password.'
  try {
    const body = (await res.json()) as { error?: unknown }
    if (typeof body.error === 'string' && body.error) message = body.error
  } catch {
    // keep the default message
  }
  return { ok: false, message }
}

export async function logout(fetchImpl: FetchLike = fetch): Promise<void> {
  try {
    await fetchImpl('/api/logout', { method: 'POST', credentials: 'same-origin' })
  } catch {
    // Signing out locally still happens; the cookie simply expires on its own.
  }
}
