/**
 * 등록 파이프 augment 직후 — 자유여행(Fit+imageKeyword) vs 패키지(공급사별 키워드) 분기.
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
import { isRegisterAirtelListing } from '@/lib/register-admin-airtel-listing'
import { enrichRegisterParsedWithAirtelFit } from '@/lib/register-airtel-fit-enrich'
import { applyYbtourScheduleImageKeywordsToRows } from '@/lib/ybtour-schedule-image-keyword'

export type ApplyRegisterPostAugmentScheduleOpts = {
  travelScope: string
  forcedBrandKey: string
  logPrefix?: string
  mode: 'preview' | 'confirm'
  /** confirm 시 클라이언트가 preview parsed 를 그대로 넘긴 경우 */
  hasPersistedParsed?: boolean
}

export async function applyRegisterPostAugmentSchedulePipeline(
  parsed: RegisterParsed,
  opts: ApplyRegisterPostAugmentScheduleOpts,
): Promise<RegisterParsed> {
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
    return {
      ...parsed,
      schedule: applyYbtourScheduleImageKeywordsToRows(parsed.schedule ?? [], {
        productDestination: parsed.destination ?? null,
      }),
    }
  }

  return parsed
}
