/**
 * 롯데관광(lottetour) 등록 POST — URL register-facts + detail-collect SSOT (Gemini overlay 없음).
 *
 * REGRESSION-FREEZE[lottetour-register-ssot-freeze]: manifest
 */
import { parseForRegisterLottetour } from '@/lib/register-parse-lottetour'
import { runLottetourRegisterFlow } from '@/lib/lottetour-register-flow'
import { sanitizeLottetourRegisterParsedStrings } from '@/lib/register-lottetour-text-sanitize'
import {
  augmentLottetourScheduleExpressionParsed,
  finalizeLottetourItineraryDayDraftsFromSchedule,
  lottetourConfirmHasScheduleExpressionLayer,
} from '@/lib/parse-and-register-lottetour-schedule'

import { augmentLottetourParsedWithDetailCollect } from '@/lib/lottetour-register-detail-collect'
import { injectLottetourApiDeparturePricesIfMissing } from '@/lib/lottetour-register-api-price-inject'

export async function handleParseAndRegisterLottetourRequest(request: Request) {
  return runLottetourRegisterFlow(request, {
    forcedBrandKey: 'lottetour',
    parseFn: parseForRegisterLottetour,
    logPrefix: '[lottetour-register]',
    savePersistedParsedOnly: true,
    augmentParsed: (p, ctx) =>
      sanitizeLottetourRegisterParsedStrings(
        augmentLottetourScheduleExpressionParsed(p, ctx?.pastedBodyText, { travelScope: ctx?.travelScope }),
      ),
    patchParsedAfterAugment: async (parsed, _text, ctx) => {
      let next = await augmentLottetourParsedWithDetailCollect(parsed, {
        originUrl: ctx?.originUrl,
        pastedBlocks: ctx?.pastedBlocks,
      })
      next = await injectLottetourApiDeparturePricesIfMissing(next, ctx?.originUrl)
      return next
    },
    finalizeItineraryDayDraftsFromSchedule: finalizeLottetourItineraryDayDraftsFromSchedule,
    getHeroTripDatesSupplement: (p) => ({
      lottetourFlightStructured: p.detailBodyStructured?.flightStructured ?? null,
    }),
    confirmScheduleExpressionLayerOk: lottetourConfirmHasScheduleExpressionLayer,
  })
}
