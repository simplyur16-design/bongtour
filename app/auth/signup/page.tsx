import Link from 'next/link'
import KakaoLoginButton from '@/app/components/auth/KakaoLoginButton'
import Header from '@/app/components/Header'

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function SignUpPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams
  const kakaoOn = Boolean(process.env.KAKAO_CLIENT_ID?.trim() && process.env.KAKAO_CLIENT_SECRET?.trim())

  return (
    <div className="min-h-screen bg-beige">
      <Header />
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-14">
        <h1 className="mb-1 text-xl font-bold text-bt-strong">회원가입</h1>
        <p className="mb-8 text-center text-sm leading-relaxed text-bt-body">
          이메일 또는 소셜 계정으로 시작할 수 있습니다. 상품 탐색은 로그인 없이도 이용할 수 있습니다.
        </p>

        <div className="flex w-full flex-col gap-3">
          <Link
            href="/auth/signup/email"
            className="flex w-full items-center justify-center rounded-lg border border-bt-cta-secondary-border bg-bt-cta-secondary px-5 py-3 text-[15px] font-medium text-bt-cta-secondary-text shadow-sm transition hover:border-bt-border-strong hover:bg-bt-surface-soft"
          >
            이메일로 시작하기
          </Link>

          {kakaoOn ? (
            <>
              <div className="relative py-1 text-center text-xs text-bt-subtle">
                <span className="relative z-10 bg-beige px-2">또는</span>
                <span className="absolute inset-x-0 top-1/2 z-0 h-px -translate-y-1/2 bg-bt-border-soft" aria-hidden />
              </div>

              <KakaoLoginButton callbackUrl={callbackUrl ?? '/'} className="w-full justify-center">
                카카오로 시작하기
              </KakaoLoginButton>
              <p className="text-center text-[11px] leading-relaxed text-bt-meta">
                소셜은 카카오 외에도 단계적으로 추가될 예정입니다.
              </p>
            </>
          ) : (
            <p className="text-center text-[11px] leading-relaxed text-bt-meta">
              카카오 연동 시 서버에 KAKAO_CLIENT_ID / KAKAO_CLIENT_SECRET 을 설정하면 여기에서 소셜 가입이 열립니다.
            </p>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-bt-body">
          이미 계정이 있으신가요?{' '}
          <Link href="/auth/signin" className="font-medium text-bt-link hover:text-bt-link-hover hover:underline">
            로그인
          </Link>
        </p>
        <Link href="/" className="mt-4 text-sm text-bt-meta hover:text-bt-link">
          ← 홈으로
        </Link>
      </main>
    </div>
  )
}
