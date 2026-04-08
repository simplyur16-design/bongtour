/** [modetour] register-correction-types */
/**
 * 관리자 등록(parse-and-register) 미리보기·교정 편집기용 타입.
 * - 자동 추출값(auto)과 최종 저장값(final)을 분리하고, 재파싱 시 수동 교정을 덮어쓰지 않게 한다.
 * - 기존 fieldIssues / ssotPreview 와 병행하는 optional 확장.
 */

import type { RegisterParsed } from '@/lib/register-llm-schema-modetour'
import type { RegisterPreviewSsotBadge } from '@/lib/register-preview-ssot-modetour'

/** 공통 검수 상태 — 자동 확정 / 검수 필요 / 수동 교정 / 승인 */
export type ReviewState = 'auto' | 'needs_review' | 'manually_edited' | 'approved'

export const REGISTER_CORRECTION_PREVIEW_VERSION = '1' as const

/** 이슈·필드와 근거 연결 (원문 스니펫 / 요약 / 출처 종류 중 하나 이상) */
export type RegisterIssueEvidence = {
  rawSnippet?: string | null
  sourceSummary?: string | null
  /** 자유 문자열(예: pasted_table, body_text, llm, regex) */
  sourceKind?: string | null
}

/** 교정 UI·오버레이에서 쓰는 논리 키 */
export type RegisterCorrectionFieldKey = 'shopping' | string

export type RegisterCorrectionShoppingPlaceRowV1 = {
  id: string
  auto: {
    itemType: string
    placeName: string
    durationText: string | null
    refundPolicyText: string | null
    raw: string | null
  }
  final: {
    itemType: string
    placeName: string
    durationText: string | null
    refundPolicyText: string | null
    raw: string | null
  }
  reviewState: ReviewState
  evidence: RegisterIssueEvidence
}

export type RegisterCorrectionShoppingVisitValueV1 = {
  auto: number | null
  final: number | null
  reviewState: ReviewState
  evidence: RegisterIssueEvidence
}

export type RegisterCorrectionShoppingFieldV1 = {
  /** 쇼핑 방문 횟수 요약값 */
  visitCount: RegisterCorrectionShoppingVisitValueV1
  /** 쇼핑 상세 리스트(행 단위) */
  places: {
    reviewState: ReviewState
    rows: RegisterCorrectionShoppingPlaceRowV1[]
    evidence: RegisterIssueEvidence
  }
  /**
   * legacy(구형 overlay 호환) — 존재하면 신형 구조보다 후순위.
   * TODO: 구형 클라이언트 제거 후 삭제.
   */
  reviewState?: ReviewState
  finalVisitCount?: number | null
  finalShoppingPlacesJson?: string | null
}

/** confirm 시 서버로 보내는 선택적 교정 오버레이 (구형 클라이언트는 생략) */
export type RegisterCorrectionOverlayV1 = {
  version: typeof REGISTER_CORRECTION_PREVIEW_VERSION
  fields: Partial<{
    shopping: RegisterCorrectionShoppingFieldV1
  }>
}

/** 미리보기 응답에만 포함: 자동 스냅샷 + 이슈별 근거 */
export type RegisterCorrectionShoppingPreviewV1 = {
  visitCount: RegisterCorrectionShoppingVisitValueV1
  places: {
    autoTableRowCount: number | null
    rows: RegisterCorrectionShoppingPlaceRowV1[]
    reviewState: ReviewState
    evidence: RegisterIssueEvidence
  }
  separationNote: string | null
}

export type RegisterCorrectionIssueHintDetailV1 = {
  field: string
  badge: RegisterPreviewSsotBadge
  reason: string
  correctionKey: RegisterCorrectionFieldKey
  evidence: RegisterIssueEvidence
}

export type RegisterCorrectionPreviewV1 = {
  version: typeof REGISTER_CORRECTION_PREVIEW_VERSION
  shopping: RegisterCorrectionShoppingPreviewV1
  issueHintDetails: RegisterCorrectionIssueHintDetailV1[]
}

export function inferCorrectionKeyFromIssueField(field: string): RegisterCorrectionFieldKey {
  const f = field.toLowerCase()
  if (f.includes('shopping') || f.includes('쇼핑')) return 'shopping'
  return field
}

function parseJsonArrayLen(s: string | null | undefined): number | null {
  if (s == null || !String(s).trim()) return null
  try {
    const v = JSON.parse(s) as unknown
    return Array.isArray(v) ? v.length : null
  } catch {
    return null
  }
}

function parseShoppingPlacesJsonRows(
  s: string | null | undefined
): Array<{
  itemType: string
  placeName: string
  durationText: string | null
  refundPolicyText: string | null
  raw: string | null
}> | null {
  if (s == null || !String(s).trim()) return null
  try {
    const v = JSON.parse(s) as unknown
    if (!Array.isArray(v)) return null
    return v.map((row) => {
      const r = (row ?? {}) as Record<string, unknown>
      return {
        itemType: String(r.itemType ?? '').trim(),
        placeName: String(r.placeName ?? '').trim(),
        durationText: r.durationText == null ? null : String(r.durationText),
        refundPolicyText: r.refundPolicyText == null ? null : String(r.refundPolicyText),
        raw: r.raw == null ? null : String(r.raw),
      }
    })
  } catch {
    return null
  }
}

function normalizeShoppingRowsForParsed(rows: RegisterCorrectionShoppingPlaceRowV1[]): string | null {
  const finalRows = rows.map((r) => ({
    itemType: String(r.final.itemType ?? '').trim(),
    placeName: String(r.final.placeName ?? '').trim(),
    durationText: r.final.durationText == null || String(r.final.durationText).trim() === '' ? null : String(r.final.durationText).trim(),
    refundPolicyText:
      r.final.refundPolicyText == null || String(r.final.refundPolicyText).trim() === ''
        ? null
        : String(r.final.refundPolicyText).trim(),
    raw: r.final.raw == null || String(r.final.raw).trim() === '' ? null : String(r.final.raw).trim(),
  }))
  return JSON.stringify(finalRows)
}

/** confirm 직전 parsed에 교정 오버레이 적용 (수동·승인된 필드만) */
export function applyRegisterCorrectionOverlayToParsed(
  parsed: RegisterParsed,
  overlay: RegisterCorrectionOverlayV1 | null | undefined
): RegisterParsed {
  if (!overlay || overlay.version !== REGISTER_CORRECTION_PREVIEW_VERSION) return parsed
  const shop = overlay.fields.shopping
  if (!shop) return parsed
  // 구형 payload 호환: finalVisitCount/finalShoppingPlacesJson
  if (shop.visitCount == null || shop.places == null) {
    if (shop.reviewState !== 'manually_edited' && shop.reviewState !== 'approved') return parsed
    const json = shop.finalShoppingPlacesJson?.trim() ?? ''
    let nextStops: string | null = parsed.shoppingStops ?? null
    if (json !== '') {
      const legacyRows = parseShoppingPlacesJsonRows(json)
      if (legacyRows) nextStops = JSON.stringify(legacyRows)
    }
    const listLen = parseJsonArrayLen(nextStops)
    return {
      ...parsed,
      shoppingVisitCount: shop.finalVisitCount ?? parsed.shoppingVisitCount ?? null,
      shoppingStops: nextStops,
      hasShopping: listLen != null ? listLen > 0 : parsed.hasShopping,
    }
  }

  const visitEditable = shop.visitCount.reviewState === 'manually_edited' || shop.visitCount.reviewState === 'approved'
  const placesEditable = shop.places.reviewState === 'manually_edited' || shop.places.reviewState === 'approved'
  if (!visitEditable && !placesEditable) return parsed

  const nextStops = placesEditable ? normalizeShoppingRowsForParsed(shop.places.rows) : parsed.shoppingStops ?? null

  const listLen = parseJsonArrayLen(nextStops)
  return {
    ...parsed,
    shoppingVisitCount: visitEditable ? shop.visitCount.final ?? parsed.shoppingVisitCount ?? null : parsed.shoppingVisitCount ?? null,
    shoppingStops: nextStops,
    hasShopping: listLen != null ? listLen > 0 : parsed.hasShopping,
  }
}

/** 새 미리보기 직후: 수동·승인 교정이 있으면 서버 parsed 위에 덮어씀 */
export function mergeParsedWithCorrectionOverlay(
  freshParsed: RegisterParsed,
  overlay: RegisterCorrectionOverlayV1 | null | undefined
): RegisterParsed {
  return applyRegisterCorrectionOverlayToParsed(freshParsed, overlay)
}
