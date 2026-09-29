// Overall Trends. Cash area chart and grouped call type bars, one point per bucket.
// Cash rather than contract value: contract value moves around as deposits and refunds settle,
// cash is the number sales teams actually track.

import { TrendingUp } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AXIS_TICK, GRID_LINE, TOOLTIP_STYLE, TREND_COLORS } from '../../lib/colors'
import { count, money, moneyShort } from '../../lib/format'
import type { TrendPoint } from '../../lib/metrics'
import Card from '../ui/Card'
import ChartLegend from '../ui/ChartLegend'
import EmptyState from '../ui/EmptyState'
import SectionTitle from '../ui/SectionTitle'

interface OverallTrendsProps {
  points: TrendPoint[]
}

const SERIES = [
  { key: 'firstCalls', name: 'First Calls', color: TREND_COLORS.firstCalls },
  { key: 'followUps', name: 'Follow-Ups', color: TREND_COLORS.followUps },
  { key: 'textCloses', name: 'Text Closes', color: TREND_COLORS.textCloses },
] as const

export default function OverallTrends({ points }: OverallTrendsProps) {
  const data = points.map((p) => ({
    label: p.label,
    revenue: p.revenue,
    firstCalls: p.firstCalls,
    followUps: p.followUps,
    textCloses: p.textCloses,
  }))
  const empty = data.length === 0

  return (
    <section>
      <SectionTitle icon={TrendingUp} title="Overall Trends" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Cash Trend" subtitle="Cash collected each week in the selected period">
          {empty ? (
            <EmptyState message="No activity in this period" />
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TREND_COLORS.cash} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={TREND_COLORS.cash} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_LINE} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => moneyShort(Number(v))} width={52} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [money(Number(value)), 'Cash Collected']} />
                  <Area
                    type="monotone"
                    dataKey="cash"
                    name="Cash Collected"
                    stroke={TREND_COLORS.cash}
                    strokeWidth={2}
                    fill="url(#revenueFill)"
                    dot={{ r: 3, fill: TREND_COLORS.cash, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Call Types Over Time" subtitle="First calls vs follow-up calls by week">
          {empty ? (
            <EmptyState message="No activity in this period" />
          ) : (
            <>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }} barGap={6} barCategoryGap="18%">
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_LINE} vertical={false} />
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(value) => count(Number(value))} />
                    {SERIES.map((s) => (
                      <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartLegend items={SERIES.map((s) => ({ name: s.name, color: s.color }))} />
            </>
          )}
        </Card>
      </div>
    </section>
  )
}
