/**
 * 등록 파이프 augment 직후 — 자유여행(Fit+imageKeyword) vs 패키지(공급사별 키워드) 분기.
 * REGRESSION-FREEZE[ybtour-register-schedule-image-keyword-apply]: mergePostAugmentScheduleImageKeywords — manifest
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
import {
  isRegisterAirtelListing,
  stampRegisterAirtelProductTypeOnParsed,
} from '@/lib/register-admin-airtel-listing'
import { enrichRegisterParsedWithAirtelFit } from '@/lib/register-airtel-fit-enrich'
import { applyYbtourScheduleImageKeywordsToRows, inferYbtourEffectiveProductDestination, isYbtourCrossContinentHallucinationKeyword } from '@/lib/ybtour-schedule-image-keyword'
import { applyModetourScheduleImageKeywordsToRows } from '@/lib/modetour-schedule-image-keyword'
import { applyHanatourScheduleImageKeywordsToRows } from '@/lib/hanatour-schedule-image-keyword'
import { isScheduleAirportLikeImageKeyword } from '@/lib/schedule-image-keyword-adjacent-poi'

export type ApplyRegisterPostAugmentScheduleOpts = {
  travelScope: string
  forcedBrandKey: string
  logPrefix?: string
  mode: 'preview' | 'confirm'
  /** confirm 시 클라이언트가 preview parsed 를 그대로 넘긴 경우 */
  hasPersistedParsed?: boolean
}

type ScheduleRouteRow = {
  day: number
  title?: string | null
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

type ScheduleKeywordSlotKind = 'departure' | 'middle' | 'return'

function resolvePostAugmentKeywordSlotKind(day: number, maxDay: number): ScheduleKeywordSlotKind {
  if (day === 1) return 'departure'
  if (maxDay >= 2 && day === maxDay) return 'return'
  return 'middle'
}

function shouldPreservePreAugmentImageKeyword(
  kw: string,
  supplierKey: string,
  productDestination: string | null,
  schedule: readonly ScheduleRouteRow[],
  slot: 'departure' | 'middle' | 'return',
): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return false
  if (isScheduleAirportLikeImageKeyword(t)) return false
  if (supplierKey === 'ybtour') {
    const dest = inferYbtourEffectiveProductDestination(productDestination, schedule)
    if (isYbtourCrossContinentHallucinationKeyword(t, dest)) return false
  }
  if (slot === 'return' && supplierKey !== 'ybtour') {
    /* package return — Gemini kw rarely valid */
  }
  return true
}

/** 규칙 allocate 후 Gemini 등으로 채워진 키워드 — post-augment에서만 보존 */
function mergePostAugmentScheduleImageKeywords<T extends ScheduleRouteRow>(
  before: readonly T[],
  after: readonly T[],
  opts: { supplierKey: string; productDestination: string | null },
): T[] {
  const beforeByDay = new Map(before.map((r) => [Number(r.day), r]))
  const maxDay = after.reduce((m, r) => Math.max(m, Number(r.day)), 0)
  return after.map((row) => {
    const day = Number(row.day)
    const prev = beforeByDay.get(day)
    if (!prev) return row
    const slot = resolvePostAugmentKeywordSlotKind(day, maxDay)
    const prevKw = String(prev.imageKeyword ?? '').trim()
    const prevKw2 = String(prev.imageKeyword2 ?? '').trim()
    const nextKw = String(row.imageKeyword ?? '').trim()
    const nextKw2 = String(row.imageKeyword2 ?? '').trim()
    const preservePrevKw =
      slot !== 'return' &&
      shouldPreservePreAugmentImageKeyword(prevKw, opts.supplierKey, opts.productDestination, before, slot)
    const preservePrevKw2 =
      slot === 'middle' &&
      shouldPreservePreAugmentImageKeyword(prevKw2, opts.supplierKey, opts.productDestination, before, slot)
    return {
      ...row,
      imageKeyword: nextKw || (preservePrevKw ? prevKw : ''),
      imageKeyword2:
        nextKw2 ||
        (preservePrevKw2 ? prevKw2 : null) ||
        null,
    }
  })
}

function applySupplierScheduleImageKeywords(
  supplierKey: string,
  schedule: ScheduleRouteRow[],
  productDestination: string | null,
): ScheduleRouteRow[] {
  if (supplierKey === 'ybtour') {
    return applyYbtourScheduleImageKeywordsToRows(schedule, { productDestination })
  }
  if (supplierKey === 'modetour') {
    return applyModetourScheduleImageKeywordsToRows(schedule, { productDestination })
  }
  if (supplierKey === 'hanatour') {
    return applyHanatourScheduleImageKeywordsToRows(schedule, { productDestination })
  }
  return schedule
}

/** 마지막·기내박 일차 — API에 routeText가 없을 때 title로 최소 routeText 보정 */
function backfillEmptyScheduleRouteTextFromTitle<T extends ScheduleRouteRow>(rows: T[]): T[] {
  if (!rows.length) return rows
  const maxDay = Math.max(...rows.map((r) => Number(r.day)).filter((d) => d > 0))
  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0 || String(row.routeText ?? '').trim()) return row
    const title = String(row.title ?? '').trim()
    if (!title) return row
    if (day === maxDay && /^(?:인천|김포|ICN|GMP)$/iu.test(title)) {
      return { ...row, routeText: title }
    }
    if (/^기내박$/u.test(title)) {
      return { ...row, routeText: '기내박' }
    }
    return row
  })
}

export async function applyRegisterPostAugmentSchedulePipeline(
  parsed: RegisterParsed,
  opts: ApplyRegisterPostAugmentScheduleOpts,
): Promise<RegisterParsed> {
  parsed = stampRegisterAirtelProductTypeOnParsed(parsed, opts.travelScope)
  if (isRegisterAirtelListing(opts.travelScope, parsed.productType)) {
    return enrichRegisterParsedWithAirtelFit(parsed, {
      travelScope: opts.travelScope,
      logLabel: opts.logPrefix ?? 'register-airtel-fit',
      reuseStoredGeminiJson:
        opts.mode === 'confirm' &&
        Boolean(opts.hasPersistedParsed) &&
        Boolean(parsed.registerFitItineraryGeminiJson?.trim()),
    })
  }

  if (opts.forcedBrandKey === 'ybtour') {
    const before = parsed.schedule ?? []
    const schedule = backfillEmptyScheduleRouteTextFromTitle(before)
    const allocated = applySupplierScheduleImageKeywords(
      'ybtour',
      schedule,
      parsed.primaryDestination ?? parsed.destination ?? null,
    )
    return {
      ...parsed,
      schedule: mergePostAugmentScheduleImageKeywords(before, allocated, {
        supplierKey: 'ybtour',
        productDestination: parsed.primaryDestination ?? parsed.destination ?? null,
      }),
    }
  }

  if (opts.forcedBrandKey === 'modetour') {
    const before = parsed.schedule ?? []
    const schedule = backfillEmptyScheduleRouteTextFromTitle(before)
    const allocated = applySupplierScheduleImageKeywords(
      'modetour',
      schedule,
      parsed.primaryDestination ?? parsed.destination ?? null,
    )
    return {
      ...parsed,
      schedule: mergePostAugmentScheduleImageKeywords(before, allocated, {
        supplierKey: 'modetour',
        productDestination: parsed.primaryDestination ?? parsed.destination ?? null,
      }),
    }
  }

  if (opts.forcedBrandKey === 'hanatour') {
    const before = parsed.schedule ?? []
    const schedule = backfillEmptyScheduleRouteTextFromTitle(before)
    const allocated = applySupplierScheduleImageKeywords(
      'hanatour',
      schedule,
      parsed.primaryDestination ?? parsed.destination ?? null,
    )
    return {
      ...parsed,
      schedule: mergePostAugmentScheduleImageKeywords(before, allocated, {
        supplierKey: 'hanatour',
        productDestination: parsed.primaryDestination ?? parsed.destination ?? null,
      }),
    }
  }

  return parsed
}
