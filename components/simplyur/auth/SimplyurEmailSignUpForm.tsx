'use client'

import Link from 'next/link'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { SIMPLYUR_LOGIN_1B } from '@/lib/simplyur/login-design'
import type { SimplyurLocale } from '@/lib/simplyur/constants'
import { simplyurLegalPath } from '@/lib/simplyur/legal-disclosures'
import { normalizeSimplyurSignupEmail } from '@/lib/simplyur/auth/register-email'

type Props = {
  locale: SimplyurLocale
  callbackUrl: string
  labels: {
    email: string
    password: string
    confirmPassword: string
    termsPrefix: string
    termsLink: string
    privacyLink: string
    termsAnd: string
    submit: string
    successSigningIn: string
    errorGeneric: string
    errorInvalidEmail: string
    errorWeakPassword: string
    errorEmailTaken: string
    errorTermsRequired: string
    errorPasswordMismatch: string
    haveAccount: string
    signInLink: string
  }
  signInHref: string
}

export function SimplyurEmailSignUpForm({ locale, callbackUrl, labels, signInHref }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const inputClass =
    'w-full rounded-2xl border-[1.5px] bg-white px-3.5 py-3.5 text-[15px] outline-none focus:ring-2'
  const labelClass = 'mb-1.5 block text-xs font-semibold'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (password !== confirm) {
      setErr(labels.errorPasswordMismatch)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/simplyur/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizeSimplyurSignupEmail(email),
          password,
          termsAccepted,
        }),
      })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; code?: string } | null
      if (!res.ok || !data?.ok) {
        const code = data?.code
        if (code === 'invalid_email') setErr(labels.errorInvalidEmail)
        else if (code === 'weak_password') setErr(labels.errorWeakPassword)
        else if (code === 'email_taken') setErr(labels.errorEmailTaken)
        else if (code === 'terms_required') setErr(labels.errorTermsRequired)
        else setErr(labels.errorGeneric)
        setLoading(false)
        return
      }

      const signInRes = await signIn('credentials', {
        email: normalizeSimplyurSignupEmail(email),
        password,
        redirect: false,
        callbackUrl,
      })
      if (signInRes?.error) {
        setErr(labels.errorGeneric)
        setLoading(false)
        return
      }
      window.location.assign(signInRes?.url ?? callbackUrl)
    } catch {
      setErr(labels.errorGeneric)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3">
      <div>
        <label htmlFor="simplyur-signup-email" className={labelClass} style={{ color: SIMPLYUR_LOGIN_1B.muted }}>
          {labels.email}
        </label>
        <input
          id="simplyur-signup-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          style={{ borderColor: SIMPLYUR_LOGIN_1B.border, color: SIMPLYUR_LOGIN_1B.navy }}
          required
        />
      </div>
      <div>
        <label
          htmlFor="simplyur-signup-password"
          className={labelClass}
          style={{ color: SIMPLYUR_LOGIN_1B.muted }}
        >
          {labels.password}
        </label>
        <input
          id="simplyur-signup-password"
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
        <label
          htmlFor="simplyur-signup-confirm"
          className={labelClass}
          style={{ color: SIMPLYUR_LOGIN_1B.muted }}
        >
          {labels.confirmPassword}
        </label>
        <input
          id="simplyur-signup-confirm"
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

      <label className="flex items-start gap-2 text-[12px] leading-relaxed" style={{ color: SIMPLYUR_LOGIN_1B.muted }}>
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5"
          required
        />
        <span>
          {labels.termsPrefix}{' '}
          <Link
            href={simplyurLegalPath(locale, 'terms')}
            className="font-medium underline"
            style={{ color: SIMPLYUR_LOGIN_1B.coral }}
            target="_blank"
          >
            {labels.termsLink}
          </Link>{' '}
          {labels.termsAnd}{' '}
          <Link
            href={simplyurLegalPath(locale, 'privacy')}
            className="font-medium underline"
            style={{ color: SIMPLYUR_LOGIN_1B.coral }}
            target="_blank"
          >
            {labels.privacyLink}
          </Link>
        </span>
      </label>

      {err ? <p className="text-center text-xs text-red-700">{err}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold text-white shadow-[0_12px_26px_-12px_rgba(255,107,74,0.55)] disabled:opacity-60"
        style={{ backgroundColor: SIMPLYUR_LOGIN_1B.coral }}
      >
        {loading ? labels.successSigningIn : labels.submit}
      </button>

      <p className="text-center text-[12px]" style={{ color: SIMPLYUR_LOGIN_1B.muted }}>
        {labels.haveAccount}{' '}
        <Link href={signInHref} className="font-medium underline" style={{ color: SIMPLYUR_LOGIN_1B.coral }}>
          {labels.signInLink}
        </Link>
      </p>
    </form>
  )
}
