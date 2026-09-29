// Colour tokens for everything that cannot be expressed as a Tailwind class:
// Recharts series, pie slices, icon chips and glows. The values mirror styles.css and
// tailwind.config.ts. No chart may hard-code a colour.

import type { CloseType, FunnelStageName } from './metrics'

export type Accent = 'primary' | 'secondary' | 'green' | 'teal' | 'orange' | 'slate'

export const ACCENT_HEX: Record<Accent, string> = {
  // CHANGE THESE TWO to make the dashboard your colours. Nothing else needs touching,
  // except the matching lines in tailwind.config.ts.
  primary: '#E3A857', // first calls, the selected filter, the contract column
  secondary: '#9B8AFB', // close rate, the Follow-Ups tab, the selected view
  green: '#22c55e', // revenue, closed, positive
  teal: '#2dd4bf', // cash collected
  orange: '#D2691E', // text closes, pitched, paid ads
  slate: '#64748b', // scheduled
}

export const SURFACE = '#151519'
export const SURFACE_2 = '#1c1c22'
export const BORDER = 'rgba(255,255,255,0.09)'
export const TEXT = '#ededf0'
export const MUTED = '#8b8b96'
export const GRID_LINE = 'rgba(255,255,255,0.07)'
export const FONT_SANS = "'DM Sans', Inter, system-ui, sans-serif"

/** Tailwind accent rule class per accent (defined in tailwind.config.ts). A hairline along the
 * top edge of a highlighted card, instead of a coloured halo around it. */
export const RULE_CLASS: Record<Accent, string> = {
  primary: 'shadow-rule-primary',
  secondary: 'shadow-rule-secondary',
  green: 'shadow-rule-green',
  teal: 'shadow-rule-teal',
  orange: 'shadow-rule-orange',
  slate: 'shadow-rule-slate',
}

/** Tailwind text colour class per accent. */
export const TEXT_CLASS: Record<Accent, string> = {
  primary: 'text-accent-primary',
  secondary: 'text-accent-secondary',
  green: 'text-accent-green',
  teal: 'text-accent-teal',
  orange: 'text-accent-orange',
  slate: 'text-accent-slate',
}

/** Close type slices, one colour per way a deal can close. */
export const CLOSE_TYPE_COLORS: Record<CloseType, string> = {
  '1st Call Close': ACCENT_HEX.primary,
  'Follow-up Close': ACCENT_HEX.secondary,
  'Text Close': ACCENT_HEX.green,
}

/** Trend chart series. */
export const TREND_COLORS = {
  cash: ACCENT_HEX.green,
  firstCalls: ACCENT_HEX.primary,
  followUps: ACCENT_HEX.secondary,
  textCloses: ACCENT_HEX.green,
} as const

/** Funnel bar colour per stage. */
export const FUNNEL_COLORS: Record<FunnelStageName, string> = {
  Scheduled: ACCENT_HEX.slate,
  Showed: ACCENT_HEX.primary,
  Qualified: ACCENT_HEX.secondary,
  Pitched: ACCENT_HEX.orange,
  Closed: ACCENT_HEX.green,
}

/** Objection donut palette, in slice order. */
export const OBJECTION_PALETTE: readonly string[] = [
  ACCENT_HEX.primary,
  ACCENT_HEX.orange,
  ACCENT_HEX.secondary,
  ACCENT_HEX.green,
  ACCENT_HEX.teal,
  ACCENT_HEX.slate,
]

/** Colour for the nth objection slice, cycling through the palette. */
export function objectionColor(index: number): string {
  return OBJECTION_PALETTE[index % OBJECTION_PALETTE.length]
}

/** Hex colour to rgba with the given alpha, e.g. alpha('#22c55e', 0.15). */
export function alpha(hex: string, a: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = parseInt(full, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${a})`
}

/** Mix a hex colour toward white, e.g. lighten('#A855F7', 0.4) for readable small text on a tinted pill. */
export function lighten(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = parseInt(full, 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`
}

/**
 * Text colour for status pills. Pink and slate are lifted toward white so 12px labels clear
 * the 4.5:1 contrast floor on their 15% alpha pill backgrounds; the bright accents stay as they are.
 */
export const PILL_TEXT: Record<Accent, string> = {
  primary: ACCENT_HEX.primary,
  secondary: lighten(ACCENT_HEX.secondary, 0.4),
  green: ACCENT_HEX.green,
  teal: ACCENT_HEX.teal,
  orange: ACCENT_HEX.orange,
  slate: lighten(ACCENT_HEX.slate, 0.45),
}

/** Shared Recharts tooltip styling so every chart looks the same. */
export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    color: TEXT,
    fontSize: 12,
    fontFamily: FONT_SANS,
  },
  labelStyle: { color: MUTED, marginBottom: 4 },
  itemStyle: { color: TEXT },
  cursor: { fill: 'rgba(148,163,184,0.06)' },
} as const

export const AXIS_TICK = { fill: MUTED, fontSize: 12, fontFamily: FONT_SANS } as const
