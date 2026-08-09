import Link from 'next/link'
import ForgotPasswordForm from '@/app/components/auth/ForgotPasswordForm'
import Header from '@/app/components/Header'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { SUBPAGE_PAGE_SHELL_CLASS } from '@/lib/subpage-design-system'

/** REGRESSION-FREEZE[auth-password-reset]: bongtour forgot-password page — manifest */
export default function ForgotPasswordPage() {
  return (
    <div className={SUBPAGE_PAGE_SHELL_CLASS}>
      <Header />
      <main className={`${SITE_CONTENT_CLASS} flex max-w-md flex-col items-center justify-center py-16`}>
        <h1 className="mb-2 text-xl font-bold text-bt-strong">비밀번호 찾기</h1>
        <p className="mb-8 max-w-xs text-center text-sm leading-relaxed text-bt-body">
          가입에 사용한 이메일을 입력해 주세요. 비밀번호가 설정된 계정이면 재설정 안내 메일을 보냅니다.
        </p>
        <ForgotPasswordForm
          surface="bongtour"
          signInHref="/auth/signin"
          labels={{
            title: '비밀번호 찾기',
            subtitle: '가입 이메일을 입력해 주세요.',
            emailLabel: '이메일 또는 ID',
            submit: '재설정 메일 보내기',
            success:
              '요청을 접수했습니다. 비밀번호가 설정된 계정이면 안내 메일을 확인해 주세요.',
            backToSignIn: '← 로그인으로',
          }}
        />
        <Link href="/" className="mt-6 text-sm text-bt-meta hover:text-bt-link">
          ← 홈으로
        </Link>
      </main>
    </div>
  )
}
