/**
 * 참좋은여행(verygoodtour): 일차 `imageKeyword` — 영문 + 실존 랜드마크 우선, 삼단 포맷
 * (`register-schedule-english-place-image-keyword` — 노랑풍선 `keywordFromTitleDescription`과 동일 엔진)
 */
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'
import { buildEnglishPlaceTripartiteImageKeyword } from '@/lib/register-schedule-english-place-image-keyword'

/**
 * LLM·병합 직후 호출. 원문 일차 블록(`detRows`)을 먼저 넣어 공항·사원 등 고유명이 title보다 우선한다.
 */
export function polishVerygoodRegisterScheduleImageKeywords(
  schedule: RegisterScheduleDay[],
  detRows: RegisterScheduleDay[]
): RegisterScheduleDay[] {
  if (!schedule?.length) return schedule
  const detByDay = new Map<number, RegisterScheduleDay>()
  for (const r of detRows) {
    const d = Number(r.day) || 0
    if (d > 0) detByDay.set(d, r)
  }
  return schedule.map((row) => {
    const day = Number(row.day) || 0
    const det = detByDay.get(day)
    const rawDayBody = String(det?.description ?? '').trim()
    const title = String(row.title ?? '').trim()
    const description = String(row.description ?? '').trim()
    const kw = buildEnglishPlaceTripartiteImageKeyword({
      title,
      description,
      rawDayBody,
      currentKeyword: String(row.imageKeyword ?? '').trim(),
    }).slice(0, 180)
    return { ...row, imageKeyword: kw }
  })
}
