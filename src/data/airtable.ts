// Airtable adapter: fetch through the local proxy, map raw records to the
// normalized model using the candidate lists in src/config/airtable.config.ts.

import {
  AIRTABLE_CONFIG,
  type AirtableConfig,
  type DateFormat,
  type LeadSourceGroups,
  type TableIds,
} from '../config/airtable.config'
import { toISODate } from '../lib/timeRange'
import type { CallReport, CallType, DMClose, LeadSource, SalesData } from './types'

export interface AirtableRecord {
  id: string
  createdTime?: string
  fields: Record<string, unknown>
}

export interface AirtablePage {
  records: AirtableRecord[]
  offset?: string
}

export interface MappedData {
  data: SalesData
  unmappedLeadSources: string[]
}

export const API_BASE = '/api/airtable'

// ---------- field matching ----------

/** Lowercase, strip everything that is not a letter or digit. "Closer's Name" -> "closersname". */
export function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Unwrap Airtable oddities: lookups come as arrays, some selects as objects with a name. */
function unwrap(value: unknown): unknown {
  if (Array.isArray(value)) return value.length ? unwrap(value[0]) : undefined
  if (value && typeof value === 'object' && 'name' in value) {
    const name = (value as { name?: unknown }).name
    return typeof name === 'string' ? name : value
  }
  return value
}

/** First candidate (in order) that exists in the record's fields, matched loosely. */
export function pickField(fields: Record<string, unknown>, candidates: string[]): unknown {
  const byKey = new Map<string, unknown>()
  for (const [key, value] of Object.entries(fields)) {
    const k = normalizeKey(key)
    if (!byKey.has(k)) byKey.set(k, value)
  }
  for (const candidate of candidates) {
    const k = normalizeKey(candidate)
    if (byKey.has(k)) return unwrap(byKey.get(k))
  }
  return undefined
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

// ---------- value parsers ----------

/** Numbers, or strings like "$4,000", "4,000", "4k", "4.5K". Blank or unparseable = 0. */
export function parseCurrency(value: unknown): number {
  const v = unwrap(value)
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const text = asText(v)
  if (!text) return 0
  const cleaned = text.replace(/[^0-9.kKmM-]/g, '')
  const match = /^(-?\d*\.?\d+)\s*([kKmM])?$/.exec(cleaned)
  if (!match) return 0
  let n = parseFloat(match[1])
  if (!Number.isFinite(n)) return 0
  const suffix = match[2]?.toLowerCase()
  if (suffix === 'k') n *= 1000
  if (suffix === 'm') n *= 1_000_000
  return n
}

/** "Yes" / "Y" / true / "✓" / checkbox / 1 -> true. Anything else false. */
export function parseYesNo(value: unknown): boolean {
  const v = unwrap(value)
  if (v === true) return true
  if (typeof v === 'number') return v > 0
  const text = asText(v).toLowerCase()
  return ['yes', 'y', 'true', 'checked', '1', '✓', '✔', '✅'].includes(text)
}

const NEGATIVE_START = /^(no\b|not\b|un|non|didn|never|none)/i
const YES_WORDS = ['yes', 'y', 'true', 'checked', '1', '✓', '✔', '✅']

/**
 * Yes / Y / true / tick / checkbox / 1, or a positive word such as "Qualified" or "Pitched"
 * (the live base stores "Qualified" instead of "Yes"). Anything starting with No, Not, Un or
 * Non is false, so "Not Qualified" and "Unqualified" never count.
 */
export function parseFlag(value: unknown, positiveWords: readonly string[] = []): boolean {
  const v = unwrap(value)
  if (v === true) return true
  if (typeof v === 'number') return v > 0
  const text = asText(v).toLowerCase()
  if (!text) return false
  if (NEGATIVE_START.test(text)) return false
  if (YES_WORDS.includes(text)) return true
  return positiveWords.some((word) => text.includes(word))
}

/** Call Status: /^show/i or Yes/true -> showed. "No Show", "Rescheduled", "Cancelled", "" -> false. */
export function parseShowed(value: unknown): boolean {
  const v = unwrap(value)
  if (v === true) return true
  const text = asText(v)
  if (!text) return false
  if (/^show/i.test(text)) return true
  return parseYesNo(text)
}

/**
 * closed = Call Outcome matches /clos|won|sale|deal|purchas/i and NOT /not|no |lost|didn/i.
 * A checkbox column "Closed" also counts. When Call Outcome is blank, closed = revenue > 0.
 */
export function parseClosed(outcome: unknown, closedFlag: unknown, revenue: number): boolean {
  if (closedFlag !== undefined && closedFlag !== null && closedFlag !== '') {
    if (parseYesNo(closedFlag)) return true
  }
  const text = asText(unwrap(outcome))
  if (text) {
    return /clos|won|sale|deal|purchas/i.test(text) && !/not|no |lost|didn/i.test(text)
  }
  return revenue > 0
}

/** Anything containing "follow" (any case, with or without hyphen) or 2nd / 3rd -> Follow-up. */
export function parseCallType(value: unknown): CallType {
  const text = asText(unwrap(value))
  return /follow|2nd|3rd|4th|second|third/i.test(text) ? 'Follow-up' : '1st Call'
}

function twoDigitYear(y: number): number {
  return y < 100 ? 2000 + y : y
}

/**
 * Accepts ISO dates, ISO datetimes, DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD and free text dates.
 * Returns a local YYYY-MM-DD, or null when it cannot be read.
 */
export function parseAirtableDate(value: unknown, dateFormat: DateFormat = 'auto'): string | null {
  const v = unwrap(value)
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : toISODate(v)
  const text = asText(v)
  if (!text) return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (iso) return text

  const isoDateTime = /^(\d{4})-(\d{2})-(\d{2})T/.exec(text)
  if (isoDateTime) {
    const d = new Date(text)
    return Number.isNaN(d.getTime()) ? null : toISODate(d)
  }

  const ymd = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/.exec(text)
  if (ymd) return build(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]))

  const parts = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(text)
  if (parts) {
    const a = Number(parts[1])
    const b = Number(parts[2])
    const year = twoDigitYear(Number(parts[3]))
    let dayFirst: boolean
    if (dateFormat === 'dmy') dayFirst = true
    else if (dateFormat === 'mdy') dayFirst = false
    else if (a > 12) dayFirst = true
    else if (b > 12) dayFirst = false
    else dayFirst = true
    return dayFirst ? build(year, b, a) : build(year, a, b)
  }

  const d = new Date(text)
  return Number.isNaN(d.getTime()) ? null : toISODate(d)
}

function build(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(year, month - 1, day)
  if (d.getMonth() !== month - 1) return null
  return toISODate(d)
}

export interface LeadSourceLookup {
  leadSource: LeadSource
  raw: string
  known: boolean
}

/** Organic vs Paid Ads by config lookup. Unknown values default to Organic and are flagged. */
export function groupLeadSource(raw: unknown, groups: LeadSourceGroups = AIRTABLE_CONFIG.leadSourceGroups): LeadSourceLookup {
  const text = asText(unwrap(raw))
  const key = normalizeKey(text)
  if (!key) return { leadSource: 'Organic', raw: text, known: false }
  if (groups.paidAds.some((g) => normalizeKey(g) === key)) return { leadSource: 'Paid Ads', raw: text, known: true }
  if (groups.organic.some((g) => normalizeKey(g) === key)) return { leadSource: 'Organic', raw: text, known: true }
  return { leadSource: 'Organic', raw: text, known: false }
}

function parseCloser(value: unknown): string {
  const text = asText(unwrap(value))
  return text || 'Unknown'
}

function optionalText(value: unknown): string | undefined {
  const text = asText(unwrap(value))
  return text || undefined
}

// ---------- record mapping ----------

export interface MapResult<T> {
  record: T | null
  unmappedLeadSource: string | null
}

/** Map one Post Call Report record. Returns null when no usable date exists. */
export function mapCallRecord(rec: AirtableRecord, config: AirtableConfig = AIRTABLE_CONFIG): MapResult<CallReport> {
  const f = config.fields.calls
  const fields = rec.fields ?? {}
  const date = parseAirtableDate(pickField(fields, f.date), config.dateFormat) ?? parseAirtableDate(rec.createdTime, config.dateFormat)
  if (!date) return { record: null, unmappedLeadSource: null }

  const source = groupLeadSource(pickField(fields, f.leadSource), config.leadSourceGroups)
  const revenue = parseCurrency(pickField(fields, f.revenue))
  const cashCollected = parseCurrency(pickField(fields, f.cashCollected))
  const callStatusRaw = pickField(fields, f.callStatus)
  const callOutcomeRaw = pickField(fields, f.callOutcome)
  const closed = parseClosed(callOutcomeRaw, pickField(fields, f.closed), revenue)
  const objection = asText(unwrap(pickField(fields, f.objection)))

  const record: CallReport = {
    id: rec.id,
    date,
    closer: parseCloser(pickField(fields, f.closer)),
    leadSource: source.leadSource,
    callType: parseCallType(pickField(fields, f.callType)),
    showed: parseShowed(callStatusRaw),
    qualified: parseFlag(pickField(fields, f.qualified), ['qualified']),
    pitched: parseFlag(pickField(fields, f.pitched), ['pitched']),
    closed,
    // Revenue only counts once the deal is closed (a deposit is not a close). Cash always counts,
    // and contractValue keeps the figure as typed so deposits can be reported separately.
    revenue: closed ? revenue : 0,
    contractValue: revenue,
    cashCollected,
    objection: objection || null,
    prospect: optionalText(pickField(fields, f.prospect)),
    leadSourceRaw: source.raw,
    callStatus: optionalText(callStatusRaw),
    callOutcome: optionalText(callOutcomeRaw),
    nextSteps: optionalText(pickField(fields, f.nextSteps)),
    notes: optionalText(pickField(fields, f.notes)),
    phone: optionalText(pickField(fields, f.phone)),
    email: optionalText(pickField(fields, f.email)),
  }
  return { record, unmappedLeadSource: source.known || !source.raw ? null : source.raw }
}

/** Map one Text Close Report record. Returns null when no usable date exists. */
export function mapDMRecord(rec: AirtableRecord, config: AirtableConfig = AIRTABLE_CONFIG): MapResult<DMClose> {
  const f = config.fields.dm
  const fields = rec.fields ?? {}
  const date = parseAirtableDate(pickField(fields, f.date), config.dateFormat) ?? parseAirtableDate(rec.createdTime, config.dateFormat)
  if (!date) return { record: null, unmappedLeadSource: null }
  const source = groupLeadSource(pickField(fields, f.leadSource), config.leadSourceGroups)
  const record: DMClose = {
    id: rec.id,
    date,
    closer: parseCloser(pickField(fields, f.closer)),
    leadSource: source.leadSource,
    revenue: parseCurrency(pickField(fields, f.revenue)),
    cashCollected: parseCurrency(pickField(fields, f.cashCollected)),
    prospect: optionalText(pickField(fields, f.prospect)),
    leadSourceRaw: source.raw,
  }
  return { record, unmappedLeadSource: source.known || !source.raw ? null : source.raw }
}

/** Map both tables and collect the lead source values the config does not know about. */
export function mapRecords(
  callRecords: AirtableRecord[],
  dmRecords: AirtableRecord[],
  config: AirtableConfig = AIRTABLE_CONFIG,
): MappedData {
  const unmapped = new Set<string>()
  const calls: CallReport[] = []
  const dmCloses: DMClose[] = []
  for (const rec of callRecords) {
    const r = mapCallRecord(rec, config)
    if (r.record) calls.push(r.record)
    if (r.unmappedLeadSource) unmapped.add(r.unmappedLeadSource)
  }
  for (const rec of dmRecords) {
    const r = mapDMRecord(rec, config)
    if (r.record) dmCloses.push(r.record)
    if (r.unmappedLeadSource) unmapped.add(r.unmappedLeadSource)
  }
  const byDateDesc = <T extends { date: string; id: string }>(a: T, b: T) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
  return {
    data: { calls: calls.sort(byDateDesc), dmCloses: dmCloses.sort(byDateDesc) },
    unmappedLeadSources: [...unmapped].sort(),
  }
}

// ---------- fetching ----------

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** Thrown when the proxy answers 401: the session cookie is missing or expired. */
export class UnauthorizedError extends Error {
  constructor(message = 'Sign in required') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

/** All records of one table through the proxy, following offset pagination (100 per page). */
export async function fetchTable(tableId: string, fetchImpl: FetchLike = fetch, apiBase: string = API_BASE): Promise<AirtableRecord[]> {
  if (!tableId) throw new Error('Airtable table id is missing')
  const records: AirtableRecord[] = []
  let offset: string | undefined
  let guard = 0
  do {
    const params = new URLSearchParams({ pageSize: '100' })
    if (offset) params.set('offset', offset)
    const res = await fetchImpl(`${apiBase}/${encodeURIComponent(tableId)}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    })
    if (res.status === 401) throw new UnauthorizedError()
    if (!res.ok) {
      let detail = ''
      try {
        const body = (await res.json()) as { error?: unknown }
        detail = typeof body?.error === 'string' ? body.error : JSON.stringify(body?.error ?? '')
      } catch {
        detail = ''
      }
      throw new Error(`Airtable request failed (${res.status})${detail ? `: ${detail}` : ''}`)
    }
    const page = (await res.json()) as AirtablePage
    records.push(...(page.records ?? []))
    offset = page.offset
    guard += 1
  } while (offset && guard < 200)
  return records
}

/** Fetch both tables and map them. (Direct mode, kept for tests and for ALLOW_DIRECT_AIRTABLE.) */
export async function fetchAll(tables: TableIds, fetchImpl: FetchLike = fetch, config: AirtableConfig = AIRTABLE_CONFIG): Promise<MappedData> {
  const [callRecords, dmRecords] = await Promise.all([fetchTable(tables.calls, fetchImpl), fetchTable(tables.dm, fetchImpl)])
  return mapRecords(callRecords, dmRecords, config)
}

// ---------- server snapshot (the normal path, SPEC section 13) ----------

export interface SnapshotError {
  type: string
  status: number | null
  message: string
  at: string
}

export interface SnapshotResponse {
  configured: boolean
  /** Human name of whatever the server read, for the footer: "Google Sheets" or "Airtable". */
  sourceLabel?: string
  fetchedAt: string | null
  nextRefreshAt: string | null
  refreshMinutes: number
  manualCooldownMinutes: number
  error: SnapshotError | null
  records: { calls: AirtableRecord[]; dm: AirtableRecord[] }
}

/** The server's copy of both tables. Costs nothing on Airtable, so the browser can poll it freely. */
export async function fetchSnapshot(fetchImpl: FetchLike = fetch): Promise<SnapshotResponse> {
  const res = await fetchImpl('/api/snapshot', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
  if (res.status === 401) throw new UnauthorizedError()
  if (res.status === 503) {
    return { configured: false, fetchedAt: null, nextRefreshAt: null, refreshMinutes: 0, manualCooldownMinutes: 0, error: null, records: { calls: [], dm: [] } }
  }
  if (!res.ok) throw new Error(`Proxy server not reachable (${res.status}). Run: npm run dev`)
  return (await res.json()) as SnapshotResponse
}

export type RefreshResult =
  | { ok: true }
  | { ok: false; skipped: 'cooldown'; waitSeconds: number }
  | { ok: false; error: SnapshotError }

/** Ask the server to fetch from Airtable now. The server enforces the cooldown. */
export async function requestRefresh(fetchImpl: FetchLike = fetch): Promise<RefreshResult> {
  const res = await fetchImpl('/api/refresh', { method: 'POST', headers: { Accept: 'application/json' }, credentials: 'same-origin' })
  if (res.status === 401) throw new UnauthorizedError()
  if (!res.ok) throw new Error(`Refresh failed (${res.status})`)
  return (await res.json()) as RefreshResult
}
