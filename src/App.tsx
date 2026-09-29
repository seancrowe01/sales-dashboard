// Sales dashboard. Holds the view, time preset and custom range state, loads the
// data through useSalesData, filters it to the active range and hands the numbers to the sections.

import { useEffect, useMemo, useState } from 'react'
import { fetchSession, logout } from './data/session'
import { resolveDataSource, useSalesData } from './data/useSalesData'
import {
  computeCallTypeBreakdown,
  computeCloseDistribution,
  computeCloserRows,
  computeFollowUps,
  computeFunnel,
  computeObjections,
  computeOverview,
  computeSourceBreakdown,
  computeTrends,
  filterByRange,
  hasSourceData,
} from './lib/metrics'
import { getRange, type CustomRange, type RangePreset } from './lib/timeRange'
import Header, { type View } from './components/Header'
import LoginScreen from './components/LoginScreen'
import CallTypeBreakdown from './components/sections/CallTypeBreakdown'
import CloseAnalysis from './components/sections/CloseAnalysis'
import CloserPerformance from './components/sections/CloserPerformance'
import FollowUps from './components/sections/FollowUps'
import Footer from './components/sections/Footer'
import FunnelAndObjections from './components/sections/FunnelAndObjections'
import LeadSourceBreakdown from './components/sections/LeadSourceBreakdown'
import MasterOverview from './components/sections/MasterOverview'
import OverallTrends from './components/sections/OverallTrends'
import ErrorBanner from './components/ui/ErrorBanner'
import DashboardSkeleton from './components/ui/Skeleton'

// The view and time range live in the URL too, so links like ?view=followups, ?range=Year or
// ?from=2026-04-01&to=2026-04-30 open the dashboard in that exact state and can be shared.
const ROLLING_PRESETS: readonly RangePreset[] = ['LastWeek', 'TwoWeeks', 'FourWeeks', 'Year', 'AllTime']
const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/

function readParams(): URLSearchParams {
  return new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
}

function initialView(): View {
  return readParams().get('view') === 'followups' ? 'followups' : 'dashboard'
}

function initialRange(): { preset: RangePreset; custom: CustomRange | null } {
  const params = readParams()
  const from = params.get('from')
  const to = params.get('to')
  if (from && to && DATE_PARAM.test(from) && DATE_PARAM.test(to) && from <= to) {
    return { preset: 'Custom', custom: { start: from, end: to } }
  }
  const range = params.get('range')
  const preset = ROLLING_PRESETS.find((p) => p === range) ?? 'FourWeeks'
  return { preset, custom: null }
}

function writeUrl(mutate: (params: URLSearchParams) => void) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  mutate(url.searchParams)
  window.history.replaceState(null, '', url)
}

// The Paid Ads blocks are always shown, matching the reference dashboard the client signed off.
// Set VITE_HIDE_EMPTY_PAID=true to hide them while the selected range has no paid calls or text closes.
const HIDE_EMPTY_PAID = String(import.meta.env.VITE_HIDE_EMPTY_PAID ?? '').trim().toLowerCase() === 'true'

// Password gate state: live data needs a session cookie from the proxy; sample data never does.
type AuthState = 'checking' | 'required' | 'ok'

export default function App() {
  const source = resolveDataSource()
  const [auth, setAuth] = useState<AuthState>(source === 'airtable' ? 'checking' : 'ok')
  const [passwordRequired, setPasswordRequired] = useState(false)

  useEffect(() => {
    if (source !== 'airtable') return
    let cancelled = false
    fetchSession()
      .then((session) => {
        if (cancelled) return
        setPasswordRequired(session.required)
        setAuth(session.authenticated || !session.required ? 'ok' : 'required')
      })
      .catch(() => {
        // Proxy unreachable: let the data hook surface the error banner instead of a dead login screen.
        if (!cancelled) setAuth('ok')
      })
    return () => {
      cancelled = true
    }
  }, [source])

  const signOut = async () => {
    await logout()
    setAuth('required')
  }

  const [view, setViewState] = useState<View>(initialView)
  const [preset, setPresetState] = useState<RangePreset>(() => initialRange().preset)
  const [custom, setCustom] = useState<CustomRange | null>(() => initialRange().custom)

  const setView = (next: View) => {
    setViewState(next)
    writeUrl((p) => (next === 'dashboard' ? p.delete('view') : p.set('view', next)))
  }

  const setPreset = (next: RangePreset) => {
    setPresetState(next)
    writeUrl((p) => {
      p.delete('from')
      p.delete('to')
      if (next === 'FourWeeks') p.delete('range')
      else p.set('range', next)
    })
  }
  const sales = useSalesData({ enabled: auth === 'ok', onUnauthorized: () => setAuth('required') })

  // "Now" is read at render so the rolling presets always end at the end of today.
  const now = new Date()
  const range = getRange(preset, now, custom)
  const rangeKey = `${range.start.getTime()}:${range.end.getTime()}`
  const dayKey = now.toDateString()

  const filtered = useMemo(
    () => filterByRange(sales.data, range),
    [sales.data, rangeKey],
  )

  const dashboard = useMemo(
    () => ({
      overview: computeOverview(filtered),
      organic: computeSourceBreakdown(filtered, 'Organic'),
      paid: computeSourceBreakdown(filtered, 'Paid Ads'),
      organicFirst: computeCallTypeBreakdown(filtered, 'Organic', '1st Call'),
      organicFollow: computeCallTypeBreakdown(filtered, 'Organic', 'Follow-up'),
      paidFirst: computeCallTypeBreakdown(filtered, 'Paid Ads', '1st Call'),
      paidFollow: computeCallTypeBreakdown(filtered, 'Paid Ads', 'Follow-up'),
      organicCloses: computeCloseDistribution(filtered, 'Organic'),
      paidCloses: computeCloseDistribution(filtered, 'Paid Ads'),
      trends: computeTrends(sales.data, range),
      organicFunnel: computeFunnel(filtered, 'Organic'),
      paidFunnel: computeFunnel(filtered, 'Paid Ads'),
      organicObjections: computeObjections(filtered, 'Organic'),
      paidObjections: computeObjections(filtered, 'Paid Ads'),
      closers: computeCloserRows(filtered),
      // Paid Ads blocks always render unless VITE_HIDE_EMPTY_PAID is on and the range has no paid data.
      showPaid: !HIDE_EMPTY_PAID || hasSourceData(filtered, 'Paid Ads'),
    }),
    [filtered, sales.data, rangeKey],
  )

  const followUps = useMemo(
    () => computeFollowUps(filtered, now),
    [filtered, dayKey],
  )

  const applyCustom = (value: CustomRange) => {
    setCustom(value)
    setPresetState('Custom')
    writeUrl((p) => {
      p.delete('range')
      p.set('from', value.start)
      p.set('to', value.end)
    })
  }

  const clearCustom = () => {
    setCustom(null)
    setPreset('FourWeeks')
  }

  const showError = sales.status === 'error' && sales.error
  const sampleNote = sales.status === 'mock' && sales.error ? sales.error : null

  if (auth === 'checking') {
    return <div className="min-h-screen bg-bg" aria-busy="true" />
  }
  if (auth === 'required') {
    return <LoginScreen onSuccess={() => setAuth('ok')} />
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header
        view={view}
        onViewChange={setView}
        preset={preset}
        onPresetChange={setPreset}
        custom={custom}
        onCustomApply={applyCustom}
        onCustomClear={clearCustom}
        isRefreshing={sales.isRefreshing}
        onRefresh={() => void sales.refresh()}
        onSignOut={source === 'airtable' && passwordRequired ? () => void signOut() : undefined}
      />

      <main className="mx-auto max-w-content px-6 pt-8">
        {showError ? (
          <div className="mb-8">
            <ErrorBanner message={sales.error ?? ''} />
          </div>
        ) : null}

        {sales.isLoading ? (
          <DashboardSkeleton />
        ) : view === 'dashboard' ? (
          <div className="space-y-10">
            <MasterOverview overview={dashboard.overview} />
            <LeadSourceBreakdown organic={dashboard.organic} paid={dashboard.paid} showPaid={dashboard.showPaid} />
            <CallTypeBreakdown source="Organic" firstCall={dashboard.organicFirst} followUp={dashboard.organicFollow} />
            {dashboard.showPaid ? (
              <CallTypeBreakdown source="Paid Ads" firstCall={dashboard.paidFirst} followUp={dashboard.paidFollow} />
            ) : null}
            <CloseAnalysis source="Organic" slices={dashboard.organicCloses} />
            {dashboard.showPaid ? <CloseAnalysis source="Paid Ads" slices={dashboard.paidCloses} /> : null}
            <OverallTrends points={dashboard.trends} />
            <FunnelAndObjections source="Organic" funnel={dashboard.organicFunnel} objections={dashboard.organicObjections} />
            {dashboard.showPaid ? (
              <FunnelAndObjections source="Paid Ads" funnel={dashboard.paidFunnel} objections={dashboard.paidObjections} />
            ) : null}
            <CloserPerformance rows={dashboard.closers} />
          </div>
        ) : (
          <FollowUps result={followUps} />
        )}

        <Footer
          status={sales.status}
          lastUpdated={sales.lastUpdated}
          nextRefresh={sales.nextRefresh}
          refreshMinutes={sales.refreshMinutes}
          sourceLabel={sales.sourceLabel}
          unmappedLeadSources={sales.unmappedLeadSources}
          note={sampleNote}
          warning={sales.warning}
        />
      </main>
    </div>
  )
}
