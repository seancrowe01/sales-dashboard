import { describe, expect, it } from 'vitest'
import { generateMockData } from '../data/mock'
import {
  computeCallTypeBreakdown,
  computeCloseDistribution,
  computeCloserRows,
  computeFollowUps,
  computeFunnel,
  computeObjections,
  computeOverview,
  computeSourceBreakdown,
  computeTrends,
  filterByRange,
} from './metrics'
import { getRange } from './timeRange'

// Reference numbers from the specto 4.11 and 11, under the 4 Weeks filter.
const now = new Date(2026, 8, 2, 12, 0, 0)
const all = generateMockData(now)
const range = getRange('FourWeeks', now)
const data = filterByRange(all, range)

const close3 = (n: number) => Number(n.toFixed(3))

describe('mock data shape', () => {
  it('is deterministic for the same now', () => {
    const again = generateMockData(now)
    expect(again).toEqual(all)
  })

  it('has older records so Year and All Time differ from 4 Weeks', () => {
    const year = filterByRange(all, getRange('Year', now))
    expect(year.calls.length).toBeGreaterThan(data.calls.length)
    expect(year.dmCloses.length).toBeGreaterThan(data.dmCloses.length)
    const closers = new Set(year.calls.map((c) => c.closer))
    expect(closers.has('Sam Rivera')).toBe(true)
    expect(closers.has('Dani Okafor')).toBe(true)
    // nothing older than 300 days, nothing between 28 and 30 days
    const oldest = getRange('Custom', now, { start: '2025-01-01', end: '2025-11-05' })
    expect(filterByRange(all, oldest).calls.length).toBe(0)
  })

  it('gives every call a prospect name and exercises the raw lead source grouping', () => {
    expect(all.calls.every((c) => typeof c.prospect === 'string' && c.prospect.length > 0)).toBe(true)
    const raws = new Set(data.calls.map((c) => c.leadSourceRaw))
    expect(raws.has('Instagram')).toBe(true)
    expect(raws.has('Referral')).toBe(true)
    expect(raws.has('VSL')).toBe(true)
    expect(raws.has('Free Guide')).toBe(true)
    expect(data.calls.filter((c) => c.showed && !c.closed).every((c) => c.objection)).toBe(true)
  })
})

describe('4.2 master overview', () => {
  const o = computeOverview(data)

  it('counts', () => {
    expect(o.scheduled).toBe(58)
    expect(o.shown).toBe(36)
    expect(o.qualified).toBe(25)
    expect(o.pitched).toBe(27)
    expect(o.callClosed).toBe(7)
    expect(o.textClosed).toBe(3)
    expect(o.closed).toBe(10)
    expect(o.firstCalls).toBe(55)
    expect(o.followUps).toBe(3)
  })

  it('money', () => {
    expect(o.revenue).toBe(40000)
    expect(o.cashCollected).toBe(30000)
    expect(o.avgDeal).toBe(4000)
    expect(o.avgCashPerDeal).toBe(3000)
    expect(o.dmRevenue).toBe(14000)
  })

  it('rates', () => {
    expect(close3(o.showRate)).toBe(0.621)
    expect(close3(o.qualifiedRate)).toBe(0.694)
    expect(close3(o.pitchRate)).toBe(1.08)
    expect(close3(o.closeRate)).toBe(0.278)
    expect(close3(o.closeRateOfPitched)).toBe(0.37)
    expect(close3(o.firstCallCloseRate)).toBe(0.121)
    expect(o.firstCallsShown).toBe(33)
    expect(o.firstCallsClosed).toBe(4)
    expect(close3(o.followUpCloseRate)).toBe(1)
  })
})

describe('4.3 lead source breakdown', () => {
  it('organic', () => {
    const s = computeSourceBreakdown(data, 'Organic')
    expect(s.revenue).toBe(34000)
    expect(s.closed).toBe(8)
    expect(s.cashCollected).toBe(27000)
    expect(s.avgDeal).toBe(4250)
    expect(close3(s.closeRate)).toBe(0.276)
    expect(s.pitched).toBe(23)
    expect(s.scheduled).toBe(42)
    expect(s.shown).toBe(29)
    expect(close3(s.showRate)).toBe(0.69)
    expect(s.qualified).toBe(22)
    expect(close3(s.qualifiedRate)).toBe(0.759)
    expect(close3(s.pitchRate)).toBe(1.045)
  })

  it('paid ads', () => {
    const s = computeSourceBreakdown(data, 'Paid Ads')
    expect(s.revenue).toBe(6000)
    expect(s.closed).toBe(2)
    expect(s.cashCollected).toBe(3000)
    expect(s.avgDeal).toBe(3000)
    expect(close3(s.closeRate)).toBe(0.286)
    expect(s.pitched).toBe(4)
    expect(s.scheduled).toBe(16)
    expect(s.shown).toBe(7)
    expect(close3(s.showRate)).toBe(0.438)
    expect(s.qualified).toBe(3)
    expect(close3(s.qualifiedRate)).toBe(0.429)
    expect(close3(s.pitchRate)).toBe(1.333)
  })
})

describe('4.4 / 4.5 call type breakdown', () => {
  it('organic 1st call', () => {
    const b = computeCallTypeBreakdown(data, 'Organic', '1st Call')
    expect(b.totalCalls).toBe(39)
    expect(b.shown).toBe(26)
    expect(close3(b.showRate)).toBe(0.667)
    expect(b.qualified).toBe(19)
    expect(close3(b.qualifiedRate)).toBe(0.731)
    expect(b.pitched).toBe(20)
    expect(close3(b.pitchRate)).toBe(1.053)
    expect(b.closed).toBe(3)
    expect(close3(b.closeRate)).toBe(0.115)
    expect(b.revenue).toBe(12000)
    expect(b.avgDeal).toBe(4000)
    expect(b.cashCollected).toBe(5000)
  })

  it('organic follow-up', () => {
    const b = computeCallTypeBreakdown(data, 'Organic', 'Follow-up')
    expect([b.totalCalls, b.shown, b.qualified, b.pitched, b.closed]).toEqual([3, 3, 3, 3, 3])
    expect(close3(b.showRate)).toBe(1)
    expect(close3(b.qualifiedRate)).toBe(1)
    expect(close3(b.pitchRate)).toBe(1)
    expect(close3(b.closeRate)).toBe(1)
    expect(b.revenue).toBe(12000)
    expect(b.avgDeal).toBe(4000)
    expect(b.cashCollected).toBe(12000)
  })

  it('paid 1st call', () => {
    const b = computeCallTypeBreakdown(data, 'Paid Ads', '1st Call')
    expect(b.totalCalls).toBe(16)
    expect(b.shown).toBe(7)
    expect(close3(b.showRate)).toBe(0.438)
    expect(b.qualified).toBe(3)
    expect(close3(b.qualifiedRate)).toBe(0.429)
    expect(b.pitched).toBe(4)
    expect(close3(b.pitchRate)).toBe(1.333)
    expect(b.closed).toBe(1)
    expect(close3(b.closeRate)).toBe(0.143)
    expect(b.revenue).toBe(2000)
    expect(b.avgDeal).toBe(2000)
    expect(b.cashCollected).toBe(2000)
  })

  it('paid follow-up is all zeros', () => {
    const b = computeCallTypeBreakdown(data, 'Paid Ads', 'Follow-up')
    expect([b.totalCalls, b.shown, b.qualified, b.pitched, b.closed, b.revenue, b.cashCollected]).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect([b.showRate, b.qualifiedRate, b.pitchRate, b.closeRate, b.avgDeal]).toEqual([0, 0, 0, 0, 0])
  })
})

describe('4.6 / 4.7 close distribution', () => {
  it('organic', () => {
    const d = computeCloseDistribution(data, 'Organic')
    expect(d.map((s) => s.type)).toEqual(['1st Call Close', 'Follow-up Close', 'Text Close'])
    expect(d.map((s) => s.count)).toEqual([3, 3, 2])
    expect(d.map((s) => close3(s.countPct))).toEqual([0.375, 0.375, 0.25])
    expect(d.map((s) => s.revenue)).toEqual([12000, 12000, 10000])
    expect(d.map((s) => close3(s.revenuePct))).toEqual([0.353, 0.353, 0.294])
  })

  it('paid', () => {
    const d = computeCloseDistribution(data, 'Paid Ads')
    expect(d.map((s) => s.count)).toEqual([1, 0, 1])
    expect(d.map((s) => close3(s.countPct))).toEqual([0.5, 0, 0.5])
    expect(d.map((s) => s.revenue)).toEqual([2000, 0, 4000])
    expect(d.map((s) => close3(s.revenuePct))).toEqual([0.333, 0, 0.667])
    expect(d.filter((s) => s.count > 0).length).toBe(2)
  })
})

describe('4.8 overall trends', () => {
  it('4 week buckets oldest to newest', () => {
    const t = computeTrends(all, range)
    expect(t.length).toBe(4)
    expect(t.map((p) => p.label)).toEqual(['Aug 6', 'Aug 13', 'Aug 20', 'Aug 27'])
    expect(t.map((p) => p.revenue)).toEqual([22000, 10000, 8000, 0])
    expect(t.map((p) => p.firstCalls)).toEqual([20, 10, 18, 7])
    expect(t.map((p) => p.followUps)).toEqual([2, 1, 0, 0])
    expect(t.map((p) => p.textCloses)).toEqual([2, 1, 0, 0])
  })

  it('year uses monthly buckets and all time starts at the earliest record', () => {
    const year = computeTrends(all, getRange('Year', now))
    expect(year.length).toBe(13)
    expect(year[0].label).toBe('Sep 2025')
    expect(year[12].label).toBe('Sep 2026')
    const total = year.reduce((s, p) => s + p.revenue, 0)
    const o = computeOverview(filterByRange(all, getRange('Year', now)))
    expect(total).toBe(o.revenue)

    const allTime = computeTrends(all, getRange('AllTime', now))
    expect(allTime.length).toBeGreaterThan(4)
    expect(allTime.length).toBeLessThanOrEqual(13)
    expect(/^[A-Z][a-z]{2} \d{4}$/.test(allTime[0].label)).toBe(true)
    expect(allTime.reduce((s, p) => s + p.firstCalls + p.followUps, 0)).toBe(all.calls.length)
  })
})

describe('4.9 / 4.10 funnel and objections', () => {
  it('organic funnel', () => {
    const f = computeFunnel(data, 'Organic')
    expect(f.map((s) => s.stage)).toEqual(['Scheduled', 'Showed', 'Qualified', 'Pitched', 'Closed'])
    expect(f.map((s) => s.count)).toEqual([42, 29, 22, 23, 8])
    expect(f[0].conversion).toBeNull()
    expect(f.slice(1).map((s) => close3(s.conversion ?? -1))).toEqual([0.69, 0.759, 1.045, 0.348])
    expect(f[0].width).toBe(1)
    expect(close3(f[4].width)).toBe(0.19)
  })

  it('paid funnel', () => {
    const f = computeFunnel(data, 'Paid Ads')
    expect(f.map((s) => s.count)).toEqual([16, 7, 3, 4, 2])
    expect(f.slice(1).map((s) => close3(s.conversion ?? -1))).toEqual([0.438, 0.429, 1.333, 0.5])
  })

  it('organic objections', () => {
    const o = computeObjections(data, 'Organic')
    expect(o.map((x) => [x.objection, x.count])).toEqual([
      ['Timing', 9],
      ['Shopping Around', 9],
      ['Need Partner Approval', 3],
      ['Money', 2],
    ])
    expect(o.map((x) => Math.round(x.pct * 100))).toEqual([39, 39, 13, 9])
  })

  it('paid objections', () => {
    const o = computeObjections(data, 'Paid Ads')
    expect(o[0]).toMatchObject({ objection: 'Timing', count: 3 })
    const rest = o.slice(1).map((x) => [x.objection, x.count]).sort()
    expect(rest).toEqual([
      ['Money', 1],
      ['Need to Think', 1],
      ['Shopping Around', 1],
    ])
    expect(o.map((x) => Math.round(x.pct * 100))).toEqual([50, 17, 17, 17])
  })
})

describe('4.11 closer performance', () => {
  it('single closer row', () => {
    const rows = computeCloserRows(data)
    expect(rows.length).toBe(1)
    const r = rows[0]
    expect(r.closer).toBe('Sam Rivera')
    expect(r.calls).toBe(58)
    expect(r.shows).toBe(36)
    expect(r.firstCalls).toBe(55)
    expect(r.followUps).toBe(3)
    expect(r.textCloses).toBe(3)
    expect(r.qualified).toBe(25)
    expect(r.pitched).toBe(27)
    expect(r.closed).toBe(10)
    expect(close3(r.closeRate)).toBe(0.278)
    expect(close3(r.firstCallCloseRate)).toBe(0.121)
    expect(close3(r.followUpCloseRate)).toBe(1)
    expect(r.revenue).toBe(40000)
    expect(r.cash).toBe(30000)
    expect(r.status).toBe('Good')
  })

  it('status thresholds', () => {
    const year = filterByRange(all, getRange('Year', now))
    const rows = computeCloserRows(year)
    expect(rows.map((r) => r.closer).sort()).toEqual(['Dani Okafor', 'Sam Rivera'])
    for (const r of rows) {
      const expected = r.shows === 0 ? 'No Data' : r.closeRate >= 0.25 ? 'Good' : r.closeRate >= 0.15 ? 'Average' : 'Needs Work'
      expect(r.status).toBe(expected)
    }
  })
})

describe('11 follow-ups view', () => {
  const f = computeFollowUps(data, now)

  it('summary counts', () => {
    expect(f.summary.openFollowUps).toBe(29)
    expect(f.summary.deposits).toBe(2)
    expect(f.summary.noShows).toBe(22)
    expect(f.summary.scheduled).toBe(58)
    expect(close3(f.summary.noShowRate)).toBe(0.379)
    expect(f.summary.oldestOpenDays).toBe(27)
    expect(f.summary.oldestOpenProspect).toBe('Hannah G.')
  })

  it('rows', () => {
    expect(f.openRows.length).toBe(29)
    expect(f.noShowRows.length).toBe(22)
    expect(f.openRows.filter((r) => r.status === 'Deposit').length).toBe(2)
    expect(f.openRows.filter((r) => r.status === 'Deposit').every((r) => r.leadSource === 'Organic')).toBe(true)
    expect(f.openRows.every((r) => r.nextSteps.length > 0)).toBe(true)
    expect(f.openRows.every((r) => r.daysSince >= 0 && r.daysSince <= 27)).toBe(true)
    expect(f.noShowRows.some((r) => r.callStatus === 'Rescheduled')).toBe(true)
    // newest first
    for (let i = 1; i < f.openRows.length; i++) {
      expect(f.openRows[i - 1].date >= f.openRows[i].date).toBe(true)
    }
    const total = f.openRows.length + f.noShowRows.length + data.calls.filter((c) => c.closed).length
    expect(total).toBe(58)
  })
})

describe('deposits are reported, not hidden', () => {
  const o = computeOverview(data)

  it('counts deposit rows and the contract value behind them', () => {
    expect(o.deposits).toBeGreaterThan(0)
    expect(o.depositContractValue).toBeGreaterThan(0)
  })

  it('keeps that deposit money out of contract value, but its part payment in cash', () => {
    for (const c of data.calls.filter((x) => /deposit/i.test(x.callOutcome ?? ''))) {
      expect(c.closed).toBe(false)
      expect(c.revenue).toBe(0)
      expect(c.contractValue).toBeGreaterThan(0)
    }
  })

  it('contract value plus deposits is what adding up the column by hand would give', () => {
    const plainColumnSum =
      data.calls.reduce((s, c) => s + c.contractValue, 0) + data.dmCloses.reduce((s, d) => s + d.revenue, 0)
    expect(o.revenue + o.depositContractValue).toBe(plainColumnSum)
  })
})

describe('cash is tracked alongside contract value', () => {
  it('trend buckets carry cash, and it adds up to the headline cash figure', () => {
    const points = computeTrends(data, range)
    expect(points.reduce((s, p) => s + p.cash, 0)).toBe(computeOverview(data).cashCollected)
  })

  it('close type slices carry cash, and the shares total one', () => {
    const slices = computeCloseDistribution(data, 'Organic')
    const totalCash = slices.reduce((s, x) => s + x.cash, 0)
    if (totalCash > 0) expect(slices.reduce((s, x) => s + x.cashPct, 0)).toBeCloseTo(1, 6)
  })
})
