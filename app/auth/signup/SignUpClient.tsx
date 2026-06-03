'use client'

import KakaoLoginButton from '@/app/components/auth/KakaoLoginButton'
import NaverLoginLink from '@/app/components/auth/NaverLoginLink'
import { EMAIL_SIGNUP_PUBLIC_MESSAGE } from '@/lib/auth-block-email-signup'

type Props = {
  callbackUrl: string
  kakaoOn: boolean
  naverOn: boolean
}

export default function SignUpClient({ callbackUrl, kakaoOn, naverOn }: Props) {
  return (
    <div className="flex w-full flex-col gap-3">
      <p className="rounded-lg border border-bt-border-soft bg-bt-brand-blue-soft px-3 py-2 text-center text-xs leading-relaxed text-bt-title">
        {EMAIL_SIGNUP_PUBLIC_MESSAGE}
      </p>
      <p className="text-center text-xs leading-relaxed text-bt-meta">
        가입 시 이용약관·개인정보 수집·이용에 동의가 필요합니다.
      </p>

      {kakaoOn || naverOn ? (
        <div className="flex flex-col gap-2">
          {naverOn ? (
            <NaverLoginLink callbackUrl={callbackUrl} className="w-full justify-center rounded-lg">
              네이버로 시작하기
            </NaverLoginLink>
          ) : null}
          {kakaoOn ? (
            <KakaoLoginButton callbackUrl={callbackUrl} className="w-full justify-center rounded-lg">
              카카오로 시작하기
            </KakaoLoginButton>
          ) : null}
        </div>
      ) : (
        <p className="text-center text-[11px] leading-relaxed text-bt-meta">
          카카오·네이버 연동 시 서버에 각 CLIENT_ID / CLIENT_SECRET 을 설정하면 여기에서 소셜 가입이 열립니다.
        </p>
      )}
    </div>
  )
}
