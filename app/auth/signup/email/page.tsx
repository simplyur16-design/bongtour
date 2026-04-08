import Link from 'next/link'
import Header from '@/app/components/Header'
import EmailRegisterForm from '@/app/components/auth/EmailRegisterForm'

export default function SignUpEmailPage() {
  return (
    <div className="min-h-screen bg-beige">
      <Header />
      <main className="mx-auto max-w-md px-4 py-14">
        <h1 className="mb-2 text-xl font-bold text-bt-strong">이메일로 회원가입</h1>
        <p className="mb-6 text-sm leading-relaxed text-bt-body">
          이메일과 비밀번호로 가입합니다. 상품 탐색은 로그인 없이도 이용할 수 있습니다.
        </p>
        <EmailRegisterForm />
        <p className="mt-6 text-center text-sm text-bt-body">
          <Link href="/auth/signup" className="text-bt-link hover:text-bt-link-hover hover:underline">
            다른 가입 방식 보기
          </Link>
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-bt-meta hover:text-bt-link">
          ← 홈으로
        </Link>
      </main>
    </div>
  )
}
