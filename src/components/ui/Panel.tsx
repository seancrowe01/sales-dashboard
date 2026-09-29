import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ACCENT_HEX, alpha, type Accent } from '../../lib/colors'
import IconChip from './IconChip'

interface PanelProps {
  title: string
  subtitle?: string
  icon: LucideIcon
  /** Panel identity colour: a left edge rule, not a halo. */
  accent: Accent
  children: ReactNode
}

/** Large panel (Organic = green, Paid Ads = orange) holding a grid of mini cards. The accent is
 * a solid rule down the left edge, so panels read as sections rather than glowing objects. */
export default function Panel({ title, subtitle, icon, accent, children }: PanelProps) {
  const hex = ACCENT_HEX[accent]
  return (
    <section
      className="overflow-hidden rounded-card border border-line bg-surface p-5 pl-6"
      style={{ boxShadow: `inset 3px 0 0 0 ${hex}`, background: `linear-gradient(90deg, ${alpha(hex, 0.05)} 0%, transparent 220px), var(--surface)` }}
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
