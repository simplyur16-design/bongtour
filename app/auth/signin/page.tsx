import Link from 'next/link'
import { notFound } from 'next/navigation'
import EmailSignInForm from '@/app/components/auth/EmailSignInForm'
import SignInSocialPanel from '@/app/components/auth/SignInSocialPanel'
import Header from '@/app/components/Header'
import {
  SIGN_IN_SOCIAL_METHODS_DOMESTIC,
  isSignInMethodEnabled,
} from '@/lib/auth/sign-in-method-catalog'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { SUBPAGE_PAGE_SHELL_CLASS } from '@/lib/subpage-design-system'

type Props = {
  searchParams: Promise<{ callbackUrl?: string; registered?: string; method?: string; error?: string }>
}

/** 국내(봉투어) 웹 — 카카오·네이버·이메일을 한 화면에. Google·Apple은 모바일 앱 전용. */
export default async function SignInPage({ searchParams }: Props) {
  const { callbackUrl, registered, method: rawMethod } = await searchParams
  const cb = callbackUrl?.startsWith('/') ? callbackUrl : '/'

  const methodEnabled = {
    kakao: isSignInMethodEnabled('kakao'),
    naver: isSignInMethodEnabled('naver'),
    email: isSignInMethodEnabled('email'),
  }

  if (rawMethod === 'google' || rawMethod === 'apple') {
    notFound()
  }

  const socialOptions = SIGN_IN_SOCIAL_METHODS_DOMESTIC.map((id) => ({
    id,
    enabled: methodEnabled[id],
  }))
  const hasSocial = socialOptions.some((o) => o.enabled)

  return (
    <div className={SUBPAGE_PAGE_SHELL_CLASS}>
      <Header />
      <main className={`${SITE_CONTENT_CLASS} flex max-w-md flex-col items-center justify-center py-16`}>
        <h1 className="mb-2 text-xl font-bold text-bt-strong">로그인</h1>
        <p className="mb-8 max-w-xs text-center text-sm leading-relaxed text-bt-body">
          카카오·네이버·이메일로 로그인할 수 있습니다. 여행·연수 상품 탐색은 로그인 없이 가능합니다.
        </p>

        {registered === '1' ? (
          <p className="mb-4 w-full max-w-xs rounded-lg border border-bt-border-soft bg-bt-brand-blue-soft px-3 py-2 text-center text-xs text-bt-title">
            회원가입이 완료되었습니다. 이메일로 로그인해 주세요.
          </p>
        ) : null}

        <div className="flex w-full max-w-sm flex-col items-center">
          {methodEnabled.email ? <EmailSignInForm callbackUrl={cb} /> : null}

          {methodEnabled.email && hasSocial ? (
            <div className="my-5 flex w-full items-center gap-3">
              <span className="h-px flex-1 bg-bt-border-soft" aria-hidden />
              <span className="text-xs font-medium text-bt-meta">또는</span>
              <span className="h-px flex-1 bg-bt-border-soft" aria-hidden />
            </div>
          ) : null}

          <SignInSocialPanel callbackUrl={cb} csrfToken="" socialOptions={socialOptions} />
        </div>

        <p className="mt-8 text-center text-sm text-bt-body">
          계정이 없으신가요?{' '}
          <Link href="/auth/signup" className="font-medium text-bt-link hover:text-bt-link-hover hover:underline">
            회원가입
          </Link>
        </p>
        <Link href="/" className="mt-6 text-sm text-bt-meta hover:text-bt-link">
          ← 홈으로
        </Link>
      </main>
    </div>
  )
}
