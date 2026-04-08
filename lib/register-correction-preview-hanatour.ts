/** [hanatour] register-correction-preview */
/**
 * parse-and-register preview 응답용 correctionPreview 블록 생성.
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'
import type { PricePromotionFieldIssue } from '@/lib/price-promotion-hanatour'
import type { RegisterExtractionFieldIssue } from '@/lib/register-llm-schema-hanatour'
import type { RegisterPreviewSsotMeta } from '@/lib/register-preview-ssot-hanatour'
import type { RegisterPreviewProductDraft } from '@/lib/register-preview-payload-hanatour'
import {
  inferCorrectionKeyFromIssueField,
  type RegisterCorrectionPreviewV1,
  type RegisterCorrectionShoppingPlaceRowV1,
  type RegisterIssueEvidence,
} from '@/lib/register-correction-types-hanatour'
import { issueBadge } from '@/lib/register-preview-ssot-hanatour'
import {
  buildSupplierFlightSnippet,
  mapIssueFieldToFlightKind,
} from '@/lib/register-flight-evidence-supplier-hanatour'

function clip(s: string | null | undefined, max: number): string | null {
  if (s == null || !String(s).trim()) return null
  const t = String(s).trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function pickPasted(
  preview: Record<string, string | undefined | null> | null | undefined,
  key: string
): string | null {
  const v = preview?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function flightFieldEvidence(
  field: string,
  parsed: RegisterParsed,
  preview: Record<string, string | undefined | null> | null | undefined,
  brandKey: string | null | undefined
): RegisterIssueEvidence {
  const kind = mapIssueFieldToFlightKind(field)
  const none = (): RegisterIssueEvidence => ({
    rawSnippet: null,
    sourceSummary: null,
    sourceKind: 'no_flight_excerpt',
  })
  if (!kind) return none()
  const { rawSnippet, sourceKind } = buildSupplierFlightSnippet(brandKey, kind, parsed, preview)
  if (!rawSnippet?.trim()) return none()
  const max = kind === 'flight_info' ? 720 : kind === 'carrier' ? 400 : 560
  return {
    rawSnippet: clip(rawSnippet, max),
    sourceSummary: `항공 근거(관리자 공급사=${(brandKey ?? '').trim() || '미선택'})`,
    sourceKind,
  }
}

/**
 * 검수 교정창 근거 스니펫 — 필드 축별 원문만 (쇼핑 원문을 타 축에 재사용하지 않음).
 */
function evidenceForField(
  field: string,
  parsed: RegisterParsed,
  pastedBlocksPreview: Record<string, string | undefined | null> | null | undefined,
  brandKey?: string | null
): RegisterIssueEvidence {
  const f = field.toLowerCase()
  const r = parsed.detailBodyStructured?.raw

  if (f.includes('shopping') || f.includes('쇼핑')) {
    const snippet = clip(pickPasted(pastedBlocksPreview, 'shopping') ?? r?.shoppingPasteRaw ?? null, 600)
    return {
      rawSnippet: snippet,
      sourceSummary: snippet
        ? '쇼핑: 붙여넣기 블록 또는 본문 shopping_section 추출 원문'
        : null,
      sourceKind: snippet ? 'shopping_paste_or_section' : 'no_shopping_excerpt',
    }
  }

  if (f.includes('optional') || f.includes('optionaltours')) {
    const snippet = clip(pickPasted(pastedBlocksPreview, 'optionalTour') ?? r?.optionalToursPasteRaw ?? null, 600)
    return {
      rawSnippet: snippet,
      sourceSummary: snippet ? '옵션: 붙여넣기 또는 본문 optional_tour_section 원문' : null,
      sourceKind: snippet ? 'optional_tour_paste_or_section' : 'no_optional_excerpt',
    }
  }

  if (
    f.includes('flight') ||
    f.includes('inboundarrival') ||
    f.includes('outbounddeparture') ||
    f.includes('carriername') ||
    f.includes('flightno') ||
    f.includes('airline') ||
    f === 'carrier' ||
    (f.includes('inbound') && !f.includes('shopping')) ||
    (f.includes('outbound') && !f.includes('shopping'))
  ) {
    return flightFieldEvidence(field, parsed, pastedBlocksPreview, brandKey ?? null)
  }

  if (f.includes('hotel')) {
    const snippet = clip(pickPasted(pastedBlocksPreview, 'hotel') ?? r?.hotelPasteRaw ?? null, 600)
    return {
      rawSnippet: snippet,
      sourceSummary: snippet ? '호텔: 붙여넣기 또는 본문 hotel_section 원문' : null,
      sourceKind: snippet ? 'hotel_paste_or_section' : 'no_hotel_excerpt',
    }
  }

  if (f.includes('detail_body') || f.includes('included') || f.includes('excluded')) {
    const snippet = clip(parsed.detailBodyStructured?.normalizedRaw ?? null, 600)
    return {
      rawSnippet: snippet,
      sourceSummary: snippet ? '본문: 정규화된 상세 원문 일부' : null,
      sourceKind: snippet ? 'normalized_detail_body' : 'no_body_excerpt',
    }
  }

  if (f.startsWith('destination.')) {
    const snippet = clip(parsed.detailBodyStructured?.normalizedRaw ?? null, 600)
    return {
      rawSnippet: snippet,
      sourceSummary: snippet
        ? '목적지·일정 정합성: 본문(일정표·항공 구간) 일부 — 대표 목적지와 첫 입국/최종 출국이 다를 수 있음'
        : null,
      sourceKind: snippet ? 'destination_coherence_body' : 'no_body_excerpt',
    }
  }

  return {
    rawSnippet: null,
    sourceSummary: null,
    sourceKind: 'no_dedicated_axis_excerpt',
  }
}

function parseShoppingRows(s: string | null | undefined): RegisterCorrectionShoppingPlaceRowV1[] {
  if (!s?.trim()) return []
  try {
    const v = JSON.parse(s) as unknown
    if (!Array.isArray(v)) return []
    return v.map((x, i) => {
      const r = (x ?? {}) as Record<string, unknown>
      const auto = {
        itemType: String(r.itemType ?? '').trim(),
        placeName: String(r.placeName ?? '').trim(),
        durationText: r.durationText == null ? null : String(r.durationText),
        refundPolicyText: r.refundPolicyText == null ? null : String(r.refundPolicyText),
        raw: r.raw == null ? null : String(r.raw),
      }
      return {
        id: `auto_row_${i + 1}`,
        auto,
        final: { ...auto },
        reviewState: 'auto',
        evidence: { sourceKind: 'shopping_structured_row', sourceSummary: `shoppingStops row ${i + 1}` },
      }
    })
  } catch {
    return []
  }
}

/** `register-preview-ssot-hanatour` issueBadge ? ?? ?? ?? ? ?? ??? ?? ? ?? */
export function buildRegisterCorrectionPreview(opts: {
  parsed: RegisterParsed
  productDraft: RegisterPreviewProductDraft
  fieldIssues: Array<PricePromotionFieldIssue | RegisterExtractionFieldIssue>
  ssotPreview: RegisterPreviewSsotMeta
  /** 미리보기에 실리는 붙여넣기 블록 요약 — 값이 비어 있을 수 있음 */
  pastedBlocksPreview: Record<string, string | undefined | null> | null | undefined
  /** 관리자 선택 공급사 — 항공 evidence 분기 전용 */
  brandKey?: string | null
}): RegisterCorrectionPreviewV1 {
  const { parsed, productDraft, fieldIssues, ssotPreview, pastedBlocksPreview } = opts

  const visit = productDraft.shoppingVisitCount ?? parsed.shoppingVisitCount ?? null
  const shoppingRows = parseShoppingRows(parsed.shoppingStops ?? null)
  const rows = productDraft.shoppingStopsCount ?? shoppingRows.length
  const separationNote = ssotPreview.shopping.separationNote

  const shoppingEvidence = evidenceForField('shoppingStops', parsed, pastedBlocksPreview, opts.brandKey)

  const issueHintDetails = fieldIssues.map((it) => ({
    field: it.field,
    badge: issueBadge(it),
    reason: it.reason,
    correctionKey: inferCorrectionKeyFromIssueField(it.field),
    evidence: (() => {
      const axis = evidenceForField(it.field, parsed, pastedBlocksPreview, opts.brandKey)
      const axisSummary = axis.sourceSummary?.trim() || null
      const reason = it.reason?.trim() || ''
      const sourceSummary =
        axisSummary && reason ? `${axisSummary} — ${reason}` : axisSummary || reason || null
      return {
        rawSnippet: axis.rawSnippet ?? null,
        sourceSummary,
        sourceKind:
          axis.sourceKind && axis.sourceKind !== 'no_dedicated_axis_excerpt'
            ? `${axis.sourceKind};issue:${'severity' in it && it.severity ? it.severity : String(it.source ?? 'unknown')}`
            : 'severity' in it && it.severity
              ? `extraction:${it.severity}`
              : String(it.source ?? 'unknown'),
      }
    })(),
  }))

  return {
    version: '1',
    shopping: {
      visitCount: {
        auto: visit,
        final: visit,
        reviewState: 'needs_review',
        evidence: shoppingEvidence,
      },
      places: {
        autoTableRowCount: rows,
        rows: shoppingRows,
        reviewState: 'needs_review',
        evidence: shoppingEvidence,
      },
      separationNote,
    },
    issueHintDetails,
  }
}
