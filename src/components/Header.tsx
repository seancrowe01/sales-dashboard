// Sticky header: brand lockup, title, view tabs,
// time filter pills, Custom popover and Refresh button. A 2px cyan to pink line runs along the top.

import { Calendar, LogOut, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PRESET_LABELS, type CustomRange, type RangePreset } from '../lib/timeRange'
import Mark from './brand/Mark'
import { BRAND_NAME } from '../config/brand'

export type View = 'dashboard' | 'followups'

export const VIEW_LABELS: Record<View, string> = {
  dashboard: 'Dashboard',
  followups: 'Follow-Ups',
}

const ROLLING_PRESETS: readonly RangePreset[] = ['LastWeek', 'TwoWeeks', 'FourWeeks', 'Year', 'AllTime']

export interface HeaderProps {
  view: View
  onViewChange: (view: View) => void
  preset: RangePreset
  onPresetChange: (preset: RangePreset) => void
  custom: CustomRange | null
  onCustomApply: (range: CustomRange) => void
  onCustomClear: () => void
  isRefreshing: boolean
  onRefresh: () => void
  /** Shown as a Sign out button when the dashboard sits behind the password gate. */
  onSignOut?: () => void
}

const PILL_BASE =
  'whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60'
const PILL_ACTIVE = 'bg-brand-primary text-bg'
const PILL_INACTIVE = 'text-muted hover:bg-surface-2 hover:text-text'
const OUTLINED =
  'inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-medium leading-none text-muted transition-colors hover:bg-surface-2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60'

export default function Header({
  view,
  onViewChange,
  preset,
  onPresetChange,
  custom,
  onCustomApply,
  onCustomClear,
  isRefreshing,
  onRefresh,
  onSignOut,
}: HeaderProps) {
  const [open, setOpen] = useState(false)
  const [draftStart, setDraftStart] = useState(custom?.start ?? '')
  const [draftEnd, setDraftEnd] = useState(custom?.end ?? '')
  const popoverRef = useRef<HTMLDivElement>(null)

  // Keep the draft in sync when the popover opens.
  useEffect(() => {
    if (open) {
      setDraftStart(custom?.start ?? '')
      setDraftEnd(custom?.end ?? '')
    }
  }, [open, custom])

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const canApply = draftStart !== '' && draftEnd !== ''
  const customActive = preset === 'Custom'

  const apply = () => {
    if (!canApply) return
    onCustomApply({ start: draftStart, end: draftEnd })
    setOpen(false)
  }

  const clear = () => {
    setDraftStart('')
    setDraftEnd('')
    onCustomClear()
    setOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
      <div className="brand-topline" aria-hidden="true" />
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-x-6 gap-y-4 px-6 py-4">
        <div className="flex items-center gap-4">
          <Mark size={36} className="shrink-0 text-brand-white" />
          <div>
            {BRAND_NAME ? (
                <div className="font-display text-[15px] font-bold uppercase leading-none tracking-wordmark text-brand-white">
                  {BRAND_NAME}
                </div>
              ) : null}
            <h1 className="mt-1.5 font-display text-[28px] font-bold leading-none text-text">
              Sales <span className="text-brand-primary">Dashboard</span>
            </h1>
            <p className="mt-1.5 text-[14px] text-muted">Real-time sales performance analytics</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-full border border-line bg-surface p-1" role="tablist" aria-label="View">
            {(Object.keys(VIEW_LABELS) as View[]).map((key) => {
              const active = view === key
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onViewChange(key)}
                  className={`${PILL_BASE} ${active ? 'bg-brand-secondary font-semibold text-bg' : PILL_INACTIVE}`}
                >
                  {VIEW_LABELS[key]}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap rounded-[22px] border border-line bg-surface p-1" role="group" aria-label="Time range">
            {ROLLING_PRESETS.map((key) => {
              const active = preset === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPresetChange(key)}
                  className={`${PILL_BASE} ${active ? PILL_ACTIVE : PILL_INACTIVE}`}
                >
                  {PRESET_LABELS[key]}
                </button>
              )
            })}
          </div>

          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={`${OUTLINED} ${customActive ? '!border-transparent !bg-brand-primary !text-bg' : ''}`}
              title={custom ? `${custom.start} to ${custom.end}` : 'Pick a custom date range'}
            >
              <Calendar size={16} aria-hidden="true" />
              {PRESET_LABELS.Custom}
            </button>
            {open ? (
              <div
                role="dialog"
                aria-label="Custom date range"
                className="absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] rounded-card border border-line bg-surface-2 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
              >
                <div className="mb-3 text-[13px] font-semibold text-text">Custom range</div>
                <label className="block text-[12px] text-muted">
                  Start date
                  <input
                    type="date"
                    value={draftStart}
                    max={draftEnd || undefined}
                    onChange={(e) => setDraftStart(e.target.value)}
                    className="mt-1 w-full rounded-mini border border-line bg-surface-2 px-3 py-2 text-[13px] text-text focus:border-brand-primary focus:outline-none"
                  />
                </label>
                <label className="mt-3 block text-[12px] text-muted">
                  End date
                  <input
                    type="date"
                    value={draftEnd}
                    min={draftStart || undefined}
                    onChange={(e) => setDraftEnd(e.target.value)}
                    className="mt-1 w-full rounded-mini border border-line bg-surface-2 px-3 py-2 text-[13px] text-text focus:border-brand-primary focus:outline-none"
                  />
                </label>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={clear}
                    className="rounded-full px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={apply}
                    disabled={!canApply}
                    className="rounded-full bg-brand-primary px-3.5 py-1.5 text-[13px] font-semibold text-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <button type="button" onClick={onRefresh} disabled={isRefreshing} className={OUTLINED} aria-busy={isRefreshing}>
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh
          </button>

          {onSignOut ? (
            <button type="button" onClick={onSignOut} className={OUTLINED} title="Sign out of the dashboard">
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
