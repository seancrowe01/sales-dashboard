// Sections 4.4 and 4.5: call type breakdown for one lead source.
// Organic uses the leaf icon and green tint, Paid Ads the megaphone icon and orange tint.

import { Leaf, Megaphone, PhoneCall, Repeat } from 'lucide-react'
import type { LeadSource } from '../../data/types'
import type { Accent } from '../../lib/colors'
import { count, money, pct } from '../../lib/format'
import type { CallTypeBreakdown as Breakdown } from '../../lib/metrics'
import MiniCard from '../ui/MiniCard'
import Panel from '../ui/Panel'
import SectionTitle from '../ui/SectionTitle'

interface CallTypeBreakdownProps {
  source: LeadSource
  firstCall: Breakdown
  followUp: Breakdown
}

const SOURCE_ACCENT: Record<LeadSource, Accent> = { Organic: 'green', 'Paid Ads': 'orange' }
const SOURCE_WORD: Record<LeadSource, string> = { Organic: 'Organic', 'Paid Ads': 'Paid ads' }

function CallTypePanel({ b, title, subtitle, accent, icon }: { b: Breakdown; title: string; subtitle: string; accent: Accent; icon: typeof PhoneCall }) {
  return (
    <Panel title={title} subtitle={subtitle} icon={icon} accent={accent}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniCard label="Total Calls" value={count(b.totalCalls)} />
        <MiniCard label="Shown" value={count(b.shown)} subtitle={pct(b.showRate)} />
        <MiniCard label="Qualified" value={count(b.qualified)} subtitle={pct(b.qualifiedRate)} />
        <MiniCard label="Pitched" value={count(b.pitched)} subtitle={pct(b.pitchRate)} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniCard label="Closed" value={count(b.closed)} subtitle={`${pct(b.closeRate)} of ${count(b.shown)} shown`} glow="teal" />
        <MiniCard label="Cash Collected" value={money(b.cashCollected)} glow="orange" />
        <MiniCard label="Contract Value" value={money(b.revenue)} subtitle={`Avg ${money(b.avgDeal)}`} glow="green" />
      </div>
    </Panel>
  )
}

export default function CallTypeBreakdown({ source, firstCall, followUp }: CallTypeBreakdownProps) {
  const accent = SOURCE_ACCENT[source]
  const word = SOURCE_WORD[source]
  return (
    <section>
      <SectionTitle icon={source === 'Organic' ? Leaf : Megaphone} title={`${source} - Call Type Breakdown`} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CallTypePanel b={firstCall} title="1st Call Performance" subtitle={`${word} initial sales calls`} accent={accent} icon={PhoneCall} />
        <CallTypePanel b={followUp} title="Follow-up Performance" subtitle={`${word} follow-up calls`} accent={accent} icon={Repeat} />
      </div>
    </section>
  )
}
