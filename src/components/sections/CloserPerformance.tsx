// Section 4.11: Closer Performance table. One row per closer in the filtered data.

import type { Accent } from '../../lib/colors'
import { count, money, pct } from '../../lib/format'
import type { CloserRow, CloserStatus } from '../../lib/metrics'
import Card from '../ui/Card'
import EmptyState from '../ui/EmptyState'
import StatusPill from '../ui/StatusPill'

interface CloserPerformanceProps {
  rows: CloserRow[]
}

const STATUS_ACCENT: Record<CloserStatus, Accent> = {
  Good: 'green',
  Average: 'orange',
  'Needs Work': 'secondary',
  'No Data': 'slate',
}

const HEADERS = [
  'Closer',
  'Calls',
  'Shows',
  '1st Calls',
  'Follow-ups',
  'Text Closes',
  'Qualified',
  'Pitched',
  'Closed',
  'Close Rate',
  '1st Call CR',
  'Follow-up CR',
  'Cash',
  'Contract',
  'Status',
] as const

const TH = 'whitespace-nowrap px-2 py-2.5 text-left text-[12px] font-medium uppercase tracking-wide text-muted first:pl-0 last:pr-0'
const TD = 'whitespace-nowrap px-2 py-3 text-[13px] text-text first:pl-0 last:pr-0'
const NUM = 'font-semibold tabular-nums'

export default function CloserPerformance({ rows }: CloserPerformanceProps) {
  return (
    <section>
      <Card title="Closer Performance" subtitle="Individual sales rep statistics">
        {rows.length === 0 ? (
          <EmptyState message="No closer activity in this period" />
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[1040px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  {HEADERS.map((h) => (
                    <th key={h} scope="col" className={TH}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.closer} className="border-b border-line last:border-b-0">
                    <td className={`${TD} font-semibold`}>{r.closer}</td>
                    <td className={`${TD} ${NUM}`}>{count(r.calls)}</td>
                    <td className={`${TD} ${NUM}`}>{count(r.shows)}</td>
                    <td className={`${TD} ${NUM}`}>{count(r.firstCalls)}</td>
                    <td className={`${TD} ${NUM}`}>{count(r.followUps)}</td>
                    <td className={`${TD} ${NUM} text-accent-green`}>{count(r.textCloses)}</td>
                    <td className={`${TD} ${NUM}`}>{count(r.qualified)}</td>
                    <td className={`${TD} ${NUM}`}>{count(r.pitched)}</td>
                    <td className={`${TD} ${NUM} text-accent-green`}>{count(r.closed)}</td>
                    <td className={`${TD} ${NUM}`}>{pct(r.closeRate)}</td>
                    <td className={`${TD} ${NUM}`}>{pct(r.firstCallCloseRate)}</td>
                    <td className={`${TD} ${NUM}`}>{pct(r.followUpCloseRate)}</td>
                    <td className={`${TD} ${NUM} text-accent-green`}>{money(r.cash)}</td>
                    <td className={`${TD} ${NUM} text-accent-primary`}>{money(r.revenue)}</td>
                    <td className={TD}>
                      <StatusPill label={r.status} accent={STATUS_ACCENT[r.status]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  )
}
