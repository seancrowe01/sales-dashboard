import { describe, expect, it } from 'vitest'
import { mapCallRecord, mapDMRecord, parseFlag } from './airtable'

// Column names and select values from a real Airtable base in daily use. These are the shapes
// (checked through the proxy on 2026-09-02). Prospect details are made up.
const liveCall = {
  id: 'recLIVE1',
  createdTime: '2026-03-09T10:00:00.000Z',
  fields: {
    Date: '2026-03-09',
    'Closer Name': 'Sam Rivera',
    'Call Type': 'Second Call',
    'Lead Source': 'Ads',
    'Call Status': 'Showed',
    'Prospect Name': 'Test Person',
    'Was Offer Pitched?': 'Yes',
    'Was Prospect Qualified?': 'Qualified',
    'Call Outcome': 'Closed',
    'Cash Collected': 1000,
    'Contract Value': 2500,
    'Call Notes': 'Signed up on the call',
  },
}

const liveNoShow = {
  id: 'recLIVE2',
  fields: {
    Date: '2026-03-09',
    'Closer Name': 'Sam Rivera',
    'Call Type': 'First Call',
    'Lead Source': 'Organic',
    'Call Status': 'No Show',
    'Prospect Name': 'Another Person',
  },
}

const liveNotClosed = {
  id: 'recLIVE3',
  fields: {
    Date: '2026-03-09',
    'Closer Name': 'Sam Rivera',
    'Call Type': 'Third Call',
    'Lead Source': 'Ads',
    'Call Status': 'Showed',
    'Prospect Name': 'Third Person',
    'Was Offer Pitched?': 'Yes',
    'Was Prospect Qualified?': 'Not Qualified',
    'Call Outcome': 'Not closed',
  },
}

const liveTextClose = {
  id: 'recLIVE4',
  fields: {
    'Lead Source': 'Organic',
    'Prospect Name': 'Text Person',
    'Contract Value': 700,
    Date: '2026-03-09',
    'Cash Collected': 500,
    'Closer Name': 'Sam Rivera',
    'Close Type': 'Text Follow-up Close',
  },
}

describe('parseFlag', () => {
  it('accepts yes-style values and positive words', () => {
    for (const v of ['Yes', 'yes', 'Y', 'true', true, 1, '✓', 'Qualified', 'qualified']) {
      expect(parseFlag(v, ['qualified'])).toBe(true)
    }
  })

  it('rejects no-style values and negated words', () => {
    for (const v of ['No', 'no', 'N', 'false', false, 0, '', null, undefined, 'Not Qualified', 'Unqualified', 'Non qualified']) {
      expect(parseFlag(v, ['qualified'])).toBe(false)
    }
  })

  it('only treats the listed positive words as true', () => {
    expect(parseFlag('Pitched', ['qualified'])).toBe(false)
    expect(parseFlag('Pitched', ['pitched'])).toBe(true)
  })
})

describe('real Airtable column names', () => {
  it('maps a closed second call with the real column names', () => {
    const { record, unmappedLeadSource } = mapCallRecord(liveCall)
    expect(record).not.toBeNull()
    expect(unmappedLeadSource).toBeNull()
    expect(record).toMatchObject({
      date: '2026-03-09',
      closer: 'Sam Rivera',
      callType: 'Follow-up',
      leadSource: 'Paid Ads',
      leadSourceRaw: 'Ads',
      showed: true,
      qualified: true,
      pitched: true,
      closed: true,
      revenue: 2500,
      cashCollected: 1000,
      objection: null,
    })
  })

  it('maps a no show with nothing after Call Status filled in', () => {
    const { record } = mapCallRecord(liveNoShow)
    expect(record).toMatchObject({
      callType: '1st Call',
      leadSource: 'Organic',
      showed: false,
      qualified: false,
      pitched: false,
      closed: false,
      revenue: 0,
      cashCollected: 0,
    })
  })

  it('maps a pitched but not qualified third call that did not close', () => {
    const { record } = mapCallRecord(liveNotClosed)
    expect(record).toMatchObject({
      callType: 'Follow-up',
      showed: true,
      qualified: false,
      pitched: true,
      closed: false,
      revenue: 0,
    })
  })

  it('maps a text close with Contract Value as revenue', () => {
    const { record, unmappedLeadSource } = mapDMRecord(liveTextClose)
    expect(unmappedLeadSource).toBeNull()
    expect(record).toMatchObject({
      date: '2026-03-09',
      closer: 'Sam Rivera',
      leadSource: 'Organic',
      revenue: 700,
      cashCollected: 500,
    })
  })
})
