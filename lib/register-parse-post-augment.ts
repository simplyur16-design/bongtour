/**
 * 등록 파이프 augment 직후 — 자유여행(Fit+imageKeyword) vs 패키지(공급사별 키워드) 분기.
 * REGRESSION-FREEZE[register-post-augment-schedule-ssot]: applyRegisterScheduleImageKeywordsBySupplier — manifest
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: routeText·description vibe SSOT — manifest
 * REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: preview/confirm Gemini 보조 — manifest
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
  opts: { logPrefix?: string; mode: 'preview' | 'confirm' },
): Promise<RegisterParsed> {
  const schedule = backfillEmptyScheduleRouteTextFromTitle(parsed.schedule ?? [])
  const dest = parsed.primaryDestination ?? parsed.destination ?? null
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
  const withGemini =
    process.env.SKIP_REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI === '1' || opts.mode === 'preview'
      ? allocated
      : await fillRegisterScheduleImageKeywordsWithGeminiIfNeeded(allocated, {
          supplierKey,
          productDestination: dest,
          productTitle: parsed.title ?? null,
          logLabel: opts.logPrefix ?? 'register-post-augment',
        })
  // Gemini 후 gap-fill 재실행 금지 — tripHay bleed·등록 지연 재개 방지 (rules는 apply 단계만)
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: no post-gemini gap-fill — manifest
  return {
    ...parsed,
    schedule: ensurePackageScheduleLastDayGateCompliance(withGemini),
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
    })
  }

  return parsed
}
