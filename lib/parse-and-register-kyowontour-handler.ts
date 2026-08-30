/**
 * 교원이지(kyowontour) 등록 POST — API SSOT (Gemini overlay 없음).
 * REGRESSION-FREEZE[kyowontour-register-ssot-freeze]: manifest
 */
import { parseForRegisterKyowontour } from '@/lib/register-parse-kyowontour'
import { runKyowontourRegisterFlow } from '@/lib/kyowontour-register-flow'
import { sanitizeKyowontourRegisterParsedStrings } from '@/lib/register-kyowontour-text-sanitize'
import {
  augmentKyowontourScheduleExpressionParsed,
  finalizeKyowontourItineraryDayDraftsFromSchedule,
  kyowontourConfirmHasScheduleExpressionLayer,
} from '@/lib/parse-and-register-kyowontour-schedule'
import { augmentKyowontourParsedWithDetailCollect } from '@/lib/kyowontour-register-detail-collect'
import { injectKyowontourApiDeparturePricesIfMissing } from '@/lib/kyowontour-register-api-price-inject'

export async function handleParseAndRegisterKyowontourRequest(
  request: Request,
  opts?: { skipRequireAdmin?: boolean },
) {
  return runKyowontourRegisterFlow(request, {
    forcedBrandKey: 'kyowontour',
    parseFn: parseForRegisterKyowontour,
    logPrefix: '[parse-and-register-kyowontour]',
    savePersistedParsedOnly: true,
    skipRequireAdmin: opts?.skipRequireAdmin === true,
    augmentParsed: (p, ctx) =>
      sanitizeKyowontourRegisterParsedStrings(
        augmentKyowontourScheduleExpressionParsed(p, ctx?.pastedBodyText, { travelScope: ctx?.travelScope }),
      ),
    patchParsedAfterAugment: async (parsed, _text, ctx) => {
      let next = await injectKyowontourApiDeparturePricesIfMissing(parsed, ctx?.originUrl)
      return augmentKyowontourParsedWithDetailCollect(next, {
        originUrl: ctx?.originUrl,
        pastedBlocks: ctx?.pastedBlocks,
        travelScope: ctx?.travelScope,
      })
    },
    finalizeItineraryDayDraftsFromSchedule: finalizeKyowontourItineraryDayDraftsFromSchedule,
    getHeroTripDatesSupplement: (p) => ({
      kyowontourFlightStructured: p.detailBodyStructured?.flightStructured ?? null,
    }),
    confirmScheduleExpressionLayerOk: kyowontourConfirmHasScheduleExpressionLayer,
  })
}
