import { SolapiMessageService } from 'solapi'
import { generateSmartLink } from '@/lib/link-builder'
import {
  buildInquiryCustomerAlimtalkVariables,
  resolveInquiryCustomerAlimtalkKind,
  selectInquiryCustomerAlimtalkTemplateId,
  type InquiryCustomerAlimtalkContext,
} from '@/lib/inquiry-customer-alimtalk'
import { parseInquiryPayloadJson } from '@/lib/inquiry-notification-format'

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
 * 문의 접수 고객 알림톡 — `SOLAPI_API_KEY`/`SOLAPI_API_SECRET`(SDK) + `SOLAPI_PFID` + `SOLAPI_FROM_PHONE`.
 * 템플릿 ID는 `SOLAPI_TPL_*` env. 미설정·미등록·발송 실패 시 LMS 폴백.
 */
export async function attemptSendCustomerInquiryAlimTalk(
  ctx: InquiryCustomerAlimtalkContext
): Promise<CustomerInquiryAlimtalkAttemptResult> {
  const apiKey = process.env.SOLAPI_API_KEY?.trim()
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim()
  const pfId = process.env.SOLAPI_PFID?.trim()
  const senderRaw = process.env.SOLAPI_FROM_PHONE?.trim()

  if (!apiKey || !apiSecret || !pfId || !senderRaw) {
    console.error(
      '[solapi-alimtalk] inquiry_alimtalk_skipped_env',
      JSON.stringify({
        inquiryId: ctx.inquiryId,
        hasKey: Boolean(apiKey),
        hasSecret: Boolean(apiSecret),
        hasPfId: Boolean(pfId),
        hasFromPhone: Boolean(senderRaw),
      })
    )
    return { ok: false, shouldSendLmsFallback: true, detail: 'inquiry_alimtalk_missing_env' }
  }

  const payload = parseInquiryPayloadJson(ctx.payloadJson)
  const kind = resolveInquiryCustomerAlimtalkKind(ctx.inquiryType, payload)
  if (!kind) {
    console.error(
      '[solapi-alimtalk] inquiry_alimtalk_unknown_branch',
      JSON.stringify({ inquiryId: ctx.inquiryId, inquiryType: ctx.inquiryType })
    )
    return { ok: false, shouldSendLmsFallback: true, detail: 'inquiry_alimtalk_unknown_branch' }
  }

  const templateId = selectInquiryCustomerAlimtalkTemplateId(ctx.inquiryType, payload)
  if (!templateId) {
    return { ok: false, shouldSendLmsFallback: true, detail: 'inquiry_alimtalk_missing_template_env' }
  }

  const to = ctx.applicantPhone.replace(/\D/g, '')
  if (to.length < 10) {
    return { ok: false, shouldSendLmsFallback: true, detail: 'inquiry_alimtalk_invalid_phone' }
  }

  const from = senderRaw.replace(/\D/g, '')
  if (!from) {
    return { ok: false, shouldSendLmsFallback: true, detail: 'inquiry_alimtalk_invalid_sender' }
  }

  const variables = buildInquiryCustomerAlimtalkVariables(kind, ctx)

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

  const apiKey = process.env.SOLAPI_API_KEY?.trim()
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim()
  const fromRaw = process.env.SOLAPI_FROM_PHONE?.trim()
  if (!apiKey || !apiSecret || !fromRaw) {
    console.error(
      '[solapi-alimtalk] sendAlimtalkWithDetail missing env',
      JSON.stringify({
        hasKey: Boolean(apiKey),
        hasSecret: Boolean(apiSecret),
        hasFromPhone: Boolean(fromRaw),
      })
    )
    throw new Error('solapi_credentials_or_from_phone_missing')
  }

  const fromDigits = fromRaw.replace(/\D/g, '')
  const message = {
    to: phone,
    from: fromDigits,
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

  const one = new SolapiMessageService(apiKey, apiSecret)
  return await one.sendOne(message)
}
