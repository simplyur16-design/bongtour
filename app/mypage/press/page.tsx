import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** 언론사 이메일 OTP 폐기 — 소속 명함 인증으로 통합 */
export default function MyPagePressVerificationPage() {
  redirect('/mypage/affiliation')
}
