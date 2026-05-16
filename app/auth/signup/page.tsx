import Link from 'next/link'
import Header from '@/app/components/Header'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { SUBPAGE_PAGE_SHELL_CLASS } from '@/lib/subpage-design-system'
import SignUpClient from './SignUpClient'

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function SignUpPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams
  const cb = callbackUrl ?? '/'
  const kakaoOn = Boolean(process.env.KAKAO_CLIENT_ID?.trim() && process.env.KAKAO_CLIENT_SECRET?.trim())
  const naverOn = Boolean(process.env.NAVER_CLIENT_ID?.trim() && process.env.NAVER_CLIENT_SECRET?.trim())

  return (
    <div className={SUBPAGE_PAGE_SHELL_CLASS}>
      <Header />
      <main className={`${SITE_CONTENT_CLASS} flex max-w-md flex-col items-center py-14`}>
        <h1 className="mb-1 text-xl font-bold text-bt-strong">회원가입</h1>
        <p className="mb-8 text-center text-sm leading-relaxed text-bt-body">
          이메일 또는 소셜 계정으로 시작할 수 있습니다. 상품 탐색은 로그인 없이도 이용할 수 있습니다.
        </p>

        <SignUpClient callbackUrl={cb} kakaoOn={kakaoOn} naverOn={naverOn} />

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
