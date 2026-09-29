import { RULE_CLASS, type Accent } from '../../lib/colors'

interface MiniCardProps {
  label: string
  value: string
  subtitle?: string
  /** Glow accent for highlighted cards (Closed / Revenue / Cash inside call type panels). */
  glow?: Accent
}

/** Small card inside a tinted panel: surface-2 background, 10px radius. One white number per card. */
export default function MiniCard({ label, value, subtitle, glow }: MiniCardProps) {
  const border = glow ? `border-line ${RULE_CLASS[glow]}` : 'border-line'
  return (
    <div className={`rounded-mini border bg-surface-2 px-4 py-3.5 ${border}`}>
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div className="mt-1.5 font-display text-[24px] font-bold leading-none tracking-number text-text">{value}</div>
      {subtitle ? <div className="mt-1.5 text-[12px] text-muted">{subtitle}</div> : null}
    </div>
  )
}
