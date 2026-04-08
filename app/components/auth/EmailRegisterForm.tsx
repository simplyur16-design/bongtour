'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function EmailRegisterForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [marketingOpen, setMarketingOpen] = useState(false)
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!privacyConfirmed) {
      setErr('회원가입을 위한 개인정보 수집·이용 안내 확인이 필요합니다.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: email.trim().toLowerCase(),
          password,
          privacyNoticeConfirmed: privacyConfirmed,
          privacyNoticeVersion: 'member-privacy-v1',
          marketingConsent,
          marketingConsentVersion: 'member-marketing-v1',
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setErr(data.error ?? '가입에 실패했습니다.')
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
      <div>
        <label htmlFor="reg-name" className="mb-1 block text-xs font-medium text-bt-body">
          이름
        </label>
        <input
          id="reg-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
          required
          minLength={8}
        />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <button
          type="button"
          onClick={() => setPrivacyOpen((v) => !v)}
          className="text-xs font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          회원가입을 위한 개인정보 수집·이용 안내 보기
        </button>
        {privacyOpen ? (
          <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
            <p className="font-semibold text-slate-900">회원가입을 위한 개인정보 수집·이용 안내</p>
            <p>Bong투어는 회원가입 및 계정 관리를 위해 아래와 같이 개인정보를 수집·이용합니다.</p>
            <p>1. 수집 항목: 이름, 이메일, 연락처, 비밀번호(암호화 저장), 서비스 이용기록/접속 로그/IP/기기 정보 등</p>
            <p>2. 수집 및 이용 목적: 회원가입 의사 확인, 회원 식별 및 계정 관리, 서비스 제공 및 응대, 부정이용 방지, 서비스 개선 및 운영 안정성 확보</p>
            <p>3. 처리의 근거: 회원가입 요청 및 계정 운영에 필요한 범위의 개인정보 처리, 개인정보 보호법 등 관련 법령이 허용하는 범위 내 처리</p>
            <p>4. 보유 및 이용 기간: 회원 탈퇴 시까지(관계 법령에 따른 별도 보관 제외)</p>
            <p>5. 이용자 안내: 필수 정보가 제공되지 않으면 회원가입 및 계정 이용이 제한될 수 있습니다.</p>
            <p>6. 문의처: bongtour24@naver.com</p>
          </div>
        ) : null}
        <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={privacyConfirmed}
            onChange={(e) => setPrivacyConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-600"
          />
          회원가입을 위한 개인정보 수집·이용 안내를 확인했습니다 <span className="text-rose-600">*</span>
        </label>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <button
          type="button"
          onClick={() => setMarketingOpen((v) => !v)}
          className="text-xs font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          [선택] 마케팅 정보 수신 동의 안내 보기
        </button>
        {marketingOpen ? (
          <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
            <p className="font-semibold text-slate-900">[선택] 마케팅 정보 수신 동의</p>
            <p>Bong투어는 서비스 소식, 혜택, 이벤트, 맞춤형 제안 등 마케팅 정보를 제공하기 위해 아래와 같이 개인정보를 이용할 수 있습니다.</p>
            <p>1. 수집·이용 항목: 이름, 이메일, 연락처</p>
            <p>2. 이용 목적: 서비스 소식/이벤트 안내, 혜택·프로모션·맞춤형 제안 제공, 뉴스레터 및 마케팅 정보 발송</p>
            <p>3. 보유 및 이용 기간: 동의일로부터 2년 또는 동의 철회 시까지</p>
            <p>4. 동의 거부 권리: 동의하지 않아도 회원가입 및 기본 서비스 이용에는 제한이 없습니다.</p>
          </div>
        ) : null}
        <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-600"
          />
          [선택] 마케팅 정보 수신에 동의합니다
        </label>
      </div>
      {err ? <p className="text-sm text-bt-danger">{err}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-bt-cta-primary px-4 py-3 text-sm font-semibold text-bt-cta-primary-fg transition hover:bg-bt-cta-primary-hover disabled:opacity-60"
      >
        {loading ? '처리 중…' : '이메일로 가입하기'}
      </button>
      <p className="text-center text-xs text-bt-meta">
        가입 후{' '}
        <Link href="/auth/signin" className="text-bt-link hover:text-bt-link-hover hover:underline">
          로그인
        </Link>
        에서 이메일로 로그인할 수 있습니다.
      </p>
    </form>
  )
}
