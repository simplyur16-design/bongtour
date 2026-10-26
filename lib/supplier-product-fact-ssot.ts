/**
 * 공개·비교·**등록 파이프 write** 공용 공급사 상품 사실 필드 SSOT.
 * 쇼핑/옵션: 없음(0/false) ≠ 정보 없음(null). 숙박·식사·항공사는 점수 없이 표시명.
 *
 * REGRESSION-FREEZE[supplier-product-fact-ssot]: 사실 필드 도출 — manifest
 */

import { formatPublicAirlineDisplay } from '@/lib/airline-iata-public-display-ssot'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { buildOptionalToursStructuredJsonFromCanonical } from '@/lib/public-consumption-hanatour'
import { parseProductRawMetaPublic, parseShoppingStopsJson } from '@/lib/public-product-extras'
import { scrubPublicHotelDisplayLine } from '@/lib/public-hotel-display-ssot'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { formatVerygoodtourHotelLabelFromTextBlobs } from '@/lib/verygoodtour-hotel-info-ssot'

export type FactTriState = 'yes' | 'no' | 'unknown'

export type ShoppingFact = {
  state: FactTriState
  /** 방문 횟수 — yes일 때 ≥1, no일 때 0, unknown이면 null */
  visitCount: number | null
  source: string
}

export type OptionalFact = {
  state: FactTriState
  rowCount: number
  source: string
}

export type HotelMealFact = {
  /** 비교·목록: 대표 숙소명 + 성급(있으면). 예: `상하이 쑤닝 노보텔 호텔 (준5성급)` */
  hotelLabel: string
  /** 비교: 조·중·석 유무. 예: `조식·중식·석식` / `조식 있음 · 중식 없음 · 석식 있음` */
  mealLabel: string
  /** 성급 원문 (준5성급 등), 없으면 null */
  hotelStarGrade: string | null
}

export type AirlineFact = {
  /** 공개 히어로와 동일 IATA→한글 표시, 없으면 `정보 없음` */
  airlineLabel: string
  source: string
}

/** 제목 해시태그 `#NO쇼핑` / `#노쇼핑` 포함 */
const NO_SHOPPING_RE = /#?\s*NO\s*쇼핑|노쇼핑|쇼핑\s*없음|쇼핑없음|쇼핑\s*0\s*회|쇼핑\s*零/i
const HAS_SHOPPING_COUNT_RE = /쇼핑\s*(\d{1,2})\s*회/i
/** 제목 해시태그 `#NO옵션` / `#노옵션` 포함 — 자유여행·패키지 공통 */
const NO_OPTIONAL_RE = /#?\s*NO\s*옵션|노옵션|옵션\s*없음|선택관광\s*없음|현지옵션\s*없음/i
const HAS_OPTIONAL_RE = /현지옵션\s*있음|선택관광\s*있음|옵션\s*있음/i

function numOrNull(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function parseOptionalStructuredRowCount(raw: string | null | undefined): number {
  const s = String(raw ?? '').trim()
  if (!s) return 0
  try {
    const j = JSON.parse(s) as unknown
    if (Array.isArray(j)) return j.filter((x) => x && typeof x === 'object').length
    if (j && typeof j === 'object') {
      const rows = (j as { rows?: unknown }).rows
      if (Array.isArray(rows)) return rows.filter((x) => x && typeof x === 'object').length
      const tours = (j as { tours?: unknown }).tours
      if (Array.isArray(tours)) return tours.filter((x) => x && typeof x === 'object').length
    }
  } catch {
    /* ignore */
  }
  return 0
}

function shoppingStopCount(shoppingShopOptions: string | null | undefined): number {
  const rows = parseShoppingStopsJson(shoppingShopOptions)
  return Array.isArray(rows) ? rows.length : 0
}

function haystackFromProduct(p: {
  title?: string | null
  shoppingItems?: string | null
  shoppingCustomsNoticeRaw?: string | null
  includedText?: string | null
  excludedText?: string | null
  rawMeta?: string | null
}): string {
  const meta = parseProductRawMetaPublic(p.rawMeta ?? null)
  const signals = (meta as { structuredSignals?: Record<string, unknown> } | null)?.structuredSignals
  const paste =
    typeof signals?.shoppingPasteRaw === 'string' ? signals.shoppingPasteRaw : ''
  const notice =
    typeof signals?.shoppingNoticeRaw === 'string' ? signals.shoppingNoticeRaw : ''
  return [
    p.title,
    p.shoppingItems,
    p.shoppingCustomsNoticeRaw,
    p.includedText,
    p.excludedText,
    paste,
    notice,
  ]
    .map((x) => String(x ?? ''))
    .join('\n')
}

/**
 * 쇼핑 사실 — Product 스칼라 우선, 없으면 표/시그널/제목으로 보강.
 * REGRESSION-FREEZE[supplier-product-fact-ssot]: 쇼핑 tri-state — manifest
 */
export function deriveShoppingFact(p: {
  originSource?: string | null
  title?: string | null
  shoppingCount?: number | null
  shoppingVisitCountTotal?: number | null
  shoppingItems?: string | null
  shoppingShopOptions?: string | null
  shoppingCustomsNoticeRaw?: string | null
  includedText?: string | null
  excludedText?: string | null
  rawMeta?: string | null
}): ShoppingFact {
  const visit = numOrNull(p.shoppingVisitCountTotal) ?? numOrNull(p.shoppingCount)
  if (visit != null) {
    if (visit <= 0) return { state: 'no', visitCount: 0, source: 'product_scalar_zero' }
    return { state: 'yes', visitCount: Math.floor(visit), source: 'product_scalar' }
  }

  const supplier = normalizeSupplierOrigin(p.originSource)
  const stops = shoppingStopCount(p.shoppingShopOptions)
  const hay = haystackFromProduct(p)

  if (NO_SHOPPING_RE.test(hay)) {
    return { state: 'no', visitCount: 0, source: 'body_no_shopping_signal' }
  }

  const m = hay.match(HAS_SHOPPING_COUNT_RE)
  if (m) {
    const n = Number(m[1])
    if (Number.isFinite(n) && n >= 0) {
      if (n === 0) return { state: 'no', visitCount: 0, source: 'body_shopping_zero' }
      return { state: 'yes', visitCount: n, source: 'body_shopping_n_회' }
    }
  }

  // ybtour/verygoodtour: 목록 행 수를 횟수로 쓸 수 있음 (visit SSOT 문서)
  if ((supplier === 'ybtour' || supplier === 'verygoodtour') && stops > 0) {
    return { state: 'yes', visitCount: stops, source: 'shopping_stops_row_count' }
  }

  // hanatour/modetour: 행만 있고 횟수 시그널 없으면 unknown 유지 (횟수≠행수)
  if (stops > 0) {
    return { state: 'unknown', visitCount: null, source: 'stops_without_visit_count' }
  }

  const meta = parseProductRawMetaPublic(p.rawMeta ?? null)
  const signals = (meta as { structuredSignals?: Record<string, unknown> } | null)?.structuredSignals
  if (signals && typeof signals.hasShopping === 'boolean') {
    if (signals.hasShopping === false) {
      return { state: 'no', visitCount: 0, source: 'rawMeta_hasShopping_false' }
    }
    const vc = numOrNull(signals.shoppingVisitCount)
    if (vc != null && vc > 0) {
      return { state: 'yes', visitCount: Math.floor(vc), source: 'rawMeta_shoppingVisitCount' }
    }
    if (signals.hasShopping === true) {
      return { state: 'yes', visitCount: null, source: 'rawMeta_hasShopping_true_no_count' }
    }
  }

  return { state: 'unknown', visitCount: null, source: 'none' }
}

/**
 * 옵션 사실 — hasOptionalTours 스칼라 우선, structured/시그널 보강.
 * REGRESSION-FREEZE[supplier-product-fact-ssot]: 옵션 tri-state — manifest
 */
export function deriveOptionalFact(p: {
  title?: string | null
  hasOptionalTours?: boolean | null
  optionalToursStructured?: string | null
  includedText?: string | null
  excludedText?: string | null
  rawMeta?: string | null
}): OptionalFact {
  const rowCount = parseOptionalStructuredRowCount(p.optionalToursStructured)
  if (p.hasOptionalTours === true) {
    return { state: 'yes', rowCount, source: 'product_hasOptionalTours_true' }
  }
  if (p.hasOptionalTours === false) {
    return { state: 'no', rowCount, source: 'product_hasOptionalTours_false' }
  }

  if (rowCount > 0) {
    return { state: 'yes', rowCount, source: 'optionalToursStructured_rows' }
  }

  const meta = parseProductRawMetaPublic(p.rawMeta ?? null)
  const signals = (meta as { structuredSignals?: Record<string, unknown> } | null)?.structuredSignals
  const paste =
    typeof signals?.optionalToursPasteRaw === 'string' ? signals.optionalToursPasteRaw : ''
  const canon = signals?.optionalToursStructuredCanonical as { rows?: unknown[] } | undefined
  const canonRows = Array.isArray(canon?.rows) ? canon!.rows!.length : 0
  if (canonRows > 0) {
    return { state: 'yes', rowCount: canonRows, source: 'rawMeta_canonical_optional_rows' }
  }

  const hay = [p.title, p.includedText, p.excludedText, paste].map((x) => String(x ?? '')).join('\n')
  if (NO_OPTIONAL_RE.test(hay)) {
    return { state: 'no', rowCount: 0, source: 'body_no_optional_signal' }
  }
  if (HAS_OPTIONAL_RE.test(hay)) {
    return { state: 'yes', rowCount: 0, source: 'body_has_optional_signal' }
  }

  if (signals && typeof signals.hasOptionalTour === 'boolean') {
    return {
      state: signals.hasOptionalTour ? 'yes' : 'no',
      rowCount: 0,
      source: 'rawMeta_hasOptionalTour',
    }
  }

  return { state: 'unknown', rowCount: 0, source: 'none' }
}

/** Product 컬럼에 쓸 쇼핑 동기화 값 */
export function shoppingScalarsFromFact(fact: ShoppingFact): {
  shoppingCount: number | null
  shoppingVisitCountTotal: number | null
} {
  if (fact.state === 'no') {
    return { shoppingCount: 0, shoppingVisitCountTotal: 0 }
  }
  if (fact.state === 'yes' && fact.visitCount != null && fact.visitCount > 0) {
    const n = Math.floor(fact.visitCount)
    return { shoppingCount: n, shoppingVisitCountTotal: n }
  }
  // yes but count unknown — leave null (정보 없음으로 표시, 탭은 paste/stops로 열릴 수 있음)
  if (fact.state === 'yes') {
    return { shoppingCount: null, shoppingVisitCountTotal: null }
  }
  return { shoppingCount: null, shoppingVisitCountTotal: null }
}

export function optionalScalarFromFact(fact: OptionalFact): boolean | null {
  if (fact.state === 'yes') return true
  if (fact.state === 'no') return false
  return null
}

/** 등록 파서 결과 → Product write (null 남기지 않는 규칙) */
export function shoppingScalarsFromRegisterParsed(parsed: {
  hasShopping?: boolean | null
  shoppingVisitCount?: number | null
}): { shoppingCount: number | null; shoppingVisitCountTotal: number | null } {
  if (parsed.hasShopping === false) {
    return { shoppingCount: 0, shoppingVisitCountTotal: 0 }
  }
  const vc = numOrNull(parsed.shoppingVisitCount)
  if (vc != null && vc >= 0) {
    return { shoppingCount: vc, shoppingVisitCountTotal: vc }
  }
  if (parsed.hasShopping === true) {
    return { shoppingCount: null, shoppingVisitCountTotal: null }
  }
  return { shoppingCount: null, shoppingVisitCountTotal: null }
}

export function optionalScalarFromRegisterParsed(parsed: {
  hasOptionalTour?: boolean | null
}): boolean | null {
  if (parsed.hasOptionalTour === true) return true
  if (parsed.hasOptionalTour === false) return false
  return null
}

export type RegisterParsedFactInput = {
  hasShopping?: boolean | null
  shoppingVisitCount?: number | null
  hasOptionalTour?: boolean | null
  hotelSummaryText?: string | null
}

type OptionalCanonicalForWrite = {
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
    priceText?: string
    supplierTags?: string[]
    includedNoExtraCharge?: boolean
  }>
} | null | undefined

/**
 * Product.optionalToursStructured 등록 write — 레거시 JSON 없으면 canonical 첨부.
 * 자유여행·패키지 공통 (air_hotel_free라도 옵션 있으면 첨부).
 * REGRESSION-FREEZE[supplier-product-fact-ssot]: 옵션 구조화 첨부 — manifest
 */
export function resolveOptionalToursStructuredForProductWrite(input: {
  optionalToursStructured?: string | null
  /** detailBodyStructured.optionalToursStructured 또는 signals canonical */
  optionalToursStructuredCanonical?: OptionalCanonicalForWrite
}): string | null {
  const existing = String(input.optionalToursStructured ?? '').trim()
  if (existing) {
    try {
      const j = JSON.parse(existing) as unknown
      if (Array.isArray(j) && j.some((x) => x && typeof x === 'object')) return existing
      if (j && typeof j === 'object' && Array.isArray((j as { rows?: unknown[] }).rows)) {
        if ((j as { rows: unknown[] }).rows.length > 0) return existing
      }
    } catch {
      if (existing.length > 2) return existing
    }
  }
  return buildOptionalToursStructuredJsonFromCanonical(input.optionalToursStructuredCanonical)
}

/**
 * 등록 confirm Prisma write + rawMeta.structuredSignals 동일 소스.
 * REGRESSION-FREEZE[supplier-product-fact-ssot]: 등록 파이프 fact write — manifest
 */
export function buildRegisterProductFactWrite(
  parsed: RegisterParsedFactInput & {
    optionalToursStructured?: string | null
    optionalToursStructuredCanonical?: OptionalCanonicalForWrite
    detailBodyStructured?: { optionalToursStructured?: OptionalCanonicalForWrite } | null
  },
): {
  shoppingCount: number | null
  shoppingVisitCountTotal: number | null
  hasOptionalTours: boolean | null
  /** Product.optionalToursStructured — canonical 첨부 포함 */
  optionalToursStructured: string | null
  /** 공개 표시용 — scrub. 원문은 hotelSummaryRaw에 별도 보존 */
  hotelSummaryText: string | null
  /** rawMeta.structuredSignals에 넣을 쇼핑·옵션 사실 (Product 컬럼과 정합) */
  structuredSignalsFacts: {
    hasShopping: boolean
    shoppingVisitCount: number | null
    hasOptionalTour: boolean | null
  }
} {
  const shop = shoppingScalarsFromRegisterParsed(parsed)
  const optionalToursStructured = resolveOptionalToursStructuredForProductWrite({
    optionalToursStructured: parsed.optionalToursStructured,
    optionalToursStructuredCanonical:
      parsed.optionalToursStructuredCanonical ??
      parsed.detailBodyStructured?.optionalToursStructured ??
      null,
  })
  let hasOptionalTours = optionalScalarFromRegisterParsed(parsed)
  if (optionalToursStructured) {
    // 행이 있으면 첨부·스칼라 yes (자유여행 포함)
    hasOptionalTours = true
  }
  const hotelSummaryText = scrubPublicHotelDisplayLine(parsed.hotelSummaryText) ?? null

  let hasShopping: boolean
  if (parsed.hasShopping === false || shop.shoppingCount === 0) {
    hasShopping = false
  } else if (
    (shop.shoppingCount != null && shop.shoppingCount > 0) ||
    parsed.hasShopping === true
  ) {
    hasShopping = true
  } else {
    hasShopping = false
  }

  return {
    shoppingCount: shop.shoppingCount,
    shoppingVisitCountTotal: shop.shoppingVisitCountTotal,
    hasOptionalTours,
    optionalToursStructured,
    hotelSummaryText,
    structuredSignalsFacts: {
      hasShopping,
      shoppingVisitCount: shop.shoppingVisitCountTotal,
      hasOptionalTour: hasOptionalTours,
    },
  }
}

type MealSlotState = 'yes' | 'no' | 'unknown'

function mealSlotTokenState(raw: string | null | undefined): MealSlotState {
  const t = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t || t === '-' || t === '—' || t === '·') return 'unknown'
  // 「조식 불포함」·「불포함」 — 식사종류 토큰이 있어도 불포함이 우선
  if (/(?:불포함|미포함|제공\s*안\s*함)/u.test(t) || /^(?:없음|X|x)$/u.test(t)) return 'no'
  if (/없음/u.test(t) && !/(호텔식|현지식|기내식|특식|한식|뷔페)/u.test(t)) return 'no'
  return 'yes'
}

function mergeMealSlot(a: MealSlotState, b: MealSlotState): MealSlotState {
  if (a === 'yes' || b === 'yes') return 'yes'
  if (a === 'no' || b === 'no') return 'no'
  return 'unknown'
}

function parseMealSummarySlots(summary: string): {
  breakfast: MealSlotState
  lunch: MealSlotState
  dinner: MealSlotState
} {
  const s = summary.replace(/\s+/g, ' ').trim()
  const out = {
    breakfast: 'unknown' as MealSlotState,
    lunch: 'unknown' as MealSlotState,
    dinner: 'unknown' as MealSlotState,
  }
  const b = s.match(/(?:조식|아침)\s*[-:：]?\s*([^,，/·]+)/u)
  const l = s.match(/(?:중식|점심)\s*[-:：]?\s*([^,，/·]+)/u)
  const d = s.match(/(?:석식|저녁)\s*[-:：]?\s*([^,，/·]+)/u)
  if (b) out.breakfast = mealSlotTokenState(b[1])
  if (l) out.lunch = mealSlotTokenState(l[1])
  if (d) out.dinner = mealSlotTokenState(d[1])
  // `호텔식 / 현지식 / 한식` 3칸
  if (out.breakfast === 'unknown' && out.lunch === 'unknown' && out.dinner === 'unknown') {
    const parts = s.split(/\s*[\/·|]\s*/).map((x) => x.trim()).filter(Boolean)
    if (parts.length === 3) {
      out.breakfast = mealSlotTokenState(parts[0])
      out.lunch = mealSlotTokenState(parts[1])
      out.dinner = mealSlotTokenState(parts[2])
    }
  }
  return out
}

/** 비교용 — 전 일정에서 조·중·석이 한 번이라도 있으면 있음 */
export function formatCompareMealSlotsLabel(days: Array<{
  mealSummaryText?: string | null
  meals?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
}>): string {
  let breakfast: MealSlotState = 'unknown'
  let lunch: MealSlotState = 'unknown'
  let dinner: MealSlotState = 'unknown'
  for (const d of days) {
    breakfast = mergeMealSlot(breakfast, mealSlotTokenState(d.breakfastText))
    lunch = mergeMealSlot(lunch, mealSlotTokenState(d.lunchText))
    dinner = mergeMealSlot(dinner, mealSlotTokenState(d.dinnerText))
    const summary = String(d.mealSummaryText || d.meals || '').trim()
    if (summary) {
      const parsed = parseMealSummarySlots(summary)
      breakfast = mergeMealSlot(breakfast, parsed.breakfast)
      lunch = mergeMealSlot(lunch, parsed.lunch)
      dinner = mergeMealSlot(dinner, parsed.dinner)
    }
  }
  if (breakfast === 'unknown' && lunch === 'unknown' && dinner === 'unknown') return '정보 없음'
  // REGRESSION-FREEZE[supplier-product-fact-ssot]: 조중석 포함·불포함 명시 — manifest
  const parts: string[] = []
  const push = (label: string, s: MealSlotState) => {
    if (s === 'yes') parts.push(`${label} 포함`)
    else if (s === 'no') parts.push(`${label} 불포함`)
    // unknown 슬롯은 비교에서 생략 (일별 미기입 ≠ 없음)
  }
  push('조식', breakfast)
  push('중식', lunch)
  push('석식', dinner)
  return parts.length ? parts.join(' · ') : '정보 없음'
}

/** 제목·호텔문구에서 성급 추출 — `준5성급` / `4성급` / `5성` */
export function extractHotelStarGrade(...texts: Array<string | null | undefined>): string | null {
  const blob = texts.map((t) => String(t ?? '')).join('\n')
  const m = blob.match(/준\s*[3-5]\s*성\s*급?|[3-5]\s*성\s*급/u)
  if (!m) return null
  return m[0]!.replace(/\s+/g, '').replace(/성$/, '성급')
}

function formatHotelLabelWithStar(name: string, star: string | null): string {
  let n = name.replace(/\s+/g, ' ').trim()
  if (!n) return '정보 없음'
  // 잘린 `(4` / 기존 `(4성급)` 꼬리 제거 후 성급 재부착
  n = n
    .replace(/\s*\(\s*준?\s*[3-5]\s*성\s*급?\s*\)\s*$/u, '')
    .replace(/\s*\(\s*[준]?\s*[3-5]\s*성?\s*$/u, '')
    .trim()
  if (!n || /^(?:상세보기|휴식|동급)$/u.test(n)) return '정보 없음'
  if (!star) return n
  if (/성\s*급/.test(n)) return n
  return `${n} (${star})`
}

/**
 * 비교·목록용 항공사 한 줄.
 * 우선순위: 선택/대표 `departureKeyFacts.airline` → 출발행 `carrierName`
 * → rawMeta `structuredSignals.airlineName` (상세 항공 블록과 동일 축).
 * 상담 시·미추출은 발명하지 않음 → `정보 없음`.
 */
export function deriveAirlineFact(p: {
  rawMeta?: string | null
  departures?: Array<{ carrierName?: string | null }> | null
  /** 상세·캘린더 선택일과 동일 축 — 있으면 최우선 */
  departureKeyFactsAirline?: string | null
  selectedDepartureCarrierName?: string | null
}): AirlineFact {
  const rejectConsult = (raw: string) => {
    const t = raw.trim()
    if (!t) return null
    if (/상담\s*시|문의|미정|확인\s*후|별도\s*안내/u.test(t)) return null
    return t
  }
  const fromFacts = rejectConsult(String(p.departureKeyFactsAirline ?? ''))
  if (fromFacts) {
    const label = formatPublicAirlineDisplay(fromFacts)
    if (label) return { airlineLabel: label, source: 'departure_key_facts' }
  }
  const fromSelected = rejectConsult(String(p.selectedDepartureCarrierName ?? ''))
  if (fromSelected) {
    const label = formatPublicAirlineDisplay(fromSelected)
    if (label) return { airlineLabel: label, source: 'selected_departure_carrier' }
  }
  const fromDep = (p.departures ?? [])
    .map((d) => rejectConsult(String(d.carrierName ?? '')))
    .find(Boolean)
  if (fromDep) {
    const label = formatPublicAirlineDisplay(fromDep)
    if (label) return { airlineLabel: label, source: 'departure_carrier' }
  }
  const structured = parseProductRawMetaPublic(p.rawMeta ?? null)?.structuredSignals
  const fromStruct = rejectConsult(String(structured?.airlineName ?? ''))
  if (fromStruct) {
    const label = formatPublicAirlineDisplay(fromStruct)
    if (label) return { airlineLabel: label, source: 'structured_airline' }
  }
  return { airlineLabel: '정보 없음', source: 'none' }
}

/** 섹션 제목·안내 헤더 — 숙소명으로 채택 금지 */
function isHotelSectionHeading(raw: string): boolean {
  const t = raw.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (/^(?:날씨\s*및\s*호텔|날씨\/호텔|호텔\s*및\s*날씨)$/u.test(t)) return true
  if (/^(?:호텔\s*정보|숙소\s*안내|숙박\s*안내|호텔\s*안내)$/u.test(t)) return true
  if (/날씨\s*및\s*호텔|호텔\s*정보\s*안내/u.test(t) && t.length <= 24) return true
  return false
}

export function deriveHotelMealFact(p: {
  title?: string | null
  hotelSummaryText?: string | null
  hotelSummaryRaw?: string | null
  rawMeta?: string | null
  /** FIT/에어텔이면 식사칸을 예시일정 조중석으로 채우지 않음 */
  listingKind?: string | null
  productType?: string | null
  slug?: string | null
  isFit?: boolean | null
  schedule?: unknown
  itineraryDays?: Array<{
    hotelText?: string | null
    mealSummaryText?: string | null
    meals?: string | null
    breakfastText?: string | null
    lunchText?: string | null
    dinnerText?: string | null
  }> | null
}): HotelMealFact {
  const schedule = getScheduleFromProduct(p as Parameters<typeof getScheduleFromProduct>[0])
  const days = [...schedule, ...(p.itineraryDays ?? [])]
  const meta = parseProductRawMetaPublic(p.rawMeta ?? null)?.structuredSignals
  const hotelNames = Array.isArray(meta?.hotelNames)
    ? meta!.hotelNames!.map((x) => String(x).trim()).filter(Boolean)
    : []
  const planHotels: string[] = []
  if (Array.isArray(meta?.dayHotelPlans)) {
    for (const row of meta!.dayHotelPlans!) {
      const hotels = (row as { hotels?: unknown }).hotels
      if (Array.isArray(hotels)) {
        for (const h of hotels) {
          const s = String(h ?? '').trim()
          if (s) planHotels.push(s)
        }
      }
    }
  }

  let hotel = ''
  const candidates = [
    p.hotelSummaryText,
    ...hotelNames,
    ...planHotels,
    p.hotelSummaryRaw,
    ...days.map((d) => (d as { hotelText?: string | null }).hotelText),
  ]
  for (const c of candidates) {
    if (isHotelSectionHeading(String(c ?? ''))) continue
    const h = scrubPublicHotelDisplayLine(c)
    if (!h) continue
    if (isHotelSectionHeading(h)) continue
    if (/^(?:조식|중식|석식|아침|점심|저녁|불포함|기내식)(?:\s|$|\/)/u.test(h) && !/(호텔|Hotel|Resort)/i.test(h)) {
      continue
    }
    hotel = h
    break
  }
  // 제목에 숙소 브랜드가 있으면 보강 — 상품 제목 전체·프로모 문구는 제외
  if (!hotel && p.title) {
    const titleCore = String(p.title)
      .replace(/^\[[^\]]*\]\s*/g, '')
      .replace(/\d+\s*박\s*\d+\s*일.*$/u, '')
      .replace(/[（(]\s*준?\s*[3-5]\s*성\s*급?\s*[）)]/gu, '')
      .replace(/#.*$/u, '')
      .trim()
    const fromTitle = scrubPublicHotelDisplayLine(titleCore)
    if (
      fromTitle &&
      fromTitle.length <= 48 &&
      !/^\[[^\]]+\]/.test(fromTitle) &&
      !/[【】]|골프|#|\d+\s*일\b|\d+\s*박\b/u.test(fromTitle) &&
      /(노보텔|메리어트|힐튼|하얏트|쉐라톤|코트야드|Hotel|Resort|리조트)/i.test(fromTitle) &&
      /(호텔|Hotel|Resort|리조트)/i.test(fromTitle)
    ) {
      hotel = fromTitle
    }
  }

  // 참좋은여행: 호텔/관광지·[호텔설명] 축약 (미정→등급+공지 / 예정명→동급 추후안내)
  // 일반 「도시 예정 호텔」placeholder에는 적용하지 않음
  if (!hotel) {
    const vgBlob = [p.hotelSummaryText, p.hotelSummaryRaw, ...hotelNames, ...planHotels]
      .map((x) => String(x ?? ''))
      .join('\n')
    const looksVerygoodHotelSource =
      /\[호텔설명\]/u.test(vgBlob) ||
      /호텔명\s*은\s*미정/u.test(vgBlob) ||
      /준특급\s*호텔에서\s*투숙/u.test(vgBlob) ||
      /hotelTourInfo|class="name"/i.test(vgBlob) ||
      /혹은\s*동급\s*\(\s*추후안내\s*\)/u.test(vgBlob) ||
      /출발일\s*1~2일전\s*공지/u.test(vgBlob)
    if (looksVerygoodHotelSource) {
      const vg = formatVerygoodtourHotelLabelFromTextBlobs(
        p.hotelSummaryText,
        p.hotelSummaryRaw,
        ...hotelNames,
        ...planHotels,
      )
      if (vg) hotel = vg
    }
  } else if (/혹은\s*동급|출발일\s*1~2일전\s*공지/u.test(hotel)) {
    // 이미 VG 축약형 — 성급 꼬리 재부착하지 않음
    return {
      hotelLabel: hotel,
      mealLabel: resolveCompareMealLabel(p, days),
      hotelStarGrade: extractHotelStarGrade(hotel, p.title, p.hotelSummaryRaw),
    }
  }

  const star = extractHotelStarGrade(
    p.title,
    p.hotelSummaryText,
    p.hotelSummaryRaw,
    hotel,
    ...hotelNames,
    ...planHotels,
  )
  // VG 축약형에는 `(준5성급)` 중복 부착하지 않음
  if (/혹은\s*동급|출발일\s*1~2일전\s*공지/u.test(hotel)) {
    return {
      hotelLabel: hotel,
      mealLabel: resolveCompareMealLabel(p, days),
      hotelStarGrade: star,
    }
  }
  return {
    hotelLabel: formatHotelLabelWithStar(hotel, star),
    mealLabel: resolveCompareMealLabel(p, days),
    hotelStarGrade: star,
  }
}

function isFitProductForMealFact(p: {
  listingKind?: string | null
  productType?: string | null
  slug?: string | null
  isFit?: boolean | null
}): boolean {
  if (p.isFit === true) return true
  if (String(p.slug || '')
    .trim()
    .toLowerCase()
    .startsWith('fit-')) {
    return true
  }
  const lk = String(p.listingKind || '').trim()
  if (lk === 'air_hotel_free') return true
  const pt = String(p.productType || '')
    .trim()
    .toLowerCase()
  return pt === 'air-hotel' || pt === 'airtel' || pt === 'air_hotel' || pt === 'air-tel'
}

/** 공급사가 조식 포함을 명시한 경우만 true (호텔식·예시일정 추정 금지) */
function fitSourceExplicitlyIncludesBreakfast(hay: string): boolean {
  const t = hay.replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (/(?:조식|아침)\s*(?:불포함|미포함)/u.test(t)) return false
  if (/(?:룸\s*온리|room\s*only)/i.test(t)) return false
  return (
    /조식\s*포함|조식포함/u.test(t) ||
    /breakfast\s*included/i.test(t) ||
    /(?:포함)\s*[:：]?\s*조식/u.test(t)
  )
}

/** FIT/에어텔: 명시 조식포함만 「호텔 조식」; 룸온리·미상 → 상담 시 안내 */
function resolveCompareMealLabel(
  p: {
    listingKind?: string | null
    productType?: string | null
    slug?: string | null
    isFit?: boolean | null
    hotelSummaryText?: string | null
    hotelSummaryRaw?: string | null
    includedText?: string | null
  },
  days: Array<{
    mealSummaryText?: string | null
    meals?: string | null
    breakfastText?: string | null
    lunchText?: string | null
    dinnerText?: string | null
  }>,
): string {
  if (!isFitProductForMealFact(p)) {
    return formatCompareMealSlotsLabel(days)
  }
  const hay = [
    p.hotelSummaryText,
    p.hotelSummaryRaw,
    p.includedText,
    ...days.map((d) => d.breakfastText),
    ...days.map((d) => d.mealSummaryText),
    ...days.map((d) => d.meals),
  ]
    .map((x) => String(x ?? ''))
    .join('\n')
  if (fitSourceExplicitlyIncludesBreakfast(hay)) return '호텔 조식'
  return '상담 시 안내'
}

export function formatFactTriState(state: FactTriState, visitCount?: number | null): string {
  if (state === 'yes') {
    if (visitCount != null && visitCount > 0) return `있음 (${visitCount}회)`
    return '있음'
  }
  if (state === 'no') return '없음'
  return '정보 없음'
}
