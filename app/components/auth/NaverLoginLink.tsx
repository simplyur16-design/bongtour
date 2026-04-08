import Link from 'next/link'

type Props = {
  callbackUrl?: string
  className?: string
  children?: React.ReactNode
}

/** GET `/api/auth/naver` → 수동 OAuth → `/api/auth/naver/callback` 에서 Account/세션 처리 */
export default function NaverLoginLink({ callbackUrl, className = '', children }: Props) {
  const q = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''
  return (
    <Link
      href={`/api/auth/naver${q}`}
      className={`inline-flex w-full items-center justify-center rounded-lg bg-[#03C75A] px-5 py-3 text-[15px] font-medium text-white transition hover:opacity-90 ${className}`}
    >
      {children ?? '네이버로 로그인'}
    </Link>
  )
}
