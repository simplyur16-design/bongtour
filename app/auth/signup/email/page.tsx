import { redirect } from 'next/navigation'

/** 이메일 신규 가입 UI 폐기 — OAuth 전용 회원가입으로 통합 */
export default function SignUpEmailPage() {
  redirect('/auth/signup')
}
