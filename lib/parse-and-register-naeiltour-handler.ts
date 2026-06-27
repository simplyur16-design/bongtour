/**
 * 내일투어(naeiltour) 등록 POST — URL register-facts + detail-collect SSOT (Gemini overlay 없음).
 *
 * REGRESSION-FREEZE[naeiltour-register-ssot-freeze]: manifest
 */
import { parseForRegisterNaeiltour } from '@/lib/register-parse-naeiltour'
import { runNaeiltourRegisterFlow } from '@/lib/naeiltour-register-flow'
import { sanitizeNaeiltourRegisterParsedStrings } from '@/lib/register-naeiltour-text-sanitize'
import {
  augmentNaeiltourScheduleExpressionParsed,
  finalizeNaeiltourItineraryDayDraftsFromSchedule,
  naeiltourConfirmHasScheduleExpressionLayer,
} from '@/lib/parse-and-register-naeiltour-schedule'

import { augmentNaeiltourParsedWithDetailCollect } from '@/lib/naeiltour-register-detail-collect'
import { injectNaeiltourApiDeparturePricesIfMissing } from '@/lib/naeiltour-register-api-price-inject'

export async function handleParseAndRegisterNaeiltourRequest(request: Request) {
  return runNaeiltourRegisterFlow(request, {
    forcedBrandKey: 'naeiltour',
    parseFn: parseForRegisterNaeiltour,
    logPrefix: '[naeiltour-register]',
    savePersistedParsedOnly: true,
    augmentParsed: (p, ctx) =>
      sanitizeNaeiltourRegisterParsedStrings(
        augmentNaeiltourScheduleExpressionParsed(p, ctx?.pastedBodyText, { travelScope: ctx?.travelScope }),
      ),
    patchParsedAfterAugment: async (parsed, _text, ctx) => {
      let next = await augmentNaeiltourParsedWithDetailCollect(parsed, {
        originUrl: ctx?.originUrl,
        travelScope: ctx?.travelScope,
        pastedBlocks: ctx?.pastedBlocks,
      })
      next = await injectNaeiltourApiDeparturePricesIfMissing(next, ctx?.originUrl)
      return next
    },
    finalizeItineraryDayDraftsFromSchedule: finalizeNaeiltourItineraryDayDraftsFromSchedule,
    getHeroTripDatesSupplement: (p) => ({
      naeiltourFlightStructured: p.detailBodyStructured?.flightStructured ?? null,
    }),
    confirmScheduleExpressionLayerOk: naeiltourConfirmHasScheduleExpressionLayer,
  })
}
