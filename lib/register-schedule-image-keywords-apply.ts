/**
 * 등록 imageKeyword 규칙 — 6공급사 switch SSOT.
 * preview(클라이언트)·admin UI(서버) 모두 이 모듈만 호출한다. 스위치 복제 금지.
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]
 * REGRESSION-FREEZE[register-schedule-forbidden-city-route-evidence]: Forbidden City — route literal만 허용
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: trip-wide imageKeyword 중복 제거 — manifest
 */
import { applyHanatourScheduleImageKeywordsToRows } from '@/lib/hanatour-schedule-image-keyword'
import { applyKyowontourScheduleImageKeywordsToRows } from '@/lib/kyowontour-schedule-image-keyword'
import { applyLottetourScheduleImageKeywordsToRows } from '@/lib/lottetour-schedule-image-keyword'
import { applyModetourScheduleImageKeywordsToRows } from '@/lib/modetour-schedule-image-keyword'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import type { RegisterScheduleDay as VerygoodRegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'
import { applyVerygoodScheduleImageKeywordsToRows } from '@/lib/verygoodtour-schedule-image-keyword'
import { isRegisterAirtelListing } from '@/lib/register-admin-airtel-listing'
import { applyAirtelRouteTextImageKeywordsToSchedule } from '@/lib/register-airtel-route-image-keyword'
import { applyYbtourScheduleImageKeywordsToRows } from '@/lib/ybtour-schedule-image-keyword'
import { applyNaeiltourScheduleImageKeywordsToRows, type NaeiltourScheduleImageKeywordRow } from '@/lib/naeiltour-schedule-image-keyword'
import { sanitizeRegisterScheduleImageKeywordsFromRouteEvidence } from '@/lib/register-schedule-route-evidence-keyword'
import { sanitizeRegisterScheduleRouteText } from '@/lib/register-schedule-route-place-noise'
import { enforceRegisterScheduleTripUniqueImageKeywords } from '@/lib/register-schedule-trip-image-keyword-dedupe'

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
  /** imageKeyword SSOT — 키워드는 maxPlaces 자르기 전 원본 routeText 순서. 표시용 sanitize는 출력 직전만 */
  // REGRESSION-FREEZE[register-schedule-mongolia-image-keyword]: routeTextRawByDay — manifest
  const routeTextRawByDay = new Map(rows.map((row) => [Number(row.day), row.routeText ?? null]))
  const supplier =
    normalizeSupplierOrigin(String(opts.supplierKey ?? '').trim()) ?? String(opts.supplierKey ?? '').trim()
  const dest = opts.productDestination ?? null
  const title = opts.productTitle ?? null

  let out: T[]
  if (isRegisterAirtelListing(opts.travelScope, opts.productType)) {
    out = applyAirtelRouteTextImageKeywordsToSchedule(rows)
  } else {
    switch (supplier) {
      case 'hanatour':
        out = applyHanatourScheduleImageKeywordsToRows(rows, {
          productDestination: dest,
          optionalTourNames: opts.optionalTourNames,
          scheduleSectionByDay: opts.scheduleSectionByDay ?? null,
        })
        break
      case 'modetour':
        out = applyModetourScheduleImageKeywordsToRows(rows, { productDestination: dest })
        break
      case 'ybtour':
        out = applyYbtourScheduleImageKeywordsToRows(rows, { productDestination: dest })
        break
      case 'verygoodtour':
        out = applyVerygoodScheduleImageKeywordsToRows(rows, {
          detRows: rows as VerygoodRegisterScheduleDay[],
          productDestination: dest,
          totalDays: rows.length,
        })
        break
      case 'lottetour':
        out = applyLottetourScheduleImageKeywordsToRows(rows, {
          productDestination: dest,
          productTitle: title ?? undefined,
        })
        break
      case 'kyowontour':
        out = applyKyowontourScheduleImageKeywordsToRows(rows, {
          productDestination: dest,
          productTitle: title ?? undefined,
        })
        break
      case 'naeiltour':
        out = applyNaeiltourScheduleImageKeywordsToRows(rows as NaeiltourScheduleImageKeywordRow[], {
          productDestination: dest,
          englishLandmarksByDay: opts.naeiltourEnglishLandmarksByDay ?? undefined,
        }) as T[]
        break
      default:
        out = rows
    }
  }
  const withKeywords = enforceRegisterScheduleTripUniqueImageKeywords(
    sanitizeRegisterScheduleImageKeywordsFromRouteEvidence(out),
  )
  return withKeywords.map((row) => {
    const day = Number(row.day)
    const rawRoute = routeTextRawByDay.get(day)
    return {
      ...row,
      routeText: sanitizeRegisterScheduleRouteText(rawRoute ?? row.routeText),
    }
  })
}
