import { prisma } from '@/lib/prisma'
import {
  CUSTOMER_INQUIRY_TYPES,
  validateCustomerInquiryBody,
  type CustomerInquiryType,
} from '@/lib/customer-inquiry-intake'
import { sendInquiryReceivedEmail } from '@/lib/inquiry-email'
import { notifyTravelConsultInquiryBookingAligned } from '@/lib/inquiry-booking-aligned-notify'
import { sendAdminInquiryNotification } from '@/lib/notification-service'
import { sendInquiryCustomerAlimtalkOrLms } from '@/lib/inquiry-customer-notify'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { getRateLimitStore } from '@/lib/rate-limit-store'
import { getPublicMutationOriginError } from '@/lib/public-mutation-origin'
import { makeInquiryNumber } from '@/lib/identifiers/make-inquiry-number'
import { parsePublicAttributionFromBody } from '@/lib/public-attribution-body'

const INQUIRY_RATE_LIMIT_WINDOW_MS = 60_000
const INQUIRY_RATE_LIMIT_MAX = 5

function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return headers.get('x-real-ip') || 'unknown'
}

/** 브라우저 자동완성이 `website`/`website_url` 이름에 값을 넣는 경우가 있어 별도 키도 검사 */
function inquiryHoneypotFilled(obj: Record<string, unknown>): boolean {
  for (const key of ['website', 'website_url', 'btHpWebsite', 'btHpUrl'] as const) {
    const v = obj[key]
    if (typeof v === 'string' && v.trim()) return true
  }
  return false
}

function buildSilentInquiryAcceptPayload(body: Record<string, unknown>) {
  const rawType = body.inquiryType
  const inquiryType: CustomerInquiryType =
    typeof rawType === 'string' && (CUSTOMER_INQUIRY_TYPES as readonly string[]).includes(rawType)
      ? (rawType as CustomerInquiryType)
      : 'travel_consult'
  const id = `in${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  const createdAt = new Date().toISOString()
  return {
    ok: true as const,
    persisted: false as const,
    inquiry: {
      id,
      inquiryType,
      status: 'received' as const,
      leadTimeRisk: 'normal' as const,
      createdAt,
    },
    notification: {
      ok: false as const,
      delayed: true as const,
      channels: { email: { ok: false as const } },
    },
  }
}

/**
 * POST /api/inquiries — 공개 문의 생성 (`CustomerInquiry` 단일 저장소)
 *
 * 보안·운영:
 * - 동일 출처(Origin/Referer) 검증 후 IP rate limit — lib/public-mutation-origin
 * - Honeypot(`website`·`website_url`)·운영 시각(`formOpenedAt`)·`validateCustomerInquiryBody` 봇 패턴: DB·알림 없이 성공 형태 200.
 * - Captcha: 미적용 — 봇 남용 시 bot 관리·캡차 등 검토
 * - travel_consult: `notifyTravelConsultInquiryBookingAligned` — 예약과 동일 env·`bookingAdminNotificationRecipient`.
 * - 그 외 유형: `sendInquiryReceivedEmail`(SMTP_* / BOOKING_NOTIFICATION_EMAIL 우선·INQUIRY 폴백).
 * - 솔라피: 고객 알림톡 시도(`attemptSendCustomerInquiryAlimTalk`, 미설정 시 LMS 폴백) → `sendInquiryCustomerLmsFallback`; 담당자 `sendAdminInquiryNotification` — `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_FROM_PHONE`, `SOLAPI_ADMIN_PHONES`(쉼표 구분 복수). 문자 실패는 문의 저장 성공과 분리·`console.error`.
 * - `sourcePagePath` / `snapshot*`: 운영·분석 추적용(클라이언트 입력이므로 신뢰 검증은 하지 않음)
 */
export async function POST(request: Request) {
  const originErr = getPublicMutationOriginError(request)
  if (originErr) {
    return jsonWithLeakGuard(
      { ok: false, error: originErr.message, fieldErrors: {} as Record<string, string> },
      'api.inquiries.origin',
      { status: originErr.status },
    )
  }

  const ip = getClientIp(request.headers)
  const store = getRateLimitStore()
  const bucket = await store.incr(`public:inquiries:${ip}`, INQUIRY_RATE_LIMIT_WINDOW_MS)
  if (bucket.count > INQUIRY_RATE_LIMIT_MAX) {
    return jsonWithLeakGuard(
      {
        ok: false,
        error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
        fieldErrors: {} as Record<string, string>,
      },
      'api.inquiries.rate-limit',
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000))) } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonWithLeakGuard(
      { ok: false, error: 'JSON 본문을 읽을 수 없습니다.', fieldErrors: {} as Record<string, string> },
      'api.inquiries.bad-json',
      { status: 400 },
    )
  }
  const obj = (body ?? {}) as Record<string, unknown>
  if (inquiryHoneypotFilled(obj)) {
    console.warn('[POST /api/inquiries] silent_honeypot', JSON.stringify({ ip }))
    const payload = buildSilentInquiryAcceptPayload(obj)
    return jsonWithLeakGuard(payload, 'api.inquiries.silent-honeypot')
  }

  const productionInquiry = process.env.NODE_ENV === 'production'
  if (productionInquiry) {
    const opened = obj.formOpenedAt
    const now = Date.now()
    const openedMs = typeof opened === 'number' && Number.isFinite(opened) ? opened : NaN
    const minTs = 1_700_000_000_000 /** ~2023-11 — 과거·0 방지 */
    const tooFast =
      !Number.isFinite(openedMs) || openedMs < minTs || openedMs > now || now - openedMs < 3000
    if (tooFast) {
      console.warn(
        '[POST /api/inquiries] rejected_too_fast',
        JSON.stringify({ ip, elapsedMs: Number.isFinite(openedMs) ? now - openedMs : null }),
      )
      return jsonWithLeakGuard(
        {
          ok: false,
          error: '제출이 너무 빨랐습니다. 내용을 확인한 뒤 3초 이상 채운 다음 다시 접수해 주세요.',
          fieldErrors: {} as Record<string, string>,
        },
        'api.inquiries.too-fast',
        { status: 400 },
      )
    }
  }

  const validated = validateCustomerInquiryBody(body, { productionInquiryRules: productionInquiry })
  if (validated.ok === 'silent_bot') {
    console.warn('[POST /api/inquiries] silent_bot', JSON.stringify({ ip }))
    const payload = buildSilentInquiryAcceptPayload(obj)
    return jsonWithLeakGuard(payload, 'api.inquiries.silent-bot')
  }
  if (validated.ok === false) {
    return jsonWithLeakGuard(
      { ok: false, error: validated.error, fieldErrors: validated.fieldErrors },
      'api.inquiries.validation',
      { status: 400 },
    )
  }
  const v = validated.value
  const attribution = parsePublicAttributionFromBody(obj)

  /** productId 있을 때 1회 조회 — 존재 검증 + 스냅샷(origin·제목) 채움 */
  let productForInquiry: {
    title: string
    originUrl: string | null
    originSource: string | null
    originCode: string | null
  } | null = null

  if (v.productId) {
    const p = await prisma.product.findUnique({
      where: { id: v.productId },
      select: { title: true, originUrl: true, originSource: true, originCode: true },
    })
    if (!p) {
      return jsonWithLeakGuard(
        {
          ok: false,
          error: '요청한 상품을 찾을 수 없습니다.',
          fieldErrors: { productId: '존재하지 않는 productId입니다.' },
        },
        'api.inquiries.bad-product',
        { status: 400 },
      )
    }
    productForInquiry = {
      title: p.title ?? '',
      originUrl: p.originUrl,
      originSource: p.originSource,
      originCode: p.originCode,
    }
  }

  const snapshotProductTitleForDb = productForInquiry
    ? v.snapshotProductTitle?.trim() || productForInquiry.title?.trim() || null
    : v.snapshotProductTitle
  const snapshotOriginUrlForDb = productForInquiry?.originUrl?.trim() || null
  const snapshotOriginSourceForDb = productForInquiry?.originSource?.trim() || null
  const snapshotOriginCodeForDb = productForInquiry?.originCode?.trim() || null

  if (v.monthlyCurationItemId) {
    const exists = await prisma.monthlyCurationItem.findUnique({
      where: { id: v.monthlyCurationItemId },
      select: { id: true },
    })
    if (!exists) {
      return jsonWithLeakGuard(
        {
          ok: false,
          error: '요청한 큐레이션 항목을 찾을 수 없습니다.',
          fieldErrors: { monthlyCurationItemId: '존재하지 않는 monthlyCurationItemId입니다.' },
        },
        'api.inquiries.monthly-curation-missing',
        { status: 400 },
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
        inquiryNumber: makeInquiryNumber(),
        inquiryType: v.inquiryType,
        status: 'received',
        leadTimeRisk: v.leadTimeRisk,
        applicantName: v.applicantName,
        applicantPhone: v.applicantPhone,
        applicantEmail: v.applicantEmail,
        message: v.message,
        productId: v.productId,
        monthlyCurationItemId: v.monthlyCurationItemId,
        snapshotProductTitle: snapshotProductTitleForDb,
        snapshotCardLabel: v.snapshotCardLabel,
        snapshotOriginUrl: snapshotOriginUrlForDb,
        snapshotOriginSource: snapshotOriginSourceForDb,
        snapshotOriginCode: snapshotOriginCodeForDb,
        sourcePagePath: v.sourcePagePath,
        utmSource: attribution.utmSource,
        utmMedium: attribution.utmMedium,
        utmCampaign: attribution.utmCampaign,
        utmContent: attribution.utmContent,
        utmTerm: attribution.utmTerm,
        referrer: attribution.referrer,
        landingPath: attribution.landingPath,
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
        inquiryNumber: true,
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
        snapshotOriginUrl: true,
        snapshotOriginSource: true,
        snapshotOriginCode: true,
      },
    })

    const productMeta: { title: string; originCode: string; originSource: string } | null = productForInquiry
      ? {
          title: productForInquiry.title,
          originCode: productForInquiry.originCode ?? '',
          originSource: productForInquiry.originSource ?? '',
        }
      : null

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
      snapshotOriginUrl: row.snapshotOriginUrl,
      product: productMeta,
    }

    const productLabel =
      productMeta?.title?.trim() ||
      row.snapshotProductTitle?.trim() ||
      row.snapshotCardLabel?.trim() ||
      '상담문의'

    let emailOk = false
    let adminLmsOk = false
    let adminLmsSkipped = true
    let adminLmsFailedCount = 0
    let customerAlimtalkOk: boolean | null = null
    let customerLmsOk: boolean | null = null
    let customerLmsSkipped: boolean | null = null
    let notificationMode: 'booking_aligned' | 'inquiry_legacy' = 'inquiry_legacy'

    if (row.inquiryType === 'travel_consult') {
      notificationMode = 'booking_aligned'
      const aligned = await notifyTravelConsultInquiryBookingAligned(
        {
          id: row.id,
          inquiryNumber: row.inquiryNumber,
          inquiryType: row.inquiryType,
          applicantName: row.applicantName,
          applicantPhone: row.applicantPhone,
          applicantEmail: row.applicantEmail,
          message: row.message,
          payloadJson: row.payloadJson,
          productId: row.productId,
          snapshotProductTitle: row.snapshotProductTitle,
          snapshotCardLabel: row.snapshotCardLabel,
          snapshotOriginSource: row.snapshotOriginSource,
          snapshotOriginUrl: row.snapshotOriginUrl,
          preferredContactChannel: row.preferredContactChannel,
          createdAt: row.createdAt,
        },
        productLabel,
      )
      emailOk = aligned.emailOk
      adminLmsSkipped = aligned.adminSms.skipped
      adminLmsOk = aligned.adminSms.ok
      adminLmsFailedCount = aligned.adminSms.ok ? 0 : 1
      customerAlimtalkOk = aligned.customerAlimtalkOk
      customerLmsOk = aligned.customerLmsOk
      customerLmsSkipped = aligned.customerLmsSkipped
      if (!aligned.emailOk) {
        console.error(
          '[POST /api/inquiries] booking_aligned_admin_email_failed',
          JSON.stringify({ inquiryId: row.id, inquiryNumber: row.inquiryNumber }),
        )
      }
      if (!aligned.adminSms.skipped && !aligned.adminSms.ok) {
        console.error(
          '[POST /api/inquiries] booking_aligned_admin_sms_failed',
          JSON.stringify({ inquiryId: row.id, inquiryNumber: row.inquiryNumber }),
        )
      }
      if (!aligned.customerAlimtalkOk && !aligned.noRegisteredAlimtalkTemplate) {
        console.warn(
          '[POST /api/inquiries] booking_aligned_customer_alimtalk_failed',
          JSON.stringify({
            inquiryId: row.id,
            customerLmsOk: aligned.customerLmsOk,
            customerLmsSkipped: aligned.customerLmsSkipped,
            hint: aligned.customerLmsOk
              ? '알림톡 실패 후 LMS만 발송 — SOLAPI 4종 템플릿 ID·PFID 확인'
              : '알림톡·LMS 모두 실패 또는 미설정',
          }),
        )
      }
    } else {
      try {
        await sendInquiryReceivedEmail(notifyInput)
        emailOk = true
      } catch (mailError) {
        const errMsg = mailError instanceof Error ? mailError.message.slice(0, 500) : 'unknown'
        console.error(
          '[POST /api/inquiries] notification_email_failed',
          JSON.stringify({
            inquiryId: row.id,
            inquiryType: row.inquiryType,
            stage: 'smtp_inquiry_received',
            error: errMsg,
          }),
        )
      }

      const travelConsultProductTitle =
        productMeta?.title?.trim() || row.snapshotProductTitle?.trim() || '상담문의'

      const customerNotify = await sendInquiryCustomerAlimtalkOrLms({
        inquiryId: row.id,
        inquiryType: row.inquiryType,
        applicantName: row.applicantName,
        applicantPhone: row.applicantPhone,
        payloadJson: row.payloadJson,
        productLabel,
        travelConsultProductTitle,
        snapshotCardLabel: row.snapshotCardLabel,
      })
      customerAlimtalkOk = customerNotify.customerAlimtalkOk
      customerLmsOk = customerNotify.customerLmsOk
      customerLmsSkipped = customerNotify.customerLmsSkipped
      if (!customerNotify.customerAlimtalkOk && !customerNotify.noRegisteredAlimtalkTemplate) {
        console.warn(
          '[POST /api/inquiries] inquiry_customer_alimtalk_failed',
          JSON.stringify({
            inquiryId: row.id,
            inquiryType: row.inquiryType,
            customerLmsOk: customerNotify.customerLmsOk,
          }),
        )
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
        productId: row.productId,
        snapshotOriginUrl: row.snapshotOriginUrl,
      })
      adminLmsSkipped = lmsAdmin.skipped
      adminLmsOk = !lmsAdmin.skipped && lmsAdmin.failed.length === 0 && lmsAdmin.succeeded.length > 0
      adminLmsFailedCount = lmsAdmin.failed.length
      if (lmsAdmin.failed.length > 0) {
        console.error(
          '[POST /api/inquiries] inquiry_admin_lms_failed',
          JSON.stringify({
            inquiryId: row.id,
            succeeded: lmsAdmin.succeeded,
            failed: lmsAdmin.failed,
          }),
        )
      }
    }

    await prisma.customerInquiry.update({
      where: { id: row.id },
      data: emailOk
        ? { emailSentAt: new Date(), emailSentStatus: 'sent', emailError: null }
        : {
            emailSentAt: null,
            emailSentStatus: 'failed',
            emailError: notificationMode === 'booking_aligned' ? 'booking_aligned_email_failed' : 'smtp_failed',
          },
    })

    const payload = {
      ok: true,
      persisted: true as const,
      inquiry: {
        id: row.id,
        inquiryNumber: row.inquiryNumber,
        inquiryType: row.inquiryType,
        status: row.status,
        leadTimeRisk: row.leadTimeRisk,
        createdAt: row.createdAt.toISOString(),
      },
      notification: {
        ok: emailOk && (adminLmsSkipped || adminLmsOk),
        delayed: !emailOk,
        mode: notificationMode,
        channels: {
          email: { ok: emailOk },
          adminLms: {
            skipped: adminLmsSkipped,
            ok: adminLmsOk,
            failedCount: adminLmsFailedCount,
          },
          customerAlimtalk: { ok: customerAlimtalkOk === true },
          customerLms: {
            skipped: customerLmsSkipped === true,
            ok: customerLmsOk === true,
          },
        },
      },
    }
    console.log(
      '[POST /api/inquiries] notify_done',
      JSON.stringify({
        inquiryId: row.id,
        inquiryNumber: row.inquiryNumber,
        inquiryType: row.inquiryType,
        mode: notificationMode,
        emailOk,
        adminLmsOk,
        adminLmsSkipped,
      }),
    )
    return jsonWithLeakGuard(payload, 'api.inquiries.ok')
  } catch (e) {
    console.error('[POST /api/inquiries]', e)
    return jsonWithLeakGuard(
      {
        ok: false,
        error: '문의 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        fieldErrors: {} as Record<string, string>,
      },
      'api.inquiries.catch',
      { status: 500 },
    )
  }
}
