/**
 * 하나투어 등록 POST — URL register-facts + detail-collect SSOT (Gemini overlay 없음).
 *
 * REGRESSION-FREEZE[hanatour-register-ssot-freeze]: manifest
 * REGRESSION-FREEZE[hanatour-register-schedule-2030]: confirm 시 2030 일정 재정제·가드 — manifest
 * REGRESSION-FREEZE[hanatour-register-schedule-2030]: polishParsedBeforeConfirmGate (reuse skip) — manifest
 */
import { augmentHanatourParsedWithDetailCollect } from '@/lib/hanatour-register-detail-collect'
import { injectHanatourApiDeparturePricesIfMissing } from '@/lib/hanatour-register-api-price-inject'
import { applyHanatourSyntheticPriceRowIfNeeded } from '@/lib/register-hanatour-confirm-fallback-prices'
import { isRegisterAirHotelListing } from '@/lib/register-admin-airtel-listing'
import { parseForRegisterHanatour } from '@/lib/register-parse-hanatour'
import { runHanatourRegisterFlow } from '@/lib/hanatour-register-flow'
import {
  augmentHanatourScheduleExpressionParsed,
  finalizeHanatourItineraryDayDraftsFromSchedule,
  hanatourConfirmHasScheduleExpressionLayer,
} from '@/lib/parse-and-register-hanatour-schedule'
import {
  applyHanatour2030RegisterConfirmGuard,
  hanatour2030ConfirmScheduleBlockReason,
} from '@/lib/hanatour-register-schedule-2030'

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
        travelScope: ctx?.travelScope,
      })
      next = await injectHanatourApiDeparturePricesIfMissing(next, ctx?.originUrl, {
        adminTravelScope: ctx?.travelScope,
      })
      next = applyHanatourSyntheticPriceRowIfNeeded(next, pastedText, 'hanatour')
      return next
    },
    /** detail patch 스킵 시에도 2030 제목·일정 정제 필수 (confirm reuse) */
    polishParsedBeforeConfirmGate: (parsed, ctx) => {
      if (isRegisterAirHotelListing(ctx?.travelScope, parsed.productType)) return parsed
      return applyHanatour2030RegisterConfirmGuard(parsed)
    },
    finalizeItineraryDayDraftsFromSchedule: finalizeHanatourItineraryDayDraftsFromSchedule,
    strictConfirmDeparturePriceRows: true,
    confirmScheduleExpressionLayerOk: hanatourConfirmHasScheduleExpressionLayer,
    confirmScheduleExpressionLayerFailReason: (parsed) => hanatour2030ConfirmScheduleBlockReason(parsed),
    reservationNoticeRawForProductSave: () => null,
  })
}
