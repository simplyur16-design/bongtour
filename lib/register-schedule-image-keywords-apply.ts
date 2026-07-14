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
 * REGRESSION-FREEZE[register-schedule-hawaii-free-day-example-itinerary]: tip/example free day detect — manifest
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
import { isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { mapDestination } from '@/lib/pexels-keyword'
import { applyHawaiiFreeDayRecommendedExampleItineraries } from '@/lib/register-schedule-hawaii-free-day-example-itinerary'

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
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: keyword collect on sanitized route — manifest
  const preparedForKeywords = prepared.map((row) => ({
    ...row,
    routeText: sanitizeRegisterScheduleRouteText(row.routeText) ?? row.routeText,
  }))
  const dest = opts.productDestination ?? null
  const supplier =
    normalizeSupplierOrigin(String(opts.supplierKey ?? '').trim()) ?? String(opts.supplierKey ?? '').trim()
  // REGRESSION-FREEZE[register-schedule-hawaii-free-day-example-itinerary]: tip/example free day detect — manifest
  const preparedWithHawaiiExamples = applyHawaiiFreeDayRecommendedExampleItineraries(
    preparedForKeywords,
    {
      productDestination: dest,
      productTitle: opts.productTitle ?? null,
    },
  )
  /** display sanitize는 출력 직전 — 키워드는 sanitize·예시 시드 후 세그먼트 순서 SSOT */
  const routeTextRawByDay = new Map(
    preparedWithHawaiiExamples.map((row) => [Number(row.day), row.routeText ?? null]),
  )

  let out: T[]
  if (isRegisterAirtelListing(opts.travelScope, opts.productType)) {
    out = applyAirtelRouteTextImageKeywordsToSchedule(preparedWithHawaiiExamples)
  } else if (supplier === 'naeiltour') {
    out = applyNaeiltourScheduleImageKeywordsToRows(preparedWithHawaiiExamples as NaeiltourScheduleImageKeywordRow[], {
      productDestination: dest,
      englishLandmarksByDay: opts.naeiltourEnglishLandmarksByDay ?? undefined,
    }) as T[]
  } else {
    out = applyRegisterScheduleRouteTextKeywordsWithSupplierFallback(preparedWithHawaiiExamples, {
      supplierKey: supplier,
      productDestination: dest,
      productTitle: opts.productTitle ?? null,
      optionalTourNames: opts.optionalTourNames,
      scheduleSectionByDay: opts.scheduleSectionByDay ?? null,
    })
  }
  out = applyHawaiiFreeDayRecommendedExampleItineraries(out, {
    productDestination: dest,
    productTitle: opts.productTitle ?? null,
  }) as T[]
  const crossContinentStripped = out.map((row) => {
    const kw = String(row.imageKeyword ?? '').trim()
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    const strip = (k: string) =>
      k && isRegisterScheduleCrossContinentHallucinationKeyword(k, dest, preparedForKeywords) ? '' : k
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
  const reconciled = isPackageListing
    ? reconcileRegisterScheduleTripUniqueImageKeywordsAfterGapFill(withKeywords)
    : withKeywords
  // REGRESSION-FREEZE[register-schedule-hawaii-free-day-example-itinerary]: tip/example free day detect — manifest
  const finalDeduped = applyHawaiiFreeDayRecommendedExampleItineraries(reconciled, {
    productDestination: dest,
    productTitle: opts.productTitle ?? null,
  }) as T[]
  for (const row of finalDeduped) {
    routeTextRawByDay.set(Number(row.day), row.routeText ?? null)
  }
  // reconcile 후 귀국·출발 빈 슬롯 재보충 (중간일 gap-fill이 마지막 고유 랜드마크를 선점한 경우)
  const withReturnRefill = ensureDepartureReturnVisitCityKeywords(finalDeduped, dest)
  // 귀국 슬롯이 중간일 랜드마크와 fuzzy 중복이면 방문도시 soft-dup으로 교체
  const maxDayFinal = Math.max(...withReturnRefill.map((r) => Number(r.day)).filter((d) => d > 0), 0)
  const pickTripVisitCitySoftDup = (): string => {
    for (const row of [...withReturnRefill].sort((a, b) => Number(b.day) - Number(a.day))) {
      if (Number(row.day) >= maxDayFinal) continue
      for (const seg of String(row.routeText ?? '')
        .split(/\s+-\s+/)
        .map((s) => s.trim())
        .filter(Boolean)) {
        const mapped = mapDestination(seg)
        if (
          mapped &&
          isBareCityOrCountryKeyword(mapped) &&
          !/^(?:Vietnam|Thailand|Japan|Korea|China|Indonesia|Malaysia|Cambodia|Laos|Philippines|Singapore)$/i.test(
            mapped,
          )
        ) {
          return mapped
        }
      }
    }
    const fromDest = mapDestination(String(dest ?? '').trim())
    if (fromDest && isBareCityOrCountryKeyword(fromDest)) return fromDest
    return ''
  }
  const middleUsedNk = new Set<string>()
  for (const row of withReturnRefill) {
    const d = Number(row.day)
    if (d <= 1 || d >= maxDayFinal) continue
    for (const slot of [row.imageKeyword, row.imageKeyword2]) {
      const nk = normScheduleImageKeywordKey(String(slot ?? '').trim())
      if (nk) middleUsedNk.add(nk)
    }
  }
  const returnDeduped = withReturnRefill.map((row) => {
    const d = Number(row.day)
    if (d !== maxDayFinal || maxDayFinal < 2) return row
    let kw = String(row.imageKeyword ?? '').trim()
    if (
      !kw ||
      /^(?:Vietnam|Thailand|Japan|Korea|China|Indonesia|Malaysia|Cambodia|Laos|Philippines|Singapore|베트남|태국|일본|한국|중국)$/i.test(
        kw,
      )
    ) {
      const soft = pickTripVisitCitySoftDup()
      if (soft) {
        return { ...row, imageKeyword: soft, imageKeyword2: null }
      }
      if (!kw) return row
    }
    const nk = normScheduleImageKeywordKey(kw)
    let clash = middleUsedNk.has(nk)
    if (!clash) {
      for (const u of middleUsedNk) {
        if (nk.includes(u) || u.includes(nk)) {
          clash = true
          break
        }
      }
    }
    if (!clash) return row
    if (isBareCityOrCountryKeyword(kw)) {
      return { ...row, imageKeyword: kw, imageKeyword2: null }
    }
    const soft = pickTripVisitCitySoftDup()
    if (soft) {
      return { ...row, imageKeyword: soft, imageKeyword2: null }
    }
    return { ...row, imageKeyword: '', imageKeyword2: null }
  })
  // 귀국 soft-dup 방문도시와 겹치는 중간일 bare-city kw2 제거
  const returnNk = normScheduleImageKeywordKey(
    String(returnDeduped.find((r) => Number(r.day) === maxDayFinal)?.imageKeyword ?? '').trim(),
  )
  const middleBareCleared = returnDeduped.map((row) => {
    const d = Number(row.day)
    if (d <= 1 || d >= maxDayFinal) return row
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    if (!kw2 || !returnNk) return row
    const nk2 = normScheduleImageKeywordKey(kw2)
    if (nk2 === returnNk && isBareCityOrCountryKeyword(kw2)) {
      return { ...row, imageKeyword2: null }
    }
    return row
  })
  const finalCrossStripped = middleBareCleared.map((row) => {
    const kw = String(row.imageKeyword ?? '').trim()
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    const strip = (k: string) =>
      k && isRegisterScheduleCrossContinentHallucinationKeyword(k, dest, preparedForKeywords) ? '' : k
    return {
      ...row,
      imageKeyword: strip(kw),
      imageKeyword2: strip(kw2) || null,
    }
  })
  return finalCrossStripped.map((row) => {
    const day = Number(row.day)
    const rawRoute = routeTextRawByDay.get(day)
    return {
      ...row,
      routeText: sanitizeRegisterScheduleRouteText(rawRoute ?? row.routeText),
    }
  })
}
