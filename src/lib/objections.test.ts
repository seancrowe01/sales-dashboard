import { describe, expect, it } from 'vitest'
import type { CallReport, SalesData } from '../data/types'
import { computeObjections, normalizeObjection } from './metrics'

function call(id: string, objection: string | null, leadSource: 'Organic' | 'Paid Ads' = 'Organic'): CallReport {
  return {
    id,
    date: '2026-09-01',
    closer: 'Sam Rivera',
    leadSource,
    leadSourceRaw: leadSource === 'Organic' ? 'Organic' : 'Ads',
    callType: '1st Call',
    showed: true,
    qualified: true,
    pitched: true,
    closed: false,
    revenue: 0,
    contractValue: 0,
    cashCollected: 0,
    objection,
  }
}

describe('normalizeObjection', () => {
  it('folds case, spacing and trailing punctuation into one key and keeps the wording as typed', () => {
    expect(normalizeObjection('Money')).toEqual({ key: 'money', label: 'Money' })
    expect(normalizeObjection('  money.  ')).toEqual({ key: 'money', label: 'Money' })
    expect(normalizeObjection('MONEY!')).toEqual({ key: 'money', label: 'MONEY' })
    expect(normalizeObjection('shopping   around')).toEqual({ key: 'shopping around', label: 'Shopping around' })
    expect(normalizeObjection('Need to Think')).toEqual({ key: 'need to think', label: 'Need to Think' })
  })

  it('returns null for blank text', () => {
    expect(normalizeObjection('')).toBeNull()
    expect(normalizeObjection('   ')).toBeNull()
    expect(normalizeObjection(null)).toBeNull()
    expect(normalizeObjection(undefined)).toBeNull()
  })
})

describe('computeObjections with free text', () => {
  it('groups variants of the same objection and keeps other sources out', () => {
    const data: SalesData = {
      calls: [
        call('a', 'Money'),
        call('b', 'money '),
        call('c', 'MONEY.'),
        call('d', 'Timing'),
        call('e', 'timing', 'Paid Ads'),
        call('f', null),
        call('g', ''),
      ],
      dmCloses: [],
    }
    const organic = computeObjections(data, 'Organic')
    expect(organic).toEqual([
      { objection: 'Money', count: 3, pct: 0.75 },
      { objection: 'Timing', count: 1, pct: 0.25 },
    ])
    const paid = computeObjections(data, 'Paid Ads')
    expect(paid).toEqual([{ objection: 'Timing', count: 1, pct: 1 }])
  })
})
