/**
 * 모두투어(modetour) 등록 전용: detail review 집계 + 쇼핑 Gemini 노이즈 필터.
 */
import type {
  DetailBodyParseSnapshot,
  FlightStructured,
  HotelStructured,
  IncludedExcludedStructured,
  OptionalToursStructured,
  ShoppingStructured,
} from '@/lib/detail-body-parser-types'
import { brandKeyExpectsFlightNumber, canonicalBrandKeyForRegister } from '@/lib/brand-key-register'
import { isFlightAxisEngaged } from '@/lib/review-axis-guards'

function isRegisterShoppingAxisField(field: string): boolean {
  const f = field.toLowerCase()
  return (
    f.includes('shopping') ||
    f.includes('쇼핑') ||
    f === 'shoppingstops' ||
    f === 'shoppingvisitcount' ||
    f === 'has_shopping' ||
    f === 'hasshopping'
  )
}

function isGeminiShoppingVisitVsListMismatchNoise(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  const lower = t.toLowerCase()
  const hasDigit = /\d/.test(t)

  if (/\btext\s+mentions\b/i.test(t) && /\bvisits?\b/i.test(t)) return true
  if (/\bsummary\s+mentions\b/i.test(t) && /\bstops?\b/i.test(t)) return true
  if (/\bpotential\s+locations?\b/i.test(t)) return true
  if (/\blist\s+provides\b/i.test(t)) return true

  if (/\b(mismatch|inconsistent|discrepancy|does\s+not\s+match)\b/i.test(lower)) {
    if (/\bvisits?\b/i.test(t) && /\b(stops?|rows?|list|locations?|entries)\b/i.test(t)) return true
  }
  if (/\bcompared\s+to\b/i.test(lower) && /\bvisits?\b/i.test(t) && /\b(list|row|stop|location)/i.test(t)) return true

  if (hasDigit) {
    if (/\bvisits?\b/i.test(t) && /\bbut\b/.test(lower) && /\b(rows?|entries|items|stops?|locations?|listed|provided)\b/i.test(t))
      return true
    if (/\bstops?\b/i.test(t) && /\bbut\b/.test(lower) && /\b(rows?|entries|list|potential|provided)\b/i.test(t))
      return true
  }

  return false
}

function filterShoppingReviewReasonGeminiNoise(reasons: string[]): string[] {
  return reasons.filter((r) => !isGeminiShoppingVisitVsListMismatchNoise(r))
}

export function filterRegisterExtractionIssuesShoppingGeminiNoise<T extends { field: string; reason: string }>(
  issues: T[]
): T[] {
  return issues.filter((it) => !(isRegisterShoppingAxisField(it.field) && isGeminiShoppingVisitVsListMismatchNoise(it.reason)))
}

export function shouldEmitShoppingBothEmptyExtractionIssue(p: {
  hasShoppingFromBodyOrSignals: boolean
  shopRowCount: number
  visitCount: number | null | undefined
}): boolean {
  const visitNum =
    p.visitCount != null && Number.isFinite(Number(p.visitCount)) ? Number(p.visitCount) : null
  return (
    p.hasShoppingFromBodyOrSignals &&
    p.shopRowCount === 0 &&
    (p.visitCount == null || visitNum == null || visitNum <= 0)
  )
}

function filterFlightReviewReasonsForSupplier(reasons: string[], expectFlightNo: boolean): string[] {
  if (expectFlightNo) return reasons
  return reasons.filter((r) => !/편명/.test(r))
}

function isFlightAxisWarningLine(w: string): boolean {
  return /항공|편명|출국|입국|공항|여정|편\s*명|구조화/i.test(w)
}

type ReviewComputed = {
  review: DetailBodyParseSnapshot['review']
  sectionReview: DetailBodyParseSnapshot['sectionReview']
  qualityScores: NonNullable<DetailBodyParseSnapshot['qualityScores']>
  failurePatterns: NonNullable<DetailBodyParseSnapshot['failurePatterns']>
}

export type DetailReviewAbsenceTolerances = {
  hotelEmptyWhenNoReviewOk?: boolean
  optionalEmptyWhenNoReviewOk?: boolean
  shoppingEmptyWhenNoReviewOk?: boolean
}

export function buildDetailReviewPolicyModetour(args: {
  sections: Array<{ type: DetailBodyParseSnapshot['sections'][number]['type']; text: string }>
  flightStructured: FlightStructured
  hotelStructured: HotelStructured
  optionalToursStructured: OptionalToursStructured
  shoppingStructured: ShoppingStructured
  includedExcludedStructured: IncludedExcludedStructured
  optionalPasteRaw?: string | null
  shoppingPasteRaw?: string | null
  absenceTolerances?: DetailReviewAbsenceTolerances
}): ReviewComputed {
  const {
    sections,
    flightStructured,
    hotelStructured,
    optionalToursStructured,
    shoppingStructured,
    includedExcludedStructured,
    optionalPasteRaw,
    shoppingPasteRaw,
    absenceTolerances,
  } = args
  const tol = absenceTolerances ?? {}
  const bk = canonicalBrandKeyForRegister('modetour')
  const expectFlightNo = brandKeyExpectsFlightNumber(bk)
  const flightEngaged = isFlightAxisEngaged({
    flightStructured,
    sections,
    optionalPasteRaw,
    shoppingPasteRaw,
  })
  const required: string[] = []
  const warning: string[] = []
  const info: string[] = []
  if (sections.length < 2) required.push('본문 섹션 분리 실패')
  const flightOnlyWarnings: string[] = []
  if (flightEngaged) {
    if (flightStructured.reviewNeeded) {
      required.push(...filterFlightReviewReasonsForSupplier([...flightStructured.reviewReasons], expectFlightNo))
    }
    if (expectFlightNo && (!flightStructured.outbound.flightNo || !flightStructured.inbound.flightNo)) {
      const msg = '항공 편명 일부 또는 전체 누락'
      warning.push(msg)
      flightOnlyWarnings.push(msg)
    }
    if (flightStructured.debug?.status === 'partial') {
      const msg = '항공 부분 구조화(일부 필드 누락)'
      warning.push(msg)
      flightOnlyWarnings.push(msg)
    }
    if (flightStructured.debug?.status === 'failure') required.push('항공 구조화 실패')
    if (!flightStructured.airlineName) {
      const msg = '항공사명 누락'
      warning.push(msg)
      flightOnlyWarnings.push(msg)
    }
  }
  if (hotelStructured.reviewNeeded) required.push(...hotelStructured.reviewReasons)
  if (optionalToursStructured.reviewNeeded) required.push(...optionalToursStructured.reviewReasons)
  if (shoppingStructured.reviewNeeded) required.push(...shoppingStructured.reviewReasons)
  if (includedExcludedStructured.reviewNeeded) required.push(...includedExcludedStructured.reviewReasons)
  if (hotelStructured.rows.some((r) => r.hotelCandidates.length > 1)) warning.push('호텔명 후보 다수')
  if (optionalToursStructured.rows.length === 0) info.push('선택관광 없음')
  if (shoppingStructured.rows.length === 0) info.push('쇼핑 없음')

  const flightSectionRequired: string[] = []
  if (flightEngaged && flightStructured.reviewNeeded) {
    flightSectionRequired.push(...filterFlightReviewReasonsForSupplier([...flightStructured.reviewReasons], expectFlightNo))
  }
  if (flightEngaged && flightStructured.debug?.status === 'failure') {
    flightSectionRequired.push('항공 구조화 실패')
  }
  const flightSectionRequiredDeduped = Array.from(new Set(flightSectionRequired))

  const sectionReview: DetailBodyParseSnapshot['sectionReview'] = {
    flight_section: {
      required: flightSectionRequiredDeduped,
      warning: flightEngaged ? flightOnlyWarnings : [],
      info: [],
    },
    hotel_section: {
      required: hotelStructured.reviewNeeded ? [...hotelStructured.reviewReasons] : [],
      warning: warning.filter((w) => /호텔/.test(w) && !isFlightAxisWarningLine(w)),
      info: info.filter((x) => /호텔/.test(x)),
    },
    optional_tour_section: {
      required: optionalToursStructured.reviewNeeded ? [...optionalToursStructured.reviewReasons] : [],
      warning: [],
      info: info.filter((x) => /선택관광/.test(x)),
    },
    shopping_section: {
      required: shoppingStructured.reviewNeeded
        ? filterShoppingReviewReasonGeminiNoise([...shoppingStructured.reviewReasons])
        : [],
      warning: [],
      info: info.filter((x) => /쇼핑/.test(x)),
    },
    included_excluded_section: {
      required: includedExcludedStructured.reviewNeeded ? [...includedExcludedStructured.reviewReasons] : [],
      warning: [],
      info: [],
    },
  }

  const qualityScores = {
    hotelQualityScore:
      hotelStructured.rows.length === 0
        ? 0
        : Math.round(
            (hotelStructured.rows
              .map((r) => [r.dayLabel, r.dateText, r.cityText, r.hotelNameText].filter(Boolean).length / 4)
              .reduce((a, b) => a + b, 0) /
              hotelStructured.rows.length) *
              100
          ),
    optionalTourQualityScore:
      optionalToursStructured.rows.length === 0
        ? 0
        : Math.round(
            (optionalToursStructured.rows
              .map((r) => [r.tourName, r.currency, r.adultPrice != null ? '1' : '', r.durationText].filter(Boolean).length / 4)
              .reduce((a, b) => a + b, 0) /
              optionalToursStructured.rows.length) *
              100
          ),
    shoppingQualityScore:
      shoppingStructured.rows.length === 0
        ? 0
        : Math.round(
            (shoppingStructured.rows
              .map((r) => [r.shoppingItem, r.shoppingPlace, r.durationText, r.refundPolicyText].filter(Boolean).length / 4)
              .reduce((a, b) => a + b, 0) /
              shoppingStructured.rows.length) *
              100
          ),
    flightQualityScore: (() => {
      const base = [
        flightStructured.outbound.departureAirport,
        flightStructured.outbound.arrivalAirport,
        flightStructured.outbound.departureDate,
        flightStructured.outbound.departureTime,
        flightStructured.inbound.departureAirport,
        flightStructured.inbound.arrivalAirport,
        flightStructured.inbound.departureDate,
        flightStructured.inbound.departureTime,
      ]
      if (expectFlightNo) {
        base.push(
          flightStructured.outbound.flightNo,
          flightStructured.inbound.flightNo
        )
      }
      const denom = expectFlightNo ? 10 : 8
      return Math.round(((base.filter(Boolean).length / denom) as number) * 100)
    })(),
  }

  const policyHotelEmptyOk =
    !!tol.hotelEmptyWhenNoReviewOk &&
    hotelStructured.rows.length === 0 &&
    !hotelStructured.reviewNeeded

  const failurePatterns = {
    hotel: policyHotelEmptyOk
      ? []
      : hotelStructured.rows.length === 0
        ? ['section_split_or_row_recovery_failed']
        : hotelStructured.rows.every((r) => !r.hotelNameText.trim())
          ? ['hotel_name_missing_majority']
          : [],
    optionalTour:
      optionalToursStructured.rows.length === 0
        ? !!tol.optionalEmptyWhenNoReviewOk && !optionalToursStructured.reviewNeeded
          ? []
          : ['numbered_or_one_line_pattern_missed']
        : optionalToursStructured.rows.every((r) => r.adultPrice == null && !r.durationText)
          ? ['price_duration_missing_majority']
          : [],
    shopping:
      shoppingStructured.rows.length === 0
        ? !!tol.shoppingEmptyWhenNoReviewOk && !shoppingStructured.reviewNeeded
          ? []
          : ['round_or_table_row_recovery_failed']
        : shoppingStructured.rows.every((r) => !r.shoppingItem && !r.shoppingPlace)
          ? ['shopping_item_place_missing_majority']
          : [],
    flight:
      !flightEngaged
        ? []
        : flightStructured.reviewNeeded
          ? ['candidate_block_merge_or_direction_failed']
          : qualityScores.flightQualityScore < 50
            ? ['date_time_or_flightno_missing']
            : [],
  }

  return {
    review: { required, warning, info },
    sectionReview,
    qualityScores,
    failurePatterns,
  }
}
