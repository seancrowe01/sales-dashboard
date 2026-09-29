// Section 11: Follow-Ups view. Summary strip, search and lead source filter, then the two chase
// tables (open follow-ups and no shows). Uses the same time range and data as the Dashboard tab.

import { Check, ClipboardList, Hourglass, ListChecks, Minus, PhoneMissed, Search, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { LeadSource } from '../../data/types'
import type { Accent } from '../../lib/colors'
import { count, days, formatDate, pct } from '../../lib/format'
import { matchesFollowUpSearch, type FollowUpStatus, type FollowUpsResult } from '../../lib/metrics'
import Card from '../ui/Card'
import EmptyState from '../ui/EmptyState'
import SectionTitle from '../ui/SectionTitle'
import StatCard from '../ui/StatCard'
import StatusPill from '../ui/StatusPill'

interface FollowUpsProps {
  result: FollowUpsResult
}

type SourceFilter = 'All' | LeadSource

const SOURCE_OPTIONS: readonly SourceFilter[] = ['All', 'Organic', 'Paid Ads']

const STATUS_ACCENT: Record<FollowUpStatus, Accent> = {
  Deposit: 'secondary',
  Rescheduled: 'orange',
  Open: 'primary',
}

const EMPTY_MESSAGE = 'Nothing to chase in this period'

const TH = 'whitespace-nowrap px-3 py-2.5 text-left text-[12px] font-medium uppercase tracking-wide text-muted first:pl-0 last:pr-0'
const TD = 'whitespace-nowrap px-3 py-3 align-top text-[13px] text-text first:pl-0 last:pr-0'
const TD_WRAP = 'min-w-[160px] max-w-[260px] whitespace-normal px-3 py-3 align-top text-[13px] text-text'

function YesNo({ value, label }: { value: boolean; label: string }) {
  return value ? (
    <Check size={16} className="text-accent-green" aria-label={`${label}: yes`} />
  ) : (
    <Minus size={16} className="text-muted" aria-label={`${label}: no`} />
  )
}

function dash(value: string): string {
  return value.trim() === '' ? '-' : value
}

export default function FollowUps({ result }: FollowUpsProps) {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<SourceFilter>('All')
  const { summary } = result

  const openRows = useMemo(
    () =>
      result.openRows.filter(
        (r) => (source === 'All' || r.leadSource === source) && matchesFollowUpSearch(r, query),
      ),
    [result.openRows, source, query],
  )
  const noShowRows = useMemo(
    () =>
      result.noShowRows.filter(
        (r) => (source === 'All' || r.leadSource === source) && matchesFollowUpSearch(r, query),
      ),
    [result.noShowRows, source, query],
  )

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle icon={ListChecks} title="Follow-Ups" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Open Follow-Ups" value={count(summary.openFollowUps)} icon={ClipboardList} accent="primary" size="sm" />
          <StatCard label="Deposits" value={count(summary.deposits)} icon={Wallet} accent="secondary" size="sm" />
          <StatCard
            label="No Shows"
            value={count(summary.noShows)}
            subtitle={`${pct(summary.noShowRate)} of scheduled`}
            icon={PhoneMissed}
            accent="orange"
            size="sm"
          />
          <StatCard
            label="Oldest Open"
            value={summary.oldestOpenDays !== null ? days(summary.oldestOpenDays) : 'None'}
            subtitle={summary.oldestOpenProspect ?? 'No open follow-ups'}
            icon={Hourglass}
            accent="teal"
            size="sm"
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search</span>
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prospect, closer or objection"
              className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-[13px] text-text placeholder:text-muted focus:border-brand-primary focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <span>Lead source</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as SourceFilter)}
              className="rounded-full border border-line bg-surface px-3.5 py-2.5 text-[13px] text-text focus:border-brand-primary focus:outline-none"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <Card title="Open Follow-Ups" subtitle="Showed but did not close, newest first">
        {openRows.length === 0 ? (
          <EmptyState message={EMPTY_MESSAGE} />
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  {['Date', 'Prospect', 'Closer', 'Lead Source', 'Call Type', 'Qualified', 'Pitched', 'Objection', 'Next Steps', 'Days Since', 'Status'].map(
                    (h) => (
                      <th key={h} scope="col" className={TH}>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {openRows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-b-0">
                    <td className={`${TD} text-muted`}>{formatDate(r.date)}</td>
                    <td className={`${TD} font-semibold`}>{r.prospect}</td>
                    <td className={TD}>{r.closer}</td>
                    <td className={TD}>{r.leadSourceRaw}</td>
                    <td className={TD}>{r.callType}</td>
                    <td className={TD}>
                      <YesNo value={r.qualified} label="Qualified" />
                    </td>
                    <td className={TD}>
                      <YesNo value={r.pitched} label="Pitched" />
                    </td>
                    <td className={TD}>{dash(r.objection ?? '')}</td>
                    <td className={TD_WRAP}>{dash(r.nextSteps)}</td>
                    <td className={`${TD} font-semibold tabular-nums`}>{count(r.daysSince)}</td>
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

      <Card title="No Shows" subtitle="Booked but never turned up">
        {noShowRows.length === 0 ? (
          <EmptyState message={EMPTY_MESSAGE} />
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[880px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  {['Date', 'Prospect', 'Closer', 'Lead Source', 'Call Type', 'Days Since', 'Phone', 'Email'].map((h) => (
                    <th key={h} scope="col" className={TH}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {noShowRows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-b-0">
                    <td className={`${TD} text-muted`}>{formatDate(r.date)}</td>
                    <td className={`${TD} font-semibold`}>{r.prospect}</td>
                    <td className={TD}>{r.closer}</td>
                    <td className={TD}>{r.leadSourceRaw}</td>
                    <td className={TD}>{r.callType}</td>
                    <td className={`${TD} font-semibold tabular-nums`}>{count(r.daysSince)}</td>
                    <td className={TD}>{dash(r.phone)}</td>
                    <td className={TD}>{dash(r.email)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
