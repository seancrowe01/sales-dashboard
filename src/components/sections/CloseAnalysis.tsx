// Close analysis for one lead source. Two pies: deal counts and cash
// by close type. Slices with a zero value are omitted. Labels sit outside in the slice colour.

import { ChartPie } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type PieLabelRenderProps } from 'recharts'
import type { LeadSource } from '../../data/types'
import { CLOSE_TYPE_COLORS, TOOLTIP_STYLE } from '../../lib/colors'
import { count, money, pct } from '../../lib/format'
import type { CloseSlice, CloseType } from '../../lib/metrics'
import Card from '../ui/Card'
import ChartLegend from '../ui/ChartLegend'
import EmptyState from '../ui/EmptyState'
import { renderPieLabel } from '../ui/PieLabel'
import SectionTitle from '../ui/SectionTitle'

interface CloseAnalysisProps {
  source: LeadSource
  slices: CloseSlice[]
}

interface PieDatum {
  name: CloseType
  value: number
  fill: string
}

function sliceColor(props: PieLabelRenderProps): string {
  const name = props.name as CloseType | undefined
  if (typeof props.fill === 'string' && props.fill) return props.fill
  return name ? CLOSE_TYPE_COLORS[name] : '#ffffff'
}

function ClosePie({ data, valueFormatter }: { data: PieDatum[]; valueFormatter: (v: number) => string }) {
  if (data.length === 0) return <EmptyState message="No deals closed in this period" />
  return (
    <>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={82}
              stroke="none"
              isAnimationActive={false}
              labelLine={false}
              label={(props: PieLabelRenderProps) =>
                renderPieLabel({
                  cx: Number(props.cx),
                  cy: Number(props.cy),
                  midAngle: Number(props.midAngle),
                  outerRadius: Number(props.outerRadius),
                  fill: sliceColor(props),
                  text: `${props.name}: ${pct(Number(props.percent ?? 0))}`,
                })
              }
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} formatter={(value) => valueFormatter(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={data.map((d) => ({ name: d.name, color: d.fill }))} />
    </>
  )
}

export default function CloseAnalysis({ source, slices }: CloseAnalysisProps) {
  const countData: PieDatum[] = slices
    .filter((s) => s.count > 0)
    .map((s) => ({ name: s.type, value: s.count, fill: CLOSE_TYPE_COLORS[s.type] }))
  const cashData: PieDatum[] = slices
    .filter((s) => s.cash > 0)
    .map((s) => ({ name: s.type, value: s.cash, fill: CLOSE_TYPE_COLORS[s.type] }))

  return (
    <section>
      <SectionTitle icon={ChartPie} title={`${source} - Close Analysis`} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Close Distribution" subtitle="Where deals are being closed">
          <ClosePie data={countData} valueFormatter={(v) => `${count(v)} deals`} />
        </Card>
        <Card title="Cash by Close Type" subtitle="Where the money actually came from">
          <ClosePie data={cashData} valueFormatter={(v) => money(v)} />
        </Card>
      </div>
    </section>
  )
}
