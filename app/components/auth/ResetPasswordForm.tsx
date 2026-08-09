'use client'

import { useState } from 'react'
import Link from 'next/link'

type Props = {
  surface: 'bongtour' | 'simplyur'
  email: string
  token: string
  signInHref: string
  labels: {
    title: string
    subtitle: string
    newPassword: string
    confirmPassword: string
    submit: string
    success: string
    backToSignIn: string
    errorWeak: string
    errorMismatch: string
    errorInvalid: string
    errorGeneric: string
  }
}

export default function ResetPasswordForm({
  surface,
  email,
  token,
  signInHref,
  labels,
}: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (password !== confirm) {
      setErr(labels.errorMismatch)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password, surface }),
      })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; code?: string } | null
      if (!res.ok || !data?.ok) {
        const code = data?.code
        if (code === 'weak_password') setErr(labels.errorWeak)
        else if (code === 'expired_or_used' || code === 'invalid_token' || code === 'no_password_account') {
          setErr(labels.errorInvalid)
        } else setErr(labels.errorGeneric)
        setLoading(false)
        return
      }
      setDone(true)
    } catch {
      setErr(labels.errorGeneric)
    }
    setLoading(false)
  }

  if (!email || !token) {
    return (
      <div className="w-full max-w-xs space-y-3 text-center">
        <p className="text-sm text-bt-danger">{labels.errorInvalid}</p>
        <Link href={signInHref} className="text-sm font-medium text-bt-link hover:underline">
          {labels.backToSignIn}
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="w-full max-w-xs space-y-4 text-center">
        <p className="text-sm leading-relaxed text-bt-body">{labels.success}</p>
        <Link href={signInHref} className="text-sm font-medium text-bt-link hover:underline">
          {labels.backToSignIn}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-xs space-y-3">
      <div>
        <label htmlFor="reset-password" className="mb-1 block text-xs font-medium text-bt-body">
          {labels.newPassword}
        </label>
        <input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
          required
          minLength={8}
        />
      </div>
      <div>
        <label htmlFor="reset-confirm" className="mb-1 block text-xs font-medium text-bt-body">
          {labels.confirmPassword}
        </label>
        <input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
          required
          minLength={8}
        />
      </div>
      {err ? <p className="text-center text-xs text-bt-danger">{err}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-bt-cta-primary px-4 py-2.5 text-sm font-semibold text-bt-cta-primary-fg transition hover:bg-bt-cta-primary-hover disabled:opacity-60"
      >
        {loading ? '…' : labels.submit}
      </button>
    </form>
  )
}
