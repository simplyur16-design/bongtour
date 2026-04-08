import { CUSTOMER_INQUIRY_TYPES } from '@/lib/customer-inquiry-intake'
import {
  CURATION_SCOPES,
  briefingSourceLabel,
  isCurationScope,
  isValidYearMonth,
} from '@/lib/monthly-curation'

/** 관리자 PATCH/POST에서 허용하는 게시 상태 (DB `MonthlyCurationItem.status`) */
export const CURATION_PUBLISH_STATUSES = ['draft', 'published'] as const
export type CurationPublishStatus = (typeof CURATION_PUBLISH_STATUSES)[number]

export const BRIEFING_SOURCE_TYPES = [
  'supplier_based',
  'bongtour_editorial',
  'hybrid',
] as const
export type BriefingSourceType = (typeof BRIEFING_SOURCE_TYPES)[number]

const MAX_DEST = 200
const MAX_THEME = 300
const MAX_TEXT = 2000
const MAX_LEAD_LABEL = 500

export function isCurationPublishStatus(s: string): s is CurationPublishStatus {
  return (CURATION_PUBLISH_STATUSES as readonly string[]).includes(s)
}

export function isBriefingSourceType(s: string): s is BriefingSourceType {
  return (BRIEFING_SOURCE_TYPES as readonly string[]).includes(s)
}

export function isPrimaryInquiryType(s: string): boolean {
  return (CUSTOMER_INQUIRY_TYPES as readonly string[]).includes(s)
}

export function primaryInquiryTypeLabel(type: string): string {
  switch (type) {
    case 'travel_consult':
      return '여행 상담'
    case 'institution_request':
      return '기관·단체 문의'
    case 'overseas_training_quote':
      return '해외연수 견적'
    case 'bus_quote':
      return '버스 견적'
    default:
      return type
  }
}

export { briefingSourceLabel }

export function curationScopeLabel(s: string): string {
  switch (s) {
    case 'domestic':
      return '국내'
    case 'overseas':
      return '국외'
    default:
      return s
  }
}

export function curationStatusLabel(s: string): string {
  switch (s) {
    case 'draft':
      return '초안'
    case 'published':
      return '게시'
    default:
      return s
  }
}

export type MainVisibilityExplain = {
  /** 메인 API가 이 카드 한 건을 그대로 내려줄 조건 (published + active) */
  wouldServe: boolean
  /** 운영자용 한 줄 요약 */
  summary: string
  /** 메인에 안 나가는 이유 (있으면) */
  blockers: string[]
}

/**
 * 메인 `GET /api/curations/monthly`는 `status === published && isActive === true`인 행만 내려준다.
 * 같은 달·스코프 내 yearMonth·scope는 쿼리로 걸러지므로, 여기서는 행 자체 조건만 설명한다.
 */
export function explainMainVisibilityForRow(row: {
  status: string
  isActive: boolean
}): MainVisibilityExplain {
  const blockers: string[] = []
  if (row.status !== 'published') {
    blockers.push('상태가 게시(published)가 아니면 공개 API에 포함되지 않습니다.')
  }
  if (!row.isActive) {
    blockers.push('비활성(isActive=false)이면 공개 API에 포함되지 않습니다.')
  }
  const wouldServe = row.status === 'published' && row.isActive
  const summary = wouldServe
    ? '이 카드는 게시·활성 조건을 만족합니다. (해당 월·스코프로 API 요청 시 메인에 나갈 수 있음)'
    : `메인 미노출: ${blockers.join(' ')}`
  return { wouldServe, summary, blockers }
}

/** GET 응답 한 행 (클라이언트와 공유) */
export type AdminMonthlyCurationListItem = {
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
  status: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  linkedProduct: { id: string; title: string } | null
  mainVisibility: MainVisibilityExplain
}

export type CurationCreateInput = {
  yearMonth: string
  scope: (typeof CURATION_SCOPES)[number]
  destinationName: string
  oneLineTheme: string
  whyNowText: string
  recommendedForText: string
  leadTimeLabel: string
  primaryInquiryType: string
  briefingSourceType: BriefingSourceType
  linkedProductId: string | null
  sortOrder: number
  status: CurationPublishStatus
  isActive: boolean
}

export type FieldErrors = Record<string, string>

function trimStr(v: unknown, max: number, field: string, errors: FieldErrors): string | null {
  if (v === undefined || v === null) {
    errors[field] = '필수입니다.'
    return null
  }
  if (typeof v !== 'string') {
    errors[field] = '문자열이어야 합니다.'
    return null
  }
  const t = v.trim()
  if (!t) {
    errors[field] = '비어 있을 수 없습니다.'
    return null
  }
  if (t.length > max) {
    errors[field] = `최대 ${max}자까지입니다.`
    return null
  }
  return t
}

function optionalTrimStr(
  v: unknown,
  max: number,
  field: string,
  errors: FieldErrors,
  required: boolean
): string | null {
  if (v === undefined || v === null) {
    if (required) errors[field] = '필수입니다.'
    return required ? null : ''
  }
  if (typeof v !== 'string') {
    errors[field] = '문자열이어야 합니다.'
    return null
  }
  const t = v.trim()
  if (!t && required) {
    errors[field] = '비어 있을 수 없습니다.'
    return null
  }
  if (t.length > max) {
    errors[field] = `최대 ${max}자까지입니다.`
    return null
  }
  return t
}

function parseLinkedProductId(v: unknown, field: string, errors: FieldErrors): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  if (typeof v !== 'string') {
    errors[field] = '문자열 또는 null이어야 합니다.'
    return undefined
  }
  const t = v.trim()
  if (!t) return null
  return t
}

function parseSortOrder(v: unknown, field: string, errors: FieldErrors): number | undefined {
  if (v === undefined) return undefined
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v)) {
    errors[field] = '정수여야 합니다.'
    return undefined
  }
  return v
}

function parseBoolean(v: unknown, field: string, errors: FieldErrors): boolean | undefined {
  if (v === undefined) return undefined
  if (typeof v !== 'boolean') {
    errors[field] = '불리언이어야 합니다.'
    return undefined
  }
  return v
}

/** POST 본문 검증 — 성공 시 Prisma create 데이터 */
export function parseCurationCreateBody(body: unknown): { ok: true; data: CurationCreateInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: { _body: 'JSON 객체가 필요합니다.' } }
  }
  const o = body as Record<string, unknown>

  let yearMonth: string | undefined
  if (typeof o.yearMonth !== 'string' || !isValidYearMonth(o.yearMonth.trim())) {
    errors.yearMonth = 'YYYY-MM 형식이어야 합니다.'
  } else {
    yearMonth = o.yearMonth.trim()
  }

  let scope: (typeof CURATION_SCOPES)[number] | undefined
  if (typeof o.scope !== 'string' || !isCurationScope(o.scope)) {
    errors.scope = `허용: ${CURATION_SCOPES.join(', ')}`
  } else {
    scope = o.scope
  }

  const destinationName = trimStr(o.destinationName, MAX_DEST, 'destinationName', errors)
  const oneLineTheme = trimStr(o.oneLineTheme, MAX_THEME, 'oneLineTheme', errors)
  const whyNowText = trimStr(o.whyNowText, MAX_TEXT, 'whyNowText', errors)
  const recommendedForText = trimStr(o.recommendedForText, MAX_TEXT, 'recommendedForText', errors)
  const leadTimeLabel = trimStr(o.leadTimeLabel, MAX_LEAD_LABEL, 'leadTimeLabel', errors)

  let primaryInquiryType: string | undefined
  const pit = o.primaryInquiryType
  if (typeof pit !== 'string' || !isPrimaryInquiryType(pit)) {
    errors.primaryInquiryType = `허용: ${CUSTOMER_INQUIRY_TYPES.join(', ')}`
  } else {
    primaryInquiryType = pit
  }

  let briefingSourceType: BriefingSourceType | undefined
  const bst = o.briefingSourceType
  if (typeof bst !== 'string' || !isBriefingSourceType(bst)) {
    errors.briefingSourceType = `허용: ${BRIEFING_SOURCE_TYPES.join(', ')}`
  } else {
    briefingSourceType = bst
  }

  const linkedProductId = parseLinkedProductId(o.linkedProductId, 'linkedProductId', errors)

  let sortOrder = 0
  if (o.sortOrder !== undefined) {
    const so = parseSortOrder(o.sortOrder, 'sortOrder', errors)
    if (so !== undefined) sortOrder = so
  }

  let status: CurationPublishStatus = 'draft'
  if (o.status !== undefined) {
    if (typeof o.status === 'string' && isCurationPublishStatus(o.status)) {
      status = o.status
    } else {
      errors.status = `허용: ${CURATION_PUBLISH_STATUSES.join(', ')}`
    }
  }

  let isActive = true
  if (o.isActive !== undefined) {
    const ia = parseBoolean(o.isActive, 'isActive', errors)
    if (ia !== undefined) isActive = ia
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    data: {
      yearMonth: yearMonth!,
      scope: scope!,
      destinationName: destinationName!,
      oneLineTheme: oneLineTheme!,
      whyNowText: whyNowText!,
      recommendedForText: recommendedForText!,
      leadTimeLabel: leadTimeLabel!,
      primaryInquiryType: primaryInquiryType!,
      briefingSourceType: briefingSourceType!,
      linkedProductId: linkedProductId === undefined ? null : linkedProductId,
      sortOrder,
      status,
      isActive,
    },
  }
}

/** PATCH 본문 — 부분 업데이트 필드만 검증 */
export function parseCurationPatchBody(body: unknown): { ok: true; patch: Record<string, unknown> } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: { _body: 'JSON 객체가 필요합니다.' } }
  }
  const o = body as Record<string, unknown>
  const patch: Record<string, unknown> = {}

  if ('yearMonth' in o) {
    const ym = o.yearMonth
    if (typeof ym !== 'string' || !isValidYearMonth(ym.trim())) {
      errors.yearMonth = 'YYYY-MM 형식이어야 합니다.'
    } else {
      patch.yearMonth = ym.trim()
    }
  }

  if ('scope' in o) {
    const s = o.scope
    if (typeof s !== 'string' || !isCurationScope(s)) {
      errors.scope = `허용: ${CURATION_SCOPES.join(', ')}`
    } else {
      patch.scope = s
    }
  }

  if ('destinationName' in o) {
    const t = optionalTrimStr(o.destinationName, MAX_DEST, 'destinationName', errors, true)
    if (t !== null && !errors.destinationName) patch.destinationName = t
  }
  if ('oneLineTheme' in o) {
    const t = optionalTrimStr(o.oneLineTheme, MAX_THEME, 'oneLineTheme', errors, true)
    if (t !== null && !errors.oneLineTheme) patch.oneLineTheme = t
  }
  if ('whyNowText' in o) {
    const t = optionalTrimStr(o.whyNowText, MAX_TEXT, 'whyNowText', errors, true)
    if (t !== null && !errors.whyNowText) patch.whyNowText = t
  }
  if ('recommendedForText' in o) {
    const t = optionalTrimStr(o.recommendedForText, MAX_TEXT, 'recommendedForText', errors, true)
    if (t !== null && !errors.recommendedForText) patch.recommendedForText = t
  }
  if ('leadTimeLabel' in o) {
    const t = optionalTrimStr(o.leadTimeLabel, MAX_LEAD_LABEL, 'leadTimeLabel', errors, true)
    if (t !== null && !errors.leadTimeLabel) patch.leadTimeLabel = t
  }

  if ('primaryInquiryType' in o) {
    const pit = o.primaryInquiryType
    if (typeof pit !== 'string' || !isPrimaryInquiryType(pit)) {
      errors.primaryInquiryType = `허용: ${CUSTOMER_INQUIRY_TYPES.join(', ')}`
    } else {
      patch.primaryInquiryType = pit
    }
  }

  if ('briefingSourceType' in o) {
    const bst = o.briefingSourceType
    if (typeof bst !== 'string' || !isBriefingSourceType(bst)) {
      errors.briefingSourceType = `허용: ${BRIEFING_SOURCE_TYPES.join(', ')}`
    } else {
      patch.briefingSourceType = bst
    }
  }

  if ('linkedProductId' in o) {
    const lp = parseLinkedProductId(o.linkedProductId, 'linkedProductId', errors)
    if (lp !== undefined && !errors.linkedProductId) patch.linkedProductId = lp
  }

  if ('sortOrder' in o) {
    const so = parseSortOrder(o.sortOrder, 'sortOrder', errors)
    if (so !== undefined) patch.sortOrder = so
  }

  if ('status' in o) {
    const st = o.status
    if (typeof st !== 'string' || !isCurationPublishStatus(st)) {
      errors.status = `허용: ${CURATION_PUBLISH_STATUSES.join(', ')}`
    } else {
      patch.status = st
    }
  }

  if ('isActive' in o) {
    const ia = parseBoolean(o.isActive, 'isActive', errors)
    if (ia !== undefined) patch.isActive = ia
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, errors: { _body: '수정할 필드가 없습니다.' } }
  }
  return { ok: true, patch }
}

export type AdminCurationListAppliedFilters = {
  scope?: string
  status?: string
  isActive?: boolean
  yearMonth?: string
}

/**
 * 목록 GET 쿼리 파싱. 잘못된 필터 조합은 400으로 거절한다.
 */
export function parseAdminCurationListQuery(
  searchParams: URLSearchParams
):
  | { ok: true; where: Record<string, string | boolean>; applied: AdminCurationListAppliedFilters }
  | { ok: false; error: string } {
  const where: Record<string, string | boolean> = {}
  const applied: AdminCurationListAppliedFilters = {}

  const scopeRaw = searchParams.get('scope')
  if (scopeRaw != null && scopeRaw.trim() !== '') {
    const scope = scopeRaw.trim()
    if (!isCurationScope(scope)) {
      return { ok: false, error: 'scope는 domestic 또는 overseas 이어야 합니다.' }
    }
    where.scope = scope
    applied.scope = scope
  }

  const statusRaw = searchParams.get('status')
  if (statusRaw != null && statusRaw.trim() !== '') {
    const status = statusRaw.trim()
    if (!isCurationPublishStatus(status)) {
      return { ok: false, error: `status는 ${CURATION_PUBLISH_STATUSES.join(', ')} 중 하나여야 합니다.` }
    }
    where.status = status
    applied.status = status
  }

  const isActiveStr = searchParams.get('isActive')
  if (isActiveStr !== null && isActiveStr !== '') {
    if (isActiveStr !== 'true' && isActiveStr !== 'false') {
      return { ok: false, error: 'isActive는 true 또는 false 여야 합니다.' }
    }
    const b = isActiveStr === 'true'
    where.isActive = b
    applied.isActive = b
  }

  const ymRaw = searchParams.get('yearMonth')
  if (ymRaw != null && ymRaw.trim() !== '') {
    const ym = ymRaw.trim()
    if (!isValidYearMonth(ym)) {
      return { ok: false, error: 'yearMonth는 YYYY-MM 형식이어야 합니다.' }
    }
    where.yearMonth = ym
    applied.yearMonth = ym
  }

  return { ok: true, where, applied }
}
