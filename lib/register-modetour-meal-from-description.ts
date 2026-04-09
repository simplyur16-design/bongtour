/**
 * 일정 day description 안의 「식사」·조식/중식/석식 줄만 뽑아 mealSummaryText 보강용 문자열로 반환.
 * `registerScheduleToDayInputs` 등 저장 경로에서만 사용 — 공개 상세는 DB/schedule JSON에 적재된 식사 필드를 쓴다.
 */

export function extractModetourMealSummaryFromScheduleDescription(desc: string | undefined): string | null {
  if (!desc?.trim()) return null
  const t = desc.replace(/\r/g, '\n').replace(/<[^>]+>/g, ' ')
  const sameLineAfterMeal = t.match(
    /식사\s+((?:조식|중식|석식)\s*[-–—]\s*[^\n]+(?:\s*,\s*(?:조식|중식|석식)\s*[-–—]\s*[^\n]+)*)/i
  )
  if (sameLineAfterMeal?.[1] && /(?:조식|중식|석식)/.test(sameLineAfterMeal[1])) {
    return `식사 ${sameLineAfterMeal[1].replace(/\s+/g, ' ').trim().slice(0, 480)}`
  }
  const mealHead = t.match(/(?:^|\n)\s*식사\s*\n([\s\S]{0,500})/i)
  if (mealHead?.[1] && /(?:조식|중식|석식)/.test(mealHead[1])) {
    return `식사 ${mealHead[1].replace(/\s+/g, ' ').trim().slice(0, 480)}`
  }
  const lineMatch = t.match(
    /(?:^|\n)\s*(?:조식|중식|석식)\s*[-–—]\s*[^\n]+(?:\n\s*(?:조식|중식|석식)\s*[-–—]\s*[^\n]+)*/gi
  )
  if (lineMatch?.length) {
    return lineMatch.join(' · ').replace(/\s+/g, ' ').trim().slice(0, 500)
  }
  return null
}
