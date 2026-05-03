import { computeLeadTimeRisk } from '@/lib/inquiry-lead-time-risk'
import { optionalEmailFormatError } from '@/lib/email-format'

/**
 * Prisma `CustomerInquiry.inquiryType` — 공개 POST `/api/inquiries` 허용값(SSOT).
 * URL `?type=` → 이 배열 값: `lib/inquiry-page.ts` 의 `inquiryKindToApiType` 과 반드시 일치.
 */
export const CUSTOMER_INQUIRY_TYPES = [
  'travel_consult',
  'institution_request',
  'overseas_training_quote',
  'bus_quote',
] as const

export type CustomerInquiryType = (typeof CUSTOMER_INQUIRY_TYPES)[number]

const MAX_NAME = 120
const PRODUCTION_NAME_MAX = 30
const PRODUCTION_NAME_REGEX = /^[가-힣a-zA-Z\s]{2,30}$/
const MAX_PHONE = 40
const MAX_EMAIL = 254
const MAX_MESSAGE = 8000
const MAX_SNAPSHOT = 500
const MAX_SOURCE_PATH = 2000
const MAX_PAYLOAD_JSON_CHARS = 32000
const MIN_PRIVATE_MESSAGE = 10

const CONTACT_CHANNELS = ['email', 'kakao', 'both'] as const

export type FieldErrors = Record<string, string>

export type ValidatedInquiryCreate = {
  inquiryType: CustomerInquiryType
  applicantName: string
  applicantPhone: string
  applicantEmail: string | null
  message: string | null
  productId: string | null
  monthlyCurationItemId: string | null
  snapshotProductTitle: string | null
  snapshotCardLabel: string | null
  sourcePagePath: string | null
  privacyAgreed: true
  privacyNoticeConfirmedAt: Date
  privacyNoticeVersion: string
  preferredContactChannel: 'email' | 'kakao' | 'both'
  /** DB에 JSON.stringify 해서 저장 */
  payloadJson: string | null
  payloadObject: Record<string, unknown> | null
  leadTimeRisk: ReturnType<typeof computeLeadTimeRisk>
}

function optionalTrimmedString(v: unknown, max: number, field: string): { ok: true; value: string | null } | { ok: false; err: string } {
  if (v == null || v === '') return { ok: true, value: null }
  if (typeof v !== 'string') return { ok: false, err: `${field}는 문자열이어야 합니다.` }
  const t = v.trim()
  if (!t) return { ok: true, value: null }
  if (t.length > max) return { ok: false, err: `${field}는 최대 ${max}자까지 입력할 수 있습니다.` }
  return { ok: true, value: t }
}

function optionalId(v: unknown, field: string): { ok: true; value: string | null } | { ok: false; err: string } {
  if (v == null || v === '') return { ok: true, value: null }
  if (typeof v === 'string') {
    const t = v.trim()
    return { ok: true, value: t || null }
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return { ok: true, value: String(v) }
  }
  return { ok: false, err: `${field} 형식이 올바르지 않습니다.` }
}

function normalizeKoreanTelDigits(input: string): string {
  let d = input.replace(/\D/g, '')
  if (d.startsWith('82')) d = `0${d.slice(2)}`
  return d
}

/** 한국 휴대(01x)·지역(02·0xx) 번호로 보이는지(운영 규격). */
function isValidKoreanInquiryPhone(raw: string): boolean {
  const d = normalizeKoreanTelDigits(raw)
  if (d.length < 9 || d.length > 11) return false
  if (/^01[0-9]\d{7,8}$/.test(d)) return true
  if (/^02\d{7,8}$/.test(d)) return true
  if (/^0[3-6][0-9]\d{7,9}$/.test(d)) return true
  if (/^0[7-9][0-9]\d{7,9}$/.test(d)) return true
  if (/^070\d{8}$/.test(d)) return true
  return false
}

function isLikelyGmailDotTrickEmail(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at < 1) return false
  const local = email.slice(0, at)
  const domain = email.slice(at + 1).toLowerCase()
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return false
  const dots = (local.match(/\./g) ?? []).length
  if (dots >= 7) return true
  if (local.length > 0 && dots / local.length >= 0.3) return true
  return false
}

function hasHangul(s: string): boolean {
  return /[가-힣]/.test(s)
}

function isAsciiLettersAndSpacesOnly(s: string): boolean {
  return /^[a-zA-Z\s]+$/.test(s)
}

function payloadStringField(obj: Record<string, unknown> | null, key: string): string {
  if (!obj) return ''
  const v = obj[key]
  return typeof v === 'string' ? v.trim() : ''
}

export type ValidateCustomerInquiryOptions = {
  productionInquiryRules?: boolean
}

export type ValidateCustomerInquiryBodyResult =
  | { ok: true; value: ValidatedInquiryCreate }
  | { ok: false; error: string; fieldErrors: FieldErrors }
  | { ok: 'silent_bot' }

/**
 * 공개 POST /api/inquiries 본문 검증 (라이브러리 무거운 도입 없음).
 */
export function validateCustomerInquiryBody(
  raw: unknown,
  options?: ValidateCustomerInquiryOptions
): ValidateCustomerInquiryBodyResult {
  const productionInquiryRules = Boolean(options?.productionInquiryRules)
  const fieldErrors: FieldErrors = {}

  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: '요청 본문이 올바른 JSON 객체가 아닙니다.', fieldErrors: {} }
  }
  const body = raw as Record<string, unknown>
  const preferredContactChannelRaw =
    typeof body.preferredContactChannel === 'string' ? body.preferredContactChannel.trim().toLowerCase() : ''
  /** UI에서 생략 시(여행·기관 문의 등): 전화 중심 운영 — 카카오 안내 노출용 기본값 */
  let preferredContactChannel: 'email' | 'kakao' | 'both' = 'kakao'
  if (
    CONTACT_CHANNELS.includes(preferredContactChannelRaw as (typeof CONTACT_CHANNELS)[number])
  ) {
    preferredContactChannel = preferredContactChannelRaw as 'email' | 'kakao' | 'both'
  }

  const inquiryTypeRaw = body.inquiryType
  if (typeof inquiryTypeRaw !== 'string' || !CUSTOMER_INQUIRY_TYPES.includes(inquiryTypeRaw as CustomerInquiryType)) {
    fieldErrors.inquiryType = '문의 유형이 올바르지 않습니다.'
  }

  const nameMax = productionInquiryRules ? PRODUCTION_NAME_MAX : MAX_NAME
  const nameR = optionalTrimmedString(body.applicantName, nameMax, 'applicantName')
  if (!nameR.ok) fieldErrors.applicantName = nameR.err
  else if (!nameR.value) fieldErrors.applicantName = '이름을 입력해 주세요.'
  else if (productionInquiryRules) {
    if (nameR.value.length < 2 || !PRODUCTION_NAME_REGEX.test(nameR.value)) {
      fieldErrors.applicantName = '이름은 2~30자 한글·영문·공백만 입력해 주세요.'
    }
  }

  const phoneR = optionalTrimmedString(body.applicantPhone, MAX_PHONE, 'applicantPhone')
  if (!phoneR.ok) fieldErrors.applicantPhone = phoneR.err
  else if (!phoneR.value) fieldErrors.applicantPhone = '연락처를 입력해 주세요.'
  else if (phoneR.value.replace(/[\d\-+\s()]/g, '').length > 0) {
    fieldErrors.applicantPhone = '연락처 형식을 확인해 주세요.'
  } else if (phoneR.value.replace(/\D/g, '').length < 8) {
    fieldErrors.applicantPhone = '연락처가 너무 짧습니다.'
  } else if (productionInquiryRules && !isValidKoreanInquiryPhone(phoneR.value)) {
    fieldErrors.applicantPhone = '휴대폰 또는 유선 전화 형식을 확인해 주세요.'
  }

  const emailR = optionalTrimmedString(body.applicantEmail, MAX_EMAIL, 'applicantEmail')
  if (!emailR.ok) fieldErrors.applicantEmail = emailR.err
  else if (emailR.value) {
    const fe = optionalEmailFormatError(emailR.value)
    if (fe) fieldErrors.applicantEmail = fe
  }

  const messageR = optionalTrimmedString(body.message, MAX_MESSAGE, 'message')
  if (!messageR.ok) fieldErrors.message = messageR.err

  const snapTitleR = optionalTrimmedString(body.snapshotProductTitle, MAX_SNAPSHOT, 'snapshotProductTitle')
  if (!snapTitleR.ok) fieldErrors.snapshotProductTitle = snapTitleR.err
  const snapCardR = optionalTrimmedString(body.snapshotCardLabel, MAX_SNAPSHOT, 'snapshotCardLabel')
  if (!snapCardR.ok) fieldErrors.snapshotCardLabel = snapCardR.err
  const pathR = optionalTrimmedString(body.sourcePagePath, MAX_SOURCE_PATH, 'sourcePagePath')
  if (!pathR.ok) fieldErrors.sourcePagePath = pathR.err
  const privacyVersionR = optionalTrimmedString(body.privacyNoticeVersion, 120, 'privacyNoticeVersion')
  if (!privacyVersionR.ok) fieldErrors.privacyNoticeVersion = privacyVersionR.err
  const privacyConfirmedAtRaw =
    typeof body.privacyNoticeConfirmedAt === 'string' ? body.privacyNoticeConfirmedAt.trim() : ''
  const privacyConfirmedAt = privacyConfirmedAtRaw ? new Date(privacyConfirmedAtRaw) : null
  if (!privacyConfirmedAt || Number.isNaN(privacyConfirmedAt.getTime())) {
    fieldErrors.privacyNoticeConfirmedAt = '개인정보 안내 확인 시각이 필요합니다.'
  }
  if (!privacyVersionR.ok || !privacyVersionR.value) {
    fieldErrors.privacyNoticeVersion = '개인정보 안내 버전이 필요합니다.'
  }

  const pidR = optionalId(body.productId, 'productId')
  if (!pidR.ok) fieldErrors.productId = pidR.err
  const curR = optionalId(body.monthlyCurationItemId, 'monthlyCurationItemId')
  if (!curR.ok) fieldErrors.monthlyCurationItemId = curR.err

  if (body.privacyAgreed !== true) {
    fieldErrors.privacyAgreed = '개인정보 처리 동의가 필요합니다.'
  }

  let payloadObject: Record<string, unknown> | null = null
  const pj = body.payloadJson
  if (pj === undefined || pj === null) {
    payloadObject = null
  } else if (typeof pj === 'object' && !Array.isArray(pj)) {
    payloadObject = pj as Record<string, unknown>
  } else {
    fieldErrors.payloadJson = 'payloadJson은 객체이거나 생략해야 합니다.'
  }

  let payloadJson: string | null = null
  if (payloadObject != null) {
    try {
      payloadJson = JSON.stringify(payloadObject)
      if (payloadJson.length > MAX_PAYLOAD_JSON_CHARS) {
        fieldErrors.payloadJson = `payloadJson 직렬화 길이는 최대 ${MAX_PAYLOAD_JSON_CHARS}자까지 허용됩니다.`
      }
    } catch {
      fieldErrors.payloadJson = 'payloadJson을 직렬화할 수 없습니다.'
    }
  }

  const quoteKind = typeof payloadObject?.quoteKind === 'string' ? payloadObject.quoteKind : null
  if (quoteKind === 'private_custom') {
    const destinationSummary = typeof payloadObject?.destinationSummary === 'string'
      ? payloadObject.destinationSummary.trim()
      : ''
    if (!destinationSummary) {
      fieldErrors.destinationSummary = '희망 여행지 또는 국가/도시를 입력해 주세요.'
    }

    const departureDate =
      typeof payloadObject?.preferredDepartureDate === 'string'
        ? payloadObject.preferredDepartureDate.trim()
        : ''
    const departureMonth =
      typeof payloadObject?.preferredDepartureMonth === 'string'
        ? payloadObject.preferredDepartureMonth.trim()
        : ''
    if (!departureDate && !departureMonth) {
      fieldErrors.departureDateOrMonth = '출발 희망일 또는 출발 희망월 중 하나를 입력해 주세요.'
    }
    if (departureMonth && !/^\d{4}-\d{2}$/.test(departureMonth)) {
      fieldErrors.preferredDepartureMonth = '출발 희망월은 YYYY-MM 형식이어야 합니다.'
    }

    const hc = payloadObject?.headcount
    if (typeof hc !== 'number' || !Number.isInteger(hc) || hc < 1) {
      fieldErrors.headcount = '인원은 1명 이상의 숫자로 입력해 주세요.'
    }

    if (!messageR.ok || !messageR.value || messageR.value.trim().length < MIN_PRIVATE_MESSAGE) {
      fieldErrors.message = `문의 내용은 최소 ${MIN_PRIVATE_MESSAGE}자 이상 입력해 주세요.`
    }
  }

  if (inquiryTypeRaw === 'overseas_training_quote') {
    const serviceScope = typeof payloadObject?.serviceScope === 'string' ? payloadObject.serviceScope.trim() : ''
    if (!serviceScope) {
      fieldErrors.serviceScope = '필요한 서비스를 선택해 주세요.'
    }

    if (!emailR.ok) {
      fieldErrors.applicantEmail = emailR.err
    } else if (!emailR.value) {
      fieldErrors.applicantEmail = '이메일을 입력해 주세요.'
    } else {
      const fe = optionalEmailFormatError(emailR.value)
      if (fe) fieldErrors.applicantEmail = fe
    }

    const departureMonth =
      typeof payloadObject?.preferredDepartureMonth === 'string'
        ? payloadObject.preferredDepartureMonth.trim()
        : ''
    if (departureMonth && !/^\d{4}-\d{2}$/.test(departureMonth)) {
      fieldErrors.preferredDepartureMonth = '출발 희망월은 YYYY-MM 형식이어야 합니다.'
    }

    if (!messageR.ok || !messageR.value || messageR.value.trim().length < MIN_PRIVATE_MESSAGE) {
      fieldErrors.message = `문의 내용은 최소 ${MIN_PRIVATE_MESSAGE}자 이상 입력해 주세요.`
    }
  }

  if (inquiryTypeRaw === 'bus_quote') {
    const hc = payloadObject?.estimatedHeadcount
    if (typeof hc !== 'number' || !Number.isInteger(hc) || hc < 1) {
      fieldErrors.estimatedHeadcount = '예상 인원은 1명 이상의 숫자로 입력해 주세요.'
    }

    if (!emailR.ok) {
      fieldErrors.applicantEmail = emailR.err
    } else if (!emailR.value) {
      fieldErrors.applicantEmail = '이메일을 입력해 주세요.'
    } else {
      const fe = optionalEmailFormatError(emailR.value)
      if (fe) fieldErrors.applicantEmail = fe
    }

    const targetYearMonth =
      typeof payloadObject?.targetYearMonth === 'string' ? payloadObject.targetYearMonth.trim() : ''
    if (targetYearMonth && !/^\d{4}-\d{2}$/.test(targetYearMonth)) {
      fieldErrors.targetYearMonth = '이용 희망 월은 YYYY-MM 형식이어야 합니다.'
    }

    if (!messageR.ok || !messageR.value || messageR.value.trim().length < MIN_PRIVATE_MESSAGE) {
      fieldErrors.message = `문의 내용은 최소 ${MIN_PRIVATE_MESSAGE}자 이상 입력해 주세요.`
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    const first = Object.values(fieldErrors)[0] ?? '입력값을 확인해 주세요.'
    return { ok: false, error: first, fieldErrors }
  }

  if (productionInquiryRules) {
    const nm = nameR.ok && nameR.value ? nameR.value : ''
    const nameLettersOnlyLen = nm.replace(/\s/g, '').length
    if (nm && isAsciiLettersAndSpacesOnly(nm) && !hasHangul(nm) && nameLettersOnlyLen >= 12) {
      return { ok: 'silent_bot' }
    }

    const em = emailR.ok ? emailR.value : null
    if (em && isLikelyGmailDotTrickEmail(em)) {
      return { ok: 'silent_bot' }
    }

    const msgTrim = messageR.ok && messageR.value ? messageR.value.trim() : ''
    if (msgTrim.length > 0 && !hasHangul(msgTrim)) {
      return { ok: 'silent_bot' }
    }

    if (quoteKind === 'private_custom') {
      const dest =
        typeof payloadObject?.destinationSummary === 'string' ? payloadObject.destinationSummary.trim() : ''
      if (dest.length > 0 && !hasHangul(dest)) {
        return { ok: 'silent_bot' }
      }
    }

    if (inquiryTypeRaw === 'bus_quote' && payloadObject) {
      for (const key of ['departurePlace', 'arrivalPlace', 'viaPoints'] as const) {
        const t = payloadStringField(payloadObject, key)
        if (t.length > 0 && !hasHangul(t)) return { ok: 'silent_bot' }
      }
    }
  }

  const inquiryType = inquiryTypeRaw as CustomerInquiryType
  const leadTimeRisk = computeLeadTimeRisk(payloadObject)

  const productAttach =
    inquiryType === 'travel_consult'
      ? {
          productId: pidR.ok ? pidR.value : null,
          monthlyCurationItemId: curR.ok ? curR.value : null,
          snapshotProductTitle: snapTitleR.ok ? snapTitleR.value : null,
          snapshotCardLabel: snapCardR.ok ? snapCardR.value : null,
        }
      : {
          productId: null,
          monthlyCurationItemId: null,
          snapshotProductTitle: null,
          snapshotCardLabel: null,
        }

  return {
    ok: true,
    value: {
      inquiryType,
      applicantName: nameR.ok && nameR.value ? nameR.value : '',
      applicantPhone: phoneR.ok && phoneR.value ? phoneR.value : '',
      applicantEmail: emailR.ok ? emailR.value : null,
      message: messageR.ok ? messageR.value : null,
      productId: productAttach.productId,
      monthlyCurationItemId: productAttach.monthlyCurationItemId,
      snapshotProductTitle: productAttach.snapshotProductTitle,
      snapshotCardLabel: productAttach.snapshotCardLabel,
      sourcePagePath: pathR.ok ? pathR.value : null,
      privacyAgreed: true,
      privacyNoticeConfirmedAt: privacyConfirmedAt as Date,
      privacyNoticeVersion: privacyVersionR.ok && privacyVersionR.value ? privacyVersionR.value : '',
      preferredContactChannel: preferredContactChannel as 'email' | 'kakao' | 'both',
      payloadJson,
      payloadObject,
      leadTimeRisk,
    },
  }
}
