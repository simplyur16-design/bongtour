'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { normalizeCredentialsLoginEmail } from '@/lib/normalize-credentials-login-email'

type Props = { callbackUrl: string }

export default function EmailSignInForm({ callbackUrl }: Props) {
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
      setErr('이메일 또는 비밀번호가 올바르지 않거나, 이용이 제한된 계정입니다.')
      return
    }
    window.location.assign(res?.url ?? callbackUrl)
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-xs space-y-3">
      <div>
        <label htmlFor="signin-email" className="mb-1 block text-xs font-medium text-bt-body">
          이메일 또는 ID
        </label>
        <input
          id="signin-email"
          type="text"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
          required
        />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor="signin-password" className="block text-xs font-medium text-bt-body">
            비밀번호
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-xs font-medium text-bt-link hover:text-bt-link-hover hover:underline"
          >
            비밀번호를 잊으셨나요?
          </Link>
        </div>
        <input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
          required
        />
      </div>
      {err ? <p className="text-center text-xs text-bt-danger">{err}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-bt-cta-primary px-4 py-2.5 text-sm font-semibold text-bt-cta-primary-fg transition hover:bg-bt-cta-primary-hover disabled:opacity-60"
      >
        {loading ? '확인 중…' : '이메일로 로그인'}
      </button>
    </form>
  )
}
