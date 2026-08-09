'use client'

import Link from 'next/link'
import { useState } from 'react'
import { SIMPLYUR_LOGIN_1B } from '@/lib/simplyur/login-design'

type Props = {
  locale: string
  signInHref: string
  labels: {
    email: string
    submit: string
    success: string
    backToSignIn: string
  }
}

export function SimplyurForgotPasswordForm({ locale, signInHref, labels }: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const inputClass =
    'w-full rounded-2xl border-[1.5px] bg-white px-3.5 py-3.5 text-[15px] outline-none focus:ring-2'
  const labelClass = 'mb-1.5 block text-xs font-semibold'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          surface: 'simplyur',
          locale,
          client: 'web',
        }),
      })
    } catch {
      // generic success
    }
    setLoading(false)
    setDone(true)
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
        <label htmlFor="su-forgot-email" className={labelClass} style={{ color: SIMPLYUR_LOGIN_1B.muted }}>
          {labels.email}
        </label>
        <input
          id="su-forgot-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          style={{ borderColor: SIMPLYUR_LOGIN_1B.border, color: SIMPLYUR_LOGIN_1B.navy }}
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold text-white shadow-[0_12px_26px_-12px_rgba(255,107,74,0.55)] disabled:opacity-60"
        style={{ backgroundColor: SIMPLYUR_LOGIN_1B.coral }}
      >
        {loading ? '…' : labels.submit}
      </button>
      <p className="text-center text-[12px]">
        <Link href={signInHref} className="font-medium underline" style={{ color: SIMPLYUR_LOGIN_1B.coral }}>
          {labels.backToSignIn}
        </Link>
      </p>
    </form>
  )
}
