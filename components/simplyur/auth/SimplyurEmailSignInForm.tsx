'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { normalizeCredentialsLoginEmail } from '@/lib/normalize-credentials-login-email'

type Props = {
  callbackUrl: string
  submitLabel: string
  invalidCredentialsLabel: string
}

export function SimplyurEmailSignInForm({
  callbackUrl,
  submitLabel,
  invalidCredentialsLabel,
}: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3">
      <div>
        <label
          htmlFor="simplyur-signin-email"
          className="mb-1 block text-xs font-medium text-[color:var(--su-ink-muted)]"
        >
          Email
        </label>
        <input
          id="simplyur-signin-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-[color:var(--su-hanji-border)] bg-white px-3 py-2.5 text-sm text-[color:var(--su-ink)] outline-none focus:border-[color:var(--su-celadon)] focus:ring-2 focus:ring-[color:var(--su-brand-bg-soft)]"
          required
        />
      </div>
      <div>
        <label
          htmlFor="simplyur-signin-password"
          className="mb-1 block text-xs font-medium text-[color:var(--su-ink-muted)]"
        >
          Password
        </label>
        <input
          id="simplyur-signin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-[color:var(--su-hanji-border)] bg-white px-3 py-2.5 text-sm text-[color:var(--su-ink)] outline-none focus:border-[color:var(--su-celadon)] focus:ring-2 focus:ring-[color:var(--su-brand-bg-soft)]"
          required
        />
      </div>
      {err ? <p className="text-center text-xs text-red-700">{err}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="su-btn-navy w-full py-3 text-sm disabled:opacity-60"
      >
        {loading ? '…' : submitLabel}
      </button>
    </form>
  )
}
