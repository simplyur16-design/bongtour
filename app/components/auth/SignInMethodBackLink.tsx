import Link from 'next/link'
import type { SignInMethod } from '@/lib/auth/sign-in-method-catalog'
import { SIGN_IN_METHOD_DEFINITIONS, signInMethodTitle } from '@/lib/auth/sign-in-method-catalog'

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
      <span className="sr-only"> ({SIGN_IN_METHOD_DEFINITIONS[method].label} 취소)</span>
    </Link>
  )
}

export { signInMethodTitle }
