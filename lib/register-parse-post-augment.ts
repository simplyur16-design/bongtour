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
import { applyKyowontourScheduleImageKeywordsToRows } from '@/lib/kyowontour-schedule-image-keyword'
import { applyLottetourScheduleImageKeywordsToRows } from '@/lib/lottetour-schedule-image-keyword'
import { applyNaeiltourScheduleImageKeywordsToRows, type NaeiltourScheduleImageKeywordRow } from '@/lib/naeiltour-schedule-image-keyword'
import { applyVerygoodScheduleImageKeywordsToRows } from '@/lib/verygoodtour-schedule-image-keyword'
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
  description?: string | null
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

/** supplier imageKeyword apply — `title`/`description` null → undefined (RegisterParsed 호환) */
function normalizeScheduleRouteRowForImageKeyword<T extends ScheduleRouteRow>(
  row: T,
): T & { title?: string; description?: string } {
  return {
    ...row,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
  }
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
    const dest = inferYbtourEffectiveProductDestination(
      productDestination,
      schedule.map(normalizeScheduleRouteRowForImageKeyword),
    )
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

function applySupplierScheduleImageKeywords<T extends ScheduleRouteRow>(
  supplierKey: string,
  schedule: T[],
  productDestination: string | null,
): T[] {
  const rows = schedule.map(normalizeScheduleRouteRowForImageKeyword)
  if (supplierKey === 'ybtour') {
    return applyYbtourScheduleImageKeywordsToRows(rows, { productDestination }) as T[]
  }
  if (supplierKey === 'modetour') {
    return applyModetourScheduleImageKeywordsToRows(rows, { productDestination }) as T[]
  }
  if (supplierKey === 'hanatour') {
    return applyHanatourScheduleImageKeywordsToRows(rows, { productDestination }) as T[]
  }
  if (supplierKey === 'lottetour') {
    return applyLottetourScheduleImageKeywordsToRows(rows, { productDestination }) as T[]
  }
  if (supplierKey === 'kyowontour') {
    return applyKyowontourScheduleImageKeywordsToRows(rows, { productDestination }) as T[]
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

  if (opts.forcedBrandKey === 'lottetour') {
    const before = parsed.schedule ?? []
    const schedule = backfillEmptyScheduleRouteTextFromTitle(before)
    const allocated = applySupplierScheduleImageKeywords(
      'lottetour',
      schedule,
      parsed.primaryDestination ?? parsed.destination ?? null,
    )
    return {
      ...parsed,
      schedule: mergePostAugmentScheduleImageKeywords(before, allocated, {
        supplierKey: 'lottetour',
        productDestination: parsed.primaryDestination ?? parsed.destination ?? null,
      }),
    }
  }

  if (opts.forcedBrandKey === 'kyowontour') {
    const before = parsed.schedule ?? []
    const schedule = backfillEmptyScheduleRouteTextFromTitle(before)
    const allocated = applySupplierScheduleImageKeywords(
      'kyowontour',
      schedule,
      parsed.primaryDestination ?? parsed.destination ?? null,
    )
    return {
      ...parsed,
      schedule: mergePostAugmentScheduleImageKeywords(before, allocated, {
        supplierKey: 'kyowontour',
        productDestination: parsed.primaryDestination ?? parsed.destination ?? null,
      }),
    }
  }

  if (opts.forcedBrandKey === 'verygoodtour') {
    const before = parsed.schedule ?? []
    const schedule = backfillEmptyScheduleRouteTextFromTitle(before)
    const dest = parsed.primaryDestination ?? parsed.destination ?? null
    const allocated = applyVerygoodScheduleImageKeywordsToRows(
      schedule.map(normalizeScheduleRouteRowForImageKeyword),
      { detRows: schedule, productDestination: dest, totalDays: schedule.length },
    ) as typeof schedule
    return {
      ...parsed,
      schedule: mergePostAugmentScheduleImageKeywords(before, allocated, {
        supplierKey: 'verygoodtour',
        productDestination: dest,
      }),
    }
  }

  if (opts.forcedBrandKey === 'naeiltour') {
    const before = parsed.schedule ?? []
    const schedule = backfillEmptyScheduleRouteTextFromTitle(before)
    const dest = parsed.primaryDestination ?? parsed.destination ?? null
    const allocated = applyNaeiltourScheduleImageKeywordsToRows(
      schedule as NaeiltourScheduleImageKeywordRow[],
      { productDestination: dest, englishLandmarksByDay: undefined },
    ) as typeof schedule
    return {
      ...parsed,
      schedule: mergePostAugmentScheduleImageKeywords(before, allocated, {
        supplierKey: 'naeiltour',
        productDestination: dest,
      }),
    }
  }

  return parsed
}
