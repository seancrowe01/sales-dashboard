import { describe, expect, it } from 'vitest'
import { count, days, formatDate, money, moneyShort, pct, pctWhole, safeDiv, timeStamp } from './format'

describe('format', () => {
  it('money defaults to pounds', () => {
    expect(money(40000)).toBe('£40,000')
    expect(money(4250)).toBe('£4,250')
    expect(money(0)).toBe('£0')
    expect(money(999.6)).toBe('£1,000')
    expect(money(-1200)).toBe('-£1,200')
    expect(money(NaN)).toBe('£0')
  })
  it('money accepts another symbol', () => {
    expect(money(40000, '$')).toBe('$40,000')
    expect(money(-5, '€')).toBe('-€5')
  })
  it('moneyShort', () => {
    expect(moneyShort(22000)).toBe('£22k')
    expect(moneyShort(0)).toBe('£0k')
    expect(moneyShort(1500)).toBe('£1.5k')
    expect(moneyShort(500)).toBe('£500')
    expect(moneyShort(120000)).toBe('£120k')
    expect(moneyShort(1_200_000)).toBe('£1.2M')
    expect(moneyShort(22000, '$')).toBe('$22k')
  })
  it('pct', () => {
    expect(pct(0.621)).toBe('62.1%')
    expect(pct(1.08)).toBe('108.0%')
    expect(pct(0)).toBe('0.0%')
    expect(pct(NaN)).toBe('0.0%')
    expect(pct(10 / 36)).toBe('27.8%')
  })
  it('pctWhole', () => {
    expect(pctWhole(0.391)).toBe('39%')
    expect(pctWhole(0.087)).toBe('9%')
    expect(pctWhole(0.5)).toBe('50%')
  })
  it('safeDiv', () => {
    expect(safeDiv(10, 0)).toBe(0)
    expect(safeDiv(10, 4)).toBe(2.5)
    expect(safeDiv(0, 0)).toBe(0)
  })
  it('count and timeStamp', () => {
    expect(count(1234)).toBe('1,234')
    expect(timeStamp(new Date(2026, 0, 1, 23, 30, 9))).toBe('23:30:09')
  })
  it('formatDate', () => {
    expect(formatDate('2026-08-06')).toBe('6 Aug 2026')
    expect(formatDate('2026-12-25')).toBe('25 Dec 2026')
    expect(formatDate('not a date')).toBe('not a date')
  })
  it('days', () => {
    expect(days(27)).toBe('27 days')
    expect(days(1)).toBe('1 day')
    expect(days(0)).toBe('0 days')
  })
})
