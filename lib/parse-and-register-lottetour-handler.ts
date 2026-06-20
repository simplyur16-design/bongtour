/**
 * 롯데관광(lottetour) 등록 POST 전용 — 공용 `handleParseAndRegisterRequest` 미사용.
 * 일정 표현층: 미리보기 schedule 비움 우회·확정 시 drafts/ItineraryDay/Product.schedule 정렬은 `parse-and-register-lottetour-schedule`.
 */
import { parseForRegisterLottetour } from '@/lib/register-parse-lottetour'
import { runParseAndRegisterFlow } from '@/lib/parse-and-register-lottetour-orchestration'
import { sanitizeLottetourRegisterParsedStrings } from '@/lib/register-lottetour-text-sanitize'
import {
  augmentLottetourScheduleExpressionParsed,
  finalizeLottetourItineraryDayDraftsFromSchedule,
  lottetourConfirmHasScheduleExpressionLayer,
} from '@/lib/parse-and-register-lottetour-schedule'

import { augmentLottetourParsedWithDetailCollect } from '@/lib/lottetour-register-detail-collect'
import { injectLottetourApiDeparturePricesIfMissing } from '@/lib/lottetour-register-api-price-inject'

export async function handleParseAndRegisterLottetourRequest(request: Request) {
  return runParseAndRegisterFlow(request, {
    forcedBrandKey: 'lottetour',
    parseFn: parseForRegisterLottetour,
    logPrefix: '[parse-and-register-lottetour]',
    savePersistedParsedOnly: true,
    augmentParsed: (p, ctx) =>
      sanitizeLottetourRegisterParsedStrings(
        augmentLottetourScheduleExpressionParsed(p, ctx?.pastedBodyText, { travelScope: ctx?.travelScope }),
      ),
    patchParsedAfterAugment: async (parsed, _text, ctx) => {
      let next = await injectLottetourApiDeparturePricesIfMissing(parsed, ctx?.originUrl)
      return augmentLottetourParsedWithDetailCollect(next, {
        originUrl: ctx?.originUrl,
        pastedBlocks: ctx?.pastedBlocks,
      })
    },
    finalizeItineraryDayDraftsFromSchedule: finalizeLottetourItineraryDayDraftsFromSchedule,
    getHeroTripDatesSupplement: (p) => ({
      lottetourFlightStructured: p.detailBodyStructured?.flightStructured ?? null,
    }),
    confirmScheduleExpressionLayerOk: lottetourConfirmHasScheduleExpressionLayer,
  })
}
