// Password gate. One shared team password, checked by the proxy.

import { LockKeyhole } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { login } from '../data/session'
import Mark from './brand/Mark'
import { BRAND_NAME } from '../config/brand'

interface LoginScreenProps {
  onSuccess: () => void
}

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !password) return
    setBusy(true)
    setError(null)
    try {
      const result = await login(password)
      if (result.ok) {
        setPassword('')
        onSuccess()
      } else {
        setError(result.message)
      }
    } catch {
      setError('Could not reach the server. Check the connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <div className="brand-topline" aria-hidden="true" />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <form
          onSubmit={submit}
          className="w-full max-w-[400px] rounded-card border border-line bg-surface p-8"
          aria-labelledby="login-title"
        >
          <div className="flex items-center gap-4">
            <Mark size={40} className="shrink-0 text-brand-white" />
            <div>
              {BRAND_NAME ? (
                <div className="font-display text-[14px] font-bold uppercase leading-none tracking-wordmark text-brand-white">
                  {BRAND_NAME}
                </div>
              ) : null}
              <h1 id="login-title" className="mt-1.5 font-display text-[24px] font-bold leading-none text-text">
                Sales <span className="text-brand-primary">Dashboard</span>
              </h1>
            </div>
          </div>

          <p className="mt-6 text-[14px] text-muted">Enter the team password to continue.</p>

          <label className="mt-4 block text-[12px] font-medium text-muted">
            Password
            <div className="relative mt-1.5">
              <LockKeyhole size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-mini border border-line bg-surface-2 py-2.5 pl-10 pr-3 text-[14px] text-text focus:border-brand-primary focus:outline-none"
              />
            </div>
          </label>

          {error ? (
            <p role="alert" className="mt-3 text-[13px] font-medium text-accent-secondary">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !password}
            className="mt-5 w-full rounded-full bg-brand-primary px-4 py-2.5 text-[14px] font-semibold text-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Signing in' : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  )
}
