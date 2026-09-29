// Section 4.12: footer status line, the data source note, and the unmapped lead source warning.

import type { DataStatus } from '../../data/useSalesData'
import { timeStamp } from '../../lib/format'

interface FooterProps {
  status: DataStatus
  lastUpdated: Date | null
  nextRefresh: Date | null
  refreshMinutes: number
  unmappedLeadSources: string[]
  /** What the server actually read, for example "Google Sheets". Falls back to a neutral word. */
  sourceLabel?: string | null
  /** Explanatory note when sample data is in use because the data source is not configured. */
  note?: string | null
  /** Something needs attention while data is still showing (limit reached, refresh cooldown). */
  warning?: string | null
}

function cadence(minutes: number): string {
  if (minutes <= 0) return ''
  if (minutes % 60 === 0) {
    const h = minutes / 60
    return `every ${h} hour${h === 1 ? '' : 's'}`
  }
  return `every ${minutes} minutes`
}

export default function Footer({ status, lastUpdated, nextRefresh, refreshMinutes, unmappedLeadSources, sourceLabel, note, warning }: FooterProps) {
  const source = sourceLabel && sourceLabel.trim() ? sourceLabel.trim() : 'the data source'
  let line: string
  if (status === 'mock') {
    line = `Using sample data • Last updated: ${lastUpdated ? timeStamp(lastUpdated) : 'waiting for data'}`
  } else if (status === 'live') {
    const parts = [`Connected to ${source}`]
    if (lastUpdated) parts.push(`Data from ${timeStamp(lastUpdated)}`)
    if (refreshMinutes > 0) parts.push(`Checks ${source} ${cadence(refreshMinutes)}${nextRefresh ? `, next at ${timeStamp(nextRefresh)}` : ''}`)
    line = parts.join(' • ')
  } else {
    line = `Waiting for data from ${source}`
  }
  return (
    <footer className="mt-12 space-y-2 pb-10 text-center text-[13px] text-muted">
      <p>{line}</p>
      {note ? <p className="text-[12px]">{note}</p> : null}
      {warning ? <p className="text-[12px] text-accent-orange">{warning}</p> : null}
      {unmappedLeadSources.length > 0 ? (
        <p className="text-[12px] text-accent-orange">
          Lead sources not in the config (counted as Organic): {unmappedLeadSources.join(', ')}. Add them to LEAD_SOURCE_GROUPS in
          src/config/airtable.config.ts.
        </p>
      ) : null}
    </footer>
  )
}
