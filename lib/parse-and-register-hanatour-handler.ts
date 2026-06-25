/**
 * 하나투어 등록 POST — URL register-facts + detail-collect SSOT (Gemini overlay 없음).
 *
 * REGRESSION-FREEZE[hanatour-register-ssot-freeze]: manifest
 */
import { augmentHanatourParsedWithDetailCollect } from '@/lib/hanatour-register-detail-collect'
import { injectHanatourApiDeparturePricesIfMissing } from '@/lib/hanatour-register-api-price-inject'
import { applyHanatourSyntheticPriceRowIfNeeded } from '@/lib/register-hanatour-confirm-fallback-prices'
import { parseForRegisterHanatour } from '@/lib/register-parse-hanatour'
import { runHanatourRegisterFlow } from '@/lib/hanatour-register-flow'
import {
  augmentHanatourScheduleExpressionParsed,
  finalizeHanatourItineraryDayDraftsFromSchedule,
} from '@/lib/parse-and-register-hanatour-schedule'

export async function handleParseAndRegisterHanatourRequest(request: Request) {
  return runHanatourRegisterFlow(request, {
    forcedBrandKey: 'hanatour',
    parseFn: parseForRegisterHanatour,
    logPrefix: '[hanatour-register]',
    savePersistedParsedOnly: true,
    recoverEmptyScheduleWithFullParse: false,
    augmentParsed: augmentHanatourScheduleExpressionParsed,
    patchParsedAfterAugment: async (parsed, pastedText, ctx) => {
      let next = await augmentHanatourParsedWithDetailCollect(parsed, {
        originUrl: ctx?.originUrl,
        pastedBlocks: ctx?.pastedBlocks,
      })
      next = await injectHanatourApiDeparturePricesIfMissing(next, ctx?.originUrl)
      next = applyHanatourSyntheticPriceRowIfNeeded(next, pastedText, 'hanatour')
      return next
    },
    finalizeItineraryDayDraftsFromSchedule: finalizeHanatourItineraryDayDraftsFromSchedule,
    strictConfirmDeparturePriceRows: true,
    reservationNoticeRawForProductSave: () => null,
  })
}
