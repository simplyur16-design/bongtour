/**
 * 자유여행 제미나이 추천일정 — 모든 일차가 빠짐없이 채워졌는지 검사(사장님 11/01 19:01: 추천일정 없는 자유여행은 공개 금지).
 * 검사만 한다. 문장을 고치지 않는다. 문제가 있으면 호출부가 한 번 더 부르고, 그래도 안 되면 저장하지 않고 사유를 남긴다.
 * REGRESSION-FREEZE[fit-gemini-recommended-itinerary-1101]: 일차 수·빈 일차·금지어 검사 — manifest
 */
import type { FitItineraryGeminiResponse } from '@/lib/fit-itinerary-gemini-parse'
import { checkBongtourFreeDayText } from '@/lib/bongtour-free-day-postcheck'
import { buildFitDayRouteText } from '@/lib/fit-itinerary-pick-day-image-keyword'
import { isBrokenRegisterFitScheduleDescription } from '@/lib/register-pre-photo-guards'

export type FitItineraryDaysValidation = { ok: boolean; issues: string[] }

export function validateFitItineraryGeminiDays(
  parsed: FitItineraryGeminiResponse,
  totalDays: number,
  opts: { hotelKnown?: boolean } = {},
): FitItineraryDaysValidation {
  const issues: string[] = []
  const days = [...(parsed.days ?? [])].sort((a, b) => a.dayNumber - b.dayNumber)
  if (days.length !== totalDays) issues.push(`days_count_${days.length}_expected_${totalDays}`)
  for (let i = 1; i <= totalDays; i++) {
    const d = days.find((x) => Math.floor(Number(x.dayNumber)) === i)
    if (!d) {
      issues.push(`day${i}_missing`)
      continue
    }
    const summary = String(d.summary ?? '').trim()
    if (summary.length < 20) issues.push(`day${i}_summary_empty`)
    if (!String(d.title ?? '').trim()) issues.push(`day${i}_title_empty`)
    if (!(d.activities ?? []).some((a) => String(a.location ?? a.title ?? '').trim())) {
      issues.push(`day${i}_no_activities`)
    }
    // 등록 전 검사와 같은 기준 — 그날 동선 장소 이름이 요약에 하나도 없으면 다시 만든다
    if (summary.length >= 20 && (d.activities ?? []).length) {
      const route = buildFitDayRouteText({
        dayNumber: i,
        title: String(d.title ?? ''),
        summary,
        activities: (d.activities ?? []).map((a) => ({
          order: Number(a.order) || 0,
          category: String(a.category ?? ''),
          title: String(a.title ?? ''),
          description: String(a.description ?? ''),
          location: String(a.location ?? ''),
        })),
      })
      if (isBrokenRegisterFitScheduleDescription(summary, route)) issues.push(`day${i}_summary_no_route_place`)
    }
    // 가격·최저가·단정어 — 요약에만 엄격 적용(제목 속 호텔명 숫자 오탐 방지)
    // 그날 장소 이름 속 숫자('비토리오 에마누엘레 2세 갤러리아', '피어 39')는 가격·시간 숫자가 아니다
    let probe = summary
    for (const a of d.activities ?? []) {
      for (const name of [a.title, String(a.location ?? '').replace(/\s*\([^)]*\)\s*/g, ' ')]) {
        const n = String(name ?? '').trim()
        if (n.length >= 2 && /[0-9]/.test(n)) probe = probe.split(n).join('장소')
      }
    }
    for (const iss of checkBongtourFreeDayText('summary', probe, { hotelKnown: opts.hotelKnown === true })) {
      if (iss.kind === 'banned_word' || iss.kind === 'number') issues.push(`day${i}_${iss.kind}`)
    }
  }
  return { ok: issues.length === 0, issues }
}
