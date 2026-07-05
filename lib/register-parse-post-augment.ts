/**
 * 등록 파이프 augment 직후 — 자유여행(Fit+imageKeyword) vs 패키지(공급사별 키워드) 분기.
 * REGRESSION-FREEZE[ybtour-register-schedule-image-keyword-apply]: mergePostAugmentScheduleImageKeywords — manifest
 * REGRESSION-FREEZE[register-post-augment-schedule-ssot]: applyRegisterScheduleImageKeywordsBySupplier — manifest
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
import {
  isRegisterAirtelListing,
  stampRegisterAirtelProductTypeOnParsed,
} from '@/lib/register-admin-airtel-listing'
import { enrichRegisterParsedWithAirtelFit } from '@/lib/register-airtel-fit-enrich'
import { backfillEmptyScheduleRouteTextFromTitle } from '@/lib/register-schedule-route-text-backfill'
import { inferYbtourEffectiveProductDestination, isYbtourCrossContinentHallucinationKeyword } from '@/lib/ybtour-schedule-image-keyword'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
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
    /* package return — SSOT apply wins when non-empty; empty re-allocate may keep pre-augment kw */
  }
  return true
}

/** 규칙 allocate 후 Gemini 등으로 채워진 키워드 — post-augment re-allocate가 비었을 때만 보존 */
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
      !nextKw &&
      shouldPreservePreAugmentImageKeyword(prevKw, opts.supplierKey, opts.productDestination, before, slot)
    const preservePrevKw2 =
      !nextKw2 &&
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

const PACKAGE_POST_AUGMENT_SUPPLIERS = new Set([
  'ybtour',
  'modetour',
  'hanatour',
  'lottetour',
  'kyowontour',
  'verygoodtour',
  'naeiltour',
])

function applyPackagePostAugmentScheduleKeywords(parsed: RegisterParsed, supplierKey: string): RegisterParsed {
  const before = parsed.schedule ?? []
  const schedule = backfillEmptyScheduleRouteTextFromTitle(before)
  const dest = parsed.primaryDestination ?? parsed.destination ?? null
  const allocated = applyRegisterScheduleImageKeywordsBySupplier(
    schedule.map(normalizeScheduleRouteRowForImageKeyword),
    {
      supplierKey,
      productDestination: dest,
      productTitle: parsed.title ?? null,
    },
  )
  return {
    ...parsed,
    schedule: mergePostAugmentScheduleImageKeywords(before, allocated, {
      supplierKey,
      productDestination: dest,
    }),
  }
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

  if (PACKAGE_POST_AUGMENT_SUPPLIERS.has(opts.forcedBrandKey)) {
    return applyPackagePostAugmentScheduleKeywords(parsed, opts.forcedBrandKey)
  }

  return parsed
}
