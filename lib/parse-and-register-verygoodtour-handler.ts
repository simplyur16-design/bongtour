/**
 * 참좋은여행(verygoodtour) 등록 POST — URL register-facts + detail-collect SSOT (Gemini overlay 없음).
 *
 * REGRESSION-FREEZE[verygoodtour-register-ssot-freeze]: manifest
 */
import { parseForRegisterVerygoodtour } from '@/lib/register-parse-verygoodtour'
import { runVerygoodtourRegisterFlow } from '@/lib/verygoodtour-register-flow'
import {
  augmentVerygoodtourScheduleExpressionParsed,
  finalizeVerygoodtourItineraryDayDraftsFromSchedule,
  verygoodConfirmHasScheduleExpressionLayer,
} from '@/lib/parse-and-register-verygoodtour-schedule'
import { augmentVerygoodtourParsedWithDetailCollect } from '@/lib/verygoodtour-register-detail-collect'
import { injectVerygoodtourApiDeparturePricesIfMissing } from '@/lib/verygoodtour-register-api-price-inject'

export async function handleParseAndRegisterVerygoodtourRequest(request: Request) {
  return runVerygoodtourRegisterFlow(request, {
    forcedBrandKey: 'verygoodtour',
    parseFn: parseForRegisterVerygoodtour,
    logPrefix: '[verygoodtour-register]',
    savePersistedParsedOnly: true,
    augmentParsed: (parsed, ctx) =>
      augmentVerygoodtourScheduleExpressionParsed(parsed, ctx?.pastedBodyText, {
        travelScope: ctx?.travelScope,
      }),
    patchParsedAfterAugment: async (parsed, _text, ctx) => {
      let next = await augmentVerygoodtourParsedWithDetailCollect(parsed, {
        originUrl: ctx?.originUrl,
        pastedBlocks: ctx?.pastedBlocks,
      })
      next = await injectVerygoodtourApiDeparturePricesIfMissing(next, ctx?.originUrl)
      return next
    },
    finalizeItineraryDayDraftsFromSchedule: finalizeVerygoodtourItineraryDayDraftsFromSchedule,
    confirmScheduleExpressionLayerOk: verygoodConfirmHasScheduleExpressionLayer,
  })
}
