import Link from 'next/link'
import { notFound } from 'next/navigation'
import EmailSignInForm from '@/app/components/auth/EmailSignInForm'
import SignInMethodChooser, { type SignInMethod } from '@/app/components/auth/SignInMethodChooser'
import SignInMethodBackLink, { signInMethodTitle } from '@/app/components/auth/SignInMethodBackLink'
import Header from '@/app/components/Header'
import { getAuthCsrfToken } from '@/lib/auth/get-auth-csrf-token'
import { isGoogleOAuthConfigured } from '@/lib/auth/google-oauth-provider'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { SUBPAGE_PAGE_SHELL_CLASS } from '@/lib/subpage-design-system'

type Props = {
  searchParams: Promise<{ callbackUrl?: string; registered?: string; method?: string; error?: string }>
}

function isSignInMethod(v: string | undefined): v is 'email' | 'google' {
  return v === 'email' || v === 'google'
}

function methodHref(id: SignInMethod, callbackUrl: string): string {
  const q = encodeURIComponent(callbackUrl)
  if (id === 'kakao') return `/api/auth/kakao?callbackUrl=${q}`
  if (id === 'naver') return `/api/auth/naver?callbackUrl=${q}`
  if (id === 'google') return `/auth/signin?method=google&callbackUrl=${q}`
  return `/auth/signin?method=email&callbackUrl=${q}`
}

export default async function SignInPage({ searchParams }: Props) {
  const { callbackUrl, registered, method: rawMethod, error } = await searchParams
  const cb = callbackUrl?.startsWith('/') ? callbackUrl : '/'

  const kakaoOn = Boolean(process.env.KAKAO_CLIENT_ID?.trim() && process.env.KAKAO_CLIENT_SECRET?.trim())
  const naverOn = Boolean(process.env.NAVER_CLIENT_ID?.trim() && process.env.NAVER_CLIENT_SECRET?.trim())
  const googleOn = isGoogleOAuthConfigured()
  const csrfToken = googleOn ? await getAuthCsrfToken() : ''

  const methodEnabled: Record<SignInMethod, boolean> = {
    kakao: kakaoOn,
    naver: naverOn,
    google: googleOn && Boolean(csrfToken),
    email: true,
  }

  const method =
    rawMethod && isSignInMethod(rawMethod)
      ? rawMethod
      : registered === '1'
        ? 'email'
        : undefined

  if (method && !methodEnabled[method]) notFound()

  const chooserOptions = (['kakao', 'naver', 'google', 'email'] as const).map((id) => ({
    id,
    label: id === 'kakao' ? '카카오' : id === 'naver' ? '네이버' : id === 'google' ? 'Google' : '이메일',
    description:
      id === 'kakao'
        ? '카카오 계정'
        : id === 'naver'
          ? '네이버 계정'
          : id === 'google'
            ? '해외·simplyur'
            : 'ID·비밀번호',
    enabled: methodEnabled[id],
    href: methodHref(id, cb),
  }))

  return (
    <div className={SUBPAGE_PAGE_SHELL_CLASS}>
      <Header />
      <main className={`${SITE_CONTENT_CLASS} flex max-w-md flex-col items-center justify-center py-16`}>
        <h1 className="mb-2 text-xl font-bold text-bt-strong">
          {method ? signInMethodTitle(method) : '로그인'}
        </h1>
        <p className="mb-6 text-center text-sm leading-relaxed text-bt-body">
          {method === 'email'
            ? '이메일과 비밀번호를 입력해 주세요.'
            : method === 'google'
              ? 'Google 계정으로 로그인해 주세요.'
              : '찜·문의 이력 등 일부 기능에 활용됩니다. 여행·연수 상품 탐색은 로그인 없이 가능합니다.'}
        </p>

        {error === 'google_csrf' ? (
          <p className="mb-4 w-full max-w-xs rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-800">
            Google 로그인 준비에 실패했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        ) : null}

        {registered === '1' && !method ? (
          <p className="mb-4 w-full max-w-xs rounded-lg border border-bt-border-soft bg-bt-brand-blue-soft px-3 py-2 text-center text-xs text-bt-title">
            회원가입이 완료되었습니다. 이메일로 로그인해 주세요.
          </p>
        ) : null}

        {!method ? (
          <SignInMethodChooser callbackUrl={cb} csrfToken={csrfToken} options={chooserOptions} />
        ) : (
          <div className="w-full max-w-xs">
            <SignInMethodBackLink method={method === 'google' ? 'google' : 'email'} callbackUrl={cb} />

            {method === 'email' ? <EmailSignInForm callbackUrl={cb} /> : null}

            {method === 'google' && csrfToken ? (
              <form action="/api/auth/signin/google" method="POST">
                <input type="hidden" name="csrfToken" value={csrfToken} />
                <input type="hidden" name="callbackUrl" value={cb} />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-bt-border-soft bg-white px-5 py-3 text-[15px] font-medium text-bt-ink transition hover:bg-bt-surface-soft"
                >
                  Google 계정으로 계속
                </button>
              </form>
            ) : null}
          </div>
        )}

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
