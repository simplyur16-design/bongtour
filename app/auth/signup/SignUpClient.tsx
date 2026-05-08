'use client'

import { useState } from 'react'
import Link from 'next/link'
import KakaoLoginButton from '@/app/components/auth/KakaoLoginButton'
import NaverLoginLink from '@/app/components/auth/NaverLoginLink'

type Props = {
  callbackUrl: string
  kakaoOn: boolean
  naverOn: boolean
}

export default function SignUpClient({ callbackUrl, kakaoOn, naverOn }: Props) {
  const [marketingConsent, setMarketingConsent] = useState(false)
  const emailHref = `/auth/signup/email${marketingConsent ? '?marketingConsent=1' : ''}`

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
        <label className="flex items-start gap-2 text-sm text-bt-body">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span>[선택] 마케팅 정보 수신에 동의합니다. 동의 시 가입 환영 쿠폰이 발급될 수 있습니다.</span>
        </label>
      </div>

      <Link
        href={emailHref}
        className="flex w-full items-center justify-center rounded-lg border border-bt-cta-secondary-border bg-bt-cta-secondary px-5 py-3 text-[15px] font-medium text-bt-cta-secondary-text shadow-sm transition hover:border-bt-border-strong hover:bg-bt-surface-soft"
      >
        이메일로 시작하기
      </Link>

      {kakaoOn || naverOn ? (
        <>
          <div className="relative py-1 text-center text-xs text-bt-subtle">
            <span className="relative z-10 bg-beige px-2">또는</span>
            <span className="absolute inset-x-0 top-1/2 z-0 h-px -translate-y-1/2 bg-bt-border-soft" aria-hidden />
          </div>

          <div className="flex flex-col gap-2">
            {naverOn ? (
              <NaverLoginLink
                callbackUrl={callbackUrl}
                marketingConsent={marketingConsent}
                className="w-full justify-center rounded-lg"
              >
                네이버로 시작하기
              </NaverLoginLink>
            ) : null}
            {kakaoOn ? (
              <KakaoLoginButton callbackUrl={callbackUrl} marketingConsent={marketingConsent} className="w-full justify-center rounded-lg">
                카카오로 시작하기
              </KakaoLoginButton>
            ) : null}
          </div>
          <p className="text-center text-[11px] leading-relaxed text-bt-meta">소셜 가입은 카카오·네이버를 지원합니다.</p>
        </>
      ) : (
        <p className="text-center text-[11px] leading-relaxed text-bt-meta">
          카카오·네이버 연동 시 서버에 각 CLIENT_ID / CLIENT_SECRET 을 설정하면 여기에서 소셜 가입이 열립니다.
        </p>
      )}
    </div>
  )
}
