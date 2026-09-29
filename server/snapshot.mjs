// Server-side snapshot of both report tables.
// The server is the only thing that ever talks to the data source: a slow timer (a few times a
// day), plus the Refresh button with a cooldown. Every browser reads the snapshot, so ten open tabs
// cost nothing extra, and the snapshot is saved to disk so a restart never shows zeros.
//
// Two sources are supported and the records come out in the same shape either way:
//   - Google Sheets (the live source since Sep 2026), passed in as `source`
//   - Airtable (the original source), used when no `source` is given
// Airtable's Free plan allows 1,000 API calls a month per workspace, which is what forced the slow
// timer in the first place; Sheets has no limit we would reach, but the timer stays because the
// team does not need the numbers to move more often than that.

import fs from 'node:fs'
import path from 'node:path'

const MAX_PAGES = 200

export class SnapshotStore {
  constructor({
    file,
    token,
    baseId,
    tables,
    views = {},
    source = null,
    describeError = friendlyMessage,
    refreshMs,
    manualCooldownMs,
    fetchImpl = fetch,
    log = () => {},
  }) {
    this.file = file
    this.token = token
    this.baseId = baseId
    this.tables = tables // { calls, dm }
    this.views = views // { [tableId]: viewId }
    // Optional pluggable source with fetchAll() -> { calls, dm }. When absent, Airtable is read.
    this.source = source
    // Turns a failure into a sentence the team can act on. Swapped per source.
    this.describeError = describeError
    this.refreshMs = refreshMs
    this.manualCooldownMs = manualCooldownMs
    this.fetchImpl = fetchImpl
    this.log = log
    this.state = { fetchedAt: null, records: { calls: [], dm: [] }, error: null, lastAttemptAt: null, lastManualAt: null }
    this.inFlight = null
    this.timer = null
  }

  /** Read the last saved snapshot from disk, if any. */
  load() {
    try {
      if (!this.file || !fs.existsSync(this.file)) return false
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      if (saved && saved.records && Array.isArray(saved.records.calls) && Array.isArray(saved.records.dm)) {
        this.state.fetchedAt = saved.fetchedAt || null
        this.state.records = saved.records
        this.log(`snapshot loaded from disk (${saved.records.calls.length} calls, ${saved.records.dm.length} text closes, fetched ${saved.fetchedAt})`)
        return true
      }
    } catch (err) {
      this.log(`snapshot file unreadable: ${err.message}`)
    }
    return false
  }

  save() {
    if (!this.file) return
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      const tmp = `${this.file}.tmp`
      fs.writeFileSync(tmp, JSON.stringify({ fetchedAt: this.state.fetchedAt, records: this.state.records }))
      fs.renameSync(tmp, this.file)
    } catch (err) {
      this.log(`snapshot save failed: ${err.message}`)
    }
  }

  /** What the browser gets. Records are raw Airtable records; the browser maps them. */
  get() {
    return {
      fetchedAt: this.state.fetchedAt,
      nextRefreshAt: this.nextRefreshAt(),
      refreshMinutes: Math.round(this.refreshMs / 60_000),
      manualCooldownMinutes: Math.round(this.manualCooldownMs / 60_000),
      error: this.state.error,
      records: this.state.records,
    }
  }

  nextRefreshAt() {
    const base = this.state.lastAttemptAt || Date.now()
    return new Date(base + this.refreshMs).toISOString()
  }

  async fetchTable(tableId) {
    const records = []
    let offset
    let pages = 0
    do {
      const params = new URLSearchParams({ pageSize: '100' })
      if (offset) params.set('offset', offset)
      const view = this.views[tableId]
      if (view) params.set('view', view)
      const url = `https://api.airtable.com/v0/${encodeURIComponent(this.baseId)}/${encodeURIComponent(tableId)}?${params.toString()}`
      const res = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' } })
      const text = await res.text()
      if (!res.ok) {
        const err = new Error(`Airtable ${res.status}`)
        err.status = res.status
        try {
          const body = JSON.parse(text)
          const first = body?.errors?.[0]?.error ?? body?.error?.type ?? body?.error
          const message = body?.errors?.[0]?.message ?? body?.error?.message ?? ''
          err.type = typeof first === 'string' ? first : 'AIRTABLE_ERROR'
          err.detail = message
        } catch {
          err.type = 'AIRTABLE_ERROR'
          err.detail = text.slice(0, 200)
        }
        throw err
      }
      const page = JSON.parse(text)
      records.push(...(page.records ?? []))
      offset = page.offset
      pages += 1
    } while (offset && pages < MAX_PAGES)
    return records
  }

  /** Both tables, from whichever source is configured. */
  async fetchBoth() {
    if (this.source) return this.source.fetchAll()
    const [calls, dm] = await Promise.all([this.fetchTable(this.tables.calls), this.fetchTable(this.tables.dm)])
    return { calls, dm }
  }

  /**
   * Fetch both tables. On success the snapshot and the disk file are replaced. On failure the
   * old data stays and the error is remembered so the footer can explain it.
   */
  async refresh(reason = 'timer') {
    if (this.inFlight) return this.inFlight
    this.inFlight = (async () => {
      this.state.lastAttemptAt = Date.now()
      try {
        const { calls, dm } = await this.fetchBoth()
        this.state.records = { calls, dm }
        this.state.fetchedAt = new Date().toISOString()
        this.state.error = null
        this.save()
        this.log(`snapshot refreshed (${reason}): ${calls.length} calls, ${dm.length} text closes`)
        return { ok: true }
      } catch (err) {
        this.state.error = {
          type: err.type || 'FETCH_FAILED',
          status: err.status || null,
          message: this.describeError(err),
          at: new Date().toISOString(),
        }
        this.log(`snapshot refresh failed (${reason}): ${this.state.error.type} ${err.status || ''}`)
        return { ok: false, error: this.state.error }
      } finally {
        this.inFlight = null
      }
    })()
    return this.inFlight
  }

  /** Refresh button: honours the cooldown so a click-happy team cannot burn the allowance. */
  async manualRefresh() {
    const now = Date.now()
    if (this.state.lastManualAt && now - this.state.lastManualAt < this.manualCooldownMs) {
      const waitMs = this.manualCooldownMs - (now - this.state.lastManualAt)
      return { ok: false, skipped: 'cooldown', waitSeconds: Math.ceil(waitMs / 1000) }
    }
    this.state.lastManualAt = now
    return this.refresh('manual')
  }

  /** Timer. Skips the very first fetch when the disk copy is younger than one interval. */
  start() {
    const age = this.state.fetchedAt ? Date.now() - Date.parse(this.state.fetchedAt) : Infinity
    if (age >= this.refreshMs) void this.refresh('startup')
    else this.log(`snapshot is ${Math.round(age / 60_000)} minutes old, next timer refresh in ${Math.round((this.refreshMs - age) / 60_000)} minutes`)
    // With no snapshot on disk the startup fetch above already ran, so the first timer tick waits a full interval.
    const first = this.state.fetchedAt ? Math.max(5_000, this.refreshMs - age) : this.refreshMs
    this.timer = setTimeout(() => {
      void this.refresh('timer')
      this.timer = setInterval(() => void this.refresh('timer'), this.refreshMs)
      if (this.timer.unref) this.timer.unref()
    }, first)
    if (this.timer.unref) this.timer.unref()
  }
}

export function friendlyMessage(err) {
  if (err && err.type === 'PUBLIC_API_BILLING_LIMIT_EXCEEDED') {
    return "Airtable's monthly API limit for this workspace is used up. Showing the last data received. It resets on the 1st of the month, or sooner if the workspace plan is upgraded."
  }
  if (err && err.status === 429) return 'Airtable is rate limiting requests. Showing the last data received.'
  if (err && err.status === 401) return 'Airtable rejected the token. Check AIRTABLE_TOKEN in the settings file.'
  if (err && err.status === 403) return 'The Airtable token has no access to this base or table.'
  if (err && err.status === 404) return 'Airtable base or table id not found. Check the settings file.'
  return `Could not reach Airtable (${(err && (err.detail || err.message)) || 'unknown error'}). Showing the last data received.`
}
