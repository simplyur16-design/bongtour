/**
 * 등록 미리보기 UI — 공급사별 imageKeyword 규칙(클라이언트 번들용).
 * `register-schedule-image-keywords-ui.ts`와 동일 스위치이나 server-only 없음.
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

export type RegisterScheduleImageKeywordPreviewRow = {
  day: number
  title?: string
  description?: string
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

export type ApplyRegisterScheduleImageKeywordsForPreviewOpts = {
  supplierKey: string | null | undefined
  productDestination?: string | null
  productTitle?: string | null
  /** 관리자 등록 travelScope — air_hotel_free 이면 Fit 키워드 유지(패키지 규칙 스킵) */
  travelScope?: string | null
  productType?: string | null
}

export function applyRegisterScheduleImageKeywordsForPreview<
  T extends RegisterScheduleImageKeywordPreviewRow,
>(rows: T[], opts: ApplyRegisterScheduleImageKeywordsForPreviewOpts): T[] {
  if (!rows.length) return rows
  if (isRegisterAirtelListing(opts.travelScope, opts.productType)) {
    return applyAirtelRouteTextImageKeywordsToSchedule(rows)
  }
  const supplier =
    normalizeSupplierOrigin(String(opts.supplierKey ?? '').trim()) ?? String(opts.supplierKey ?? '').trim()
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

/**
 * 미리보기 UI(`buildRegisterPexelsUiRows`)와 confirm 저장본이 같은 imageKeyword·imageKeyword2를 쓰도록
 * 일차별 SSOT 키워드를 LLM `parsed.schedule` 행에 덮어씌운다.
 */
export function overlayPreviewScheduleImageKeywords<
  T extends RegisterScheduleImageKeywordPreviewRow,
>(scheduleRows: T[], previewRows: RegisterScheduleImageKeywordPreviewRow[]): T[] {
  if (!scheduleRows.length || !previewRows.length) return scheduleRows
  const byDay = new Map(previewRows.map((r) => [Number(r.day), r]))
  return scheduleRows.map((row) => {
    const day = Number(row.day)
    if (!Number.isFinite(day) || day < 1) return row
    const ssot = byDay.get(day)
    if (!ssot) return row
    const kw2 = String(ssot.imageKeyword2 ?? '').trim()
    return {
      ...row,
      imageKeyword: String(ssot.imageKeyword ?? '').trim(),
      imageKeyword2: kw2 ? kw2 : null,
    }
  })
}
