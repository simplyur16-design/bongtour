type Props = {
  callbackUrl?: string
  className?: string
  children?: React.ReactNode
  /** primary: 공식 노란 버튼 · minimal: 헤더 등 보조 액션 */
  variant?: 'primary' | 'minimal'
}

/**
 * OAuth 시작은 브라우저 전체 이동만 사용.
 * GET `/api/auth/kakao` → `/api/auth/kakao/callback` 에서 Account/세션 처리
 */
export default function KakaoLoginButton({
  callbackUrl,
  className = '',
  children,
  variant = 'primary',
}: Props) {
  const isMinimal = variant === 'minimal'
  const q = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''
  const href = `/api/auth/kakao${q}`
  return (
    <a
      href={href}
      className={
        isMinimal
          ? `inline-flex items-center justify-center rounded-md border border-bt-border bg-bt-surface/80 px-2.5 py-2 text-[13px] font-medium text-bt-ink/75 shadow-sm backdrop-blur-sm transition hover:border-bt-border-strong hover:bg-bt-page hover:text-bt-ink sm:text-sm ${className}`
          : `inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-[15px] font-medium text-[#191919] transition hover:opacity-90 ${className}`
      }
      style={isMinimal ? undefined : { backgroundColor: '#FEE500' }}
      aria-label="카카오 로그인"
    >
      {children ?? '카카오 로그인'}
    </a>
  )
}
