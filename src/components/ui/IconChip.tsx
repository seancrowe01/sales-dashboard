import type { LucideIcon } from 'lucide-react'
import { ACCENT_HEX, alpha, type Accent } from '../../lib/colors'

interface IconChipProps {
  icon: LucideIcon
  accent: Accent
  /** Chip size in px (40 for KPI cards, 36 for panels and small cards). */
  size?: number
}

/** Rounded 10px chip, accent at 15% alpha behind an 18px accent icon. */
export default function IconChip({ icon: Icon, accent, size = 40 }: IconChipProps) {
  const hex = ACCENT_HEX[accent]
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-chip"
      style={{ width: size, height: size, backgroundColor: alpha(hex, 0.15), color: hex }}
      aria-hidden="true"
    >
      <Icon size={18} strokeWidth={2} />
    </span>
  )
}
