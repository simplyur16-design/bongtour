'use client'

import { signIn } from 'next-auth/react'

type Props = {
  callbackUrl?: string
  className?: string
  children?: React.ReactNode
  /** primary: 공식 노란 버튼 · minimal: 헤더 등 보조 액션 */
  variant?: 'primary' | 'minimal'
}

/**
 * 카카오 공식 브랜드 가이드라인(primary): 노란 배경(#FEE500), 검정 텍스트(#191919)
 */
export default function KakaoLoginButton({
  callbackUrl,
  className = '',
  children,
  variant = 'primary',
}: Props) {
  const isMinimal = variant === 'minimal'
  return (
    <button
      type="button"
      onClick={() => signIn('kakao', { callbackUrl: callbackUrl ?? '/' })}
      className={
        isMinimal
          ? `inline-flex items-center justify-center rounded-md border border-bt-border bg-bt-surface/80 px-2.5 py-2 text-[13px] font-medium text-bt-ink/75 shadow-sm backdrop-blur-sm transition hover:border-bt-border-strong hover:bg-bt-page hover:text-bt-ink sm:text-sm ${className}`
          : `inline-flex items-center justify-center px-5 py-3 text-[15px] font-medium text-[#191919] transition hover:opacity-90 ${className}`
      }
      style={isMinimal ? undefined : { backgroundColor: '#FEE500' }}
      aria-label="카카오 로그인"
    >
      {children ?? '카카오 로그인'}
    </button>
  )
}

