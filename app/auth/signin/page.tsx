import Link from 'next/link'
import KakaoLoginButton from '@/app/components/auth/KakaoLoginButton'
import EmailSignInForm from '@/app/components/auth/EmailSignInForm'
import Header from '@/app/components/Header'

type Props = {
  searchParams: Promise<{ callbackUrl?: string; registered?: string }>
}

export default async function SignInPage({ searchParams }: Props) {
  const { callbackUrl, registered } = await searchParams
  const cb = callbackUrl ?? '/'
  const kakaoOn = Boolean(process.env.KAKAO_CLIENT_ID?.trim() && process.env.KAKAO_CLIENT_SECRET?.trim())

  return (
    <div className="min-h-screen bg-beige">
      <Header />
      <main className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-16">
        <h1 className="mb-2 text-xl font-bold text-bt-strong">로그인</h1>
        <p className="mb-6 text-center text-sm leading-relaxed text-bt-body">
          찜·문의 이력 등 일부 기능에 활용됩니다. 여행·연수 상품 탐색은 로그인 없이 가능합니다.
        </p>
        {registered === '1' ? (
          <p className="mb-4 w-full max-w-xs rounded-lg border border-bt-border-soft bg-bt-brand-blue-soft px-3 py-2 text-center text-xs text-bt-title">
            회원가입이 완료되었습니다. 이메일로 로그인해 주세요.
          </p>
        ) : null}

        <EmailSignInForm callbackUrl={cb} />

        {kakaoOn ? (
          <>
            <div className="relative my-6 w-full max-w-xs text-center text-xs text-bt-subtle">
              <span className="relative z-10 bg-beige px-2">또는</span>
              <span className="absolute inset-x-0 top-1/2 z-0 h-px -translate-y-1/2 bg-bt-border-soft" aria-hidden />
            </div>
            <KakaoLoginButton callbackUrl={callbackUrl ?? undefined} className="w-full max-w-xs justify-center">
              카카오로 로그인
            </KakaoLoginButton>
          </>
        ) : (
          <p className="mt-4 max-w-xs text-center text-[11px] text-bt-meta">
            카카오 로그인은 서버에 KAKAO_CLIENT_ID / KAKAO_CLIENT_SECRET 설정 시 표시됩니다.
          </p>
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
