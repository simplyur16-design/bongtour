/** [modetour] register-preview-ssot */
/**
 * 등록 미리보기 SSOT 정책 — 인수인계·Cursor 프롬프트·UI와 동일 기준.
 *
 * 핵심: 달력/가격표·표/regex 등 결정적 근거가 최종 기준이고,
 * LLM·프로모 문구 가격은 보조·참고다. confirm은 preview에서 확정된 값만 저장한다.
 *
 * 필드별 요약:
 * - pricePromotion.salePrice: 달력/가격표 확정가와 다르면 병합 결과에서 제거(이미 reconcile).
 * - shoppingVisitCount: 본문·시그널의 "방문 횟수". 쇼핑 표 행 수와 동일시하지 않음.
 * - optionalToursStructured: 표/regex 우선, LLM은 optionalToursLlmSupplementJson 보조.
 * - inboundArrivalAt: 날짜만 보강된 값은 시각·편명 검수 필요로 표시.
 */
import type { DeparturePreviewRow } from '@/lib/departure-preview'
import type { PricePromotionFieldIssue, PricePromotionSnapshot } from '@/lib/price-promotion-modetour'
import type { RegisterExtractionFieldIssue } from '@/lib/register-llm-schema-modetour'

export const REGISTER_PREVIEW_SSOT_POLICY_VERSION = '2025-03-26'

export type RegisterPreviewSsotBadge = 'confirmed' | 'supplement' | 'conflict' | 'review_needed'

/** 미리보기 상단·요약에 쓰는 구조화 메타 (값 중복 최소화) */
export type RegisterPreviewSsotMeta = {
  policyVersion: string
  headline: string
  price: {
    authoritativeKrw: number | null
    promotionSalePriceStripped: boolean
    conflictingGeminiSalePrice: number | null
  }
  shopping: {
    visitCount: number | null
    tableRowCount: number | null
    separationNote: string | null
  }
  optionalTours: {
    primaryRowCount: number | null
    llmSupplementRowCount: number | null
  }
  inboundSample: {
    inboundArrivalAt: string | null
    needsScheduleReview: boolean
  } | null
  /** 미리보기 한정 — 필드 교정 목록이 아닌 정책 안내(달력·가격 SSOT 등) */
  previewPolicyNotes: string[]
  issueHints: Array<{ field: string; badge: RegisterPreviewSsotBadge; reason: string }>
}

export type RegisterPreviewSsotDraftInput = {
  /** SSOT 달력가 — authoritativeKrw 최우선 */
  selectedDeparturePrice?: number | null
  /** @deprecated selectedDeparturePrice와 동일 의미(하위 호환). authoritative 체인에 사용하지 않음 */
  currentSellingPrice: number | null
  priceFrom: number | null
  shoppingVisitCount: number | null
  shoppingStopsCount: number | null
  optionalToursStructured?: string | null
  optionalToursLlmSupplementJson?: string | null
}

export function registerPreviewSsotBadgeLabel(b: RegisterPreviewSsotBadge): string {
  switch (b) {
    case 'confirmed':
      return '확정'
    case 'supplement':
      return '보조추출'
    case 'conflict':
      return '충돌'
    case 'review_needed':
      return '검수필요'
  }
}

function jsonArrayRowCount(s: string | null | undefined): number | null {
  if (!s?.trim()) return null
  try {
    const v = JSON.parse(s) as unknown
    return Array.isArray(v) ? v.length : null
  } catch {
    return null
  }
}

export function issueBadge(it: PricePromotionFieldIssue | RegisterExtractionFieldIssue): RegisterPreviewSsotBadge {
  const sev = 'severity' in it ? it.severity : undefined
  if (it.field === 'pricePromotion.salePrice' || /제거했습니다|불일치하여 제거/.test(it.reason)) {
    return 'conflict'
  }
  if (sev === 'warn' || sev === 'info') return 'review_needed'
  if (it.source === 'llm') return 'supplement'
  return 'confirmed'
}

/** 날짜만 있거나 00:00 자정으로만 채워진 경우 → 시각·편명 검수 권장 */
export function inboundArrivalNeedsScheduleReview(value: string | null | undefined): boolean {
  if (!value?.trim()) return false
  const v = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return true
  if (/^\d{4}-\d{2}-\d{2}[T\s]00:00(?::00)?(?:\.\d+)?(?:Z)?$/i.test(v)) return true
  return false
}

export function buildRegisterPreviewSsotMeta(opts: {
  draft: RegisterPreviewSsotDraftInput
  geminiPromotion: PricePromotionSnapshot | null
  sampleDeparture: DeparturePreviewRow | null
  fieldIssues: Array<PricePromotionFieldIssue | RegisterExtractionFieldIssue>
  /** register-parse `registerPreviewPolicyNotes` — 교정 이슈와 분리 */
  previewPolicyNotes?: string[] | null
}): RegisterPreviewSsotMeta {
  const { draft, geminiPromotion, sampleDeparture, fieldIssues, previewPolicyNotes } = opts
  const policyNotes = (previewPolicyNotes ?? []).map((s) => String(s).trim()).filter(Boolean)
  const strippedIssue = fieldIssues.find(
    (i) => i.field === 'pricePromotion.salePrice' && /달력|가격표|제거|불일치/.test(i.reason)
  )
  const promotionSalePriceStripped = Boolean(strippedIssue)
  const conflictingGeminiSalePrice =
    promotionSalePriceStripped && geminiPromotion?.salePrice != null ? geminiPromotion.salePrice : null

  const primaryOpt = jsonArrayRowCount(draft.optionalToursStructured)
  const llmOpt = jsonArrayRowCount(draft.optionalToursLlmSupplementJson)

  const inbound = sampleDeparture?.inboundArrivalAt?.trim() || null
  const needsScheduleReview = inboundArrivalNeedsScheduleReview(inbound)

  const visit = draft.shoppingVisitCount ?? null
  const rows = draft.shoppingStopsCount ?? null
  const hasShoppingDraft =
    (visit != null && Number(visit) > 0) || (rows != null && rows > 0)
  const separationNote = hasShoppingDraft
    ? '쇼핑 방문 횟수와 후보지 목록은 서로 다른 개념입니다. 방문 횟수는 메타 요약이며, 후보지 목록은 참고·안내용입니다.'
    : null

  return {
    policyVersion: REGISTER_PREVIEW_SSOT_POLICY_VERSION,
    headline:
      '달력/가격표·표/regex 같은 결정적 근거가 최종 기준이다. LLM·프로모 문구는 보조·참고다.',
    price: {
      authoritativeKrw: draft.selectedDeparturePrice ?? draft.priceFrom ?? null,
      promotionSalePriceStripped,
      conflictingGeminiSalePrice,
    },
    shopping: {
      visitCount: visit,
      tableRowCount: rows,
      separationNote,
    },
    optionalTours: {
      primaryRowCount: primaryOpt,
      llmSupplementRowCount: llmOpt,
    },
    inboundSample:
      sampleDeparture != null
        ? {
            inboundArrivalAt: inbound,
            needsScheduleReview,
          }
        : null,
    previewPolicyNotes: policyNotes,
    issueHints: fieldIssues.map((it) => ({
      field: it.field,
      badge: issueBadge(it),
      reason: it.reason,
    })),
  }
}
