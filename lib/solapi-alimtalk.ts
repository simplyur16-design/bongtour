import { SolapiMessageService } from 'solapi'
import { generateSmartLink } from '@/lib/link-builder'
import {
  buildInquiryCustomerAlimtalkVariables,
  resolveInquiryCustomerAlimtalkKind,
  selectInquiryCustomerAlimtalkTemplateId,
  type InquiryCustomerAlimtalkContext,
} from '@/lib/inquiry-customer-alimtalk'
import { parseInquiryPayloadJson } from '@/lib/inquiry-notification-format'
import { formatSolapiSendError, normalizeSolapiKakaoVariables } from '@/lib/solapi-kakao-variables'

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
    const generalTravelConsult =
      ctx.inquiryType === 'travel_consult' && payload.quoteKind !== 'private_custom'
    console.warn(
      generalTravelConsult
        ? '[solapi-alimtalk] inquiry_alimtalk_skipped_general_travel_consult'
        : '[solapi-alimtalk] inquiry_alimtalk_no_template_for_inquiry_type',
      JSON.stringify({ inquiryId: ctx.inquiryId, inquiryType: ctx.inquiryType }),
    )
    return { ok: false, shouldSendLmsFallback: true, detail: 'inquiry_alimtalk_no_registered_template' }
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

  const variables = normalizeSolapiKakaoVariables(
    buildInquiryCustomerAlimtalkVariables(kind, ctx),
  )

  try {
    const one = new SolapiMessageService(apiKey, apiSecret)
    await one.send({
      to,
      from,
      type: 'ATA',
      kakaoOptions: {
        pfId,
        templateId,
        variables,
        /** 실패 시 솔라피 자동 문자 + 앱 LMS 폴백 이중 발송 방지 — 폴백은 `sendInquiryCustomerLmsFallback` */
        disableSms: true,
      },
    })
    return { ok: true }
  } catch (e) {
    const msg = formatSolapiSendError(e)
    console.error(
      '[solapi-alimtalk] inquiry_alimtalk_send_failed',
      JSON.stringify({
        inquiryId: ctx.inquiryId,
        templateId,
        kind,
        variableKeys: Object.keys(variables),
        error: msg,
      }),
    )
    return { ok: false, shouldSendLmsFallback: true, detail: 'inquiry_alimtalk_send_error' }
  }
}

export type BookingRequestReceivedAlimtalkPayload = {
  customerPhone: string
  bookingNumber: string
  productTitle: string
  selectedDate: string
  paxSummary: string
}

export type BookingRequestReceivedAlimtalkResult =
  | { ok: true }
  | { ok: false; shouldSendLmsFallback: true; detail: string }

/**
 * 패키지 예약 신청 접수 고객 알림톡 — `SOLAPI_TPL_BOOKING_REQUEST_RECEIVED` env.
 * 미설정·발송 실패 시 LMS 폴백(`sendBookingRequestReceivedLmsFallback`).
 */
export async function sendBookingRequestReceivedAlimTalk(
  bookingId: number,
  payload: BookingRequestReceivedAlimtalkPayload
): Promise<BookingRequestReceivedAlimtalkResult> {
  const apiKey = process.env.SOLAPI_API_KEY?.trim()
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim()
  const pfId = process.env.SOLAPI_PFID?.trim()
  const senderRaw = process.env.SOLAPI_FROM_PHONE?.trim()
  const templateId = process.env.SOLAPI_TPL_BOOKING_REQUEST_RECEIVED?.trim()

  if (!apiKey || !apiSecret || !pfId || !senderRaw) {
    console.error(
      '[solapi-alimtalk] booking_request_alimtalk_skipped_env',
      JSON.stringify({
        bookingId,
        hasKey: Boolean(apiKey),
        hasSecret: Boolean(apiSecret),
        hasPfId: Boolean(pfId),
        hasFromPhone: Boolean(senderRaw),
      })
    )
    return { ok: false, shouldSendLmsFallback: true, detail: 'booking_request_alimtalk_missing_env' }
  }

  if (!templateId) {
    console.error(
      '[solapi-alimtalk] booking_request_alimtalk_missing_template',
      JSON.stringify({ bookingId })
    )
    return { ok: false, shouldSendLmsFallback: true, detail: 'booking_request_alimtalk_missing_template_env' }
  }

  const to = payload.customerPhone.replace(/\D/g, '')
  if (to.length < 10) {
    return { ok: false, shouldSendLmsFallback: true, detail: 'booking_request_alimtalk_invalid_phone' }
  }

  const from = senderRaw.replace(/\D/g, '')
  if (!from) {
    return { ok: false, shouldSendLmsFallback: true, detail: 'booking_request_alimtalk_invalid_sender' }
  }

  const variables = normalizeSolapiKakaoVariables({
    bookingNumber: payload.bookingNumber.trim() || '신청번호 미확인',
    productTitle: payload.productTitle.trim() || '상품명 미확인',
    selectedDate: payload.selectedDate.trim() || '출발일 미확인',
    paxSummary: payload.paxSummary.trim() || '인원 미확인',
  })

  try {
    const one = new SolapiMessageService(apiKey, apiSecret)
    await one.send({
      to,
      from,
      type: 'ATA',
      kakaoOptions: {
        pfId,
        templateId,
        variables,
        disableSms: true,
      },
    })
    return { ok: true }
  } catch (e) {
    const msg = formatSolapiSendError(e)
    console.error(
      '[solapi-alimtalk] booking_request_alimtalk_send_failed',
      JSON.stringify({
        bookingId,
        templateId,
        variableKeys: Object.keys(variables),
        error: msg,
      }),
    )
    return { ok: false, shouldSendLmsFallback: true, detail: 'booking_request_alimtalk_send_error' }
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
  const pfId = process.env.SOLAPI_PFID?.trim()
  const fromRaw = process.env.SOLAPI_FROM_PHONE?.trim()
  if (!apiKey || !apiSecret || !pfId || !fromRaw) {
    console.error(
      '[solapi-alimtalk] sendAlimtalkWithDetail missing env',
      JSON.stringify({
        hasKey: Boolean(apiKey),
        hasSecret: Boolean(apiSecret),
        hasPfId: Boolean(pfId),
        hasFromPhone: Boolean(fromRaw),
      })
    )
    throw new Error('solapi_credentials_or_from_phone_missing')
  }

  const fromDigits = fromRaw.replace(/\D/g, '')
  const toDigits = phone.replace(/\D/g, '')
  const plusFriendLink = 'kakaoplus://plusfriend/talk/@봉투어'

  const one = new SolapiMessageService(apiKey, apiSecret)
  return await one.send({
    to: toDigits,
    from: fromDigits,
    type: 'ATA',
    text: `[Bong투어] ${agency}/${code}/${title}\n- 날짜: ${date}\n- 인원: ${composition}\n- 견적: ${totalKrw}+${totalForeign}`,
    kakaoOptions: {
      pfId,
      templateId: 'BONGTOUR_QUOTATION_01',
      buttons: [
        {
          buttonName: '상세 일정 및 현지 사진 보기',
          buttonType: 'WL',
          linkMo: generateSmartLink(productId),
          linkPc: generateSmartLink(productId),
        },
        {
          buttonName: '사장님과 직접 상담하기',
          buttonType: 'AL',
          linkAnd: plusFriendLink,
          linkIos: plusFriendLink,
        },
      ],
    },
  })
}
