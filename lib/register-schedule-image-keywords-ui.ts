/**
 * 관리자 등록 미리보기(Pexels 패널) — 서버 파이프라인과 동일한 공급사별 imageKeyword 규칙 적용.
 * `finalizeRegisterScheduleImageKeywords`만으로는 한글 route·추론 폴백이 반영되지 않는다.
 */
import { applyHanatourScheduleImageKeywordsToRows } from '@/lib/hanatour-schedule-image-keyword'
import { applyKyowontourScheduleImageKeywordsToRows } from '@/lib/kyowontour-schedule-image-keyword'
import { applyLottetourScheduleImageKeywordsToRows } from '@/lib/lottetour-schedule-image-keyword'
import { applyModetourScheduleImageKeywordsToRows } from '@/lib/modetour-schedule-image-keyword'
import { normalizeSupplierOrigin } from '@/lib/supplier-origin'
import { applyVerygoodScheduleImageKeywordsToRows } from '@/lib/verygoodtour-schedule-image-keyword'
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
}

export function applyRegisterScheduleImageKeywordsForAdminUi<
  T extends RegisterScheduleImageKeywordUiRow,
>(rows: T[], opts: ApplyRegisterScheduleImageKeywordsForUiOpts): T[] {
  if (!rows.length) return rows
  const supplier = normalizeSupplierOrigin(String(opts.supplierKey ?? '').trim()) ?? String(opts.supplierKey ?? '').trim()
  const dest = opts.productDestination ?? null
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
        detRows: rows,
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
