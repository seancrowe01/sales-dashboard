// Access control helpers for the proxy: signed session tokens, cookies, a login rate limiter
// and a small read cache. Pure functions and classes, no I/O, so they are unit tested directly.

import crypto from 'node:crypto'

/** Constant-time string comparison. Never leaks how many characters matched. */
export function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a ?? ''))
  const bb = Buffer.from(String(b ?? ''))
  if (ab.length !== bb.length) {
    // Still burn a comparison so length mismatches take the same time as wrong passwords.
    crypto.timingSafeEqual(ab, ab)
    return false
  }
  return crypto.timingSafeEqual(ab, bb)
}

function hmac(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

/** Session token "expiresAtMs.nonce.signature", signed with the server secret. */
export function signSession(secret, expiresAtMs, nonce = crypto.randomBytes(12).toString('base64url')) {
  const payload = `${Math.floor(expiresAtMs)}.${nonce}`
  return `${payload}.${hmac(secret, payload)}`
}

/** True when the token was signed with this secret and has not expired. */
export function verifySession(secret, token, nowMs = Date.now()) {
  if (typeof token !== 'string' || token.length > 200) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [exp, nonce, signature] = parts
  if (!/^\d{1,16}$/.test(exp) || !/^[A-Za-z0-9_-]{1,64}$/.test(nonce)) return false
  if (Number(exp) <= nowMs) return false
  return timingSafeEqualStr(signature, hmac(secret, `${exp}.${nonce}`))
}

/** "a=1; b=2" -> { a: '1', b: '2' }. */
export function parseCookies(header) {
  const out = {}
  if (typeof header !== 'string' || !header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i <= 0) continue
    const key = part.slice(0, i).trim()
    const value = part.slice(i + 1).trim()
    if (!key) continue
    try {
      out[key] = decodeURIComponent(value)
    } catch {
      out[key] = value
    }
  }
  return out
}

/** Set-Cookie header value. HttpOnly + SameSite=Lax always, Secure when the site is on https. */
export function cookieHeader(name, value, { maxAgeSeconds, secure = false } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (maxAgeSeconds !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`)
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

/** Fixed window limiter: at most `limit` hits per `windowMs` for each key (normally an IP). */
export class RateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit
    this.windowMs = windowMs
    this.hits = new Map()
  }

  /** Records a hit and returns true while the key is still under the limit. */
  hit(key, nowMs = Date.now()) {
    const entry = this.hits.get(key)
    if (!entry || nowMs - entry.start >= this.windowMs) {
      this.hits.set(key, { start: nowMs, count: 1 })
      return true
    }
    entry.count += 1
    return entry.count <= this.limit
  }

  prune(nowMs = Date.now()) {
    for (const [key, entry] of this.hits) {
      if (nowMs - entry.start >= this.windowMs) this.hits.delete(key)
    }
  }
}

/**
 * Small time-based cache with in-flight de-duplication: ten open browser tabs asking for the
 * same Airtable page inside the window produce one upstream request.
 */
export class ReadCache {
  constructor(ttlMs) {
    this.ttlMs = ttlMs
    this.entries = new Map()
    this.inFlight = new Map()
  }

  /**
   * Returns { value, cached }. `loader` runs only on a miss. `shouldCache(value)` decides whether
   * the loaded value is kept (errors from upstream are not).
   */
  async get(key, loader, { nowMs = Date.now(), shouldCache = () => true } = {}) {
    if (this.ttlMs > 0) {
      const hit = this.entries.get(key)
      if (hit && nowMs - hit.at < this.ttlMs) return { value: hit.value, cached: true }
      const pending = this.inFlight.get(key)
      if (pending) return pending.then((value) => ({ value, cached: true }))
    }
    const promise = Promise.resolve()
      .then(loader)
      .then((value) => {
        if (this.ttlMs > 0 && shouldCache(value)) this.entries.set(key, { at: nowMs, value })
        return value
      })
      .finally(() => this.inFlight.delete(key))
    if (this.ttlMs > 0) this.inFlight.set(key, promise)
    return promise.then((value) => ({ value, cached: false }))
  }

  clear() {
    this.entries.clear()
  }

  prune(nowMs = Date.now()) {
    for (const [key, entry] of this.entries) {
      if (nowMs - entry.at >= this.ttlMs) this.entries.delete(key)
    }
  }
}
