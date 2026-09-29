import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SnapshotStore, friendlyMessage } from './snapshot.mjs'

const TABLES = { calls: 'tblCALLS', dm: 'tblDM' }

function okResponse(records, offset) {
  return { ok: true, status: 200, text: async () => JSON.stringify(offset ? { records, offset } : { records }) }
}

function makeStore(fetchImpl, file) {
  return new SnapshotStore({
    file,
    token: 'pat_test',
    baseId: 'appTEST',
    tables: TABLES,
    refreshMs: 60 * 60_000,
    manualCooldownMs: 10 * 60_000,
    fetchImpl,
  })
}

let dir
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('SnapshotStore', () => {
  it('fetches both tables, follows pagination, and saves to disk', async () => {
    const calls = []
    const fetchImpl = async (url) => {
      calls.push(url)
      const u = new URL(url)
      if (u.pathname.endsWith('/tblCALLS')) {
        return u.searchParams.get('offset') ? okResponse([{ id: 'rec2', fields: {} }]) : okResponse([{ id: 'rec1', fields: {} }], 'page2')
      }
      return okResponse([{ id: 'dm1', fields: {} }])
    }
    const file = path.join(dir, 'snapshot.json')
    const store = makeStore(fetchImpl, file)
    const result = await store.refresh('test')
    expect(result.ok).toBe(true)
    expect(calls.length).toBe(3)
    expect(store.get().records.calls.map((r) => r.id)).toEqual(['rec1', 'rec2'])
    expect(store.get().records.dm.map((r) => r.id)).toEqual(['dm1'])
    expect(store.get().error).toBeNull()
    expect(fs.existsSync(file)).toBe(true)

    const again = makeStore(fetchImpl, file)
    expect(again.load()).toBe(true)
    expect(again.get().records.calls.length).toBe(2)
    expect(again.get().fetchedAt).toBe(store.get().fetchedAt)
  })

  it('keeps the last good data and explains a billing limit error', async () => {
    let fail = false
    const fetchImpl = async () => {
      if (fail) {
        return {
          ok: false,
          status: 429,
          text: async () => JSON.stringify({ errors: [{ error: 'PUBLIC_API_BILLING_LIMIT_EXCEEDED', message: 'API billing plan limit exceeded.' }] }),
        }
      }
      return okResponse([{ id: 'rec1', fields: {} }])
    }
    const store = makeStore(fetchImpl, path.join(dir, 'snapshot.json'))
    await store.refresh('first')
    fail = true
    const result = await store.refresh('second')
    expect(result.ok).toBe(false)
    expect(store.get().records.calls.length).toBe(1)
    expect(store.get().error.type).toBe('PUBLIC_API_BILLING_LIMIT_EXCEEDED')
    expect(store.get().error.message).toContain('monthly API limit')
  })

  it('honours the manual refresh cooldown', async () => {
    let hits = 0
    const fetchImpl = async () => {
      hits += 1
      return okResponse([])
    }
    const store = makeStore(fetchImpl, path.join(dir, 'snapshot.json'))
    const first = await store.manualRefresh()
    const second = await store.manualRefresh()
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    expect(second.skipped).toBe('cooldown')
    expect(second.waitSeconds).toBeGreaterThan(0)
    expect(hits).toBe(2) // two tables, one refresh
  })

  it('de-duplicates overlapping refreshes', async () => {
    let hits = 0
    const fetchImpl = async () => {
      hits += 1
      await new Promise((r) => setTimeout(r, 10))
      return okResponse([])
    }
    const store = makeStore(fetchImpl, path.join(dir, 'snapshot.json'))
    await Promise.all([store.refresh('a'), store.refresh('b'), store.refresh('c')])
    expect(hits).toBe(2)
  })
})

describe('friendlyMessage', () => {
  it('maps the common failures to plain English', () => {
    expect(friendlyMessage({ status: 401 })).toContain('token')
    expect(friendlyMessage({ status: 404 })).toContain('not found')
    expect(friendlyMessage({ status: 429 })).toContain('rate limiting')
    expect(friendlyMessage({ message: 'boom' })).toContain('boom')
  })
})
