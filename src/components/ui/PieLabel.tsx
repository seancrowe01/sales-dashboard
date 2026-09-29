// Outside label for pie and donut slices: a short connector line from the slice edge and a
// text label in the slice colour. Recharts calls this with the geometry of each slice.

import { FONT_SANS } from '../../lib/colors'

export interface PieLabelProps {
  cx?: number
  cy?: number
  midAngle?: number
  outerRadius?: number
  fill?: string
  text: string
}

const RADIAN = Math.PI / 180

export function renderPieLabel({ cx = 0, cy = 0, midAngle = 0, outerRadius = 0, fill = '#ffffff', text }: PieLabelProps) {
  const sin = Math.sin(-RADIAN * midAngle)
  const cos = Math.cos(-RADIAN * midAngle)
  const sx = cx + outerRadius * cos
  const sy = cy + outerRadius * sin
  const mx = cx + (outerRadius + 12) * cos
  const my = cy + (outerRadius + 12) * sin
  const ex = mx + (cos >= 0 ? 1 : -1) * 14
  const ey = my
  const anchor = cos >= 0 ? 'start' : 'end'
  return (
    <g>
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={1} />
      <text
        x={ex + (cos >= 0 ? 4 : -4)}
        y={ey}
        fill={fill}
        textAnchor={anchor}
        dominantBaseline="central"
        fontSize={12}
        fontFamily={FONT_SANS}
        fontWeight={500}
      >
        {text}
      </text>
    </g>
  )
}
