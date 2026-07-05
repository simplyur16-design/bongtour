import Link from 'next/link'
import type { SignInMethod } from '@/app/components/auth/SignInMethodChooser'

const LABELS: Record<SignInMethod, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: 'Google',
  email: '이메일',
}

type Props = {
  method: SignInMethod
  callbackUrl: string
}

export default function SignInMethodBackLink({ method, callbackUrl }: Props) {
  const chooserHref = `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
  return (
    <Link
      href={chooserHref}
      className="mb-6 inline-flex items-center gap-1 text-sm text-bt-meta transition hover:text-bt-link"
    >
      ← 다른 방법으로 로그인
      <span className="sr-only"> ({LABELS[method]} 취소)</span>
    </Link>
  )
}

export function signInMethodTitle(method: SignInMethod): string {
  return `${LABELS[method]}로 로그인`
}
