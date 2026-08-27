/**
 * 등록 파이프 augment 직후 — 자유여행(Fit+imageKeyword) vs 패키지(공급사별 키워드) 분기.
 * REGRESSION-FREEZE[register-post-augment-schedule-ssot]: applyRegisterScheduleImageKeywordsBySupplier — manifest
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: routeText·description vibe SSOT — manifest
 * REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: preview/confirm Gemini 보조 — manifest
 * REGRESSION-FREEZE[register-post-augment-keyword-skip-when-filled]: preview+confirm skip wipe when middle filled — manifest
 * REGRESSION-FREEZE[register-pre-photo-heal-keep-filled-keywords]: skip 경로 셀프힐이 유효 kw 덮어쓰기 금지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-self-heal]: skip/apply 후 파라도르·중복 문장 셀프힐 — manifest
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: 패키지 레인만 키워드 파이프 — manifest
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
import {
  isRegisterAirtelListing,
  stampRegisterAirtelProductTypeOnParsed,
} from '@/lib/register-admin-airtel-listing'
import { enrichRegisterParsedWithAirtelFit } from '@/lib/register-airtel-fit-enrich'
import { backfillEmptyScheduleRouteTextFromTitle } from '@/lib/register-schedule-route-text-backfill'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { fillRegisterScheduleImageKeywordsWithGeminiIfNeeded } from '@/lib/register-schedule-image-keyword-gemini-fill'
import { resolveScheduleKeywordSlotKind } from '@/lib/schedule-image-keyword-adjacent-poi'
import {
  enforceRegisterScheduleTripUniqueImageKeywords,
  ensureDepartureReturnVisitCityKeywords,
  isScheduleHubMovementKeywordRow,
} from '@/lib/register-schedule-trip-image-keyword-dedupe'
import {
  inferRegisterEffectiveProductDestination,
  isRegisterScheduleCrossContinentHallucinationKeyword,
} from '@/lib/register-schedule-cross-continent-keyword-guard'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { healRegisterPrePhotoSchedule } from '@/lib/register-pre-photo-self-heal'

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

/** 마지막 일차 routeText 없음 — live gate 귀국 title 예외 SSOT */
function ensurePackageScheduleLastDayGateCompliance<T extends ScheduleRouteRow>(rows: T[]): T[] {
  if (!rows.length) return rows
  const maxDay = Math.max(...rows.map((r) => Number(r.day)).filter((d) => d > 0))
  return rows.map((row) => {
    if (Number(row.day) !== maxDay) return row
    const route = String(row.routeText ?? '').trim()
    if (route) return row
    const title = String(row.title ?? '').trim()
    const desc = String(row.description ?? '').trim()
    if (/숙박\s*없음|귀국|귀국편|출발/u.test(`${title} ${desc}`)) return row
    return { ...row, title: '숙박 없음(귀국)' }
  })
}

/**
 * 중간일(출발·귀국 제외) primary imageKeyword — confirm Gemini 스킵 진단/테스트용.
 * REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: confirm skip when preview kw filled — manifest
 */
export function packageScheduleMiddleDaysHavePrimaryKeywords(
  rows: readonly ScheduleRouteRow[],
): boolean {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (days.length === 0) return false
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  const middle = days.filter(
    (r) => resolveScheduleKeywordSlotKind(Number(r.day), maxDay, activeDays) === 'middle',
  )
  // 중간일 없음(2일 일정 등) — 출발·귀국만이면 preview 재적용 불필요
  if (middle.length === 0) return true
  return middle.every((r) => String(r.imageKeyword ?? '').trim().length > 0)
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

async function applyPackagePostAugmentScheduleKeywords(
  parsed: RegisterParsed,
  supplierKey: string,
  opts: { logPrefix?: string; mode: 'preview' | 'confirm'; hasPersistedParsed?: boolean },
): Promise<RegisterParsed> {
  const schedule = backfillEmptyScheduleRouteTextFromTitle(parsed.schedule ?? [])
  // REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: confirm skip when preview kw filled — manifest
  // REGRESSION-FREEZE[register-post-augment-keyword-skip-when-filled]: preview also skips wipe+reapply when filled — manifest
  // 중간일 primary가 이미 채워진 preview·confirm만 스킵(모두·교원·롯데 등 정상 미리보기 유지).
  // skip 경로 셀프힐은 숙소 제거·깨진 슬롯 회복만 — 유효 랜드마크 wipe 금지.
  // 중간일이 비면 고착 금지 — wipe+규칙+Gemini로 빈 슬롯만 회복(빈 Day4를 스킵하던 회귀 교정).
  // REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: empty middle recovers (no sticky skip) — manifest
  const middleFilled = packageScheduleMiddleDaysHavePrimaryKeywords(schedule)
  const skipKeywordPipeline =
    middleFilled &&
    (opts.mode === 'preview' || (opts.mode === 'confirm' && opts.hasPersistedParsed))
  const dest = parsed.primaryDestination ?? parsed.destination ?? null
  if (skipKeywordPipeline) {
    if (opts.logPrefix && process.env.DEV_REGISTER_PERF_LOG === '1') {
      console.info(`[${opts.logPrefix}] skip-keyword-pipeline-when-filled`, {
        mode: opts.mode,
        hasPersistedParsed: opts.hasPersistedParsed ?? false,
        middleDaysHavePrimaryKeywords: true,
        days: schedule.map((r) => ({
          day: r.day,
          kw: String(r.imageKeyword ?? '').trim().slice(0, 40),
        })),
      })
    }
    const healedSkip = healRegisterPrePhotoSchedule(schedule, {
      supplierKey,
      productDestination: dest,
      productTitle: parsed.title ?? null,
      lane: 'package',
    })
    return {
      ...parsed,
      schedule: ensurePackageScheduleLastDayGateCompliance(healedSkip.rows),
    }
  }

  const allocated = applyRegisterScheduleImageKeywordsBySupplier(
    schedule.map(normalizeScheduleRouteRowForImageKeyword),
    {
      supplierKey,
      productDestination: dest,
      productTitle: parsed.title ?? null,
      travelScope: 'package',
    },
  )
  // REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: preview rules-only — Gemini는 confirm — manifest
  // 미리보기에서 Gemini(최대 ~22s)가 사실가져오기보다 길어지는 회귀 방지. 확정(confirm)에서만 보조 채움.
  // (중간일 kw가 이미 찬 hasPersistedParsed confirm만 위에서 조기 return)
  const withGemini =
    process.env.SKIP_REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI === '1' || opts.mode === 'preview'
      ? allocated
      : await fillRegisterScheduleImageKeywordsWithGeminiIfNeeded(allocated, {
          supplierKey,
          productDestination: dest,
          productTitle: parsed.title ?? null,
          logLabel: opts.logPrefix ?? 'register-post-augment',
        })
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: no post-gemini gap-fill — manifest
  // Gemini 후 환각·중복만 제거 (middle gap-fill 재실행 금지)
  // REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: post-gemini unique+continent strip — manifest
  const effectiveDest = inferRegisterEffectiveProductDestination(dest, withGemini)
  const stripped = withGemini.map((row) => {
    let kw = String(row.imageKeyword ?? '').trim()
    let kw2 = String(row.imageKeyword2 ?? '').trim()
    const strip = (k: string) =>
      k && isRegisterScheduleCrossContinentHallucinationKeyword(k, effectiveDest, withGemini) ? '' : k
    kw = strip(kw)
    kw2 = strip(kw2)
    if (kw && kw2 && normScheduleImageKeywordKey(kw) === normScheduleImageKeywordKey(kw2)) kw2 = ''
    return { ...row, imageKeyword: kw, imageKeyword2: kw2 || null }
  })
  const deduped = enforceRegisterScheduleTripUniqueImageKeywords(stripped)
  const edged = ensureDepartureReturnVisitCityKeywords(deduped, effectiveDest)
  const healed = healRegisterPrePhotoSchedule(edged, {
    supplierKey,
    productDestination: dest,
    productTitle: parsed.title ?? null,
    lane: 'package',
  })
  return {
    ...parsed,
    schedule: ensurePackageScheduleLastDayGateCompliance(healed.rows),
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
    return applyPackagePostAugmentScheduleKeywords(parsed, opts.forcedBrandKey, {
      logPrefix: opts.logPrefix,
      mode: opts.mode,
      hasPersistedParsed: opts.hasPersistedParsed,
    })
  }

  return parsed
}
