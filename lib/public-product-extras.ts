import type { PricePromotionSnapshot } from '@/lib/price-promotion-hanatour'
import type { DayHotelPlan } from '@/lib/day-hotel-plans-hanatour'
import type { FlightStructured, HanatourReservationStatusParsed } from '@/lib/detail-body-parser-types'
import type { ShoppingStopRow } from '@/lib/public-product-extras-types'
import { isBannedOptionalTourName } from '@/lib/optional-tour-row-gate-hanatour'
import { getPublicOptionalTourRowsFromProduct, parseLegacyStructuredOptionalTours } from '@/lib/optional-tours-ui-model'

/** 등록 파싱 본문 상품가격표(연령별). ProductDeparture·레거시 ProductPrice와 별도로 rawMeta에 보관됨 */
export type BodyProductPriceTable = {
  adultPrice?: number | null
  childExtraBedPrice?: number | null
  childNoBedPrice?: number | null
  infantPrice?: number | null
}

/** 항공 구조화(등록 파싱 rawMeta) — 출발행이 비어도 본문 기준 상세 노출용 */
export type FlightStructuredBody = {
  airlineName?: string | null
  departureSegmentText?: string | null
  returnSegmentText?: string | null
  routeRaw?: string | null
  /** 등록 시 저장된 항공 섹션 원문(rawMeta.structuredSignals) */
  flightRaw?: string | null
  outboundFlightNo?: string | null
  inboundFlightNo?: string | null
  departureDateTimeRaw?: string | null
  arrivalDateTimeRaw?: string | null
  /** normalize 본문 전체 — 모두투어 전용 leg 파서 폴백 시에만 `useModetourStructuredFlightLegs`와 함께 소비 */
  detailBodyNormalizedRaw?: string | null
  /**
   * [모두투어 전용] true일 때만 `departure-key-facts` enrich에서 `flight-modetour-parser` 결정적 leg로 카드 병합.
   * 공개 상세 `app/products/[id]/page.tsx`에서만 `brandKey===modetour` 또는 `flightStructured.debug.supplierBrandKey===modetour`일 때 설정.
   * 다른 공급사에는 설정하지 말 것(본문 형식이 비슷해도 자동 적용 금지).
   */
  useModetourStructuredFlightLegs?: boolean
  /** 원문 재파싱 실패 시 `rawMeta.structuredSignals.flightStructured` leg 로 카드·세그먼트 보강 */
  modetourPersistedFlightStructured?: FlightStructured | null
}

export type PublicStructuredSignals = {
  /** 본문 표에서 추출된 연령별 단가 — 공개 상세 견적 행에 병합 */
  productPriceTable?: BodyProductPriceTable | null
  /** 상품가격표 원문 — 인원 카드 연령 기준 추출용 */
  priceTableRawText?: string | null
  /** 등록 시 normalize 본문 전체 — 모두투어 항공 전용 파서 폴백 시 소비(공통 필드, 해석은 modetour 분기만) */
  detailBodyNormalizedRaw?: string | null
  optionalTourNoticeRaw: string | null
  optionalTourNoticeItems: string[]
  optionalTourDisplayNoticeManual?: string | null
  optionalTourDisplayNoticeFinal?: string | null
  shoppingNoticeRaw: string | null
  shoppingStops: string | null
  hasShopping: boolean
  shoppingVisitCount: number | null
  hasFreeTime: boolean
  freeTimeSummaryText: string | null
  freeTimeRawMentions: string[]
  headerBadges: { optionalTour: string; shopping: string; freeTime: string } | null
  mustKnowRaw?: string | null
  mustKnowItems?: MustKnowItem[]
  mustKnowSource?: 'supplier' | 'supplier+web' | 'web' | null
  mustKnowNoticeRaw?: string | null
  singleRoomSurchargeAmount?: number | null
  singleRoomSurchargeCurrency?: string | null
  singleRoomSurchargeRaw?: string | null
  singleRoomSurchargeDisplayText?: string | null
  hasSingleRoomSurcharge?: boolean
  hotelInfoRaw?: string | null
  hotelNames?: string[] | null
  /** 일차별 예정호텔 — 호텔정보 탭 */
  dayHotelPlans?: DayHotelPlan[] | null
  /** Canonical hotel structured (public consumption primary) */
  hotelStructured?: {
    rows?: Array<{
      dayLabel?: string
      dateText?: string
      cityText?: string
      bookingStatusText?: string
      hotelNameText?: string
      hotelCandidates?: string[]
      noteText?: string
    }>
  } | null
  hotelSummaryText?: string | null
  hotelStatusText?: string | null
  hotelNoticeRaw?: string | null
  /** Canonical optional tours structured (public consumption primary) */
  optionalToursStructuredCanonical?: {
    rows?: Array<{
      tourName?: string
      currency?: string
      adultPrice?: number | null
      childPrice?: number | null
      durationText?: string
      minPeopleText?: string
      guide同行Text?: string
      waitingPlaceText?: string
      descriptionText?: string
      noteText?: string
    }>
  } | null
  /** Canonical shopping structured (public consumption primary) */
  shoppingStructured?: {
    rows?: Array<{
      shoppingItem?: string
      shoppingPlace?: string
      durationText?: string
      refundPolicyText?: string
      noteText?: string
      city?: string | null
      shopName?: string | null
      shopLocation?: string | null
      itemsText?: string | null
      visitNo?: number | null
      candidateOnly?: boolean
      candidateGroupKey?: string | null
    }>
    shoppingCountText?: string
  } | null
  minimumDepartureCount?: number | null
  minimumDepartureText?: string | null
  isDepartureGuaranteed?: boolean | null
  currentBookedCount?: number | null
  remainingSeatsCount?: number | null
  /** 하나투어 본문 한 줄 예약현황 스냅샷(rawMeta) */
  hanatourReservationStatus?: HanatourReservationStatusParsed | null
  departureStatusText?: string | null
  /** 관리자 옵션관광 입력란 원문 — 구조화 0행일 때 공개 탭 fallback */
  optionalToursPasteRaw?: string | null
  /** 관리자 쇼핑 입력란 원문 — 구조화 0행일 때 공개 탭 fallback */
  shoppingPasteRaw?: string | null
  /** 등록 파이프라인 보조(Gemini). 상세 SSOT 아님 */
  optionalToursLlmSupplementJson?: string | null
  shoppingStopsLlmSupplementJson?: string | null
  /** 히어로·날짜 정책 감사(등록 시 기록) */
  heroDepartureDateSource?: string | null
  heroReturnDateSource?: string | null
  infantAgeRuleText?: string | null
  childAgeRuleText?: string | null
  meetingInfoRaw?: string | null
  meetingPlaceRaw?: string | null
  meetingNoticeRaw?: string | null
  meetingFallbackText?: string | null
} & FlightStructuredBody

export type MustKnowCategory =
  | '입국/비자'
  | '자녀동반'
  | '현지준비'
  | '안전/유의'
  | '국내준비'
  | '집결/탑승'

export type MustKnowItem = {
  category: MustKnowCategory
  title: string
  body: string
  raw?: string
}

export type PublicPricePromotionView = Pick<
  PricePromotionSnapshot,
  | 'basePrice'
  | 'salePrice'
  | 'savingsText'
  | 'benefitTitle'
  | 'couponAvailable'
  | 'couponText'
  | 'couponCtaText'
  | 'priceDisplayRaw'
  | 'benefitRawText'
  | 'strikeThroughDetected'
>

export type ParsedProductRawMeta = {
  structuredSignals?: PublicStructuredSignals
  pricePromotion?: {
    merged?: PublicPricePromotionView
  }
}

export function normalizeMustKnowItems(items: MustKnowItem[] | null | undefined): MustKnowItem[] {
  if (!items?.length) return []
  return items
    .map((x) => ({
      category: x.category,
      title: String(x.title ?? '').trim(),
      body: String(x.body ?? '').trim(),
      raw: typeof x.raw === 'string' ? x.raw : undefined,
    }))
    .filter((x) => Boolean(x.title?.trim() || x.body?.trim()))
}

export function parseMustKnowItemsFromRawText(raw: string | null | undefined): MustKnowItem[] {
  if (!raw?.trim()) return []
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const bullets = lines
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 12)
  const out: MustKnowItem[] = []
  for (const b of bullets) {
    const title = b.length > 28 ? b.slice(0, 28) + '…' : b
    out.push({ category: '현지준비', title, body: b })
  }
  return out.slice(0, 6)
}

export function parseProductRawMetaPublic(rawMeta: string | null | undefined): ParsedProductRawMeta | null {
  if (!rawMeta?.trim()) return null
  try {
    return JSON.parse(rawMeta) as ParsedProductRawMeta
  } catch {
    return null
  }
}

export type { ShoppingStopRow } from '@/lib/public-product-extras-types'

export function parseShoppingStopsJson(json: string | null | undefined): ShoppingStopRow[] {
  if (!json?.trim()) return []
  try {
    const arr = JSON.parse(json) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .map((row) => {
        const r = row as Record<string, unknown>
        const itemType = typeof r.itemType === 'string' ? r.itemType.trim() : ''
        const placeName = typeof r.placeName === 'string' ? r.placeName.trim() : ''
        const raw = typeof r.raw === 'string' ? r.raw : JSON.stringify(row)
        if (!itemType && !placeName) return null
        const pickOpt = (k: string) => {
          const v = r[k]
          return typeof v === 'string' && v.trim() ? v.trim() : null
        }
        const visitNoRaw = r.visitNo
        const visitNo =
          typeof visitNoRaw === 'number' && Number.isFinite(visitNoRaw)
            ? visitNoRaw
            : typeof visitNoRaw === 'string' && /^\d+$/.test(visitNoRaw.trim())
              ? Number(visitNoRaw.trim())
              : null
        const candidateOnly = r.candidateOnly === true
        const candidateGroupKey = pickOpt('candidateGroupKey')
        const noteText = pickOpt('noteText')
        return {
          itemType: itemType || '—',
          placeName: placeName || '—',
          durationText: typeof r.durationText === 'string' ? r.durationText : null,
          refundPolicyText: typeof r.refundPolicyText === 'string' ? r.refundPolicyText : null,
          raw,
          city: pickOpt('city'),
          shopName: pickOpt('shopName'),
          shopLocation: pickOpt('shopLocation'),
          itemsText: pickOpt('itemsText'),
          visitNo: visitNo != null && Number.isFinite(visitNo) ? visitNo : null,
          candidateOnly: candidateOnly ? true : undefined,
          candidateGroupKey,
          noteText,
        } as ShoppingStopRow
      })
      .filter((x): x is ShoppingStopRow => x != null)
  } catch {
    return []
  }
}

// —— 공개 상세: 옵션관광 / 쇼핑 표시 규칙 (순수 helper, 직렬화·resolver와 분리) ——

export type PublicOptionalDisplayInput = {
  uiOptionalRowCount: number
  /** `OptionalToursFactSheet`에 넘기는 레거시/구조화 시트 행 수(금지명 제외 후) */
  legacyOptionalSheetTourCount: number
  optionalTourNoticeItemsCount: number
  optionalTourNoticeRaw: string | null | undefined
  optionalTourDisplayNoticeFinal: string | null | undefined
  optionalToursPasteRaw: string | null | undefined
}

export type PublicShoppingDisplayInput = {
  /** 공개 탭/배지: 서버가 내려준 구조화 행 수(팩트시트 내부 junk 필터는 별도) */
  structuredStopCount: number
  shoppingVisitCountTotal: number | null | undefined
  shoppingCount: number | null | undefined
  shoppingItems: string | null | undefined
  shoppingNoticeRaw: string | null | undefined
  shoppingPasteRaw: string | null | undefined
}

export function buildPublicOptionalDisplayInputFromProductFields(p: {
  optionalToursStructured?: string | null
  optionalTourNoticeItems?: string[] | null
  optionalTourNoticeRaw?: string | null
  optionalTourDisplayNoticeFinal?: string | null
  optionalToursPasteRaw?: string | null
  optionalTours?: Array<{ id: string }> | null
}): PublicOptionalDisplayInput {
  const uiRows = getPublicOptionalTourRowsFromProduct(p.optionalToursStructured, p.optionalToursPasteRaw)
  const structuredLegacy = parseLegacyStructuredOptionalTours(p.optionalToursStructured)
  const legacyOptionalSheetTourCount = structuredLegacy.length
    ? structuredLegacy.filter((t) => !isBannedOptionalTourName(t.name)).length
    : (p.optionalTours?.length ?? 0)
  return {
    uiOptionalRowCount: uiRows.length,
    legacyOptionalSheetTourCount,
    optionalTourNoticeItemsCount: p.optionalTourNoticeItems?.length ?? 0,
    optionalTourNoticeRaw: p.optionalTourNoticeRaw ?? null,
    optionalTourDisplayNoticeFinal: p.optionalTourDisplayNoticeFinal ?? null,
    optionalToursPasteRaw: p.optionalToursPasteRaw ?? null,
  }
}

export function buildPublicShoppingDisplayInputFromProductFields(p: {
  shoppingStopsStructured?: ShoppingStopRow[] | null
  shoppingVisitCountTotal?: number | null
  shoppingCount?: number | null
  shoppingItems?: string | null
  shoppingNoticeRaw?: string | null
  shoppingPasteRaw?: string | null
}): PublicShoppingDisplayInput {
  return {
    structuredStopCount: p.shoppingStopsStructured?.length ?? 0,
    shoppingVisitCountTotal: p.shoppingVisitCountTotal,
    shoppingCount: p.shoppingCount,
    shoppingItems: p.shoppingItems,
    shoppingNoticeRaw: p.shoppingNoticeRaw,
    shoppingPasteRaw: p.shoppingPasteRaw,
  }
}

export function hasPublicOptionalStructuredRows(input: PublicOptionalDisplayInput): boolean {
  return input.uiOptionalRowCount > 0
}

export function shouldShowLegacyOptionalSheetForPublic(input: PublicOptionalDisplayInput): boolean {
  return input.legacyOptionalSheetTourCount > 0 && input.uiOptionalRowCount === 0
}

/** 구조화 0행·레거시 시트 없을 때 paste가 옵션 축 SSOT → notice UI는 숨김 */
export function shouldSuppressOptionalNoticeBecausePasteSsot(input: PublicOptionalDisplayInput): boolean {
  const paste = String(input.optionalToursPasteRaw ?? '').trim()
  if (!paste) return false
  if (input.uiOptionalRowCount > 0) return false
  if (shouldShowLegacyOptionalSheetForPublic(input)) return false
  return true
}

export function shouldShowOptionalPasteFallback(input: PublicOptionalDisplayInput): boolean {
  return shouldSuppressOptionalNoticeBecausePasteSsot(input)
}

export function shouldShowOptionalStructuredNoticeUi(input: PublicOptionalDisplayInput): boolean {
  const hasNotice =
    (input.optionalTourNoticeItemsCount ?? 0) > 0 ||
    Boolean(String(input.optionalTourNoticeRaw ?? '').trim()) ||
    Boolean(String(input.optionalTourDisplayNoticeFinal ?? '').trim())
  const hasRows = input.uiOptionalRowCount > 0
  if (!hasNotice && !hasRows) return false
  if (shouldSuppressOptionalNoticeBecausePasteSsot(input)) return false
  return true
}

export function shouldShowPublicOptionalSection(input: PublicOptionalDisplayInput): boolean {
  return (
    shouldShowOptionalStructuredNoticeUi(input) ||
    shouldShowLegacyOptionalSheetForPublic(input) ||
    shouldShowOptionalPasteFallback(input)
  )
}

export function isPublicOptionalPanelTrulyEmpty(input: PublicOptionalDisplayInput): boolean {
  return !shouldShowPublicOptionalSection(input)
}

export function hasPublicShoppingStructuredRows(input: PublicShoppingDisplayInput): boolean {
  return input.structuredStopCount > 0
}

export function shouldShowShoppingPasteFallback(input: PublicShoppingDisplayInput): boolean {
  const paste = String(input.shoppingPasteRaw ?? '').trim()
  if (!paste) return false
  return input.structuredStopCount === 0
}

export function shouldSuppressShoppingNoticeBecausePasteSame(
  shoppingNoticeRaw: string | null | undefined,
  shoppingPasteRaw: string | null | undefined
): boolean {
  const p = String(shoppingPasteRaw ?? '').trim()
  const n = String(shoppingNoticeRaw ?? '').trim()
  return p.length > 0 && n.length > 0 && n === p
}

export function shouldShowPublicShoppingSection(input: PublicShoppingDisplayInput): boolean {
  const hasVisit = input.shoppingVisitCountTotal != null || input.shoppingCount != null
  const hasItems = Boolean(String(input.shoppingItems ?? '').trim())
  const hasStructured = input.structuredStopCount > 0
  const hasNotice = Boolean(String(input.shoppingNoticeRaw ?? '').trim())
  const hasPaste = Boolean(String(input.shoppingPasteRaw ?? '').trim())
  return hasVisit || hasItems || hasStructured || hasNotice || hasPaste
}

export function isPublicShoppingPanelTrulyEmpty(input: PublicShoppingDisplayInput): boolean {
  return !shouldShowPublicShoppingSection(input)
}

/** `ShoppingFactSheet`: junk 품목 요약 제외 후 본문을 그릴지(탭은 부모 `shouldShowPublicShoppingSection`로 이미 열림) */
export function shouldRenderShoppingFactSheetContent(
  input: PublicShoppingDisplayInput,
  shoppingItemsSummaryIsJunk: boolean
): boolean {
  const hasStructured = input.structuredStopCount > 0
  const pasteFb = shouldShowShoppingPasteFallback(input)
  const noticeTrim = String(input.shoppingNoticeRaw ?? '').trim()
  const showNotice =
    noticeTrim.length > 0 &&
    !hasStructured &&
    !shouldSuppressShoppingNoticeBecausePasteSame(input.shoppingNoticeRaw, input.shoppingPasteRaw)
  const hasItems =
    Boolean(String(input.shoppingItems ?? '').trim()) && !shoppingItemsSummaryIsJunk && !hasStructured
  const countDefined = input.shoppingVisitCountTotal != null || input.shoppingCount != null
  return countDefined || hasItems || hasStructured || showNotice || pasteFb
}

/** PC/모바일·verify 동일 입력 동일 플래그 확인용 */
export function computePublicOptionalTabFlags(input: PublicOptionalDisplayInput) {
  return {
    showStructuredNoticeUi: shouldShowOptionalStructuredNoticeUi(input),
    showLegacySheet: shouldShowLegacyOptionalSheetForPublic(input),
    showPasteFallback: shouldShowOptionalPasteFallback(input),
    hasSection: shouldShowPublicOptionalSection(input),
  }
}
