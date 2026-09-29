import { describe, expect, it } from 'vitest'
import { AIRTABLE_CONFIG, resolveTableIds } from '../config/airtable.config'
import {
  fetchAll,
  fetchTable,
  groupLeadSource,
  mapCallRecord,
  mapDMRecord,
  mapRecords,
  normalizeKey,
  parseAirtableDate,
  parseCallType,
  parseClosed,
  parseCurrency,
  parseShowed,
  parseYesNo,
  pickField,
  type AirtableRecord,
} from './airtable'

describe('field matching', () => {
  it('normalizes names loosely', () => {
    expect(normalizeKey("Closer's Name")).toBe('closersname')
    expect(normalizeKey('  Total CC ')).toBe('totalcc')
    expect(normalizeKey('Was the prospect qualified?')).toBe('wastheprospectqualified')
  })
  it('first candidate wins', () => {
    const fields = { Closer: 'B', "Closer's Name": 'A' }
    expect(pickField(fields, ["Closer's Name", 'Closer'])).toBe('A')
    expect(pickField(fields, ['Missing'])).toBeUndefined()
    expect(pickField({ 'Lead Source': ['Instagram'] }, ['Lead Source'])).toBe('Instagram')
  })
})

describe('value parsers', () => {
  it('currency', () => {
    expect(parseCurrency(4000)).toBe(4000)
    expect(parseCurrency('$4,000')).toBe(4000)
    expect(parseCurrency('4,000')).toBe(4000)
    expect(parseCurrency('4k')).toBe(4000)
    expect(parseCurrency('4.5K')).toBe(4500)
    expect(parseCurrency('')).toBe(0)
    expect(parseCurrency(undefined)).toBe(0)
    expect(parseCurrency('n/a')).toBe(0)
  })
  it('yes / no', () => {
    expect(parseYesNo('Yes')).toBe(true)
    expect(parseYesNo('y')).toBe(true)
    expect(parseYesNo(true)).toBe(true)
    expect(parseYesNo('✓')).toBe(true)
    expect(parseYesNo('No')).toBe(false)
    expect(parseYesNo('')).toBe(false)
    expect(parseYesNo(undefined)).toBe(false)
  })
  it('showed', () => {
    expect(parseShowed('Showed')).toBe(true)
    expect(parseShowed('Show')).toBe(true)
    expect(parseShowed('Yes')).toBe(true)
    expect(parseShowed(true)).toBe(true)
    expect(parseShowed('No Show')).toBe(false)
    expect(parseShowed('Rescheduled')).toBe(false)
    expect(parseShowed('Cancelled')).toBe(false)
    expect(parseShowed('')).toBe(false)
  })
  it('closed', () => {
    expect(parseClosed('Closed', undefined, 0)).toBe(true)
    expect(parseClosed('Closed - Won', undefined, 0)).toBe(true)
    expect(parseClosed('Not closed', undefined, 4000)).toBe(false)
    expect(parseClosed('Follow-up booked', undefined, 0)).toBe(false)
    expect(parseClosed('Deposit', undefined, 0)).toBe(false)
    expect(parseClosed(undefined, true, 0)).toBe(true)
    expect(parseClosed('', undefined, 4000)).toBe(true)
    expect(parseClosed('', undefined, 0)).toBe(false)
  })
  it('call type', () => {
    expect(parseCallType('1st Call')).toBe('1st Call')
    expect(parseCallType('First Call')).toBe('1st Call')
    expect(parseCallType('Follow-up')).toBe('Follow-up')
    expect(parseCallType('Follow Up')).toBe('Follow-up')
    expect(parseCallType('followup')).toBe('Follow-up')
    expect(parseCallType('2nd Follow-up')).toBe('Follow-up')
    expect(parseCallType('3rd call')).toBe('Follow-up')
    expect(parseCallType(undefined)).toBe('1st Call')
  })
  it('dates', () => {
    expect(parseAirtableDate('2026-02-01')).toBe('2026-02-01')
    expect(parseAirtableDate('2026-02-01T10:00:00.000Z')).toBe('2026-02-01')
    expect(parseAirtableDate('13/02/2026')).toBe('2026-02-13')
    expect(parseAirtableDate('02/13/2026')).toBe('2026-02-13')
    expect(parseAirtableDate('03/02/2026')).toBe('2026-02-03') // auto prefers day first
    expect(parseAirtableDate('03/02/2026', 'mdy')).toBe('2026-03-02')
    expect(parseAirtableDate('03/02/26', 'dmy')).toBe('2026-02-03')
    expect(parseAirtableDate('2026/02/01')).toBe('2026-02-01')
    expect(parseAirtableDate('')).toBeNull()
    expect(parseAirtableDate('nonsense')).toBeNull()
  })
  it('lead source groups', () => {
    expect(groupLeadSource('Instagram')).toMatchObject({ leadSource: 'Organic', known: true })
    expect(groupLeadSource('VSL')).toMatchObject({ leadSource: 'Paid Ads', known: true })
    expect(groupLeadSource('Free Guide')).toMatchObject({ leadSource: 'Paid Ads', known: true })
    expect(groupLeadSource('paid ads')).toMatchObject({ leadSource: 'Paid Ads', known: true })
    expect(groupLeadSource('Paid')).toMatchObject({ leadSource: 'Paid Ads', known: true })
    expect(groupLeadSource('Podcast')).toMatchObject({ leadSource: 'Organic', known: false, raw: 'Podcast' })
    expect(groupLeadSource(undefined)).toMatchObject({ leadSource: 'Organic', known: false, raw: '' })
  })
})

describe('record mapping', () => {
  it('maps a full Post Call Report record', () => {
    const rec: AirtableRecord = {
      id: 'rec1',
      createdTime: '2026-08-20T09:00:00.000Z',
      fields: {
        Date: '13/08/2026',
        "Closer's Name": '  Sam Rivera ',
        "Prospect's Name": 'Sarah K.',
        'Lead Source': 'Instagram',
        'Call Type': 'First Call',
        'Call Status': 'Showed',
        'Was the prospect qualified?': 'Yes',
        'Was the offer pitched?': 'Yes',
        'Call Outcome': 'Closed',
        'Total Revenue': '$4,000',
        'Total CC': '2,000',
        'Main Objection': '',
        'Next Steps': 'Onboarding call booked',
        'Call Notes / Key Insights': 'Great call',
        Phone: '+44 7000 000000',
        Email: 'sarah@example.com',
      },
    }
    const { record, unmappedLeadSource } = mapCallRecord(rec)
    expect(unmappedLeadSource).toBeNull()
    expect(record).toMatchObject({
      id: 'rec1',
      date: '2026-08-13',
      closer: 'Sam Rivera',
      prospect: 'Sarah K.',
      leadSource: 'Organic',
      leadSourceRaw: 'Instagram',
      callType: '1st Call',
      showed: true,
      qualified: true,
      pitched: true,
      closed: true,
      revenue: 4000,
      cashCollected: 2000,
      objection: null,
      callStatus: 'Showed',
      callOutcome: 'Closed',
      nextSteps: 'Onboarding call booked',
      notes: 'Great call',
      phone: '+44 7000 000000',
      email: 'sarah@example.com',
    })
  })

  it('maps checkbox, Paid, Follow Up and No Show variants', () => {
    const rec: AirtableRecord = {
      id: 'rec2',
      fields: {
        Date: '2026-08-14',
        Closer: 'Sam Rivera',
        Prospect: 'Emma M.',
        Source: 'Paid',
        'Call Type': 'Follow Up',
        Showed: true,
        Qualified: true,
        Pitched: false,
        Closed: false,
        Revenue: 0,
        'Cash Collected': '',
        Objection: 'Timing',
      },
    }
    const { record } = mapCallRecord(rec)
    expect(record).toMatchObject({
      date: '2026-08-14',
      leadSource: 'Paid Ads',
      leadSourceRaw: 'Paid',
      callType: 'Follow-up',
      showed: true,
      qualified: true,
      pitched: false,
      closed: false,
      revenue: 0,
      cashCollected: 0,
      objection: 'Timing',
    })
  })

  it('no show and blank closer', () => {
    const { record } = mapCallRecord({
      id: 'rec3',
      fields: { Date: '2026-08-14', 'Call Status': 'No Show', 'Lead Source': 'Free Guide', 'Call Outcome': 'Not closed' },
    })
    expect(record).toMatchObject({ showed: false, closed: false, closer: 'Unknown', leadSource: 'Paid Ads', callType: '1st Call' })
  })

  it('missing outcome falls back to revenue > 0 and missing date falls back to createdTime', () => {
    const { record } = mapCallRecord({
      id: 'rec4',
      createdTime: '2026-08-15T12:00:00.000Z',
      fields: { 'Call Status': 'Showed', 'Lead Source': 'Instagram', 'Total Revenue': '4k' },
    })
    expect(record?.date).toBe('2026-08-15')
    expect(record?.closed).toBe(true)
    expect(record?.revenue).toBe(4000)
  })

  it('keeps cash but zeroes revenue when the deal is not closed', () => {
    const { record } = mapCallRecord({
      id: 'rec6',
      fields: { Date: '2026-08-16', 'Call Status': 'Showed', 'Call Outcome': 'Deposit', 'Total Revenue': '$4,000', 'Total CC': '$500' },
    })
    expect(record).toMatchObject({ closed: false, revenue: 0, cashCollected: 500, callOutcome: 'Deposit' })
  })

  it('drops records with no date at all', () => {
    expect(mapCallRecord({ id: 'rec5', fields: { Closer: 'Sam Rivera' } }).record).toBeNull()
  })

  it('maps a Text Close Report record', () => {
    const { record } = mapDMRecord({
      id: 'dm1',
      fields: {
        "Closer's Name": 'Sam Rivera',
        Date: '2026-08-10',
        "Prospect's Name": 'Chloe B.',
        'Lead Source': 'VSL',
        'Close Type': 'Text',
        'Revenue Generated': '$4,000',
        'Cash Collected': '$1,000',
      },
    })
    expect(record).toMatchObject({
      id: 'dm1',
      date: '2026-08-10',
      closer: 'Sam Rivera',
      prospect: 'Chloe B.',
      leadSource: 'Paid Ads',
      leadSourceRaw: 'VSL',
      revenue: 4000,
      cashCollected: 1000,
    })
  })

  it('collects unmapped lead sources and sorts newest first', () => {
    const calls: AirtableRecord[] = [
      { id: 'a', fields: { Date: '2026-08-01', 'Lead Source': 'Podcast', 'Call Status': 'Showed' } },
      { id: 'b', fields: { Date: '2026-08-05', 'Lead Source': 'Instagram', 'Call Status': 'Showed' } },
      { id: 'c', fields: { Date: '2026-08-03', 'Lead Source': 'Billboard', 'Call Status': 'Showed' } },
    ]
    const dm: AirtableRecord[] = [{ id: 'd', fields: { Date: '2026-08-02', 'Lead Source': 'Podcast', 'Revenue Generated': 3000 } }]
    const mapped = mapRecords(calls, dm)
    expect(mapped.unmappedLeadSources).toEqual(['Billboard', 'Podcast'])
    expect(mapped.data.calls.map((c) => c.id)).toEqual(['b', 'c', 'a'])
    expect(mapped.data.calls.every((c) => c.leadSource === 'Organic')).toBe(true)
    expect(mapped.data.dmCloses[0].revenue).toBe(3000)
  })
})

describe('fetching through the proxy', () => {
  const pages: Record<string, unknown> = {
    'tblCALLS|': { records: [{ id: 'r1', fields: { Date: '2026-08-01', 'Call Status': 'Showed', 'Lead Source': 'Instagram' } }], offset: 'next1' },
    'tblCALLS|next1': { records: [{ id: 'r2', fields: { Date: '2026-08-02', 'Call Status': 'No Show', 'Lead Source': 'VSL' } }] },
    'tblDM|': { records: [{ id: 'd1', fields: { Date: '2026-08-03', 'Lead Source': 'Instagram', 'Revenue Generated': '$5,000' } }] },
  }
  const fakeFetch = async (input: string): Promise<Response> => {
    const url = new URL(input, 'http://localhost')
    const table = url.pathname.split('/').pop() ?? ''
    const key = `${table}|${url.searchParams.get('offset') ?? ''}`
    const body = pages[key]
    if (!body) return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404 })
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  it('follows offset pagination', async () => {
    const records = await fetchTable('tblCALLS', fakeFetch)
    expect(records.map((r) => r.id)).toEqual(['r1', 'r2'])
  })

  it('fetchAll maps both tables', async () => {
    const mapped = await fetchAll({ calls: 'tblCALLS', dm: 'tblDM' }, fakeFetch)
    expect(mapped.data.calls.length).toBe(2)
    expect(mapped.data.dmCloses.length).toBe(1)
    expect(mapped.data.dmCloses[0].revenue).toBe(5000)
    expect(mapped.unmappedLeadSources).toEqual([])
  })

  it('throws a readable error on a bad status', async () => {
    await expect(fetchTable('tblNOPE', fakeFetch)).rejects.toThrow(/404/)
    await expect(fetchTable('', fakeFetch)).rejects.toThrow(/missing/)
  })
})

describe('config', () => {
  it('server table ids fill in when VITE_ overrides are blank', () => {
    const ids = resolveTableIds({ calls: 'tblA', dm: 'tblB' }, { ...AIRTABLE_CONFIG, callsTableId: '', dmTableId: '' })
    expect(ids).toEqual({ calls: 'tblA', dm: 'tblB' })
    const override = resolveTableIds({ calls: 'tblA', dm: 'tblB' }, { ...AIRTABLE_CONFIG, callsTableId: 'tblX', dmTableId: '' })
    expect(override).toEqual({ calls: 'tblX', dm: 'tblB' })
  })
})
