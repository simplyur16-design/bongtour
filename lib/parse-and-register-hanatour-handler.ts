/**
 * 하나투어 등록 POST 전용.
 * 가격 행 합성·확정 게이트는 핸들러 옵션으로 오케스트레이션에 주입.
 * 일정 표현층: `parse-and-register-hanatour-schedule`.
 */
import { applyHanatourSyntheticPriceRowIfNeeded } from '@/lib/register-hanatour-confirm-fallback-prices'
import { parseForRegisterHanatour } from '@/lib/register-parse-hanatour'
import { runParseAndRegisterFlow } from '@/lib/parse-and-register-hanatour-orchestration'
import {
  augmentHanatourScheduleExpressionParsed,
  finalizeHanatourItineraryDayDraftsFromSchedule,
} from '@/lib/parse-and-register-hanatour-schedule'

export async function handleParseAndRegisterHanatourRequest(request: Request) {
  return runParseAndRegisterFlow(request, {
    forcedBrandKey: 'hanatour',
    parseFn: parseForRegisterHanatour,
    logPrefix: '[parse-and-register-hanatour]',
    savePersistedParsedOnly: true,
    recoverEmptyScheduleWithFullParse: true,
    augmentParsed: augmentHanatourScheduleExpressionParsed,
    patchParsedAfterAugment: (p, t) => applyHanatourSyntheticPriceRowIfNeeded(p, t, 'hanatour'),
    finalizeItineraryDayDraftsFromSchedule: finalizeHanatourItineraryDayDraftsFromSchedule,
    strictConfirmDeparturePriceRows: true,
    reservationNoticeRawForProductSave: () => null,
  })
}
