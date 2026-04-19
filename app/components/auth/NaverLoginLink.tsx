type Props = {
  callbackUrl?: string
  className?: string
  children?: React.ReactNode
}

/**
 * OAuth 시작은 브라우저 전체 이동만 사용 (Link/RSC fetch 금지).
 * GET `/api/auth/naver` → `/api/auth/naver/callback` 에서 Account/세션 처리
 */
export default function NaverLoginLink({ callbackUrl, className = '', children }: Props) {
  const q = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''
  const href = `/api/auth/naver${q}`
  return (
    <a
      href={href}
      className={`inline-flex w-full items-center justify-center rounded-lg bg-[#03A94D] px-5 py-3 text-[15px] font-medium text-white transition hover:opacity-90 ${className}`}
    >
      {children ?? '네이버로 로그인'}
    </a>
  )
}
