'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { normalizeCredentialsLoginEmail } from '@/lib/normalize-credentials-login-email'
import { SIMPLYUR_LOGIN_1B } from '@/lib/simplyur/login-design'

type Props = {
  callbackUrl: string
  submitLabel: string
  invalidCredentialsLabel: string
  /** design_handoff_login_1b — peach screen form styling */
  variant?: 'default' | 'login1b'
}

export function SimplyurEmailSignInForm({
  callbackUrl,
  submitLabel,
  invalidCredentialsLabel,
  variant = 'default',
}: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const is1b = variant === 'login1b'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    const res = await signIn('credentials', {
      email: normalizeCredentialsLoginEmail(email),
      password,
      redirect: false,
      callbackUrl,
    })
    setLoading(false)
    if (res?.error) {
      setErr(invalidCredentialsLabel)
      return
    }
    window.location.assign(res?.url ?? callbackUrl)
  }

  const inputClass = is1b
    ? 'w-full rounded-2xl border-[1.5px] bg-white px-3.5 py-3.5 text-[15px] outline-none focus:ring-2'
    : 'w-full rounded-xl border border-[color:var(--su-hanji-border)] bg-white px-3 py-2.5 text-sm text-[color:var(--su-ink)] outline-none focus:border-[color:var(--su-celadon)] focus:ring-2 focus:ring-[color:var(--su-brand-bg-soft)]'

  const labelClass = is1b
    ? 'mb-1.5 block text-xs font-semibold'
    : 'mb-1 block text-xs font-medium text-[color:var(--su-ink-muted)]'

  const submitClass = is1b
    ? 'flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold text-white shadow-[0_12px_26px_-12px_rgba(255,107,74,0.55)] disabled:opacity-60'
    : 'su-btn-navy w-full py-3 text-sm disabled:opacity-60'

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3">
      <div>
        <label
          htmlFor="simplyur-signin-email"
          className={labelClass}
          style={is1b ? { color: SIMPLYUR_LOGIN_1B.muted } : undefined}
        >
          Email
        </label>
        <input
          id="simplyur-signin-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          style={
            is1b
              ? {
                  borderColor: SIMPLYUR_LOGIN_1B.border,
                  color: SIMPLYUR_LOGIN_1B.navy,
                }
              : undefined
          }
          required
        />
      </div>
      <div>
        <label
          htmlFor="simplyur-signin-password"
          className={labelClass}
          style={is1b ? { color: SIMPLYUR_LOGIN_1B.muted } : undefined}
        >
          Password
        </label>
        <input
          id="simplyur-signin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          style={
            is1b
              ? {
                  borderColor: SIMPLYUR_LOGIN_1B.border,
                  color: SIMPLYUR_LOGIN_1B.navy,
                }
              : undefined
          }
          required
        />
      </div>
      {err ? <p className="text-center text-xs text-red-700">{err}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className={submitClass}
        style={is1b ? { backgroundColor: SIMPLYUR_LOGIN_1B.coral } : undefined}
      >
        {loading ? '…' : submitLabel}
      </button>
    </form>
  )
}
