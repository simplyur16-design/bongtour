import { SolapiMessageService } from 'solapi'
import { generateSmartLink } from '@/lib/link-builder'
import {
  buildInquiryCustomerAlimtalkVariables,
  selectInquiryCustomerAlimtalkTemplateId,
  type InquiryCustomerAlimtalkContext,
} from '@/lib/inquiry-customer-alimtalk'
import { parseInquiryPayloadJson } from '@/lib/inquiry-notification-format'

const sdk = new SolapiMessageService(
  process.env.SOLAPI_KEY!,
  process.env.SOLAPI_SECRET!
)

export type AlimtalkCustomerData = {
  phone: string
  agency: string
  code: string
  title: string
  date: string
  composition: string
  totalKrw: string | number
  totalForeign: string
  productId: string
}

export type CustomerInquiryAlimtalkAttemptResult =
  | { ok: true }
  | { ok: false; shouldSendLmsFallback: true; detail: string }

/**
 * 문의 접수 고객 알림톡 — `SOLAPI_KEY`/`SOLAPI_SECRET`(SDK) + `SOLAPI_KAKAO_PF_ID` + `SOLAPI_SENDER`.
 * 템플릿 5종(`lib/inquiry-customer-alimtalk.ts`). 미설정·미등록·발송 실패 시 LMS 폴백.
 */
export async function attemptSendCustomerInquiryAlimTalk(
  ctx: InquiryCustomerAlimtalkContext
): Promise<CustomerInquiryAlimtalkAttemptResult> {
  const apiKey = process.env.SOLAPI_KEY?.trim()
  const apiSecret = process.env.SOLAPI_SECRET?.trim()
  const pfId = process.env.SOLAPI_KAKAO_PF_ID?.trim()
  const senderRaw = process.env.SOLAPI_SENDER?.trim()

  if (!apiKey || !apiSecret || !pfId || !senderRaw) {
    console.warn(
      '[solapi-alimtalk] inquiry_alimtalk_skipped_env',
      JSON.stringify({
        inquiryId: ctx.inquiryId,
        hasKey: Boolean(apiKey),
        hasSecret: Boolean(apiSecret),
        hasPfId: Boolean(pfId),
        hasSender: Boolean(senderRaw),
      })
    )
    return { ok: false, shouldSendLmsFallback: true, detail: 'inquiry_alimtalk_missing_env' }
  }

  const payload = parseInquiryPayloadJson(ctx.payloadJson)
  const templateId = selectInquiryCustomerAlimtalkTemplateId(ctx.inquiryType, payload)
  if (!templateId) {
    console.warn(
      '[solapi-alimtalk] inquiry_alimtalk_unknown_branch',
      JSON.stringify({ inquiryId: ctx.inquiryId, inquiryType: ctx.inquiryType })
    )
    return { ok: false, shouldSendLmsFallback: true, detail: 'inquiry_alimtalk_unknown_branch' }
  }

  const to = ctx.applicantPhone.replace(/\D/g, '')
  if (to.length < 10) {
    return { ok: false, shouldSendLmsFallback: true, detail: 'inquiry_alimtalk_invalid_phone' }
  }

  const from = senderRaw.replace(/\D/g, '')
  if (!from) {
    return { ok: false, shouldSendLmsFallback: true, detail: 'inquiry_alimtalk_invalid_sender' }
  }

  const variables = buildInquiryCustomerAlimtalkVariables(templateId, ctx)

  try {
    const one = new SolapiMessageService(apiKey, apiSecret)
    await one.sendOne({
      to,
      from,
      type: 'ATA',
      kakaoOptions: {
        pfId,
        templateId,
        variables,
      },
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(
      '[solapi-alimtalk] inquiry_alimtalk_send_failed',
      JSON.stringify({ inquiryId: ctx.inquiryId, templateId, error: msg })
    )
    return { ok: false, shouldSendLmsFallback: true, detail: 'inquiry_alimtalk_send_error' }
  }
}

export async function sendAlimtalkWithDetail(customerData: AlimtalkCustomerData) {
  const {
    phone,
    agency,
    code,
    title,
    date,
    composition,
    totalKrw,
    totalForeign,
    productId,
  } = customerData

  const message = {
    to: phone,
    from: process.env.SOLAPI_SENDER!,
    type: 'ATA' as const,
    templateId: 'BONGTOUR_QUOTATION_01',
    text: `[Bong투어] ${agency}/${code}/${title}\n- 날짜: ${date}\n- 인원: ${composition}\n- 견적: ${totalKrw}+${totalForeign}`,
    buttons: [
      {
        buttonName: '상세 일정 및 현지 사진 보기',
        buttonType: 'WL' as const,
        linkMo: generateSmartLink(productId),
        linkPc: generateSmartLink(productId),
      },
      {
        buttonName: '사장님과 직접 상담하기',
        buttonType: 'AL' as const,
        linkMo: 'kakaoplus://plusfriend/friend/@봉투어',
      },
    ],
  }

  return await sdk.sendOne(message)
}
