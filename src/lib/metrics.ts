// Single source of truth for every number on the dashboard.
// All functions are pure. They take already-filtered data, or the range / now explicitly.
// Nothing here reads the wall clock.

import type { CallReport, CallType, LeadSource, SalesData } from '../data/types'
import { safeDiv } from './format'
import { type Bucket, type TimeRange, bucketIndex, daysSince, earliestDate, getBuckets, inRange } from './timeRange'

// ---------- filters ----------

/** Keep only records whose date falls inside the range. */
export function filterByRange(data: SalesData, range: TimeRange): SalesData {
  return {
    calls: data.calls.filter((c) => inRange(c.date, range)),
    dmCloses: data.dmCloses.filter((d) => inRange(d.date, range)),
  }
}

/** Keep only records from one lead source (Organic or Paid Ads). */
export function filterBySource(data: SalesData, source: LeadSource): SalesData {
  return {
    calls: data.calls.filter((c) => c.leadSource === source),
    dmCloses: data.dmCloses.filter((d) => d.leadSource === source),
  }
}

/** Keep only calls of one type. DM closes have no call type, so they are dropped. */
export function filterByCallType(data: SalesData, callType: CallType): SalesData {
  return {
    calls: data.calls.filter((c) => c.callType === callType),
    dmCloses: [],
  }
}

/** Keep only records for one closer (calls and DM closes). */
export function filterByCloser(data: SalesData, closer: string): SalesData {
  return {
    calls: data.calls.filter((c) => c.closer === closer),
    dmCloses: data.dmCloses.filter((d) => d.closer === closer),
  }
}

// ---------- overview (section 3 + 4.2) ----------

export interface Overview {
  scheduled: number
  shown: number
  qualified: number
  pitched: number
  callClosed: number
  textClosed: number
  closed: number
  revenue: number
  cashCollected: number
  /** Calls whose outcome is a deposit: part paid, not closed yet. */
  deposits: number
  /** Contract Value on those deposit rows, which is deliberately NOT in revenue. */
  depositContractValue: number
  dmRevenue: number
  dmCashCollected: number
  avgDeal: number
  avgCashPerDeal: number
  showRate: number
  qualifiedRate: number
  pitchRate: number
  closeRate: number // closed / shown
  closeRateOfPitched: number // closed / pitched, used for the "10 / 27 pitched" subtitle
  firstCalls: number // 1st-call calls scheduled
  firstCallsShown: number
  firstCallsClosed: number
  firstCallCloseRate: number // closed 1st-call calls / shown 1st-call calls
  followUps: number // follow-up calls scheduled
  followUpsShown: number
  followUpsClosed: number
  followUpCloseRate: number // closed follow-up calls / shown follow-up calls
}

function sum(values: number[]): number {
  let total = 0
  for (const v of values) total += Number.isFinite(v) ? v : 0
  return total
}

/** Every headline metric for a set of calls and DM closes (already filtered). */
export function computeOverview(data: SalesData): Overview {
  const calls = data.calls
  const dm = data.dmCloses
  const scheduled = calls.length
  const shown = calls.filter((c) => c.showed).length
  const qualified = calls.filter((c) => c.qualified).length
  const pitched = calls.filter((c) => c.pitched).length
  const callClosed = calls.filter((c) => c.closed).length
  const textClosed = dm.length
  const closed = callClosed + textClosed
  const dmRevenue = sum(dm.map((d) => d.revenue))
  const dmCashCollected = sum(dm.map((d) => d.cashCollected))
  const depositCalls = calls.filter(isDeposit)
  const depositContractValue = sum(depositCalls.map((c) => c.contractValue))
  const revenue = sum(calls.map((c) => c.revenue)) + dmRevenue
  const cashCollected = sum(calls.map((c) => c.cashCollected)) + dmCashCollected

  const first = calls.filter((c) => c.callType === '1st Call')
  const follow = calls.filter((c) => c.callType === 'Follow-up')
  const firstCallsShown = first.filter((c) => c.showed).length
  const firstCallsClosed = first.filter((c) => c.closed).length
  const followUpsShown = follow.filter((c) => c.showed).length
  const followUpsClosed = follow.filter((c) => c.closed).length

  return {
    scheduled,
    shown,
    qualified,
    pitched,
    callClosed,
    textClosed,
    closed,
    revenue,
    cashCollected,
    deposits: depositCalls.length,
    depositContractValue,
    dmRevenue,
    dmCashCollected,
    avgDeal: safeDiv(revenue, closed),
    avgCashPerDeal: safeDiv(cashCollected, closed),
    showRate: safeDiv(shown, scheduled),
    qualifiedRate: safeDiv(qualified, shown),
    pitchRate: safeDiv(pitched, qualified),
    closeRate: safeDiv(closed, shown),
    closeRateOfPitched: safeDiv(closed, pitched),
    firstCalls: first.length,
    firstCallsShown,
    firstCallsClosed,
    firstCallCloseRate: safeDiv(firstCallsClosed, firstCallsShown),
    followUps: follow.length,
    followUpsShown,
    followUpsClosed,
    followUpCloseRate: safeDiv(followUpsClosed, followUpsShown),
  }
}

// ---------- lead source breakdown (4.3) ----------

export interface SourceBreakdown extends Overview {
  source: LeadSource
}

/** Section 4.3 panel numbers for one lead source. */
export function computeSourceBreakdown(data: SalesData, source: LeadSource): SourceBreakdown {
  return { source, ...computeOverview(filterBySource(data, source)) }
}

/**
 * True when the source has at least one call or text close in the (already filtered) data.
 * The dashboard hides every Paid Ads block while this is false for Paid Ads.
 */
export function hasSourceData(data: SalesData, source: LeadSource): boolean {
  return data.calls.some((c) => c.leadSource === source) || data.dmCloses.some((d) => d.leadSource === source)
}

// ---------- call type breakdown (4.4 / 4.5) ----------

export interface CallTypeBreakdown {
  source: LeadSource
  callType: CallType
  totalCalls: number
  shown: number
  qualified: number
  pitched: number
  closed: number // closed calls of this type (DM closes are not calls)
  showRate: number
  qualifiedRate: number
  pitchRate: number
  closeRate: number // closed / shown of this type
  revenue: number
  cashCollected: number
  avgDeal: number // revenue / closed
}

/** Section 4.4 / 4.5 panel numbers for one lead source and call type. */
export function computeCallTypeBreakdown(data: SalesData, source: LeadSource, callType: CallType): CallTypeBreakdown {
  const calls = data.calls.filter((c) => c.leadSource === source && c.callType === callType)
  const totalCalls = calls.length
  const shown = calls.filter((c) => c.showed).length
  const qualified = calls.filter((c) => c.qualified).length
  const pitched = calls.filter((c) => c.pitched).length
  const closed = calls.filter((c) => c.closed).length
  const revenue = sum(calls.map((c) => c.revenue))
  const cashCollected = sum(calls.map((c) => c.cashCollected))
  return {
    source,
    callType,
    totalCalls,
    shown,
    qualified,
    pitched,
    closed,
    showRate: safeDiv(shown, totalCalls),
    qualifiedRate: safeDiv(qualified, shown),
    pitchRate: safeDiv(pitched, qualified),
    closeRate: safeDiv(closed, shown),
    revenue,
    cashCollected,
    avgDeal: safeDiv(revenue, closed),
  }
}

// ---------- close distribution (4.6 / 4.7) ----------

export type CloseType = '1st Call Close' | 'Follow-up Close' | 'Text Close'

export const CLOSE_TYPES: readonly CloseType[] = ['1st Call Close', 'Follow-up Close', 'Text Close'] as const

export interface CloseSlice {
  type: CloseType
  count: number
  revenue: number
  cash: number
  countPct: number // share of all closes (0..1)
  revenuePct: number // share of all close revenue (0..1)
  cashPct: number // share of all close cash (0..1)
}

/**
 * Counts and revenue by close type for one lead source. Always returns the three types in
 * order; the pie charts drop slices with count 0 (or revenue 0 for the revenue pie).
 */
export function computeCloseDistribution(data: SalesData, source: LeadSource): CloseSlice[] {
  const scoped = filterBySource(data, source)
  const firstClosed = scoped.calls.filter((c) => c.closed && c.callType === '1st Call')
  const followClosed = scoped.calls.filter((c) => c.closed && c.callType === 'Follow-up')
  const raw: Array<{ type: CloseType; count: number; revenue: number; cash: number }> = [
    {
      type: '1st Call Close',
      count: firstClosed.length,
      revenue: sum(firstClosed.map((c) => c.revenue)),
      cash: sum(firstClosed.map((c) => c.cashCollected)),
    },
    {
      type: 'Follow-up Close',
      count: followClosed.length,
      revenue: sum(followClosed.map((c) => c.revenue)),
      cash: sum(followClosed.map((c) => c.cashCollected)),
    },
    {
      type: 'Text Close',
      count: scoped.dmCloses.length,
      revenue: sum(scoped.dmCloses.map((d) => d.revenue)),
      cash: sum(scoped.dmCloses.map((d) => d.cashCollected)),
    },
  ]
  const totalCount = sum(raw.map((r) => r.count))
  const totalRevenue = sum(raw.map((r) => r.revenue))
  const totalCash = sum(raw.map((r) => r.cash))
  return raw.map((r) => ({
    ...r,
    countPct: safeDiv(r.count, totalCount),
    revenuePct: safeDiv(r.revenue, totalRevenue),
    cashPct: safeDiv(r.cash, totalCash),
  }))
}

// ---------- trends (4.8) ----------

export interface TrendPoint {
  key: string // bucket start as YYYY-MM-DD
  label: string // "Feb 1" or "Feb 2026"
  start: Date
  end: Date
  revenue: number // contract value on closed calls + DM closes
  cash: number // cash collected on every call + DM closes, the figure teams actually track
  firstCalls: number // 1st-call calls scheduled
  followUps: number // follow-up calls scheduled
  textCloses: number // DM closes
}

/**
 * One point per bucket, oldest first. Pass the full data and the active range; the function
 * filters to the range itself (All Time buckets start at the earliest record).
 */
export function computeTrends(data: SalesData, range: TimeRange): TrendPoint[] {
  const scoped = filterByRange(data, range)
  const earliest =
    range.preset === 'AllTime'
      ? earliestDate([...scoped.calls.map((c) => c.date), ...scoped.dmCloses.map((d) => d.date)])
      : null
  const buckets: Bucket[] = getBuckets(range, earliest)
  const points: TrendPoint[] = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    start: b.start,
    end: b.end,
    revenue: 0,
    cash: 0,
    firstCalls: 0,
    followUps: 0,
    textCloses: 0,
  }))
  for (const c of scoped.calls) {
    const i = bucketIndex(buckets, c.date)
    if (i < 0) continue
    points[i].revenue += c.revenue
    points[i].cash += c.cashCollected
    if (c.callType === 'Follow-up') points[i].followUps += 1
    else points[i].firstCalls += 1
  }
  for (const d of scoped.dmCloses) {
    const i = bucketIndex(buckets, d.date)
    if (i < 0) continue
    points[i].revenue += d.revenue
    points[i].cash += d.cashCollected
    points[i].textCloses += 1
  }
  return points
}

// ---------- funnel (4.9 / 4.10) ----------

export type FunnelStageName = 'Scheduled' | 'Showed' | 'Qualified' | 'Pitched' | 'Closed'

export interface FunnelStage {
  stage: FunnelStageName
  count: number
  conversion: number | null // stage / previous stage, null for Scheduled
  width: number // stage / scheduled, clamped to 0..1
}

/** Five stage funnel for one lead source. Closed = call closes + text closes for that source. */
export function computeFunnel(data: SalesData, source: LeadSource): FunnelStage[] {
  const o = computeOverview(filterBySource(data, source))
  const counts: Array<[FunnelStageName, number]> = [
    ['Scheduled', o.scheduled],
    ['Showed', o.shown],
    ['Qualified', o.qualified],
    ['Pitched', o.pitched],
    ['Closed', o.closed],
  ]
  return counts.map(([stage, count], i) => ({
    stage,
    count,
    conversion: i === 0 ? null : safeDiv(count, counts[i - 1][1]),
    width: Math.min(1, safeDiv(count, o.scheduled)),
  }))
}

// ---------- objections (4.9 / 4.10) ----------

export interface ObjectionCount {
  objection: string
  count: number
  pct: number // share of all objections (0..1); the chart label rounds it to a whole percent
}

/**
 * The Airtable "Main objection" column is free text, so "money", "Money " and "MONEY." must count
 * as one objection. Key = lower case, single spaces, no trailing punctuation. Label = the text as
 * typed (cleaned the same way) with a capital first letter, so "Need to Think" stays as written.
 */
export function normalizeObjection(raw: string | null | undefined): { key: string; label: string } | null {
  const cleaned = (raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s.,;:!]+$/g, '')
  if (!cleaned) return null
  const key = cleaned.toLowerCase()
  const label = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  return { key, label }
}

/**
 * Objection counts for one lead source, most common first. Ties keep the order the objection
 * first appeared in time (oldest record first), so the result is stable whatever order the
 * records arrive in.
 */
export function computeObjections(data: SalesData, source: LeadSource): ObjectionCount[] {
  const counts = new Map<string, { label: string; count: number }>()
  const chronological = [...data.calls].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  for (const c of chronological) {
    if (c.leadSource !== source) continue
    const normalized = normalizeObjection(c.objection)
    if (!normalized) continue
    const entry = counts.get(normalized.key)
    if (entry) entry.count += 1
    else counts.set(normalized.key, { label: normalized.label, count: 1 })
  }
  const total = sum([...counts.values()].map((e) => e.count))
  return [...counts.values()]
    .map(({ label, count }) => ({ objection: label, count, pct: safeDiv(count, total) }))
    .sort((a, b) => b.count - a.count)
}

// ---------- closer table (4.11) ----------

export type CloserStatus = 'Good' | 'Average' | 'Needs Work' | 'No Data'

export interface CloserRow {
  closer: string
  calls: number
  shows: number
  firstCalls: number
  followUps: number
  textCloses: number
  qualified: number
  pitched: number
  closed: number // call closes + text closes
  closeRate: number
  firstCallCloseRate: number
  followUpCloseRate: number
  revenue: number
  cash: number
  status: CloserStatus
}

/** Status pill rule: Good >= 25%, Average >= 15%, otherwise Needs Work; No Data when nothing was shown. */
export function closerStatus(closeRate: number, shows: number): CloserStatus {
  if (shows === 0) return 'No Data'
  if (closeRate >= 0.25) return 'Good'
  if (closeRate >= 0.15) return 'Average'
  return 'Needs Work'
}

/** One row per closer present in the data (calls or DM closes), sorted by revenue descending then name. */
export function computeCloserRows(data: SalesData): CloserRow[] {
  const names = new Set<string>()
  for (const c of data.calls) names.add(c.closer)
  for (const d of data.dmCloses) names.add(d.closer)
  const rows: CloserRow[] = [...names].map((closer) => {
    const o = computeOverview(filterByCloser(data, closer))
    return {
      closer,
      calls: o.scheduled,
      shows: o.shown,
      firstCalls: o.firstCalls,
      followUps: o.followUps,
      textCloses: o.textClosed,
      qualified: o.qualified,
      pitched: o.pitched,
      closed: o.closed,
      closeRate: o.closeRate,
      firstCallCloseRate: o.firstCallCloseRate,
      followUpCloseRate: o.followUpCloseRate,
      revenue: o.revenue,
      cash: o.cashCollected,
      status: closerStatus(o.closeRate, o.shown),
    }
  })
  return rows.sort((a, b) => b.revenue - a.revenue || a.closer.localeCompare(b.closer))
}

// ---------- follow-ups view (section 11) ----------

export type FollowUpStatus = 'Deposit' | 'Rescheduled' | 'Open'

export interface OpenFollowUpRow {
  id: string
  date: string
  prospect: string
  closer: string
  leadSource: LeadSource
  leadSourceRaw: string
  callType: CallType
  qualified: boolean
  pitched: boolean
  objection: string | null
  nextSteps: string
  daysSince: number
  status: FollowUpStatus
}

export interface NoShowRow {
  id: string
  date: string
  prospect: string
  closer: string
  leadSource: LeadSource
  leadSourceRaw: string
  callType: CallType
  daysSince: number
  phone: string
  email: string
  callStatus: string
}

export interface FollowUpsSummary {
  openFollowUps: number
  deposits: number // calls whose callOutcome contains "deposit"
  noShows: number
  scheduled: number
  noShowRate: number // noShows / scheduled
  oldestOpenDays: number | null // days since the oldest open follow-up, null when none
  oldestOpenProspect: string | null
}

export interface FollowUpsResult {
  summary: FollowUpsSummary
  openRows: OpenFollowUpRow[]
  noShowRows: NoShowRow[]
}

export function isDeposit(call: CallReport): boolean {
  return /deposit/i.test(call.callOutcome ?? '')
}

export function isRescheduled(call: CallReport): boolean {
  return /resched/i.test(call.callStatus ?? '')
}

export function followUpStatus(call: CallReport): FollowUpStatus {
  if (isDeposit(call)) return 'Deposit'
  if (isRescheduled(call)) return 'Rescheduled'
  return 'Open'
}

function newestFirst<T extends { date: string; id: string }>(a: T, b: T): number {
  return b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
}

/** Chase list for the Follow-Ups tab. Takes range-filtered data and the reference "now". */
export function computeFollowUps(data: SalesData, now: Date): FollowUpsResult {
  const calls = data.calls
  const openRows: OpenFollowUpRow[] = calls
    .filter((c) => c.showed && !c.closed)
    .map((c) => ({
      id: c.id,
      date: c.date,
      prospect: c.prospect?.trim() || 'Unknown',
      closer: c.closer,
      leadSource: c.leadSource,
      leadSourceRaw: c.leadSourceRaw,
      callType: c.callType,
      qualified: c.qualified,
      pitched: c.pitched,
      objection: c.objection,
      nextSteps: c.nextSteps?.trim() ?? '',
      daysSince: daysSince(c.date, now) ?? 0,
      status: followUpStatus(c),
    }))
    .sort(newestFirst)

  const noShowRows: NoShowRow[] = calls
    .filter((c) => !c.showed)
    .map((c) => ({
      id: c.id,
      date: c.date,
      prospect: c.prospect?.trim() || 'Unknown',
      closer: c.closer,
      leadSource: c.leadSource,
      leadSourceRaw: c.leadSourceRaw,
      callType: c.callType,
      daysSince: daysSince(c.date, now) ?? 0,
      phone: c.phone?.trim() ?? '',
      email: c.email?.trim() ?? '',
      callStatus: c.callStatus?.trim() ?? '',
    }))
    .sort(newestFirst)

  let oldest: OpenFollowUpRow | null = null
  for (const row of openRows) {
    if (!oldest || row.daysSince > oldest.daysSince) oldest = row
  }

  return {
    summary: {
      openFollowUps: openRows.length,
      deposits: calls.filter(isDeposit).length,
      noShows: noShowRows.length,
      scheduled: calls.length,
      noShowRate: safeDiv(noShowRows.length, calls.length),
      oldestOpenDays: oldest ? oldest.daysSince : null,
      oldestOpenProspect: oldest ? oldest.prospect : null,
    },
    openRows,
    noShowRows,
  }
}

/** Search helper for the Follow-Ups tab: matches prospect, closer or objection, case-insensitive. */
export function matchesFollowUpSearch(row: { prospect: string; closer: string; objection?: string | null }, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    row.prospect.toLowerCase().includes(q) ||
    row.closer.toLowerCase().includes(q) ||
    (row.objection ?? '').toLowerCase().includes(q)
  )
}
