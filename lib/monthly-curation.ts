/** DB에서 카드로 투영할 최소 행 (findMany select와 동일 키) */
export type MonthlyCurationCardSource = {
  id: string
  yearMonth: string
  scope: string
  destinationName: string
  oneLineTheme: string
  whyNowText: string
  recommendedForText: string
  leadTimeLabel: string
  primaryInquiryType: string
  briefingSourceType: string
  linkedProductId: string | null
  sortOrder: number
}

/** 공개 API `scope` 쿼리 허용값 (DB `MonthlyCurationItem.scope`와 동일) */
export const CURATION_SCOPES = ['domestic', 'overseas'] as const
export type CurationScope = (typeof CURATION_SCOPES)[number]

const YM_RE = /^\d{4}-\d{2}$/

export function isCurationScope(s: string): s is CurationScope {
  return (CURATION_SCOPES as readonly string[]).includes(s)
}

/**
 * 쿼리 `scope` 파싱. 미지정 → undefined, 잘못된 값 → 'INVALID'
 */
export function parseScopeQuery(raw: string | null): CurationScope | undefined | 'INVALID' {
  if (raw == null || raw.trim() === '') return undefined
  const v = raw.trim()
  return isCurationScope(v) ? v : 'INVALID'
}

/**
 * 쿼리 `yearMonth` 파싱. 미지정 → undefined, 잘못된 값 → 'INVALID'
 */
export function parseYearMonthQuery(raw: string | null): string | undefined | 'INVALID' {
  if (raw == null || raw.trim() === '') return undefined
  const v = raw.trim()
  if (!YM_RE.test(v)) return 'INVALID'
  const month = Number(v.slice(5, 7))
  if (month < 1 || month > 12) return 'INVALID'
  return v
}

/** 관리자·검증용: 이미 트림된 `YYYY-MM` 문자열이면 true */
export function isValidYearMonth(s: string): boolean {
  if (!YM_RE.test(s)) return false
  const month = Number(s.slice(5, 7))
  return month >= 1 && month <= 12
}

/** `/inquiry?type=` 값 — P3 문의 페이지와 동일 */
export type InquiryPageKind = 'travel' | 'institution' | 'training' | 'bus'

/**
 * `CustomerInquiry` / 큐레이션의 `primaryInquiryType` → 문의 페이지 `type`
 */
export function primaryInquiryTypeToPageKind(primaryInquiryType: string): InquiryPageKind | null {
  switch (primaryInquiryType) {
    case 'travel_consult':
      return 'travel'
    case 'institution_request':
      return 'institution'
    case 'overseas_training_quote':
      return 'training'
    case 'bus_quote':
      return 'bus'
    default:
      return null
  }
}

/** 카드 배지용 짧은 라벨 (P6에서 그대로 사용 가능) */
export const BRIEFING_SOURCE_LABELS: Record<string, string> = {
  supplier_based: '공급사 안내 기반',
  bongtour_editorial: 'Bong투어 에디토리얼',
  hybrid: '혼합',
}

export function briefingSourceLabel(raw: string): string {
  return BRIEFING_SOURCE_LABELS[raw] ?? raw
}

/**
 * `GET /api/curations/monthly` 한 항목 — DB 필드 + 카드용 최소 파생값
 */
export type PublicCurationCard = {
  id: string
  yearMonth: string
  scope: string
  destinationName: string
  oneLineTheme: string
  whyNowText: string
  recommendedForText: string
  leadTimeLabel: string
  primaryInquiryType: string
  briefingSourceType: string
  /** 배지 문구 (원문 키는 `briefingSourceType`) */
  briefingSourceLabel: string
  linkedProductId: string | null
  sortOrder: number
  /** CTA용 `/inquiry?type=` — 알 수 없는 유형이면 null (CTA는 수동 type 또는 travel fallback 권장) */
  inquiryPageKind: InquiryPageKind | null
}

export function toPublicCurationCard(row: MonthlyCurationCardSource): PublicCurationCard {
  return {
    id: row.id,
    yearMonth: row.yearMonth,
    scope: row.scope,
    destinationName: row.destinationName,
    oneLineTheme: row.oneLineTheme,
    whyNowText: row.whyNowText,
    recommendedForText: row.recommendedForText,
    leadTimeLabel: row.leadTimeLabel,
    primaryInquiryType: row.primaryInquiryType,
    briefingSourceType: row.briefingSourceType,
    briefingSourceLabel: briefingSourceLabel(row.briefingSourceType),
    linkedProductId: row.linkedProductId,
    sortOrder: row.sortOrder,
    inquiryPageKind: primaryInquiryTypeToPageKind(row.primaryInquiryType),
  }
}

/** 메인·운영 기준 월 (한국 시간) */
export function getSeoulYearMonthNow(): string {
  const d = new Date()
  const seoul = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const y = seoul.getFullYear()
  const m = String(seoul.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** P3 `/inquiry` CTA — 쿼리는 URLSearchParams로 인코딩 */
export function buildCurationInquiryHref(item: PublicCurationCard): string {
  const type = item.inquiryPageKind ?? 'travel'
  const p = new URLSearchParams({
    type,
    monthlyCurationItemId: item.id,
    snapshotCardLabel: item.oneLineTheme,
    targetYearMonth: item.yearMonth,
  })
  return `/inquiry?${p.toString()}`
}

/** 카드 성격에 맞는 CTA 톤 (특가몰형 `bookRequest` 남용 지양, 기본은 상담·맞춤) */
export type CurationCtaVariant = 'consult' | 'customItinerary' | 'bookRequest'

export function curationPrimaryTypeToCtaVariant(primaryInquiryType: string): CurationCtaVariant {
  switch (primaryInquiryType) {
    case 'overseas_training_quote':
      return 'customItinerary'
    case 'bus_quote':
      return 'consult'
    case 'institution_request':
      return 'consult'
    case 'travel_consult':
      return 'consult'
    default:
      return 'consult'
  }
}
