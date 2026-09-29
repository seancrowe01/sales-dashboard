// Normalized data model. Everything downstream works with these shapes.

export type LeadSource = 'Organic' | 'Paid Ads'
export type CallType = '1st Call' | 'Follow-up'

export interface CallReport {
  // from the Post Call Report table
  id: string
  date: string // ISO date (YYYY-MM-DD) of the call
  closer: string // e.g. "Sam Rivera"
  leadSource: LeadSource
  callType: CallType
  showed: boolean
  qualified: boolean
  pitched: boolean
  closed: boolean
  revenue: number // deal value if closed, else 0
  /** Contract Value exactly as typed, whether the deal closed or not. Deposits keep their full price here. */
  contractValue: number
  cashCollected: number
  objection: string | null // e.g. "Timing", "Shopping Around", "Need Partner Approval", "Money", "Need to Think"
  prospect?: string
  leadSourceRaw: string // original Airtable value, e.g. "Instagram"
  callStatus?: string // raw: "Showed" | "Rescheduled" | "No Show"
  callOutcome?: string // raw: "Closed" | "Deposit" | "Follow-up booked" | "Not closed" ...
  nextSteps?: string
  notes?: string
  phone?: string
  email?: string
}

export interface DMClose {
  // from the DM Close Report (Text Close Report) table
  id: string
  date: string
  closer: string
  leadSource: LeadSource
  revenue: number
  cashCollected: number
  prospect?: string
  leadSourceRaw: string // original Airtable value, e.g. "Instagram"
}

export interface SalesData {
  calls: CallReport[]
  dmCloses: DMClose[]
}

export const EMPTY_SALES_DATA: SalesData = { calls: [], dmCloses: [] }

export const LEAD_SOURCES: readonly LeadSource[] = ['Organic', 'Paid Ads'] as const
export const CALL_TYPES: readonly CallType[] = ['1st Call', 'Follow-up'] as const
