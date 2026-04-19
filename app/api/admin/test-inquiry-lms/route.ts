/**
 * TEMP TEST ROUTE — 관리자 문의 LMS(Solapi) 실발송 검증용. 운영 반영 전 이 파일 삭제.
 *
 * 실제 SMS 발송: POST 만 수행한다. GET 은 사용법 JSON만 반환(발송 없음).
 *
 * 호출 예:
 *   curl -X POST http://localhost:3000/api/admin/test-inquiry-lms
 * (관리자 세션 쿠키 또는 Authorization: Bearer <ADMIN_SERVICE_BEARER_SECRET> 필요)
 */

import { NextResponse } from 'next/server'
import { ADMIN_INQUIRY_LMS_TEST_FIXTURE } from '@/lib/admin-inquiry-lms-content'
import { requireAdmin } from '@/lib/require-admin'
import { parseSolapiReceiverPhones, sendAdminInquiryNotification } from '@/lib/notification-service'

export async function GET() {
  return NextResponse.json({
    ok: true,
    tempTestRoute: true,
    sendMethod: 'POST only (GET does not send)',
    curl: 'curl -X POST http://localhost:3000/api/admin/test-inquiry-lms',
    auth: 'Admin session or Authorization: Bearer <ADMIN_SERVICE_BEARER_SECRET>',
    env: ['SOLAPI_API_KEY', 'SOLAPI_API_SECRET', 'SOLAPI_SENDER', 'SOLAPI_RECEIVER'],
    fixedPayload: ADMIN_INQUIRY_LMS_TEST_FIXTURE,
  })
}

export async function POST() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  const receivers = parseSolapiReceiverPhones()
  const result = await sendAdminInquiryNotification(ADMIN_INQUIRY_LMS_TEST_FIXTURE)

  const successReceivers = result.succeeded
  const failedReceivers = result.failed.map((f) => ({
    to: f.to,
    code: f.code ?? null,
    message: f.message,
  }))

  const providerSummary = result.skipped
    ? {
        provider: 'solapi',
        skipped: true,
        reason: (() => {
          if (!process.env.SOLAPI_API_KEY?.trim() || !process.env.SOLAPI_API_SECRET?.trim()) {
            return 'missing SOLAPI_API_KEY or SOLAPI_API_SECRET'
          }
          if (!process.env.SOLAPI_SENDER?.trim()) return 'missing SOLAPI_SENDER'
          if (!(process.env.SOLAPI_SENDER.trim().replace(/\D/g, '') ?? '')) {
            return 'SOLAPI_SENDER has no digits after normalize'
          }
          if (receivers.length === 0) return 'missing or empty SOLAPI_RECEIVER (no valid numbers)'
          return 'skipped_unknown'
        })(),
      }
    : {
        provider: 'solapi',
        skipped: false,
        endpoint: 'messages/v4/send',
        attempted: receivers.length,
        succeeded: successReceivers.length,
        failed: failedReceivers.length,
      }

  if (result.failed.length > 0) {
    console.error(
      '[TEMP test-inquiry-lms] send failures',
      JSON.stringify({ inquiryId: ADMIN_INQUIRY_LMS_TEST_FIXTURE.inquiryId, successReceivers, failedReceivers })
    )
  }

  const ok = !result.skipped && result.failed.length === 0 && successReceivers.length > 0

  return NextResponse.json(
    {
      ok,
      receivers,
      successReceivers,
      failedReceivers,
      provider: providerSummary,
      skipped: result.skipped,
    },
    { status: 200 }
  )
}
