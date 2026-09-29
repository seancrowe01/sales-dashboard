// Display formatters. Pure, no locale surprises.

import { parseDate } from './timeRange'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0
}

/** Divide safely. Returns 0 when the denominator is 0 or the result is not finite. */
export function safeDiv(numerator: number, denominator: number): number {
  if (!denominator) return 0
  const result = numerator / denominator
  return Number.isFinite(result) ? result : 0
}

/**
 * Currency symbol for every money figure. Set VITE_CURRENCY in .env, for example $ or EUR.
 * Override with VITE_CURRENCY in .env (for example VITE_CURRENCY=$) and rebuild.
 */
export const DEFAULT_CURRENCY: string = (() => {
  const raw = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_CURRENCY : undefined
  return typeof raw === 'string' && raw.trim() ? raw.trim() : '£'
})()

/** Thousands separators, no decimals, e.g. 40000 -> "£40,000". Negative values keep the sign: "-£1,200". */
export function money(value: number, currency = DEFAULT_CURRENCY): string {
  const n = Math.round(finite(value))
  const abs = Math.abs(n)
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return n < 0 ? `-${currency}${grouped}` : `${currency}${grouped}`
}

/** Chart axis style, e.g. 22000 -> "£22k", 1500 -> "£1.5k", 0 -> "£0k", 1200000 -> "£1.2M". */
export function moneyShort(value: number, currency = DEFAULT_CURRENCY): string {
  const n = finite(value)
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs === 0) return `${currency}0k`
  if (abs < 1000) return `${sign}${currency}${Math.round(abs)}`
  if (abs < 1_000_000) {
    const k = abs / 1000
    const text = k >= 100 ? Math.round(k).toString() : trimDecimal(k, 1)
    return `${sign}${currency}${text}k`
  }
  const m = abs / 1_000_000
  return `${sign}${currency}${trimDecimal(m, 1)}M`
}

/** Ratio (0..1) to one-decimal percent, e.g. 0.621 -> "62.1%". Division by zero upstream shows "0.0%". */
export function pct(ratio: number): string {
  const n = finite(ratio) * 100
  return `${n.toFixed(1)}%`
}

/** Ratio (0..1) to whole percent, e.g. 0.391 -> "39%". Used for pie and donut labels. */
export function pctWhole(ratio: number): string {
  const n = finite(ratio) * 100
  return `${Math.round(n)}%`
}

/** Plain integer with thousands separators, e.g. 1234 -> "1,234". */
export function count(value: number): string {
  return Math.round(finite(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Clock stamp for the footer, e.g. "23:30:09". */
export function timeStamp(date: Date): string {
  const hh = date.getHours().toString().padStart(2, '0')
  const mm = date.getMinutes().toString().padStart(2, '0')
  const ss = date.getSeconds().toString().padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/** Table date, day first, e.g. "2026-08-06" -> "6 Aug 2026". Unparseable input is returned as is. */
export function formatDate(dateString: string): string {
  const d = parseDate(dateString)
  if (!d) return dateString
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Whole days as "27 days" / "1 day". */
export function days(value: number): string {
  const n = Math.round(finite(value))
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

function trimDecimal(n: number, decimals: number): string {
  const fixed = n.toFixed(decimals)
  return fixed.replace(/\.0+$/, '')
}
