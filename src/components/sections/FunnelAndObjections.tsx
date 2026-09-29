// Sections 4.9 and 4.10: sales funnel bars and objections donut for one lead source.

import { Funnel as FunnelIcon } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type PieLabelRenderProps } from 'recharts'
import type { LeadSource } from '../../data/types'
import { FUNNEL_COLORS, TOOLTIP_STYLE, objectionColor } from '../../lib/colors'
import { count, pct, pctWhole } from '../../lib/format'
import type { FunnelStage, ObjectionCount } from '../../lib/metrics'
import Card from '../ui/Card'
import ChartLegend from '../ui/ChartLegend'
import EmptyState from '../ui/EmptyState'
import { renderPieLabel } from '../ui/PieLabel'
import SectionTitle from '../ui/SectionTitle'

interface FunnelAndObjectionsProps {
  source: LeadSource
  funnel: FunnelStage[]
  objections: ObjectionCount[]
}

function FunnelRows({ stages }: { stages: FunnelStage[] }) {
  return (
    <ul className="space-y-4">
      {stages.map((s) => (
        <li key={s.stage}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="font-medium text-text">{s.stage}</span>
            <span className="text-right">
              <span className="text-[15px] font-bold tabular-nums text-text">{count(s.count)}</span>
              {s.conversion !== null ? <span className="ml-2 text-[12px] text-muted">{pct(s.conversion)} conversion</span> : null}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${Math.max(0, Math.min(1, s.width)) * 100}%`, backgroundColor: FUNNEL_COLORS[s.stage] }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function ObjectionsDonut({ objections }: { objections: ObjectionCount[] }) {
  const data = objections
    .filter((o) => o.count > 0)
    .map((o, i) => ({ name: o.objection, value: o.count, fill: objectionColor(i) }))
  if (data.length === 0) return <EmptyState message="No objections recorded in this period" />
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
              innerRadius={52}
              outerRadius={82}
              stroke="none"
              isAnimationActive={false}
              labelLine={false}
              label={(props: PieLabelRenderProps) => {
                const index = Number(props.index ?? 0)
                const fill = typeof props.fill === 'string' && props.fill ? props.fill : objectionColor(index)
                return renderPieLabel({
                  cx: Number(props.cx),
                  cy: Number(props.cy),
                  midAngle: Number(props.midAngle),
                  outerRadius: Number(props.outerRadius),
                  fill,
                  text: pctWhole(Number(props.percent ?? 0)),
                })
              }}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} formatter={(value) => `${count(Number(value))} calls`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={data.map((d) => ({ name: d.name, color: d.fill }))} />
    </>
  )
}

export default function FunnelAndObjections({ source, funnel, objections }: FunnelAndObjectionsProps) {
  return (
    <section>
      <SectionTitle icon={FunnelIcon} title={`${source} - Funnel & Objections`} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Sales Funnel" subtitle="Conversion through each stage">
          <FunnelRows stages={funnel} />
        </Card>
        <Card title="Common Objections" subtitle="Most frequent reasons for not closing">
          <ObjectionsDonut objections={objections} />
        </Card>
      </div>
    </section>
  )
}
