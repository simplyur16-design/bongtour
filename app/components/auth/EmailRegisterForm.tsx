'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ConsentBlock from '@/components/auth/ConsentBlock'
import { MARKETING_VERSION_EMAIL, PRIVACY_VERSION } from '@/lib/consent/copies'

export default function EmailRegisterForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [err, setErr] = useState('')
  const [passwordConfirmErr, setPasswordConfirmErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [termsOk, setTermsOk] = useState(false)
  const [privacyOk, setPrivacyOk] = useState(false)
  const [ageOk, setAgeOk] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [hpWebsite, setHpWebsite] = useState('')

  const requiredConsents = termsOk && privacyOk && ageOk

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setPasswordConfirmErr('')
    if (!requiredConsents) {
      setErr('필수 동의 항목을 모두 선택해 주세요.')
      return
    }
    if (!name.trim()) {
      setErr('이름을 입력해 주세요.')
      return
    }
    if (!passwordConfirm.trim()) {
      setPasswordConfirmErr('비밀번호 확인을 입력해 주세요.')
      return
    }
    if (password !== passwordConfirm) {
      setPasswordConfirmErr('비밀번호가 일치하지 않습니다.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          passwordConfirm,
          website: hpWebsite,
          termsConsent: true,
          ageConfirmed: true,
          privacyNoticeConfirmed: privacyOk,
          privacyNoticeVersion: PRIVACY_VERSION,
          marketingConsent,
          marketingConsentVersion: MARKETING_VERSION_EMAIL,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        const msg = data.error ?? '가입에 실패했습니다.'
        setErr(msg)
        if (msg.includes('비밀번호') && msg.includes('일치')) {
          setPasswordConfirmErr(msg)
        }
        return
      }
      router.push('/auth/signin?registered=1')
      router.refresh()
    } catch {
      setErr('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={hpWebsite}
        onChange={(e) => setHpWebsite(e.target.value)}
        className="pointer-events-none absolute left-[-9999px] h-px w-px opacity-0"
      />
      <div>
        <label htmlFor="reg-name" className="mb-1 block text-xs font-medium text-bt-body">
          이름
        </label>
        <input
          id="reg-name"
          type="text"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setErr('')
          }}
          className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
          required
          maxLength={80}
        />
      </div>
      <div>
        <label htmlFor="reg-email" className="mb-1 block text-xs font-medium text-bt-body">
          이메일
        </label>
        <input
          id="reg-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
          required
        />
      </div>
      <div>
        <label htmlFor="reg-password" className="mb-1 block text-xs font-medium text-bt-body">
          비밀번호 (8자 이상)
        </label>
        <input
          id="reg-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setPasswordConfirmErr('')
          }}
          className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
          required
          minLength={8}
        />
      </div>
      <div>
        <label htmlFor="reg-password-confirm" className="mb-1 block text-xs font-medium text-bt-body">
          비밀번호 확인
        </label>
        <input
          id="reg-password-confirm"
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호 확인"
          value={passwordConfirm}
          onChange={(e) => {
            setPasswordConfirm(e.target.value)
            setPasswordConfirmErr('')
          }}
          className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
          required
        />
        {passwordConfirmErr ? <p className="mt-1 text-sm text-bt-danger">{passwordConfirmErr}</p> : null}
      </div>

      <ConsentBlock type="terms" checked={termsOk} onChange={setTermsOk} required />
      <ConsentBlock type="privacy" checked={privacyOk} onChange={setPrivacyOk} required />
      <ConsentBlock type="age" checked={ageOk} onChange={setAgeOk} required />
      <ConsentBlock type="marketing" checked={marketingConsent} onChange={setMarketingConsent} required={false} />

      {err ? <p className="text-sm text-bt-danger">{err}</p> : null}
      <button
        type="submit"
        disabled={loading || !requiredConsents}
        className="w-full rounded-lg bg-bt-cta-primary px-4 py-3 text-sm font-semibold text-bt-cta-primary-fg transition hover:bg-bt-cta-primary-hover disabled:opacity-60"
      >
        {loading ? '처리 중…' : '이메일로 가입하기'}
      </button>
      <p className="text-center text-xs text-bt-meta">
        가입 후{' '}
        <Link href="/auth/signin" className="text-bt-link hover:text-bt-link-hover hover:underline">
          로그인
        </Link>
        에서 이메일과 비밀번호로 로그인할 수 있습니다.
      </p>
    </form>
  )
}
