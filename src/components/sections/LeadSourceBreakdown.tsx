// Section 4.3: Lead Source Breakdown. Organic (green) and Paid Ads (orange) panels, 3x2 mini cards each.

import { Target, Users } from 'lucide-react'
import { count, money, pct } from '../../lib/format'
import type { SourceBreakdown } from '../../lib/metrics'
import MiniCard from '../ui/MiniCard'
import Panel from '../ui/Panel'
import SectionTitle from '../ui/SectionTitle'

interface LeadSourceBreakdownProps {
  organic: SourceBreakdown
  paid: SourceBreakdown
  /** False when the selected range has no Paid Ads data: the Paid panel is hidden and Organic takes the full width. */
  showPaid: boolean
}

function SourceGrid({ b, wide = false }: { b: SourceBreakdown; wide?: boolean }) {
  const cols = wide ? 'sm:grid-cols-3 lg:grid-cols-6' : 'sm:grid-cols-3'
  return (
    <div className={`grid grid-cols-1 gap-3 ${cols}`}>
      <MiniCard label="Cash Collected" value={money(b.cashCollected)} subtitle={`Avg ${money(b.avgCashPerDeal)} per deal`} />
      <MiniCard label="Contract Value" value={money(b.revenue)} subtitle={`${count(b.closed)} ${b.closed === 1 ? 'deal' : 'deals'} closed`} />
      <MiniCard label="Close Rate" value={pct(b.closeRate)} subtitle={`${count(b.closed)} closed / ${count(b.shown)} shown`} />
      <MiniCard label="Scheduled" value={count(b.scheduled)} subtitle={`${count(b.shown)} shown (${pct(b.showRate)})`} />
      <MiniCard label="Qualified" value={count(b.qualified)} subtitle={pct(b.qualifiedRate)} />
      <MiniCard label="Pitched" value={count(b.pitched)} subtitle={pct(b.pitchRate)} />
    </div>
  )
}

export default function LeadSourceBreakdown({ organic, paid, showPaid }: LeadSourceBreakdownProps) {
  return (
    <section>
      <SectionTitle icon={Users} title="Lead Source Breakdown" />
      <div className={`grid grid-cols-1 gap-4 ${showPaid ? 'lg:grid-cols-2' : ''}`}>
        <Panel title="Organic Leads" subtitle="Leads from organic content & referrals" icon={Users} accent="green">
          <SourceGrid b={organic} wide={!showPaid} />
        </Panel>
        {showPaid ? (
          <Panel title="Paid Ads Leads" subtitle="Leads from advertising campaigns" icon={Target} accent="orange">
            <SourceGrid b={paid} />
          </Panel>
        ) : null}
      </div>
    </section>
  )
}
