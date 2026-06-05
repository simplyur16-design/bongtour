/**
 * 서버 전용 — 공급사별 imageKeyword 규칙(미리보기 API·등록 파이프라인).
 * 클라이언트(`app/admin/register/page.tsx`)에서 import 금지 — gemini·파서 체인이 번들에 실림.
 */
import 'server-only'
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

export type RegisterScheduleImageKeywordUiRow = {
  day: number
  title?: string
  description?: string
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

export type ApplyRegisterScheduleImageKeywordsForUiOpts = {
  supplierKey: string | null | undefined
  productDestination?: string | null
  productTitle?: string | null
  travelScope?: string | null
  productType?: string | null
}

export function applyRegisterScheduleImageKeywordsForAdminUi<
  T extends RegisterScheduleImageKeywordUiRow,
>(rows: T[], opts: ApplyRegisterScheduleImageKeywordsForUiOpts): T[] {
  if (!rows.length) return rows
  const supplier = normalizeSupplierOrigin(String(opts.supplierKey ?? '').trim()) ?? String(opts.supplierKey ?? '').trim()
  const dest = opts.productDestination ?? null
  if (isRegisterAirtelListing(opts.travelScope, opts.productType)) {
    const routed = applyAirtelRouteTextImageKeywordsToSchedule(rows)
    if (supplier === 'hanatour') {
      return applyHanatourScheduleImageKeywordsToRows(routed, { productDestination: dest })
    }
    return routed
  }
  const title = opts.productTitle ?? null

  switch (supplier) {
    case 'hanatour':
      return applyHanatourScheduleImageKeywordsToRows(rows, { productDestination: dest })
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
