import { ACCENT_HEX, PILL_TEXT, alpha, type Accent } from '../../lib/colors'

interface StatusPillProps {
  label: string
  accent: Accent
}

/** Small rounded pill: accent text on the accent at 15% alpha (pink and slate text lifted for contrast). */
export default function StatusPill({ label, accent }: StatusPillProps) {
  const hex = ACCENT_HEX[accent]
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none"
      style={{ backgroundColor: alpha(hex, 0.15), color: PILL_TEXT[accent] }}
    >
      {label}
    </span>
  )
}
