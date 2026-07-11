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
import { resolveScheduleKeywordSlotKind } from '@/lib/schedule-image-keyword-adjacent-poi'
import { isRegisterScheduleCrossContinentHallucinationKeyword } from '@/lib/register-schedule-cross-continent-keyword-guard'
import { isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'

export type RegisterScheduleRouteSupplierFallbackOpts = {
  supplierKey: string | null | undefined
  productDestination?: string | null
  productTitle?: string | null
  optionalTourNames?: readonly string[]
  scheduleSectionByDay?: ReadonlyMap<number, string> | null
}

/** 공급사 allocate 입력 — title/description null → undefined (supplier row 타입 호환) */
type SupplierScheduleImageKeywordRow = {
  day: number
  title?: string
  description?: string
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

function toSupplierScheduleRows(
  rows: RegisterScheduleRouteTextKeywordRow[],
): SupplierScheduleImageKeywordRow[] {
  return rows.map((row) => ({
    ...row,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
  }))
}

function acceptSupplierFallbackKeyword(
  kw: string,
  productDestination: string | null | undefined,
  scheduleRows?: readonly RegisterScheduleRouteTextKeywordRow[],
): string {
  const t = String(kw ?? '').trim()
  if (!t) return ''
  if (isRegisterScheduleCrossContinentHallucinationKeyword(t, productDestination, scheduleRows)) return ''
  if (isBareCityOrCountryKeyword(t)) return ''
  return t
}

function mergeRouteTextKeywordWithSupplierKeyword<T extends RegisterScheduleRouteTextKeywordRow>(
  routeRows: T[],
  supplierRows: T[],
  productDestination: string | null | undefined,
): T[] {
  const supplierByDay = new Map(supplierRows.map((r) => [Number(r.day), r]))
  const maxDay = routeRows.reduce((m, r) => Math.max(m, Number(r.day)), 0)
  return routeRows.map((row) => {
    const day = Number(row.day)
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, routeRows.length)
    const supplier = supplierByDay.get(day)
    const routeKw = String(row.imageKeyword ?? '').trim()
    const routeKw2 = String(row.imageKeyword2 ?? '').trim()
    const supplierKw = acceptSupplierFallbackKeyword(
      String(supplier?.imageKeyword ?? ''),
      productDestination,
      routeRows,
    )
    const supplierKw2 = acceptSupplierFallbackKeyword(
      String(supplier?.imageKeyword2 ?? ''),
      productDestination,
      routeRows,
    )
    const imageKeyword = routeKw || supplierKw
    const imageKeyword2 =
      routeKw2 || (slot === 'middle' && imageKeyword ? supplierKw2 : '') || null
    return {
      ...row,
      imageKeyword,
      imageKeyword2,
    }
  })
}

function applySupplierScheduleImageKeywordFallback(
  rows: RegisterScheduleRouteTextKeywordRow[],
  opts: RegisterScheduleRouteSupplierFallbackOpts,
): RegisterScheduleRouteTextKeywordRow[] {
  const supplier =
    normalizeSupplierOrigin(String(opts.supplierKey ?? '').trim()) ?? String(opts.supplierKey ?? '').trim()
  const dest = opts.productDestination ?? null
  const title = opts.productTitle ?? null
  const supplierRows = toSupplierScheduleRows(rows)

  switch (supplier) {
    case 'hanatour':
      return applyHanatourScheduleImageKeywordsToRows(supplierRows, {
        productDestination: dest,
        optionalTourNames: opts.optionalTourNames,
        scheduleSectionByDay: opts.scheduleSectionByDay ?? null,
      }) as RegisterScheduleRouteTextKeywordRow[]
    case 'modetour':
      return applyModetourScheduleImageKeywordsToRows(supplierRows, { productDestination: dest }) as RegisterScheduleRouteTextKeywordRow[]
    case 'ybtour':
      return applyYbtourScheduleImageKeywordsToRows(supplierRows, { productDestination: dest }) as RegisterScheduleRouteTextKeywordRow[]
    case 'verygoodtour':
      return applyVerygoodScheduleImageKeywordsToRows(supplierRows, {
        detRows: supplierRows as VerygoodRegisterScheduleDay[],
        productDestination: dest,
        totalDays: supplierRows.length,
      }) as RegisterScheduleRouteTextKeywordRow[]
    case 'lottetour':
      return applyLottetourScheduleImageKeywordsToRows(supplierRows, {
        productDestination: dest,
        productTitle: title ?? undefined,
      }) as RegisterScheduleRouteTextKeywordRow[]
    case 'kyowontour':
      return applyKyowontourScheduleImageKeywordsToRows(supplierRows, {
        productDestination: dest,
        productTitle: title ?? undefined,
      }) as RegisterScheduleRouteTextKeywordRow[]
    default:
      return rows
  }
}

/** 6공급사 — routeText 순서 SSOT, 빈 슬롯만 공급사 allocate로 보완 */
export function applyRegisterScheduleRouteTextKeywordsWithSupplierFallback<
  T extends RegisterScheduleRouteTextKeywordRow,
>(rows: T[], opts: RegisterScheduleRouteSupplierFallbackOpts): T[] {
  const routeTextOut = applyRegisterScheduleRouteTextImageKeywordsToRows(rows)
  const supplierOut = applySupplierScheduleImageKeywordFallback(rows, opts) as T[]
  return mergeRouteTextKeywordWithSupplierKeyword(routeTextOut, supplierOut, opts.productDestination ?? null)
}
