/**
 * 등록 imageKeyword 규칙 — 6공급사 switch SSOT.
 * preview(클라이언트)·admin UI(서버) 모두 이 모듈만 호출한다. 스위치 복제 금지.
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]
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
}

export function applyRegisterScheduleImageKeywordsBySupplier<
  T extends RegisterScheduleImageKeywordApplyRow,
>(rows: T[], opts: ApplyRegisterScheduleImageKeywordsOpts): T[] {
  if (!rows.length) return rows
  const supplier =
    normalizeSupplierOrigin(String(opts.supplierKey ?? '').trim()) ?? String(opts.supplierKey ?? '').trim()
  const dest = opts.productDestination ?? null
  if (isRegisterAirtelListing(opts.travelScope, opts.productType)) {
    return applyAirtelRouteTextImageKeywordsToSchedule(rows)
  }
  const title = opts.productTitle ?? null

  switch (supplier) {
    case 'hanatour':
      return applyHanatourScheduleImageKeywordsToRows(rows, {
        productDestination: dest,
        optionalTourNames: opts.optionalTourNames,
        scheduleSectionByDay: opts.scheduleSectionByDay ?? null,
      })
    case 'modetour':
      return applyModetourScheduleImageKeywordsToRows(rows, { productDestination: dest })
    case 'ybtour':
      return applyYbtourScheduleImageKeywordsToRows(rows, { productDestination: dest })
    case 'verygoodtour':
      return applyVerygoodScheduleImageKeywordsToRows(rows, {
        detRows: rows as VerygoodRegisterScheduleDay[],
        productDestination: dest,
        totalDays: rows.length,
      })
    case 'lottetour':
      return applyLottetourScheduleImageKeywordsToRows(rows, {
        productDestination: dest,
        productTitle: title ?? undefined,
      })
    case 'kyowontour':
      return applyKyowontourScheduleImageKeywordsToRows(rows, {
        productDestination: dest,
        productTitle: title ?? undefined,
      })
    default:
      return rows
  }
}
