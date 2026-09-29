// Time range presets and trend buckets.
// Every function that depends on "now" takes it as a parameter. Nothing reads the wall clock.

export type RangePreset = 'LastWeek' | 'TwoWeeks' | 'FourWeeks' | 'Year' | 'AllTime' | 'Custom'

export interface TimeRange {
  preset: RangePreset
  start: Date // 00:00:00.000 local
  end: Date // 23:59:59.999 local
  label: string
}

/** Dates as YYYY-MM-DD strings, both inclusive. */
export interface CustomRange {
  start: string
  end: string
}

export type BucketMode = 'week' | 'month'

export interface Bucket {
  key: string // YYYY-MM-DD of the bucket start
  label: string // "Feb 1" for weekly, "Feb 2026" for monthly
  start: Date // inclusive
  end: Date // exclusive
}

export const RANGE_PRESETS: readonly RangePreset[] = [
  'LastWeek',
  'TwoWeeks',
  'FourWeeks',
  'Year',
  'AllTime',
  'Custom',
] as const

export const PRESET_LABELS: Record<RangePreset, string> = {
  LastWeek: 'Last Week',
  TwoWeeks: '2 Weeks',
  FourWeeks: '4 Weeks',
  Year: 'Year',
  AllTime: 'All Time',
  Custom: 'Custom',
}

/** Days covered by each rolling preset, including today. */
export const PRESET_DAYS: Record<Exclude<RangePreset, 'AllTime' | 'Custom'>, number> = {
  LastWeek: 7,
  TwoWeeks: 14,
  FourWeeks: 28,
  Year: 365,
}

/** Ranges longer than this many days switch from 7-day buckets to calendar months. */
export const MONTHLY_THRESHOLD_DAYS = 120

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MS_PER_DAY = 86_400_000
const ALL_TIME_START = new Date(1970, 0, 1, 0, 0, 0, 0)

// ---------- date helpers ----------

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

/** Add whole calendar days (DST safe because it goes through the calendar, not milliseconds). */
export function addDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  )
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1, 0, 0, 0, 0)
}

/** Local YYYY-MM-DD for a Date. */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const d = date.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Parse a record date. "YYYY-MM-DD" is read as local midnight (so it never shifts a day
 * because of the time zone). Anything else falls back to the Date constructor.
 * Returns null when the value cannot be parsed.
 */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const trimmed = value.trim()
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (plain) {
    const d = new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]), 0, 0, 0, 0)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Whole calendar days between two dates (b - a), ignoring the time of day. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY)
}

/** Whole calendar days from a record date string to now. Null when the date cannot be parsed. */
export function daysSince(dateString: string, now: Date): number | null {
  const d = parseDate(dateString)
  if (!d) return null
  return daysBetween(d, now)
}

// ---------- presets ----------

/**
 * Build the active range. Rolling presets are inclusive of today (end of today) and start
 * at 00:00 local of (today - N + 1). All Time starts at 1970 (bucketing narrows it to the
 * earliest record). Custom takes both dates inclusive and swaps them if reversed; without a
 * custom value it falls back to the 4 Weeks window but keeps the Custom label.
 */
export function getRange(preset: RangePreset, now: Date, custom?: CustomRange | null): TimeRange {
  const end = endOfDay(now)
  switch (preset) {
    case 'LastWeek':
    case 'TwoWeeks':
    case 'FourWeeks':
    case 'Year': {
      const days = PRESET_DAYS[preset]
      return { preset, start: startOfDay(addDays(now, -(days - 1))), end, label: PRESET_LABELS[preset] }
    }
    case 'AllTime':
      return { preset, start: ALL_TIME_START, end, label: PRESET_LABELS.AllTime }
    case 'Custom': {
      const s = custom ? parseDate(custom.start) : null
      const e = custom ? parseDate(custom.end) : null
      if (!s || !e) {
        const fallback = getRange('FourWeeks', now)
        return { ...fallback, preset: 'Custom', label: PRESET_LABELS.Custom }
      }
      const [lo, hi] = s.getTime() <= e.getTime() ? [s, e] : [e, s]
      return { preset, start: startOfDay(lo), end: endOfDay(hi), label: PRESET_LABELS.Custom }
    }
  }
}

/** True when the record date falls inside the range (inclusive both ends). */
export function inRange(dateString: string, range: TimeRange): boolean {
  const d = parseDate(dateString)
  if (!d) return false
  const t = d.getTime()
  return t >= range.start.getTime() && t <= range.end.getTime()
}

/** Number of calendar days the range covers (4 Weeks = 28). */
export function rangeDays(range: TimeRange): number {
  return daysBetween(range.start, range.end) + 1
}

// ---------- buckets for trends ----------

/** Pure label formatter: "Feb 1" for weekly buckets, "Feb 2026" for monthly buckets. */
export function formatBucketLabel(date: Date, mode: BucketMode): string {
  const month = MONTHS[date.getMonth()]
  return mode === 'week' ? `${month} ${date.getDate()}` : `${month} ${date.getFullYear()}`
}

/**
 * The start the buckets count from. For All Time that is the earliest record date
 * (falls back to a 4 week window when there are no records). Other presets use range.start.
 */
export function effectiveStart(range: TimeRange, earliest?: Date | null): Date {
  if (range.preset !== 'AllTime') return range.start
  if (earliest) return startOfDay(earliest)
  return startOfDay(addDays(range.end, -(PRESET_DAYS.FourWeeks - 1)))
}

/** Weekly buckets up to 120 days, calendar months beyond that. */
export function bucketMode(range: TimeRange, earliest?: Date | null): BucketMode {
  const start = effectiveStart(range, earliest)
  const days = daysBetween(start, range.end) + 1
  return days > MONTHLY_THRESHOLD_DAYS ? 'month' : 'week'
}

/**
 * Consecutive buckets covering the range. Weekly: 7-day windows starting at the range start
 * (All Time: at the earliest record). Monthly: calendar months from the month of the start.
 * Bucket end is exclusive.
 */
export function getBuckets(range: TimeRange, earliest?: Date | null): Bucket[] {
  const start = effectiveStart(range, earliest)
  const mode = bucketMode(range, earliest)
  const buckets: Bucket[] = []
  if (mode === 'week') {
    const days = daysBetween(start, range.end) + 1
    const n = Math.max(1, Math.ceil(days / 7))
    for (let i = 0; i < n; i++) {
      const s = addDays(start, i * 7)
      const e = addDays(start, (i + 1) * 7)
      buckets.push({ key: toISODate(s), label: formatBucketLabel(s, 'week'), start: s, end: e })
    }
    return buckets
  }
  let cursor = startOfMonth(start)
  const endTime = range.end.getTime()
  while (cursor.getTime() <= endTime) {
    const next = addMonths(cursor, 1)
    buckets.push({ key: toISODate(cursor), label: formatBucketLabel(cursor, 'month'), start: cursor, end: next })
    cursor = next
  }
  return buckets
}

/** Index of the bucket a record date belongs to, or -1 when outside every bucket. */
export function bucketIndex(buckets: Bucket[], dateString: string): number {
  const d = parseDate(dateString)
  if (!d) return -1
  const t = d.getTime()
  for (let i = 0; i < buckets.length; i++) {
    if (t >= buckets[i].start.getTime() && t < buckets[i].end.getTime()) return i
  }
  return -1
}

/** Earliest parseable date among the strings, or null. */
export function earliestDate(dateStrings: string[]): Date | null {
  let best: Date | null = null
  for (const s of dateStrings) {
    const d = parseDate(s)
    if (d && (!best || d.getTime() < best.getTime())) best = d
  }
  return best
}
