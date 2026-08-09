'use client'

import Link from 'next/link'
import { useState } from 'react'
import { SIMPLYUR_LOGIN_1B } from '@/lib/simplyur/login-design'

type Props = {
  email: string
  token: string
  signInHref: string
  labels: {
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

export function SimplyurResetPasswordForm({ email, token, signInHref, labels }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const inputClass =
    'w-full rounded-2xl border-[1.5px] bg-white px-3.5 py-3.5 text-[15px] outline-none focus:ring-2'
  const labelClass = 'mb-1.5 block text-xs font-semibold'

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
        body: JSON.stringify({
          email,
          token,
          password,
          surface: 'simplyur',
        }),
      })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; code?: string } | null
      if (!res.ok || !data?.ok) {
        const code = data?.code
        if (code === 'weak_password') setErr(labels.errorWeak)
        else if (
          code === 'expired_or_used' ||
          code === 'invalid_token' ||
          code === 'no_password_account'
        ) {
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
      <div className="space-y-3 text-center">
        <p className="text-sm text-red-700">{labels.errorInvalid}</p>
        <Link
          href={signInHref}
          className="text-sm font-medium underline"
          style={{ color: SIMPLYUR_LOGIN_1B.coral }}
        >
          {labels.backToSignIn}
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm leading-relaxed" style={{ color: SIMPLYUR_LOGIN_1B.muted }}>
          {labels.success}
        </p>
        <Link
          href={signInHref}
          className="text-sm font-medium underline"
          style={{ color: SIMPLYUR_LOGIN_1B.coral }}
        >
          {labels.backToSignIn}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-3">
      <div>
        <label htmlFor="su-reset-password" className={labelClass} style={{ color: SIMPLYUR_LOGIN_1B.muted }}>
          {labels.newPassword}
        </label>
        <input
          id="su-reset-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          style={{ borderColor: SIMPLYUR_LOGIN_1B.border, color: SIMPLYUR_LOGIN_1B.navy }}
          required
          minLength={8}
        />
      </div>
      <div>
        <label htmlFor="su-reset-confirm" className={labelClass} style={{ color: SIMPLYUR_LOGIN_1B.muted }}>
          {labels.confirmPassword}
        </label>
        <input
          id="su-reset-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
          style={{ borderColor: SIMPLYUR_LOGIN_1B.border, color: SIMPLYUR_LOGIN_1B.navy }}
          required
          minLength={8}
        />
      </div>
      {err ? <p className="text-center text-xs text-red-700">{err}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold text-white shadow-[0_12px_26px_-12px_rgba(255,107,74,0.55)] disabled:opacity-60"
        style={{ backgroundColor: SIMPLYUR_LOGIN_1B.coral }}
      >
        {loading ? '…' : labels.submit}
      </button>
    </form>
  )
}
