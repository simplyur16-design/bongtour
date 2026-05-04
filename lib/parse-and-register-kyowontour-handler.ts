/**
 * 교원이지(kyowontour) 등록 POST 전용 — 공용 `handleParseAndRegisterRequest` 미사용.
 * 일정 표현층: 미리보기 schedule 비움 우회·확정 시 drafts/ItineraryDay/Product.schedule 정렬은 `parse-and-register-kyowontour-schedule`.
 */
import { parseForRegisterKyowontour } from '@/lib/register-parse-kyowontour'
import { runParseAndRegisterFlow } from '@/lib/parse-and-register-kyowontour-orchestration'
import { sanitizeKyowontourRegisterParsedStrings } from '@/lib/register-kyowontour-text-sanitize'
import {
  augmentKyowontourScheduleExpressionParsed,
  finalizeKyowontourItineraryDayDraftsFromSchedule,
  kyowontourConfirmHasScheduleExpressionLayer,
} from '@/lib/parse-and-register-kyowontour-schedule'

export async function handleParseAndRegisterKyowontourRequest(request: Request) {
  return runParseAndRegisterFlow(request, {
    forcedBrandKey: 'kyowontour',
    parseFn: parseForRegisterKyowontour,
    logPrefix: '[parse-and-register-kyowontour]',
    savePersistedParsedOnly: true,
    augmentParsed: (p, ctx) =>
      sanitizeKyowontourRegisterParsedStrings(augmentKyowontourScheduleExpressionParsed(p, ctx?.pastedBodyText)),
    finalizeItineraryDayDraftsFromSchedule: finalizeKyowontourItineraryDayDraftsFromSchedule,
    getHeroTripDatesSupplement: (p) => ({
      kyowontourFlightStructured: p.detailBodyStructured?.flightStructured ?? null,
    }),
    confirmScheduleExpressionLayerOk: kyowontourConfirmHasScheduleExpressionLayer,
  })
}
