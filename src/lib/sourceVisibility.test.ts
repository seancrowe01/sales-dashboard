import { describe, expect, it } from 'vitest'
import { generateMockData } from '../data/mock'
import type { SalesData } from '../data/types'
import { filterByRange, hasSourceData } from './metrics'
import { getRange } from './timeRange'

// The Paid Ads blocks are hidden whenever hasSourceData(filtered, 'Paid Ads') is false.
const now = new Date(2026, 8, 2, 12, 0, 0)
const all = generateMockData(now)
const fourWeeks = filterByRange(all, getRange('FourWeeks', now))

describe('hasSourceData', () => {
  it('sees both sources in the 4 week sample', () => {
    expect(hasSourceData(fourWeeks, 'Paid Ads')).toBe(true)
    expect(hasSourceData(fourWeeks, 'Organic')).toBe(true)
  })

  it('is false when the source has no calls and no text closes', () => {
    const organicOnly: SalesData = {
      calls: fourWeeks.calls.filter((c) => c.leadSource === 'Organic'),
      dmCloses: fourWeeks.dmCloses.filter((d) => d.leadSource === 'Organic'),
    }
    expect(hasSourceData(organicOnly, 'Paid Ads')).toBe(false)
    expect(hasSourceData(organicOnly, 'Organic')).toBe(true)
  })

  it('counts a lone text close as data', () => {
    const dmOnly: SalesData = {
      calls: [],
      dmCloses: fourWeeks.dmCloses.filter((d) => d.leadSource === 'Paid Ads'),
    }
    expect(dmOnly.dmCloses.length).toBeGreaterThan(0)
    expect(hasSourceData(dmOnly, 'Paid Ads')).toBe(true)
  })

  it('is false for a range with nothing in it', () => {
    const empty = filterByRange(all, getRange('Custom', now, { start: '2027-01-01', end: '2027-01-31' }))
    expect(hasSourceData(empty, 'Paid Ads')).toBe(false)
    expect(hasSourceData(empty, 'Organic')).toBe(false)
  })
})
