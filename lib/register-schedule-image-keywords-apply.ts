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
  const sanitizedRows = rows.map((row) => ({
    ...row,
    routeText: sanitizeRegisterScheduleRouteText(row.routeText),
  }))
  const supplier =
    normalizeSupplierOrigin(String(opts.supplierKey ?? '').trim()) ?? String(opts.supplierKey ?? '').trim()
  const dest = opts.productDestination ?? null
  const title = opts.productTitle ?? null

  let out: T[]
  if (isRegisterAirtelListing(opts.travelScope, opts.productType)) {
    out = applyAirtelRouteTextImageKeywordsToSchedule(sanitizedRows)
  } else {
    switch (supplier) {
      case 'hanatour':
        out = applyHanatourScheduleImageKeywordsToRows(sanitizedRows, {
          productDestination: dest,
          optionalTourNames: opts.optionalTourNames,
          scheduleSectionByDay: opts.scheduleSectionByDay ?? null,
        })
        break
      case 'modetour':
        out = applyModetourScheduleImageKeywordsToRows(sanitizedRows, { productDestination: dest })
        break
      case 'ybtour':
        out = applyYbtourScheduleImageKeywordsToRows(sanitizedRows, { productDestination: dest })
        break
      case 'verygoodtour':
        out = applyVerygoodScheduleImageKeywordsToRows(sanitizedRows, {
          detRows: sanitizedRows as VerygoodRegisterScheduleDay[],
          productDestination: dest,
          totalDays: sanitizedRows.length,
        })
        break
      case 'lottetour':
        out = applyLottetourScheduleImageKeywordsToRows(sanitizedRows, {
          productDestination: dest,
          productTitle: title ?? undefined,
        })
        break
      case 'kyowontour':
        out = applyKyowontourScheduleImageKeywordsToRows(sanitizedRows, {
          productDestination: dest,
          productTitle: title ?? undefined,
        })
        break
      case 'naeiltour':
        out = applyNaeiltourScheduleImageKeywordsToRows(sanitizedRows as NaeiltourScheduleImageKeywordRow[], {
          productDestination: dest,
          englishLandmarksByDay: opts.naeiltourEnglishLandmarksByDay ?? undefined,
        }) as T[]
        break
      default:
        out = sanitizedRows
    }
  }
  return enforceRegisterScheduleTripUniqueImageKeywords(
    sanitizeRegisterScheduleImageKeywordsFromRouteEvidence(out),
  )
}
