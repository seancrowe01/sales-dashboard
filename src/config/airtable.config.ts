// Airtable mapping config. Edit this file when a column is renamed
// or a new lead source shows up in the footer warning.
//
// Matching is case-insensitive and ignores spaces and punctuation, so "Closer's Name",
// "closers name" and "Closer Name" all match the same candidate. First hit wins.

export type DateFormat = 'auto' | 'dmy' | 'mdy'

export type CallField =
  | 'date'
  | 'closer'
  | 'prospect'
  | 'leadSource'
  | 'callType'
  | 'callStatus'
  | 'qualified'
  | 'pitched'
  | 'callOutcome'
  | 'closed'
  | 'revenue'
  | 'cashCollected'
  | 'objection'
  | 'nextSteps'
  | 'notes'
  | 'phone'
  | 'email'

export type DMField = 'date' | 'closer' | 'prospect' | 'leadSource' | 'closeType' | 'revenue' | 'cashCollected'

export interface LeadSourceGroups {
  paidAds: string[]
  organic: string[]
}

export interface AirtableConfig {
  /** Informational only. The server holds the base id; the browser never needs it. */
  baseId: string
  /** Table ids. Normally learned from /api/health; VITE_ overrides win when set. */
  callsTableId: string
  dmTableId: string
  dateFormat: DateFormat
  fields: {
    calls: Record<CallField, string[]>
    dm: Record<DMField, string[]>
  }
  leadSourceGroups: LeadSourceGroups
}

export const LEAD_SOURCE_GROUPS: LeadSourceGroups = {
  paidAds: ['VSL', 'Free Guide', 'Paid', 'Paid Ads', 'Ads', 'Facebook Ads', 'Meta', 'Meta Ads', 'YouTube Ads', 'Dialer'],
  organic: ['Instagram', 'Organic', 'Referral', 'Content', 'YouTube', 'TikTok', 'Email', 'Community', 'Word of Mouth'],
}

export const CALL_FIELD_CANDIDATES: Record<CallField, string[]> = {
  date: ['Date', 'Call Date', 'Date of Call', 'Date of Submission', 'Submitted', 'Submission Date', 'Timestamp', 'Created'],
  closer: ["Closer's Name", 'Closer Name', 'Closer', 'Closers Name', 'Sales Rep', 'Rep'],
  prospect: ["Prospect's Name", 'Prospect Name', 'Prospect', 'Prospects Name', 'Lead Name', 'Client Name', 'Name'],
  leadSource: ['Lead Source', 'Source', 'Traffic Source', 'Lead Src'],
  callType: ['Call Type', 'Type of Call', 'Type'],
  callStatus: ['Call Status', 'Status', 'Showed', 'Show', 'Show Up', 'Did they show?', 'Attended'],
  // "Was Prospect Qualified?" and "Was Offer Pitched?" are the live column names (checked 2026-09-02).
  qualified: [
    'Was Prospect Qualified?',
    'Was the prospect qualified?',
    'Prospect Qualified?',
    'Prospect Qualified',
    'Qualified',
    'Qualified?',
    'Was Qualified',
  ],
  pitched: ['Was Offer Pitched?', 'Was the offer pitched?', 'Offer Pitched?', 'Offer Pitched', 'Pitched', 'Pitched?', 'Was Pitched'],
  callOutcome: ['Call Outcome', 'Outcome', 'Call Result', 'Result'],
  closed: ['Closed', 'Closed?', 'Deal Closed', 'Won', 'Sale Made'],
  revenue: ['Total Revenue', 'Revenue', 'Revenue Generated', 'Contract Value', 'Deal Value', 'Total Contract Value'],
  cashCollected: ['Total CC', 'Cash Collected', 'CC', 'Cash', 'Total Cash Collected', 'Cash Collected Today'],
  objection: ['Main Objection', 'Objection', 'Objections', 'Primary Objection'],
  nextSteps: ['Next Steps', 'Next Step', 'Follow Up Plan'],
  notes: ['Call Notes / Key Insights', 'Call Notes', 'Notes', 'Key Insights'],
  phone: ['Phone', 'Phone Number', 'Mobile', 'Contact Number'],
  email: ['Email', 'Email Address', 'E-mail'],
}

export const DM_FIELD_CANDIDATES: Record<DMField, string[]> = {
  date: ['Date', 'Close Date', 'Date of Submission', 'Submitted', 'Submission Date', 'Timestamp', 'Created'],
  closer: ["Closer's Name", 'Closer Name', 'Closer', 'Closers Name', 'Sales Rep', 'Rep'],
  prospect: ["Prospect's Name", 'Prospect Name', 'Prospect', 'Prospects Name', 'Lead Name', 'Client Name', 'Name'],
  leadSource: ['Lead Source', 'Source', 'Traffic Source', 'Lead Src'],
  closeType: ['Close Type', 'Type'],
  revenue: ['Revenue Generated', 'Revenue', 'Total Revenue', 'Contract Value', 'Deal Value'],
  cashCollected: ['Cash Collected', 'Total CC', 'CC', 'Cash', 'Total Cash Collected'],
}

function envValue(name: 'VITE_AIRTABLE_CALLS_TABLE' | 'VITE_AIRTABLE_DM_TABLE'): string {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined
  const value = env ? env[name] : undefined
  return typeof value === 'string' ? value.trim() : ''
}

export const AIRTABLE_CONFIG: AirtableConfig = {
  baseId: '',
  callsTableId: envValue('VITE_AIRTABLE_CALLS_TABLE'),
  dmTableId: envValue('VITE_AIRTABLE_DM_TABLE'),
  // auto prefers day-first (DD/MM/YYYY) because the team is in the UK and Ireland.
  dateFormat: 'auto',
  fields: {
    calls: CALL_FIELD_CANDIDATES,
    dm: DM_FIELD_CANDIDATES,
  },
  leadSourceGroups: LEAD_SOURCE_GROUPS,
}

export interface TableIds {
  calls: string
  dm: string
}

/** VITE_ overrides win, then whatever the server reported on /api/health. */
export function resolveTableIds(fromServer?: Partial<TableIds> | null, config: AirtableConfig = AIRTABLE_CONFIG): TableIds {
  return {
    calls: config.callsTableId || fromServer?.calls?.trim() || '',
    dm: config.dmTableId || fromServer?.dm?.trim() || '',
  }
}
