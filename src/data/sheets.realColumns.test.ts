import { describe, expect, it } from 'vitest'
import { rowsToRecords } from '../../server/sheets.mjs'
import { mapRecords } from './airtable'
import { computeOverview, computeSourceBreakdown } from '../lib/metrics'

// The header rows and cell values below are exactly what the live Google Sheet contains
// from a real sheet in daily use: ISO dates, currency symbols, thousands
// separators, "Qualified" rather than "Yes", and trailing cells left off on No Show rows.
// Prospect names, phones and emails are made up.

const CALLS_HEADER = [
  'Date',
  'Closer Name',
  'Prospect Name',
  'Phone',
  'Email',
  'Lead Source',
  'Call Type',
  'Call Status',
  'Was Prospect Qualified?',
  'Was Offer Pitched?',
  'Call Outcome',
  'Contract Value',
  'Cash Collected',
  'Main objection',
  'Next Steps',
  'Call Notes',
]

const CALL_ROWS = [
  CALLS_HEADER,
  // Closed on the call, organic.
  [
    '2026-09-10',
    'Sam Rivera',
    'Test One',
    '07000 000001',
    'one@example.com',
    'Organic',
    'First Call',
    'Showed',
    'Qualified',
    'Yes',
    'Closed',
    '£997.00',
    '£997.00',
    '',
    '',
    'call closed',
  ],
  // Closed with a thousands separator, which arrives quoted in CSV and plain from the API.
  [
    '2026-09-12',
    'Sam Rivera',
    'Test Two',
    '07000 000002',
    'two@example.com',
    'Organic',
    'First Call',
    'Showed',
    'Qualified',
    'Yes',
    'Closed',
    '£1,550.00',
    '£1,550.00',
    '',
    '',
    'closed',
  ],
  // Deposit from an ad lead: cash counts, revenue does not, and it belongs to the Paid Ads panel.
  [
    '2026-09-09',
    'Sam Rivera',
    'Test Three',
    '07000 000003',
    'three@example.com',
    'Ads',
    'First Call',
    'Showed',
    'Qualified',
    'Yes',
    'Deposit',
    '£1,550.00',
    '£100.00',
    '',
    '',
    'deposit paid',
  ],
  // Showed, pitched, did not close.
  [
    '2026-09-11',
    'Sam Rivera',
    'Test Four',
    '07000 000004',
    'four@example.com',
    'Organic',
    'First Call',
    'Showed',
    'Unqualified',
    'Yes',
    'Not closed',
    '',
    '',
    'Money',
    'Lost',
    'no money',
  ],
  // The refunded row, zeroed at source: Not closed, zero money, and it must not count as cash.
  [
    '2026-09-04',
    'Sam Rivera',
    'Test Five',
    '07000 000005',
    'five@example.com',
    'Organic',
    'First Call',
    'Showed',
    'Qualified',
    'Yes',
    'Not closed',
    '£0',
    '£0',
    'Other',
    'Lost',
    'Pending refund',
  ],
  // No Show: Sheets drops the trailing empty cells entirely, so this row is short.
  ['2026-09-25', 'Sam Rivera', 'Test Six', '07000 000006', 'six@example.com', 'Organic', 'First Call', 'No Show'],
]

const DM_ROWS = [
  ['Date', 'Closer Name', 'Prospect Name', 'Phone', 'Email', 'Lead Source', 'Close Type', 'Contract Value', 'Cash Collected'],
  [
    '2026-09-25',
    'Sam Rivera',
    'Test Seven',
    '07000 000007',
    'seven@example.com',
    'Organic',
    'Text Follow-Up Close',
    '£997.00',
    '£997.00',
  ],
]

function mapSheet() {
  return mapRecords(rowsToRecords(CALL_ROWS, 'calls'), rowsToRecords(DM_ROWS, 'dm'))
}

describe('the live Google Sheet columns', () => {
  it('maps every row, with no unmapped lead sources', () => {
    const { data, unmappedLeadSources } = mapSheet()
    expect(data.calls.length).toBe(6)
    expect(data.dmCloses.length).toBe(1)
    expect(unmappedLeadSources).toEqual([])
  })

  it('reads ISO dates as the day they say, not the month', () => {
    const { data } = mapSheet()
    // 2026-09-04 must stay 4 September. Read day-first it would become 9 April.
    expect(data.calls.map((c) => c.date).sort()).toEqual([
      '2026-09-04',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-25',
    ])
  })

  it('reads "Qualified" and "Unqualified" as the flags they are', () => {
    const { data } = mapSheet()
    const byProspect = new Map(data.calls.map((c) => [c.prospect, c]))
    expect(byProspect.get('Test One')?.qualified).toBe(true)
    expect(byProspect.get('Test Four')?.qualified).toBe(false)
    expect(byProspect.get('Test Four')?.pitched).toBe(true)
  })

  it('strips pound signs and thousands separators from money', () => {
    const { data } = mapSheet()
    const two = data.calls.find((c) => c.prospect === 'Test Two')
    expect(two?.revenue).toBe(1550)
    expect(two?.cashCollected).toBe(1550)
  })

  it('counts a deposit as cash but not as revenue or a close', () => {
    const { data } = mapSheet()
    const three = data.calls.find((c) => c.prospect === 'Test Three')
    expect(three?.closed).toBe(false)
    expect(three?.revenue).toBe(0)
    expect(three?.cashCollected).toBe(100)
  })

  it('keeps a zeroed refund row out of the cash total', () => {
    const { data } = mapSheet()
    const five = data.calls.find((c) => c.prospect === 'Test Five')
    expect(five?.cashCollected).toBe(0)
    expect(five?.revenue).toBe(0)
    expect(five?.closed).toBe(false)
  })

  it('treats a short No Show row as booked but not shown', () => {
    const { data } = mapSheet()
    const six = data.calls.find((c) => c.prospect === 'Test Six')
    expect(six?.showed).toBe(false)
    expect(six?.qualified).toBe(false)
    expect(six?.pitched).toBe(false)
  })

  it('adds up to the overview the team would expect', () => {
    const { data } = mapSheet()
    const overview = computeOverview(data)
    expect(overview.scheduled).toBe(6) // the six post call rows; a text close is not a booked call
    expect(overview.shown).toBe(5)
    expect(overview.callClosed).toBe(2)
    expect(overview.textClosed).toBe(1)
    expect(overview.closed).toBe(3) // two on calls plus one text close
    expect(overview.revenue).toBe(997 + 1550 + 997)
    expect(overview.cashCollected).toBe(997 + 1550 + 100 + 997)
  })

  it('sends the ad lead to the Paid Ads panel and the rest to Organic', () => {
    const { data } = mapSheet()
    const paid = computeSourceBreakdown(data, 'Paid Ads')
    const organic = computeSourceBreakdown(data, 'Organic')
    expect(paid.scheduled).toBe(1)
    expect(paid.cashCollected).toBe(100)
    expect(organic.scheduled).toBe(5)
  })
})
