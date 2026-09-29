import { describe, expect, it } from 'vitest'
import {
  bucketIndex,
  bucketMode,
  daysSince,
  formatBucketLabel,
  getBuckets,
  getRange,
  inRange,
  parseDate,
  rangeDays,
  toISODate,
} from './timeRange'

const now = new Date(2026, 8, 2, 12, 0, 0) // Wed 2 Sep 2026, midday

describe('getRange presets', () => {
  it('Last Week = 7 days including today', () => {
    const r = getRange('LastWeek', now)
    expect(toISODate(r.start)).toBe('2026-08-27')
    expect(r.start.getHours()).toBe(0)
    expect(toISODate(r.end)).toBe('2026-09-02')
    expect(r.end.getHours()).toBe(23)
    expect(r.end.getMinutes()).toBe(59)
    expect(r.end.getMilliseconds()).toBe(999)
    expect(rangeDays(r)).toBe(7)
    expect(r.label).toBe('Last Week')
  })

  it('2 Weeks = 14 days', () => {
    const r = getRange('TwoWeeks', now)
    expect(toISODate(r.start)).toBe('2026-08-20')
    expect(rangeDays(r)).toBe(14)
    expect(r.label).toBe('2 Weeks')
  })

  it('4 Weeks = 28 days', () => {
    const r = getRange('FourWeeks', now)
    expect(toISODate(r.start)).toBe('2026-08-06')
    expect(rangeDays(r)).toBe(28)
    expect(r.label).toBe('4 Weeks')
  })

  it('Year = 365 days', () => {
    const r = getRange('Year', now)
    expect(toISODate(r.start)).toBe('2025-09-03')
    expect(rangeDays(r)).toBe(365)
    expect(r.label).toBe('Year')
  })

  it('All Time starts far in the past and ends today', () => {
    const r = getRange('AllTime', now)
    expect(r.start.getFullYear()).toBe(1970)
    expect(toISODate(r.end)).toBe('2026-09-02')
    expect(r.label).toBe('All Time')
  })

  it('Custom takes both dates inclusive and swaps reversed input', () => {
    const r = getRange('Custom', now, { start: '2026-02-01', end: '2026-02-10' })
    expect(toISODate(r.start)).toBe('2026-02-01')
    expect(toISODate(r.end)).toBe('2026-02-10')
    expect(r.end.getHours()).toBe(23)
    expect(rangeDays(r)).toBe(10)
    const swapped = getRange('Custom', now, { start: '2026-02-10', end: '2026-02-01' })
    expect(toISODate(swapped.start)).toBe('2026-02-01')
    expect(toISODate(swapped.end)).toBe('2026-02-10')
  })

  it('Custom without dates falls back to a 4 week window', () => {
    const r = getRange('Custom', now)
    expect(r.preset).toBe('Custom')
    expect(toISODate(r.start)).toBe('2026-08-06')
  })
})

describe('inRange boundaries', () => {
  const r = getRange('FourWeeks', now)
  it('includes both ends and excludes the day before and after', () => {
    expect(inRange('2026-08-06', r)).toBe(true)
    expect(inRange('2026-09-02', r)).toBe(true)
    expect(inRange('2026-08-05', r)).toBe(false)
    expect(inRange('2026-09-03', r)).toBe(false)
    expect(inRange('not a date', r)).toBe(false)
    expect(inRange('', r)).toBe(false)
  })
  it('handles ISO datetimes', () => {
    expect(inRange('2026-09-02T22:30:00', r)).toBe(true)
  })
})

describe('parseDate and daysSince', () => {
  it('reads YYYY-MM-DD as local midnight', () => {
    const d = parseDate('2026-02-01')
    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(1)
    expect(d?.getDate()).toBe(1)
    expect(d?.getHours()).toBe(0)
  })
  it('counts whole days', () => {
    expect(daysSince('2026-09-02', now)).toBe(0)
    expect(daysSince('2026-08-06', now)).toBe(27)
    expect(daysSince('bad', now)).toBeNull()
  })
})

describe('buckets', () => {
  it('4 weeks = four 7-day buckets from the range start', () => {
    const r = getRange('FourWeeks', now)
    expect(bucketMode(r)).toBe('week')
    const b = getBuckets(r)
    expect(b.length).toBe(4)
    expect(b.map((x) => x.label)).toEqual(['Aug 6', 'Aug 13', 'Aug 20', 'Aug 27'])
    expect(toISODate(b[3].end)).toBe('2026-09-03')
    expect(bucketIndex(b, '2026-08-06')).toBe(0)
    expect(bucketIndex(b, '2026-08-12')).toBe(0)
    expect(bucketIndex(b, '2026-08-13')).toBe(1)
    expect(bucketIndex(b, '2026-09-02')).toBe(3)
    expect(bucketIndex(b, '2026-09-03')).toBe(-1)
  })

  it('a 10 day custom range gets two buckets', () => {
    const r = getRange('Custom', now, { start: '2026-02-01', end: '2026-02-10' })
    const b = getBuckets(r)
    expect(b.length).toBe(2)
    expect(b.map((x) => x.label)).toEqual(['Feb 1', 'Feb 8'])
  })

  it('ranges over 120 days use calendar months', () => {
    const r = getRange('Year', now)
    expect(bucketMode(r)).toBe('month')
    const b = getBuckets(r)
    expect(b.length).toBe(13)
    expect(b[0].label).toBe('Sep 2025')
    expect(b[12].label).toBe('Sep 2026')
    expect(bucketIndex(b, '2025-09-15')).toBe(0)
    expect(bucketIndex(b, '2026-09-01')).toBe(12)
  })

  it('exactly 120 days stays weekly, 121 goes monthly', () => {
    const weekly = getRange('Custom', now, { start: '2026-05-06', end: '2026-09-02' })
    expect(rangeDays(weekly)).toBe(120)
    expect(bucketMode(weekly)).toBe('week')
    const monthly = getRange('Custom', now, { start: '2026-05-05', end: '2026-09-02' })
    expect(rangeDays(monthly)).toBe(121)
    expect(bucketMode(monthly)).toBe('month')
  })

  it('All Time starts at the earliest record', () => {
    const r = getRange('AllTime', now)
    const earliest = new Date(2026, 6, 20)
    expect(bucketMode(r, earliest)).toBe('week')
    const b = getBuckets(r, earliest)
    expect(b[0].label).toBe('Jul 20')
    expect(b.length).toBe(7)
    const monthly = getBuckets(r, new Date(2025, 10, 6))
    expect(monthly[0].label).toBe('Nov 2025')
    // no records at all: fall back to a 4 week window
    expect(getBuckets(r, null).length).toBe(4)
  })

  it('formatBucketLabel is pure', () => {
    expect(formatBucketLabel(new Date(2026, 1, 1), 'week')).toBe('Feb 1')
    expect(formatBucketLabel(new Date(2026, 1, 1), 'month')).toBe('Feb 2026')
  })
})
