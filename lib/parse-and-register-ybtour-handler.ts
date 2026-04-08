/**
 * 노랑풍선(ybtour) 등록 POST 전용 — 공용 `handleParseAndRegisterRequest` 미사용.
 * 일정 표현층: 미리보기 schedule 비움 우회·확정 시 drafts/ItineraryDay/Product.schedule 정렬은 `parse-and-register-ybtour-schedule`.
 */
import { parseForRegisterYbtour } from '@/lib/register-parse-ybtour'
import { runParseAndRegisterFlow } from '@/lib/parse-and-register-ybtour-orchestration'
import { sanitizeYbtourRegisterParsedStrings } from '@/lib/register-ybtour-text-sanitize'
import {
  augmentYbtourScheduleExpressionParsed,
  finalizeYbtourItineraryDayDraftsFromSchedule,
  ybtourConfirmHasScheduleExpressionLayer,
} from '@/lib/parse-and-register-ybtour-schedule'

export async function handleParseAndRegisterYbtourRequest(request: Request) {
  return runParseAndRegisterFlow(request, {
    forcedBrandKey: 'ybtour',
    parseFn: parseForRegisterYbtour,
    logPrefix: '[parse-and-register-ybtour]',
    savePersistedParsedOnly: true,
    augmentParsed: (p, ctx) =>
      sanitizeYbtourRegisterParsedStrings(augmentYbtourScheduleExpressionParsed(p, ctx?.pastedBodyText)),
    finalizeItineraryDayDraftsFromSchedule: finalizeYbtourItineraryDayDraftsFromSchedule,
    getHeroTripDatesSupplement: (p) => ({
      ybtourFlightStructured: p.detailBodyStructured?.flightStructured ?? null,
    }),
    confirmScheduleExpressionLayerOk: ybtourConfirmHasScheduleExpressionLayer,
  })
}
