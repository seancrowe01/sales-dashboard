import { describe, expect, it } from 'vitest'
import { RateLimiter, ReadCache, cookieHeader, parseCookies, signSession, timingSafeEqualStr, verifySession } from './auth.mjs'

const SECRET = 'test-secret-do-not-use'

describe('timingSafeEqualStr', () => {
  it('compares strings without throwing on different lengths', () => {
    expect(timingSafeEqualStr('abc', 'abc')).toBe(true)
    expect(timingSafeEqualStr('abc', 'abd')).toBe(false)
    expect(timingSafeEqualStr('abc', 'abcd')).toBe(false)
    expect(timingSafeEqualStr('', '')).toBe(true)
    expect(timingSafeEqualStr(undefined, '')).toBe(true)
  })
})

describe('session tokens', () => {
  it('round trips a valid token', () => {
    const token = signSession(SECRET, 2_000_000)
    expect(verifySession(SECRET, token, 1_000_000)).toBe(true)
  })

  it('rejects expired, tampered, foreign and malformed tokens', () => {
    const token = signSession(SECRET, 2_000_000, 'nonce')
    expect(verifySession(SECRET, token, 2_000_000)).toBe(false)
    expect(verifySession(SECRET, token.replace('nonce', 'other'), 1_000_000)).toBe(false)
    expect(verifySession(SECRET, `9${token}`, 1_000_000)).toBe(false)
    expect(verifySession('another-secret', token, 1_000_000)).toBe(false)
    expect(verifySession(SECRET, 'not.a.token.at.all', 1_000_000)).toBe(false)
    expect(verifySession(SECRET, '', 1_000_000)).toBe(false)
    expect(verifySession(SECRET, undefined, 1_000_000)).toBe(false)
  })
})

describe('cookies', () => {
  it('parses a cookie header', () => {
    expect(parseCookies('a=1; vc_session=abc.def.ghi; b=x%20y')).toEqual({ a: '1', vc_session: 'abc.def.ghi', b: 'x y' })
    expect(parseCookies(undefined)).toEqual({})
  })

  it('builds a hardened Set-Cookie value', () => {
    expect(cookieHeader('vc_session', 'tok', { maxAgeSeconds: 60, secure: true })).toBe(
      'vc_session=tok; Path=/; HttpOnly; SameSite=Lax; Max-Age=60; Secure',
    )
    expect(cookieHeader('vc_session', '', { maxAgeSeconds: 0 })).toBe('vc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
  })
})

describe('RateLimiter', () => {
  it('allows up to the limit inside the window and resets after it', () => {
    const limiter = new RateLimiter(3, 1000)
    expect(limiter.hit('ip', 0)).toBe(true)
    expect(limiter.hit('ip', 10)).toBe(true)
    expect(limiter.hit('ip', 20)).toBe(true)
    expect(limiter.hit('ip', 30)).toBe(false)
    expect(limiter.hit('other', 30)).toBe(true)
    expect(limiter.hit('ip', 1000)).toBe(true)
  })
})

describe('ReadCache', () => {
  it('serves a cached value inside the ttl and reloads after it', async () => {
    let loads = 0
    const cache = new ReadCache(1000)
    const loader = async () => ({ status: 200, body: `load ${(loads += 1)}` })
    const first = await cache.get('k', loader, { nowMs: 0 })
    const second = await cache.get('k', loader, { nowMs: 500 })
    const third = await cache.get('k', loader, { nowMs: 5000 })
    expect(first).toEqual({ value: { status: 200, body: 'load 1' }, cached: false })
    expect(second).toEqual({ value: { status: 200, body: 'load 1' }, cached: true })
    expect(third.value.body).toBe('load 2')
    expect(loads).toBe(2)
  })

  it('de-duplicates concurrent loads of the same key', async () => {
    let loads = 0
    const cache = new ReadCache(1000)
    const loader = () =>
      new Promise((resolve) => {
        loads += 1
        setTimeout(() => resolve({ status: 200, body: 'x' }), 10)
      })
    const results = await Promise.all([cache.get('k', loader), cache.get('k', loader), cache.get('k', loader)])
    expect(results.map((r) => r.value.body)).toEqual(['x', 'x', 'x'])
    expect(loads).toBe(1)
  })

  it('does not keep values the caller rejects, and never caches with ttl 0', async () => {
    let loads = 0
    const cache = new ReadCache(1000)
    const failing = async () => ({ status: 500, body: `fail ${(loads += 1)}` })
    await cache.get('k', failing, { shouldCache: (v) => v.status === 200 })
    await cache.get('k', failing, { shouldCache: (v) => v.status === 200 })
    expect(loads).toBe(2)

    const none = new ReadCache(0)
    let count = 0
    const loader = async () => ({ status: 200, body: `n ${(count += 1)}` })
    await none.get('k', loader)
    await none.get('k', loader)
    expect(count).toBe(2)
  })
})
