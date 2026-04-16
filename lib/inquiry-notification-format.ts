import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'

/** POST /api/inquiries 이후 운영자 이메일 알림 공통 입력 */
export type InquiryNotifyInput = {
  inquiryId: string
  inquiryType: string
  applicantName: string
  applicantPhone: string
  applicantEmail: string | null
  message: string | null
  sourcePagePath: string | null
  createdAtIso: string
  payloadJson: string | null
  productId: string | null
  snapshotProductTitle: string | null
  snapshotCardLabel: string | null
  product: { title: string; originCode: string; originSource: string } | null
}

export function parseInquiryPayloadJson(json: string | null): Record<string, unknown> {
  if (!json) return {}
  try {
    const parsed = JSON.parse(json)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

export function inquiryPayloadField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? '예' : '아니오'
  return '-'
}

function pathLower(path: string | null | undefined): string {
  return (path ?? '').toLowerCase()
}

function hasTravelProductContext(input: InquiryNotifyInput): boolean {
  return Boolean(input.productId?.trim()) || Boolean(input.snapshotProductTitle?.trim())
}

/**
 * 운영자 알림 제목·본문 첫머리용 접두어(요구 스펙 7종 + 일반).
 * `inquiryType` + `payloadJson` + `sourcePagePath` + 상품 컨텍스트로만 판별(추측 없음).
 */
export function resolveInquiryAlertPrefix(input: InquiryNotifyInput): string {
  const payload = parseInquiryPayloadJson(input.payloadJson)
  const path = pathLower(input.sourcePagePath)

  if (input.inquiryType === 'overseas_training_quote') return '[국외연수 문의]'
  if (input.inquiryType === 'bus_quote') return '[전세버스 문의]'

  if (input.inquiryType === 'institution_request') {
    if (payload.interpreterNeeded === true) return '[통역 문의]'
    return '[일반 문의]'
  }

  if (input.inquiryType === 'travel_consult') {
    if (payload.quoteKind === 'private_custom') return '[우리여행 견적]'
    if (path.includes('air-ticketing')) return '[항공권 문의]'
    if (hasTravelProductContext(input)) return '[여행상품 문의]'
    return '[일반 문의]'
  }

  return '[일반 문의]'
}

export function adminBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BONGTOUR_API_BASE?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    ''
  return base.replace(/\/$/, '')
}

export function travelProductDisplayTitle(input: InquiryNotifyInput): string {
  const t = input.product?.title?.trim() || input.snapshotProductTitle?.trim() || ''
  return t || '(상품명 없음)'
}

/** 공급사 상품코드 우선 → payload 힌트 → 내부 productId 폴백 */
export function travelProductDisplayCode(input: InquiryNotifyInput): string {
  const code = input.product?.originCode?.trim()
  if (code) return code
  const payload = parseInquiryPayloadJson(input.payloadJson)
  for (const key of ['originCode', 'listingProductNumber', 'supplierProductCode'] as const) {
    const v = inquiryPayloadField(payload, key)
    if (v !== '-') return v.slice(0, 80)
  }
  if (input.productId?.trim()) return `id:${input.productId.trim()}`
  return '(상품번호 없음)'
}

export function travelProductDisplaySupplier(input: InquiryNotifyInput): string {
  const raw = input.product?.originSource?.trim()
  if (raw) return formatOriginSourceForDisplay(raw) || raw
  const payload = parseInquiryPayloadJson(input.payloadJson)
  const hint = inquiryPayloadField(payload, 'originSource')
  if (hint !== '-') return formatOriginSourceForDisplay(hint) || hint
  return '-'
}

export function travelDepartureOrSchedule(payload: Record<string, unknown>): string {
  const d = inquiryPayloadField(payload, 'preferredDepartureDate')
  const m = inquiryPayloadField(payload, 'preferredDepartureMonth')
  const ym = inquiryPayloadField(payload, 'targetYearMonth')
  if (d !== '-') return d
  if (m !== '-') return m
  if (ym !== '-') return ym
  return '-'
}

export function travelPaxSummary(payload: Record<string, unknown>): string {
  const a = inquiryPayloadField(payload, 'adultCount')
  const c = inquiryPayloadField(payload, 'childCount')
  const i = inquiryPayloadField(payload, 'infantCount')
  const h = inquiryPayloadField(payload, 'headcount')
  if (h !== '-') return `인원(명시): ${h}`
  if (a !== '-' || c !== '-' || i !== '-') {
    return `성인 ${a} / 아동 ${c} / 유아 ${i}`
  }
  return '-'
}

export function buildInquiryEmailSubject(input: InquiryNotifyInput, prefix: string): string {
  const name = input.applicantName.trim() || '고객'
  const payload = parseInquiryPayloadJson(input.payloadJson)

  if (prefix === '[여행상품 문의]') {
    const supplier = travelProductDisplaySupplier(input)
    const title = travelProductDisplayTitle(input).slice(0, 56)
    const code = travelProductDisplayCode(input)
    return `${prefix} ${supplier} / ${title} / 상품번호 ${code} / ${name}`
  }
  if (prefix === '[우리여행 견적]') {
    const dest = inquiryPayloadField(payload, 'destinationSummary').slice(0, 36) || '지역미입력'
    return `${prefix} ${dest} / ${name}`
  }
  if (prefix === '[전세버스 문의]') {
    const dep = inquiryPayloadField(payload, 'departurePlace').slice(0, 16)
    const arr = inquiryPayloadField(payload, 'arrivalPlace').slice(0, 16)
    const when = inquiryPayloadField(payload, 'useDate') !== '-' ? inquiryPayloadField(payload, 'useDate') : inquiryPayloadField(payload, 'targetYearMonth')
    return `${prefix} ${when} / ${dep}→${arr} / ${name}`
  }
  if (prefix === '[통역 문의]') {
    const city = inquiryPayloadField(payload, 'preferredCountryCity').slice(0, 28)
    return `${prefix} ${city} / ${name}`
  }
  if (prefix === '[국외연수 문의]') {
    const org = inquiryPayloadField(payload, 'organizationName').slice(0, 28)
    const dest = inquiryPayloadField(payload, 'destinationSummary').slice(0, 24)
    return `${prefix} ${org} / ${dest} / ${name}`
  }
  if (prefix === '[항공권 문의]') {
    const region = inquiryPayloadField(payload, 'preferredRegion').slice(0, 28)
    return `${prefix} ${region} / ${name}`
  }
  return `${prefix} ${name}`
}

/** 이메일 본문 상단 — 유형별 핵심 필드 */
export function buildInquiryEmailSummaryBlock(input: InquiryNotifyInput, prefix: string): string {
  const payload = parseInquiryPayloadJson(input.payloadJson)
  const base = adminBaseUrl()
  const adminInquiries = base ? `${base}/admin/inquiries` : '/admin/inquiries'
  const adminProduct =
    input.productId && base ? `${base}/admin/products/${encodeURIComponent(input.productId.trim())}` : null
  const publicProduct =
    input.productId && base ? `${base}/products/${encodeURIComponent(input.productId.trim())}` : null

  const lines: string[] = [
    '━━━━━━━━━━━━━━━━',
    '■ 접수 요약 (운영)',
    `문의유형: ${prefix.replace(/^\[|\]$/g, '')}`,
    `접수번호: ${input.inquiryId}`,
    `신청자: ${input.applicantName} / ${input.applicantPhone} / ${input.applicantEmail ?? '-'}`,
    `접수시각: ${input.createdAtIso}`,
    `관리 목록: ${adminInquiries}`,
  ]

  if (prefix === '[여행상품 문의]') {
    lines.push(
      `상품명: ${travelProductDisplayTitle(input)}`,
      `상품번호(공급사코드): ${travelProductDisplayCode(input)}`,
      `공급사: ${travelProductDisplaySupplier(input)}`,
      `출발·일정: ${travelDepartureOrSchedule(payload)}`,
      `인원: ${travelPaxSummary(payload)}`
    )
    if (adminProduct) lines.push(`관리 상품: ${adminProduct}`)
    if (publicProduct) lines.push(`상품 페이지: ${publicProduct}`)
    if (input.snapshotCardLabel?.trim()) lines.push(`카드스냅샷: ${input.snapshotCardLabel.trim()}`)
  } else if (prefix === '[우리여행 견적]') {
    lines.push(
      `희망지역/국가: ${inquiryPayloadField(payload, 'destinationSummary')}`,
      `일정: ${travelDepartureOrSchedule(payload)}`,
      `인원: ${travelPaxSummary(payload)}`,
      `권역: ${inquiryPayloadField(payload, 'travelRegion')}`,
      `예산·비고: ${inquiryPayloadField(payload, 'budgetNote')}`
    )
  } else if (prefix === '[전세버스 문의]') {
    lines.push(
      `이용목적: ${inquiryPayloadField(payload, 'usageType')}`,
      `이용일: ${inquiryPayloadField(payload, 'useDate') !== '-' ? inquiryPayloadField(payload, 'useDate') : inquiryPayloadField(payload, 'targetYearMonth')}`,
      `출발지: ${inquiryPayloadField(payload, 'departurePlace')}`,
      `도착지: ${inquiryPayloadField(payload, 'arrivalPlace')}`,
      `경유: ${inquiryPayloadField(payload, 'viaPoints')}`,
      `인원: ${inquiryPayloadField(payload, 'estimatedHeadcount')}`,
      `차량희망: ${inquiryPayloadField(payload, 'vehicleClassPreference')}`
    )
  } else if (prefix === '[통역 문의]') {
    lines.push(
      `기관명: ${inquiryPayloadField(payload, 'organizationName')}`,
      `희망 국가·도시: ${inquiryPayloadField(payload, 'preferredCountryCity')}`,
      `방문분야: ${inquiryPayloadField(payload, 'visitField')}`,
      `희망 시기: ${inquiryPayloadField(payload, 'preferredTiming')}`,
      `인원: ${inquiryPayloadField(payload, 'estimatedHeadcount')}`
    )
  } else if (prefix === '[국외연수 문의]') {
    lines.push(
      `기관명: ${inquiryPayloadField(payload, 'organizationName')}`,
      `목적지: ${inquiryPayloadField(payload, 'destinationSummary')}`,
      `일정: ${travelDepartureOrSchedule(payload)}`,
      `인원: ${inquiryPayloadField(payload, 'headcount')}`,
      `서비스범위: ${inquiryPayloadField(payload, 'serviceScope')}`,
      `연수목적: ${inquiryPayloadField(payload, 'trainingPurpose')}`
    )
  } else if (prefix === '[항공권 문의]') {
    lines.push(
      `희망지역: ${inquiryPayloadField(payload, 'preferredRegion')}`,
      `희망월: ${inquiryPayloadField(payload, 'targetYearMonth')}`,
      `인원: ${travelPaxSummary(payload)}`
    )
  } else {
    lines.push(`유입경로: ${input.sourcePagePath ?? '-'}`)
  }

  lines.push('━━━━━━━━━━━━━━━━', '')
  return lines.join('\n')
}
