import Link from 'next/link'
import ResetPasswordForm from '@/app/components/auth/ResetPasswordForm'
import Header from '@/app/components/Header'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { SUBPAGE_PAGE_SHELL_CLASS } from '@/lib/subpage-design-system'

type Props = {
  searchParams: Promise<{ token?: string; email?: string }>
}

/** REGRESSION-FREEZE[auth-password-reset]: bongtour reset-password page — manifest */
export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token = '', email = '' } = await searchParams

  return (
    <div className={SUBPAGE_PAGE_SHELL_CLASS}>
      <Header />
      <main className={`${SITE_CONTENT_CLASS} flex max-w-md flex-col items-center justify-center py-16`}>
        <h1 className="mb-2 text-xl font-bold text-bt-strong">비밀번호 재설정</h1>
        <p className="mb-8 max-w-xs text-center text-sm leading-relaxed text-bt-body">
          새 비밀번호를 입력해 주세요. (8자 이상)
        </p>
        <ResetPasswordForm
          surface="bongtour"
          email={email}
          token={token}
          signInHref="/auth/signin"
          labels={{
            title: '비밀번호 재설정',
            subtitle: '새 비밀번호를 입력해 주세요.',
            newPassword: '새 비밀번호',
            confirmPassword: '비밀번호 확인',
            submit: '비밀번호 변경',
            success: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.',
            backToSignIn: '← 로그인으로',
            errorWeak: '비밀번호는 8자 이상이어야 합니다.',
            errorMismatch: '비밀번호가 일치하지 않습니다.',
            errorInvalid: '재설정 링크가 유효하지 않거나 만료되었습니다. 다시 요청해 주세요.',
            errorGeneric: '비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          }}
        />
        <Link href="/" className="mt-6 text-sm text-bt-meta hover:text-bt-link">
          ← 홈으로
        </Link>
      </main>
    </div>
  )
}
