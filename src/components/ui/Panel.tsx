import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ACCENT_HEX, alpha, type Accent } from '../../lib/colors'
import IconChip from './IconChip'

interface PanelProps {
  title: string
  subtitle?: string
  icon: LucideIcon
  /** Panel tint: border and soft glow in the accent at about 25% alpha. */
  accent: Accent
  children: ReactNode
}

/** Large tinted panel (Organic = green, Paid Ads = orange) that holds a grid of mini cards. */
export default function Panel({ title, subtitle, icon, accent, children }: PanelProps) {
  const hex = ACCENT_HEX[accent]
  return (
    <section
      className="rounded-card bg-surface p-5"
      style={{
        border: `1px solid ${alpha(hex, 0.25)}`,
        boxShadow: `0 0 24px ${alpha(hex, 0.08)}`,
      }}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[17px] font-semibold leading-tight text-text">{title}</h3>
          {subtitle ? <p className="mt-1 text-[13px] text-muted">{subtitle}</p> : null}
        </div>
        <IconChip icon={icon} accent={accent} size={36} />
      </header>
      {children}
    </section>
  )
}
