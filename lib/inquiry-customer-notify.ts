/**
 * 문의 접수 고객 알림 — 솔라피 알림톡 4종 + LMS 폴백 SSOT.
 */

import type { InquiryCustomerAlimtalkContext } from '@/lib/inquiry-customer-alimtalk'
import { resolveInquiryCustomerAlimtalkKind } from '@/lib/inquiry-customer-alimtalk'
import { parseInquiryPayloadJson } from '@/lib/inquiry-notification-format'
import { sendInquiryCustomerLmsFallback } from '@/lib/notification-service'
import { attemptSendCustomerInquiryAlimTalk } from '@/lib/solapi-alimtalk'

export type InquiryCustomerNotifyResult = {
  customerAlimtalkOk: boolean
  customerLmsOk: boolean
  customerLmsSkipped: boolean
  /** 등록 4종에 해당 없음(일반 travel_consult 등) */
  noRegisteredAlimtalkTemplate: boolean
}

export async function sendInquiryCustomerAlimtalkOrLms(
  ctx: InquiryCustomerAlimtalkContext,
): Promise<InquiryCustomerNotifyResult> {
  const payload = parseInquiryPayloadJson(ctx.payloadJson)
  const kind = resolveInquiryCustomerAlimtalkKind(ctx.inquiryType, payload)

  if (!kind) {
    const lms = await sendInquiryCustomerLmsFallback({
      inquiryId: ctx.inquiryId,
      inquiryType: ctx.inquiryType,
      productLabel: ctx.productLabel,
      applicantPhone: ctx.applicantPhone,
    })
    return {
      customerAlimtalkOk: false,
      customerLmsOk: lms.ok,
      customerLmsSkipped: false,
      noRegisteredAlimtalkTemplate: true,
    }
  }

  const alim = await attemptSendCustomerInquiryAlimTalk(ctx)
  if (alim.ok) {
    return {
      customerAlimtalkOk: true,
      customerLmsOk: false,
      customerLmsSkipped: true,
      noRegisteredAlimtalkTemplate: false,
    }
  }

  if (!alim.shouldSendLmsFallback) {
    return {
      customerAlimtalkOk: false,
      customerLmsOk: false,
      customerLmsSkipped: true,
      noRegisteredAlimtalkTemplate: false,
    }
  }

  const lms = await sendInquiryCustomerLmsFallback({
    inquiryId: ctx.inquiryId,
    inquiryType: ctx.inquiryType,
    productLabel: ctx.productLabel,
    applicantPhone: ctx.applicantPhone,
  })
  if (!lms.ok) {
    console.error(
      '[inquiry-customer-notify] customer_lms_failed',
      JSON.stringify({ inquiryId: ctx.inquiryId, inquiryType: ctx.inquiryType, alimDetail: alim.detail }),
    )
  } else {
    console.warn(
      '[inquiry-customer-notify] customer_alimtalk_failed_lms_sent',
      JSON.stringify({
        inquiryId: ctx.inquiryId,
        inquiryType: ctx.inquiryType,
        kind,
        alimDetail: alim.detail,
      }),
    )
  }

  return {
    customerAlimtalkOk: false,
    customerLmsOk: lms.ok,
    customerLmsSkipped: false,
    noRegisteredAlimtalkTemplate: false,
  }
}
