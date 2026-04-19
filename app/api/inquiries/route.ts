import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateCustomerInquiryBody } from '@/lib/customer-inquiry-intake'
import { sendInquiryReceivedEmail } from '@/lib/inquiry-email'
import { sendAdminInquiryNotification, sendInquiryCustomerLmsFallback } from '@/lib/notification-service'
import { attemptSendCustomerInquiryAlimTalk } from '@/lib/solapi-alimtalk'
import { assertNoInternalMetaLeak } from '@/lib/public-response-guard'
import { getRateLimitStore } from '@/lib/rate-limit-store'
import { getPublicMutationOriginError } from '@/lib/public-mutation-origin'

const INQUIRY_RATE_LIMIT_WINDOW_MS = 60_000
const INQUIRY_RATE_LIMIT_MAX = 12

function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return headers.get('x-real-ip') || 'unknown'
}

/**
 * POST /api/inquiries — 공개 문의 생성 (`CustomerInquiry` 단일 저장소)
 *
 * 보안·운영:
 * - 동일 출처(Origin/Referer) 검증 후 IP rate limit — lib/public-mutation-origin
 * - Captcha: 미적용 — 봇 남용 시 bot 관리·캡차 등 검토
 * - 운영자 이메일: `sendInquiryReceivedEmail`(SMTP_* / INQUIRY_NOTIFICATION_EMAIL). 실패는 DB·로그·`notification.channels.email`.
 * - 솔라피: 고객 알림톡 시도(`attemptSendCustomerInquiryAlimTalk`, 미설정 시 TODO·LMS 폴백) → `sendInquiryCustomerLmsFallback`; 담당자 `sendAdminInquiryNotification` — `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER`, `SOLAPI_RECEIVER`(쉼표 구분 복수). 문자 실패는 문의 저장 성공과 분리·`console.error`.
 * - `sourcePagePath` / `snapshot*`: 운영·분석 추적용(클라이언트 입력이므로 신뢰 검증은 하지 않음)
 */
export async function POST(request: Request) {
  const originErr = getPublicMutationOriginError(request)
  if (originErr) {
    return NextResponse.json(
      { ok: false, error: originErr.message, fieldErrors: {} as Record<string, string> },
      { status: originErr.status }
    )
  }

  const ip = getClientIp(request.headers)
  const store = getRateLimitStore()
  const bucket = await store.incr(`public:inquiries:${ip}`, INQUIRY_RATE_LIMIT_WINDOW_MS)
  if (bucket.count > INQUIRY_RATE_LIMIT_MAX) {
    return NextResponse.json(
      {
        ok: false,
        error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
        fieldErrors: {} as Record<string, string>,
      },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000))) } }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'JSON 본문을 읽을 수 없습니다.', fieldErrors: {} as Record<string, string> },
      { status: 400 }
    )
  }
  const obj = (body ?? {}) as Record<string, unknown>
  const honeypot = typeof obj.website === 'string' ? obj.website.trim() : ''
  if (honeypot) {
    return NextResponse.json(
      { ok: false, error: '요청 형식이 올바르지 않습니다.', fieldErrors: {} as Record<string, string> },
      { status: 400 }
    )
  }

  const validated = validateCustomerInquiryBody(body)
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.error, fieldErrors: validated.fieldErrors },
      { status: 400 }
    )
  }
  const v = validated.value

  if (v.productId) {
    const exists = await prisma.product.findUnique({
      where: { id: v.productId },
      select: { id: true },
    })
    if (!exists) {
      return NextResponse.json(
        {
          ok: false,
          error: '요청한 상품을 찾을 수 없습니다.',
          fieldErrors: { productId: '존재하지 않는 productId입니다.' },
        },
        { status: 400 }
      )
    }
  }

  if (v.monthlyCurationItemId) {
    const exists = await prisma.monthlyCurationItem.findUnique({
      where: { id: v.monthlyCurationItemId },
      select: { id: true },
    })
    if (!exists) {
      return NextResponse.json(
        {
          ok: false,
          error: '요청한 큐레이션 항목을 찾을 수 없습니다.',
          fieldErrors: { monthlyCurationItemId: '존재하지 않는 monthlyCurationItemId입니다.' },
        },
        { status: 400 }
      )
    }
  }

  try {
    let selectedServiceType: string | null = null
    try {
      if (v.payloadObject && typeof v.payloadObject.serviceScope === 'string') {
        const raw = v.payloadObject.serviceScope.trim()
        selectedServiceType = raw || null
      }
    } catch {
      selectedServiceType = null
    }

    /** DB 저장 — 알림과 분리. 이후 단계 실패해도 롤백하지 않음. */
    const row = await prisma.customerInquiry.create({
      data: {
        inquiryType: v.inquiryType,
        status: 'received',
        leadTimeRisk: v.leadTimeRisk,
        applicantName: v.applicantName,
        applicantPhone: v.applicantPhone,
        applicantEmail: v.applicantEmail,
        message: v.message,
        productId: v.productId,
        monthlyCurationItemId: v.monthlyCurationItemId,
        snapshotProductTitle: v.snapshotProductTitle,
        snapshotCardLabel: v.snapshotCardLabel,
        sourcePagePath: v.sourcePagePath,
        privacyAgreed: true,
        privacyNoticeConfirmedAt: v.privacyNoticeConfirmedAt,
        privacyNoticeVersion: v.privacyNoticeVersion,
        preferredContactChannel: v.preferredContactChannel,
        selectedServiceType,
        payloadJson: v.payloadJson,
        routingReasonJson: null,
      },
      select: {
        id: true,
        inquiryType: true,
        status: true,
        leadTimeRisk: true,
        createdAt: true,
        applicantName: true,
        applicantPhone: true,
        applicantEmail: true,
        preferredContactChannel: true,
        message: true,
        sourcePagePath: true,
        payloadJson: true,
        productId: true,
        snapshotProductTitle: true,
        snapshotCardLabel: true,
      },
    })

    let productMeta: { title: string; originCode: string; originSource: string } | null = null
    if (row.productId) {
      const p = await prisma.product.findUnique({
        where: { id: row.productId },
        select: { title: true, originCode: true, originSource: true },
      })
      if (p) productMeta = p
    }

    const notifyInput = {
      inquiryId: row.id,
      inquiryType: row.inquiryType,
      applicantName: row.applicantName,
      applicantPhone: row.applicantPhone,
      applicantEmail: row.applicantEmail,
      message: row.message,
      sourcePagePath: row.sourcePagePath,
      createdAtIso: row.createdAt.toISOString(),
      payloadJson: row.payloadJson,
      productId: row.productId,
      snapshotProductTitle: row.snapshotProductTitle,
      snapshotCardLabel: row.snapshotCardLabel,
      product: productMeta,
    }

    let emailOk = false
    try {
      await sendInquiryReceivedEmail(notifyInput)
      emailOk = true
      await prisma.customerInquiry.update({
        where: { id: row.id },
        data: {
          emailSentAt: new Date(),
          emailSentStatus: 'sent',
          emailError: null,
        },
      })
    } catch (mailError) {
      const errMsg = mailError instanceof Error ? mailError.message.slice(0, 500) : 'unknown'
      await prisma.customerInquiry.update({
        where: { id: row.id },
        data: {
          emailSentAt: null,
          emailSentStatus: 'failed',
          emailError: errMsg,
        },
      })
      console.error(
        '[POST /api/inquiries] notification_email_failed',
        JSON.stringify({
          inquiryId: row.id,
          inquiryType: row.inquiryType,
          stage: 'smtp_inquiry_received',
          error: errMsg,
        })
      )
    }

    const productLabel =
      productMeta?.title?.trim() ||
      row.snapshotProductTitle?.trim() ||
      row.snapshotCardLabel?.trim() ||
      '상담문의'

    /** `여행상담접수완료` #{상품명} 전용 — snapshotCardLabel 은 #{미리보기} 로만 사용 */
    const travelConsultProductTitle =
      productMeta?.title?.trim() || row.snapshotProductTitle?.trim() || '상담문의'

    const alim = await attemptSendCustomerInquiryAlimTalk({
      inquiryId: row.id,
      inquiryType: row.inquiryType,
      applicantName: row.applicantName,
      applicantPhone: row.applicantPhone,
      payloadJson: row.payloadJson,
      productLabel,
      travelConsultProductTitle,
      snapshotCardLabel: row.snapshotCardLabel,
    })
    if (!alim.ok && alim.shouldSendLmsFallback) {
      const lmsCustomer = await sendInquiryCustomerLmsFallback({
        inquiryId: row.id,
        inquiryType: row.inquiryType,
        productLabel,
        applicantPhone: row.applicantPhone,
      })
      if (!lmsCustomer.ok) {
        console.error(
          '[POST /api/inquiries] inquiry_customer_lms_failed',
          JSON.stringify({
            inquiryId: row.id,
            message: lmsCustomer.message,
            code: 'code' in lmsCustomer ? lmsCustomer.code : undefined,
          })
        )
      }
    }

    const lmsAdmin = await sendAdminInquiryNotification({
      inquiryId: row.id,
      inquiryType: row.inquiryType,
      productLabel,
      applicantName: row.applicantName,
      applicantPhone: row.applicantPhone,
      applicantEmail: row.applicantEmail ?? null,
      preferredContactChannel: row.preferredContactChannel ?? null,
      message: row.message ?? null,
      payloadJson: row.payloadJson,
    })
    if (lmsAdmin.failed.length > 0) {
      console.error(
        '[POST /api/inquiries] inquiry_admin_lms_failed',
        JSON.stringify({
          inquiryId: row.id,
          succeeded: lmsAdmin.succeeded,
          failed: lmsAdmin.failed,
        })
      )
    }

    const payload = {
      ok: true,
      inquiry: {
        id: row.id,
        inquiryType: row.inquiryType,
        status: row.status,
        leadTimeRisk: row.leadTimeRisk,
        createdAt: row.createdAt.toISOString(),
      },
      notification: {
        ok: emailOk,
        delayed: !emailOk,
        channels: {
          email: { ok: emailOk },
        },
      },
    }
    assertNoInternalMetaLeak(payload, '/api/inquiries')
    return NextResponse.json(payload)
  } catch (e) {
    console.error('[POST /api/inquiries]', e)
    return NextResponse.json(
      {
        ok: false,
        error: '문의 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        fieldErrors: {} as Record<string, string>,
      },
      { status: 500 }
    )
  }
}
