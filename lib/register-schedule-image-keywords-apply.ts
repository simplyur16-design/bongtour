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
import {
  inferRegisterEffectiveProductDestination,
  isRegisterScheduleCrossContinentHallucinationKeyword,
} from '@/lib/register-schedule-cross-continent-keyword-guard'
import { sanitizeRegisterScheduleRouteText, isRegisterScheduleDomesticHubRouteSegment } from '@/lib/register-schedule-route-place-noise'
import { enforceRegisterScheduleTripUniqueImageKeywords, applyDomesticHubOnlyDepartureReturnAdjacentKeywords, fillRegisterScheduleMiddleDayImageKeywordGaps, ensureDepartureReturnVisitCityKeywords, reconcileRegisterScheduleTripUniqueImageKeywordsAfterGapFill, isAirlineOnlyMovementRouteText, isAirportTransferOrCityHubOnlyMiddleRoute } from '@/lib/register-schedule-trip-image-keyword-dedupe'
import { resolveScheduleKeywordSlotKind, isScheduleDomesticHubOnlyRouteText } from '@/lib/schedule-image-keyword-adjacent-poi'
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
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: all-noise return route must not restore dirty text — manifest
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: domestic hub return keep unused landmark not bare city — manifest
  const preparedForKeywords = (() => {
    const maxDayPrep = Math.max(...prepared.map((r) => Number(r.day)).filter((d) => d > 0), 0)
    return prepared.map((row) => {
      const cleaned = sanitizeRegisterScheduleRouteText(row.routeText)
      if (cleaned) return { ...row, routeText: cleaned }
      const raw = String(row.routeText ?? '').trim()
      if (!raw) return row
      // 인천 only — hub SSOT 유지 (blank 하면 Nha Trang bare soft-dup 회귀)
      if (isScheduleDomesticHubOnlyRouteText(raw, isRegisterScheduleDomesticHubRouteSegment)) {
        return { ...row, routeText: raw }
      }
      // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: airline-only departure keep raw route — manifest
      // 항공사명만 sanitize→빈 route면 airline-only 가드 실패 → 다음 관광일 landmark forward-fill
      if (isAirlineOnlyMovementRouteText(raw)) {
        return { ...row, routeText: raw }
      }
      // 출발·귀국 해외공항 only — sanitize→빈 route면 ownReturnCity 상실 → Rotorua 등 타도시 명소 bleed
      // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return airport/duty-free no unused landmark bleed — manifest
      const day = Number(row.day)
      if (
        (day === 1 || day === maxDayPrep) &&
        /(?:공항|Airport)/i.test(raw) &&
        !/(?:시내|명소|관광|크루즈|공원|사원|박물관)/i.test(raw)
      ) {
        return { ...row, routeText: raw }
      }
      // 면세·해외공항만 — 원문 복원하지 않음(미사용 명소 bleed 방지)
      return { ...row, routeText: '' }
    })
  })()
  const dest = inferRegisterEffectiveProductDestination(
    opts.productDestination ?? null,
    preparedForKeywords,
  )
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
          !/[\uAC00-\uD7AF]/.test(mapped) &&
          !/^(?:Vietnam|Thailand|Japan|Korea|China|Indonesia|Malaysia|Cambodia|Laos|Philippines|Singapore|Europe|Asia|Africa|아프리카|아시아|유럽|중동)$/i.test(
            mapped,
          )
        ) {
          return mapped
        }
      }
    }
    const fromDest = mapDestination(String(dest ?? '').trim())
    if (
      fromDest &&
      isBareCityOrCountryKeyword(fromDest) &&
      !/[\uAC00-\uD7AF]/.test(fromDest) &&
      !/^(?:Europe|Asia|Africa|Vietnam|Thailand|Japan|Korea|China)$/i.test(fromDest)
    ) {
      return fromDest
    }
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
      /^(?:Vietnam|Thailand|Japan|Korea|China|Indonesia|Malaysia|Cambodia|Laos|Philippines|Singapore|베트남|태국|일본|한국|중국|Europe|Asia|Africa|아프리카|아시아|유럽|중동)$/i.test(
        kw,
      ) ||
      /[\uAC00-\uD7AF]/.test(kw)
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
  // strip으로 primary만 비운 슬롯만 재채움 — 전역 gap-fill 재실행은 D1 비움·타대륙 환각 유발
  const afterStripPrimaryRefill = fillRegisterScheduleMiddleDayImageKeywordGaps(finalCrossStripped).map(
    (row, idx) => {
      const before = finalCrossStripped[idx]!
      const beforeKw = String(before.imageKeyword ?? '').trim()
      const afterKw = String(row.imageKeyword ?? '').trim()
      const beforeKw2 = String(before.imageKeyword2 ?? '').trim()
      // primary가 strip 전에도 비어 있었거나, 새로 채운 값이 다시 환각이면 유지/거부
      if (!beforeKw && afterKw) {
        if (isRegisterScheduleCrossContinentHallucinationKeyword(afterKw, dest, preparedForKeywords)) {
          return { ...before, imageKeyword: '', imageKeyword2: before.imageKeyword2 }
        }
        return {
          ...before,
          imageKeyword: afterKw,
          imageKeyword2: beforeKw2 ? before.imageKeyword2 : row.imageKeyword2,
        }
      }
      return before
    },
  )
  const afterStripReturn = ensureDepartureReturnVisitCityKeywords(afterStripPrimaryRefill, dest)
  const finalSanitized = afterStripReturn.map((row) => {
    const day = Number(row.day)
    const rawRoute = routeTextRawByDay.get(day)
    let kw = String(row.imageKeyword ?? '').trim()
    let kw2 = String(row.imageKeyword2 ?? '').trim()
    const strip = (k: string) =>
      k && isRegisterScheduleCrossContinentHallucinationKeyword(k, dest, preparedForKeywords) ? '' : k
    kw = strip(kw)
    kw2 = strip(kw2)
    if (kw && kw2 && normScheduleImageKeywordKey(kw) === normScheduleImageKeywordKey(kw2)) {
      kw2 = ''
    }
    return {
      ...row,
      imageKeyword: kw,
      imageKeyword2: kw2 || null,
      routeText: sanitizeRegisterScheduleRouteText(rawRoute ?? row.routeText),
    }
  })
  if (!isPackageListing) return finalSanitized

  // 최종 strip·refill이 landmark를 재주입할 수 있으므로 출력 직전 exact trip-unique를 한 번 더 고정.
  // 중복 landmark는 당일/여행 방문도시 soft-dup으로 교체한다(빈칸·타일 명소 유입보다 우선).
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: middle empty → visit-city soft-dup — manifest
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: Africa safari day-route evidence — SEQP01 bleed 금지 — manifest
  // bare 방문도시 soft-dup은 출발·귀국↔호텔/공항이동 중간일만 — Osaka D2 관광일 soft-dup 금지
  const used = new Map<string, number>()
  return finalSanitized.map((row) => {
    const day = Number(row.day)
    let kw = String(row.imageKeyword ?? '').trim()
    let kw2 = String(row.imageKeyword2 ?? '').trim()
    const nk = normScheduleImageKeywordKey(kw)
    if (nk && used.has(nk)) {
      const prev = used.get(nk)!
      const isCurrentEdge = day <= 1 || day >= maxDayFinal
      const isPrevEdge = prev <= 1 || prev >= maxDayFinal
      if (isBareCityOrCountryKeyword(kw) && isCurrentEdge && isPrevEdge) {
        // keep dep↔return soft-dup
      } else if (isBareCityOrCountryKeyword(kw) && (isCurrentEdge || isPrevEdge)) {
        // 출발/귀국 edge는 방문도시 soft-dup 유지 (D1 Dubai ↔ D13 hotel ↔ D15 return)
        // 중간 관광일만 출발 도시 soft-dup 금지 (Osaka D2)
        if (isCurrentEdge) {
          // keep
        } else {
          const middleRt = String(row.routeText ?? '')
          const allowMiddleHotel =
            isAirportTransferOrCityHubOnlyMiddleRoute(middleRt) ||
            /(?:호텔|Hotel|체크인|숙박|Resort|휴식|팔라조|Palazzo|베르사체|Versace|메리어트|Marriott|힐튼|Hilton|Hyatt)/i.test(
              middleRt,
            )
          if (allowMiddleHotel) {
            // keep SEQP01 hotel soft-dup
          } else if (kw2 && normScheduleImageKeywordKey(kw2) !== nk) {
            kw = kw2
            kw2 = ''
          } else {
            kw = ''
          }
        }
      } else if (isBareCityOrCountryKeyword(kw)) {
        kw = ''
      } else {
        const soft = pickTripVisitCitySoftDup()
        const softNk = soft ? normScheduleImageKeywordKey(soft) : ''
        kw = soft && softNk && softNk !== nk && !used.has(softNk) ? soft : ''
      }
    }
    const finalNk = normScheduleImageKeywordKey(kw)
    if (finalNk) used.set(finalNk, day)
    const nk2 = normScheduleImageKeywordKey(kw2)
    if (nk2 && (used.has(nk2) || nk2 === finalNk)) {
      kw2 = ''
    }
    const finalNk2 = normScheduleImageKeywordKey(kw2)
    if (finalNk2) used.set(finalNk2, day)
    return {
      ...row,
      imageKeyword: kw,
      imageKeyword2: kw2 || null,
    }
  })
}
