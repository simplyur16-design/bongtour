/**
 * routeText SSOT 1순위 — 공급사별 allocate는 routeText 키워드가 비었을 때만 fallback.
 * per-supplier switch는 apply.ts가 아닌 이 모듈에만 둔다 (routing-parity freeze).
 */
import { applyHanatourScheduleImageKeywordsToRows } from '@/lib/hanatour-schedule-image-keyword'
import { applyKyowontourScheduleImageKeywordsToRows } from '@/lib/kyowontour-schedule-image-keyword'
import { applyLottetourScheduleImageKeywordsToRows } from '@/lib/lottetour-schedule-image-keyword'
import { applyModetourScheduleImageKeywordsToRows } from '@/lib/modetour-schedule-image-keyword'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import type { RegisterScheduleDay as VerygoodRegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'
import { applyVerygoodScheduleImageKeywordsToRows } from '@/lib/verygoodtour-schedule-image-keyword'
import { applyYbtourScheduleImageKeywordsToRows } from '@/lib/ybtour-schedule-image-keyword'
import {
  applyRegisterScheduleRouteTextImageKeywordsToRows,
  type RegisterScheduleRouteTextKeywordRow,
} from '@/lib/register-schedule-route-text-image-keyword-ssot'

export type RegisterScheduleRouteSupplierFallbackOpts = {
  supplierKey: string | null | undefined
  productDestination?: string | null
  productTitle?: string | null
  optionalTourNames?: readonly string[]
  scheduleSectionByDay?: ReadonlyMap<number, string> | null
}

function mergeRouteTextKeywordWithSupplierKeyword<T extends RegisterScheduleRouteTextKeywordRow>(
  routeRows: T[],
  supplierRows: T[],
): T[] {
  const supplierByDay = new Map(supplierRows.map((r) => [Number(r.day), r]))
  return routeRows.map((row) => {
    const day = Number(row.day)
    const supplier = supplierByDay.get(day)
    const routeKw = String(row.imageKeyword ?? '').trim()
    const routeKw2 = String(row.imageKeyword2 ?? '').trim()
    const supplierKw = String(supplier?.imageKeyword ?? '').trim()
    const supplierKw2 = String(supplier?.imageKeyword2 ?? '').trim()
    return {
      ...row,
      imageKeyword: routeKw || supplierKw,
      imageKeyword2: routeKw2 || supplierKw2 || null,
    }
  })
}

function applySupplierScheduleImageKeywordFallback<T extends RegisterScheduleRouteTextKeywordRow>(
  rows: T[],
  opts: RegisterScheduleRouteSupplierFallbackOpts,
): T[] {
  const supplier =
    normalizeSupplierOrigin(String(opts.supplierKey ?? '').trim()) ?? String(opts.supplierKey ?? '').trim()
  const dest = opts.productDestination ?? null
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

/** 6공급사 — routeText 순서 SSOT, 빈 슬롯만 공급사 allocate로 보완 */
export function applyRegisterScheduleRouteTextKeywordsWithSupplierFallback<
  T extends RegisterScheduleRouteTextKeywordRow,
>(rows: T[], opts: RegisterScheduleRouteSupplierFallbackOpts): T[] {
  const routeTextOut = applyRegisterScheduleRouteTextImageKeywordsToRows(rows)
  const supplierOut = applySupplierScheduleImageKeywordFallback(rows, opts)
  return mergeRouteTextKeywordWithSupplierKeyword(routeTextOut, supplierOut)
}
