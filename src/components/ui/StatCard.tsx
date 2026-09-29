import type { LucideIcon } from 'lucide-react'
import { GLOW_CLASS, type Accent } from '../../lib/colors'
import IconChip from './IconChip'

export interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  icon: LucideIcon
  accent: Accent
  /** Coloured glow border (hero KPI cards). Plain 1px border otherwise. */
  glow?: boolean
  /** lg = hero card padding and 40px chip (row 1), sm = tighter padding and 36px chip (row 2 and summary strips). The number is 32px in both. */
  size?: 'lg' | 'sm'
}

/** One big number per card, tiny muted label, optional subtitle, icon chip top right. */
export default function StatCard({ label, value, subtitle, icon, accent, glow = false, size = 'lg' }: StatCardProps) {
  const border = glow ? `border-transparent ${GLOW_CLASS[accent]}` : 'border-line'
  const numberSize = 'text-[32px]'
  const padding = size === 'lg' ? 'p-5' : 'p-4'
  return (
    <div className={`relative flex min-h-[118px] flex-col justify-between rounded-card border bg-surface ${padding} ${border}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-medium leading-tight text-muted">{label}</span>
        <IconChip icon={icon} accent={accent} size={size === 'lg' ? 40 : 36} />
      </div>
      <div className="mt-3">
        <div className={`font-display ${numberSize} font-bold leading-none tracking-number text-text`}>{value}</div>
        {subtitle ? <div className="mt-2 text-[12px] leading-snug text-muted">{subtitle}</div> : null}
      </div>
    </div>
  )
}
