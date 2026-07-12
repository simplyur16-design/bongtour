/**
 * 등록 imageKeyword 규칙 — 6공급사 switch SSOT.
 * preview(클라이언트)·admin UI(서버) 모두 이 모듈만 호출한다. 스위치 복제 금지.
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: domestic-hub-only — adjacent-poi SSOT, hub/airport strip only — manifest
 * REGRESSION-FREEZE[register-schedule-forbidden-city-route-evidence]: Forbidden City — route literal만 허용
 * REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]: routeText 세그먼트 순서 — manifest
 * applyRegisterScheduleRouteTextImageKeywordsToRows — register-schedule-image-keywords-route-supplier-merge.ts
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: trip dedupe·adjacent hub — manifest
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 일자 간 중복 시 route 미사용 명소 차순위 — manifest
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: hanatour gap-fill 후 reconcileRegisterScheduleTripUniqueImageKeywordsAfterGapFill — manifest
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 해외 패키지·2030 테마 — 자유여행 제외 gap-fill 후 trip 중복 차순위 — manifest
 */
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { isRegisterAirtelListing } from '@/lib/register-admin-airtel-listing'
import { applyAirtelRouteTextImageKeywordsToSchedule } from '@/lib/register-airtel-route-image-keyword'
import { applyNaeiltourScheduleImageKeywordsToRows, type NaeiltourScheduleImageKeywordRow } from '@/lib/naeiltour-schedule-image-keyword'
import { sanitizeRegisterScheduleImageKeywordsFromRouteEvidence } from '@/lib/register-schedule-route-evidence-keyword'
import { applyRegisterScheduleRouteTextKeywordsWithSupplierFallback } from '@/lib/register-schedule-image-keywords-route-supplier-merge'
import { expandSingleSegmentPoiRouteTextRows, prepareRegisterScheduleRowsForImageKeywordApply } from '@/lib/register-schedule-route-text-backfill'
import { isRegisterScheduleCrossContinentHallucinationKeyword } from '@/lib/register-schedule-cross-continent-keyword-guard'
import { sanitizeRegisterScheduleRouteText } from '@/lib/register-schedule-route-place-noise'
import { enforceRegisterScheduleTripUniqueImageKeywords, applyDomesticHubOnlyDepartureReturnAdjacentKeywords, fillRegisterScheduleMiddleDayImageKeywordGaps, ensureDepartureReturnVisitCityKeywords, reconcileRegisterScheduleTripUniqueImageKeywordsAfterGapFill } from '@/lib/register-schedule-trip-image-keyword-dedupe'
import { resolveScheduleKeywordSlotKind } from '@/lib/schedule-image-keyword-adjacent-poi'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'

function promoteMiddleDayEmptyPrimaryFromKeyword2<T extends RegisterScheduleImageKeywordApplyRow>(
  rows: T[],
): T[] {
  if (!rows.length) return rows
  const maxDay = Math.max(...rows.map((r) => Number(r.day)).filter((d) => d > 0))
  const activeDays = rows.filter((r) => Number(r.day) > 0).length
  const usedPrimary = new Set<string>()
  for (const row of rows) {
    const pk = normScheduleImageKeywordKey(String(row.imageKeyword ?? '').trim())
    if (pk) usedPrimary.add(pk)
  }
  return rows.map((row) => {
    const day = Number(row.day)
    const slot = day > 0 ? resolveScheduleKeywordSlotKind(day, maxDay, activeDays) : 'middle'
    const pk = String(row.imageKeyword ?? '').trim()
    const sk = String(row.imageKeyword2 ?? '').trim()
    if (slot !== 'middle' || pk || !sk) return row
    const skNk = normScheduleImageKeywordKey(sk)
    if (skNk && usedPrimary.has(skNk)) return row
    if (skNk) usedPrimary.add(skNk)
    return { ...row, imageKeyword: sk, imageKeyword2: null }
  })
}

export type RegisterScheduleImageKeywordApplyRow = {
  day: number
  title?: string
  description?: string
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

export type ApplyRegisterScheduleImageKeywordsOpts = {
  supplierKey: string | null | undefined
  productDestination?: string | null
  productTitle?: string | null
  travelScope?: string | null
  productType?: string | null
  /** 패키지 자유관광일 예시 imageKeyword — optionalToursStructured 행명 */
  optionalTourNames?: readonly string[]
  /** detailBody schedule_section 일차별 원문(명소 추출 SSOT) */
  scheduleSectionByDay?: ReadonlyMap<number, string> | null
  /** naeiltour tab1 h3 span 영문 랜드마크 — imageKeyword 슬롯 SSOT */
  naeiltourEnglishLandmarksByDay?: ReadonlyMap<number, string[]> | null
}

export function applyRegisterScheduleImageKeywordsBySupplier<
  T extends RegisterScheduleImageKeywordApplyRow,
>(rows: T[], opts: ApplyRegisterScheduleImageKeywordsOpts): T[] {
  if (!rows.length) return rows
  /** package — stale Gemini·공급사 키워드 무시, routeText 순서 SSOT만 (preview·서버 공통) */
  const rowsForApply = isRegisterAirtelListing(opts.travelScope, opts.productType)
    ? rows
    : rows.map((row) => ({ ...row, imageKeyword: '', imageKeyword2: null }))
  const prepared = expandSingleSegmentPoiRouteTextRows(
    prepareRegisterScheduleRowsForImageKeywordApply(rowsForApply),
  )
  /** imageKeyword SSOT — 키워드는 maxPlaces 자르기 전 원본 routeText 순서. 표시용 sanitize는 출력 직전만 */
  const routeTextRawByDay = new Map(prepared.map((row) => [Number(row.day), row.routeText ?? null]))
  const supplier =
    normalizeSupplierOrigin(String(opts.supplierKey ?? '').trim()) ?? String(opts.supplierKey ?? '').trim()
  const dest = opts.productDestination ?? null

  let out: T[]
  if (isRegisterAirtelListing(opts.travelScope, opts.productType)) {
    out = applyAirtelRouteTextImageKeywordsToSchedule(prepared)
  } else if (supplier === 'naeiltour') {
    out = applyNaeiltourScheduleImageKeywordsToRows(prepared as NaeiltourScheduleImageKeywordRow[], {
      productDestination: dest,
      englishLandmarksByDay: opts.naeiltourEnglishLandmarksByDay ?? undefined,
    }) as T[]
  } else {
    out = applyRegisterScheduleRouteTextKeywordsWithSupplierFallback(prepared, {
      supplierKey: supplier,
      productDestination: dest,
      productTitle: opts.productTitle ?? null,
      optionalTourNames: opts.optionalTourNames,
      scheduleSectionByDay: opts.scheduleSectionByDay ?? null,
    })
  }
  const crossContinentStripped = out.map((row) => {
    const kw = String(row.imageKeyword ?? '').trim()
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    const strip = (k: string) =>
      k && isRegisterScheduleCrossContinentHallucinationKeyword(k, dest, prepared) ? '' : k
    return {
      ...row,
      imageKeyword: strip(kw),
      imageKeyword2: strip(kw2) || null,
    }
  })
  const deduped = enforceRegisterScheduleTripUniqueImageKeywords(crossContinentStripped)
  const sanitized = sanitizeRegisterScheduleImageKeywordsFromRouteEvidence(deduped)
  const promoted = promoteMiddleDayEmptyPrimaryFromKeyword2(sanitized)
  const withKeywords = fillRegisterScheduleMiddleDayImageKeywordGaps(
    ensureDepartureReturnVisitCityKeywords(
      fillRegisterScheduleMiddleDayImageKeywordGaps(
        applyDomesticHubOnlyDepartureReturnAdjacentKeywords(
          enforceRegisterScheduleTripUniqueImageKeywords(promoted),
          { productDestination: dest },
        ),
      ),
      dest,
    ),
  )
  const isPackageListing = !isRegisterAirtelListing(opts.travelScope, opts.productType)
  const finalDeduped = isPackageListing
    ? reconcileRegisterScheduleTripUniqueImageKeywordsAfterGapFill(withKeywords)
    : withKeywords
  // reconcile 후 귀국·출발 빈 슬롯 재보충 (중간일 gap-fill이 마지막 고유 랜드마크를 선점한 경우)
  const withReturnRefill = ensureDepartureReturnVisitCityKeywords(finalDeduped, dest)
  return withReturnRefill.map((row) => {
    const day = Number(row.day)
    const rawRoute = routeTextRawByDay.get(day)
    return {
      ...row,
      routeText: sanitizeRegisterScheduleRouteText(rawRoute ?? row.routeText),
    }
  })
}
