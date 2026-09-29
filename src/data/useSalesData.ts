// Data hook: mock or Airtable source. In Airtable mode the browser
// reads the server's snapshot (free), the server talks to Airtable a few times a day, and the
// Refresh button asks the server to fetch now (with a cooldown). Nothing here hits Airtable.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UnauthorizedError, fetchSnapshot, mapRecords, requestRefresh } from './airtable'
import { generateMockData } from './mock'
import { EMPTY_SALES_DATA, type SalesData } from './types'

export type DataSource = 'mock' | 'airtable'
export type DataStatus = 'mock' | 'live' | 'error'

export const DEFAULT_POLL_MS = 30_000
export const MIN_POLL_MS = 5_000

export interface UseSalesDataOptions {
  /** Defaults to VITE_DATA_SOURCE, then mock. */
  source?: DataSource
  /** How often the browser re-reads the server snapshot. Defaults to VITE_POLL_MS, then 30000. */
  pollMs?: number
  /** Clock used for mock generation. Defaults to () => new Date(). */
  getNow?: () => Date
  /** False while the user still has to sign in: nothing is fetched or polled. Defaults to true. */
  enabled?: boolean
  /** Called when the proxy answers 401 (session missing or expired). */
  onUnauthorized?: () => void
}

export interface SalesDataState {
  data: SalesData
  /** mock = sample data, live = Airtable data, error = nothing usable has arrived yet. */
  status: DataStatus
  /** The source actually in use after any fallback. */
  source: DataSource
  /** True until the first dataset arrives (skeleton shimmer). */
  isLoading: boolean
  /** True while a refresh is in flight (spins the Refresh icon). */
  isRefreshing: boolean
  /** When the server last received data from Airtable. */
  lastUpdated: Date | null
  /** When the server will next ask Airtable on its own. */
  nextRefresh: Date | null
  /** Minutes between the server's own checks of the data source. */
  refreshMinutes: number
  /** What the server actually read, for the footer: "Google Sheets" or "Airtable". */
  sourceLabel: string | null
  /** Plain-English error when there is no data to show, or null. */
  error: string | null
  /** Plain-English note while data is showing but something needs attention (limit reached, refresh cooldown). */
  warning: string | null
  /** Lead source values not in LEAD_SOURCE_GROUPS (footer warning). */
  unmappedLeadSources: string[]
  pollMs: number
  refresh: () => Promise<void>
}

/**
 * Which data the browser shows: the server snapshot, or the built-in sample data. The snapshot
 * itself comes from Google Sheets or Airtable, but the browser cannot tell the difference and does
 * not need to, so "live", "sheets" and "airtable" all mean the same thing here.
 */
export function resolveDataSource(): DataSource {
  const raw = (import.meta.env.VITE_DATA_SOURCE ?? '').trim().toLowerCase()
  return raw === 'airtable' || raw === 'sheets' || raw === 'live' ? 'airtable' : 'mock'
}

export function resolvePollMs(): number {
  const raw = Number(import.meta.env.VITE_POLL_MS ?? '')
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_POLL_MS
  return Math.max(MIN_POLL_MS, Math.round(raw))
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return typeof err === 'string' ? err : 'Unknown error'
}

function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function useSalesData(options: UseSalesDataOptions = {}): SalesDataState {
  const requestedSource: DataSource = options.source ?? resolveDataSource()
  const pollMs = options.pollMs ?? resolvePollMs()
  const enabled = options.enabled ?? true
  const getNow = useMemo(() => options.getNow ?? (() => new Date()), [options.getNow])
  const onUnauthorizedRef = useRef(options.onUnauthorized)
  onUnauthorizedRef.current = options.onUnauthorized

  const [data, setData] = useState<SalesData>(() =>
    requestedSource === 'mock' ? generateMockData(getNow()) : EMPTY_SALES_DATA,
  )
  const [status, setStatus] = useState<DataStatus>('mock')
  const [source, setSource] = useState<DataSource>(requestedSource)
  const [isLoading, setIsLoading] = useState<boolean>(requestedSource === 'airtable')
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => (requestedSource === 'mock' ? getNow() : null))
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null)
  const [refreshMinutes, setRefreshMinutes] = useState<number>(0)
  const [sourceLabel, setSourceLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [unmappedLeadSources, setUnmapped] = useState<string[]>([])

  const mountedRef = useRef(true)
  const inFlightRef = useRef(false)
  const sourceRef = useRef<DataSource>(requestedSource)

  const loadMock = useCallback(async () => {
    setIsRefreshing(true)
    // Tiny delay so the Refresh icon visibly spins in sample mode.
    await new Promise((resolve) => setTimeout(resolve, 250))
    if (!mountedRef.current) return
    const now = getNow()
    setData(generateMockData(now))
    setStatus('mock')
    setSource('mock')
    setError(null)
    setWarning(null)
    setLastUpdated(now)
    setIsLoading(false)
    setIsRefreshing(false)
  }, [getNow])

  /** Read the server snapshot and map it. Free: never touches Airtable. */
  const loadSnapshot = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      const snap = await fetchSnapshot()
      if (!mountedRef.current) return
      if (!snap.configured) {
        // Server has no token or ids: fall back to sample data and say so.
        sourceRef.current = 'mock'
        const now = getNow()
        setData(generateMockData(now))
        setStatus('mock')
        setSource('mock')
        setError('Airtable is not configured on the server yet. Using sample data.')
        setWarning(null)
        setLastUpdated(now)
        setIsLoading(false)
        return
      }
      setNextRefresh(parseDate(snap.nextRefreshAt))
      setRefreshMinutes(snap.refreshMinutes)
      setSourceLabel(snap.sourceLabel ?? null)
      if (snap.fetchedAt) {
        const mapped = mapRecords(snap.records.calls, snap.records.dm)
        setData(mapped.data)
        setUnmapped(mapped.unmappedLeadSources)
        setStatus('live')
        setSource('airtable')
        setError(null)
        setWarning(snap.error ? snap.error.message : null)
        setLastUpdated(parseDate(snap.fetchedAt))
      } else {
        // The server has never managed to read Airtable (fresh install, or limit hit before the first read).
        setStatus('error')
        setSource('airtable')
        setError(
          snap.error
            ? snap.error.message.replace(' Showing the last data received.', ' No data has arrived yet.')
            : 'Waiting for the first data from Airtable.',
        )
        setWarning(null)
      }
      setIsLoading(false)
    } catch (err) {
      if (!mountedRef.current) return
      if (err instanceof UnauthorizedError) {
        setIsLoading(false)
        onUnauthorizedRef.current?.()
        return
      }
      setStatus((prev) => (prev === 'live' ? 'live' : 'error'))
      setWarning(errorMessage(err))
      setIsLoading(false)
    } finally {
      inFlightRef.current = false
    }
  }, [getNow])

  /** Refresh button: ask the server to fetch now, then re-read the snapshot. */
  const refreshLive = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const result = await requestRefresh()
      if (!mountedRef.current) return
      if (!result.ok && 'skipped' in result && result.skipped === 'cooldown') {
        const minutes = Math.max(1, Math.ceil(result.waitSeconds / 60))
        setWarning(`Refresh was used recently. The next one is available in about ${minutes} minute${minutes === 1 ? '' : 's'}.`)
      }
      await loadSnapshot()
    } catch (err) {
      if (!mountedRef.current) return
      if (err instanceof UnauthorizedError) {
        onUnauthorizedRef.current?.()
        return
      }
      setWarning(errorMessage(err))
    } finally {
      if (mountedRef.current) setIsRefreshing(false)
    }
  }, [loadSnapshot])

  const refresh = useCallback(async () => {
    if (sourceRef.current === 'mock') await loadMock()
    else await refreshLive()
  }, [loadMock, refreshLive])

  // First load (and again when the sign-in screen hands control back by flipping enabled).
  useEffect(() => {
    mountedRef.current = true
    sourceRef.current = requestedSource
    if (requestedSource === 'airtable' && enabled) void loadSnapshot()
    return () => {
      mountedRef.current = false
    }
  }, [requestedSource, loadSnapshot, enabled])

  // Re-read the snapshot on a timer (cheap), paused while the tab is hidden. Mock mode does not poll.
  useEffect(() => {
    if (requestedSource !== 'airtable' || !enabled) return
    const tick = () => {
      if (isDocumentHidden()) return
      if (sourceRef.current !== 'airtable') return
      void loadSnapshot()
    }
    const interval = window.setInterval(tick, pollMs)
    const onVisibility = () => {
      if (!isDocumentHidden()) tick()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [requestedSource, pollMs, loadSnapshot, enabled])

  return {
    data,
    status,
    source,
    isLoading,
    isRefreshing,
    lastUpdated,
    nextRefresh,
    refreshMinutes,
    sourceLabel,
    error,
    warning,
    unmappedLeadSources,
    pollMs,
    refresh,
  }
}
