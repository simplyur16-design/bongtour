import { jsonWithLeakGuard } from '@/lib/public-response-guard'

export const dynamic = 'force-dynamic'

// REGRESSION-FREEZE[bongsim-press-email-retired]: press OTP request disabled — manifest

/** 언론사 이메일 OTP 폐기 — 명함 승인만 사용 */
export async function POST() {
  return jsonWithLeakGuard(
    {
      error: 'press_email_auth_retired',
      message: '언론사 이메일 인증은 종료되었습니다. 마이페이지에서 소속 명함을 제출해 주세요.',
    },
    'bongsim.mypage.press.request-otp',
    { status: 410 },
  )
}
