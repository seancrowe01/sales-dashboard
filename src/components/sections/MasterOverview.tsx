// Section 4.2: Master Overview (All Leads). Four hero KPI cards and six smaller cards.

import { CreditCard, DollarSign, MessageSquare, Percent, Phone, PhoneCall, Repeat, Target, TrendingUp, UserCheck } from 'lucide-react'
import { count, money, pct } from '../../lib/format'
import type { Overview } from '../../lib/metrics'
import SectionTitle from '../ui/SectionTitle'
import StatCard from '../ui/StatCard'

interface MasterOverviewProps {
  overview: Overview
}

export default function MasterOverview({ overview: o }: MasterOverviewProps) {
  return (
    <section aria-labelledby="master-overview">
      <SectionTitle icon={TrendingUp} title="Master Overview (All Leads)" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Cash first: it is the number sales teams actually track, and the only one that is
            real money in the bank. */}
        <StatCard
          label="Cash Collected"
          value={money(o.cashCollected)}
          subtitle={`Money actually received • Avg ${money(o.avgCashPerDeal)} per deal`}
          icon={CreditCard}
          accent="teal"
          glow
        />
        {/* Named Contract Value, not Revenue, because that is what it is: the agreed price on
            deals that actually closed. Deposits are called out so the gap is never a mystery. */}
        <StatCard
          label="Contract Value"
          value={money(o.revenue)}
          subtitle={
            o.deposits > 0
              ? `${count(o.closed)} ${o.closed === 1 ? 'deal' : 'deals'} closed • ${money(o.depositContractValue)} more in ${count(o.deposits)} ${o.deposits === 1 ? 'deposit' : 'deposits'} not closed yet`
              : `${count(o.closed)} ${o.closed === 1 ? 'deal' : 'deals'} closed • Avg ${money(o.avgDeal)}`
          }
          icon={DollarSign}
          accent="green"
          glow
        />
        <StatCard
          label="Close Rate"
          value={pct(o.closeRate)}
          subtitle={`${count(o.closed)} closed / ${count(o.shown)} shown`}
          icon={Target}
          accent="secondary"
          glow
        />
        <StatCard
          label="Text Closes"
          value={count(o.textClosed)}
          subtitle={`${money(o.dmRevenue)} contract value`}
          icon={MessageSquare}
          accent="orange"
          glow
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Calls Scheduled" value={count(o.scheduled)} icon={Phone} accent="slate" size="sm" />
        <StatCard label="Calls Shown" value={count(o.shown)} subtitle={pct(o.showRate)} icon={UserCheck} accent="primary" size="sm" />
        <StatCard label="Qualified" value={count(o.qualified)} subtitle={pct(o.qualifiedRate)} icon={Target} accent="secondary" size="sm" />
        <StatCard label="Pitched" value={count(o.pitched)} subtitle={pct(o.pitchRate)} icon={Percent} accent="orange" size="sm" />
        <StatCard
          label="1st Call Close Rate"
          value={pct(o.firstCallCloseRate)}
          subtitle={`${count(o.firstCallsClosed)} closed / ${count(o.firstCallsShown)} shown of ${count(o.firstCalls)} booked`}
          icon={PhoneCall}
          accent="primary"
          size="sm"
        />
        <StatCard
          label="Follow-up Close Rate"
          value={pct(o.followUpCloseRate)}
          subtitle={`${count(o.followUpsClosed)} closed / ${count(o.followUpsShown)} shown of ${count(o.followUps)} booked`}
          icon={Repeat}
          accent="secondary"
          size="sm"
        />
      </div>
    </section>
  )
}
