'use client'

import { useState } from 'react'
import Link from 'next/link'

type Props = {
  surface: 'bongtour' | 'simplyur'
  locale?: string
  signInHref: string
  labels: {
    title: string
    subtitle: string
    emailLabel: string
    submit: string
    success: string
    backToSignIn: string
  }
}

export default function ForgotPasswordForm({ surface, locale, signInHref, labels }: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, surface, locale, client: 'web' }),
      })
    } catch {
      // still show generic success
    }
    setLoading(false)
    setDone(true)
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
        <label htmlFor="forgot-email" className="mb-1 block text-xs font-medium text-bt-body">
          {labels.emailLabel}
        </label>
        <input
          id="forgot-email"
          type={surface === 'simplyur' ? 'email' : 'text'}
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-bt-cta-primary px-4 py-2.5 text-sm font-semibold text-bt-cta-primary-fg transition hover:bg-bt-cta-primary-hover disabled:opacity-60"
      >
        {loading ? '…' : labels.submit}
      </button>
      <p className="text-center text-sm">
        <Link href={signInHref} className="text-bt-meta hover:text-bt-link">
          {labels.backToSignIn}
        </Link>
      </p>
    </form>
  )
}
