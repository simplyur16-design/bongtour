/** REGISTER_PROMPT·schedule 선추출 프롬프트에 삽입 */
export const REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK = `# [schedule[].imageKeyword / imageKeyword2 — Pexels 검색용]
- **관광 일차:** 그날 일정·여행지에 맞는 **관광명소·어트랙션**만(예: Merlion Park, Universal Studios Singapore, Marina Bay Sands). **호텔·숙소명·도시·국가 단독·다른 나라 명소**(Forbidden City 등) 금지. imageKeyword = 1순위, imageKeyword2 = 다른 명소. Day N travel·한글·공항·식사 키워드 금지.
- **routeText가 있으면(필수에 가깝게):** imageKeyword·imageKeyword2는 **routeText의 이동 순서(A - B - C)** 에서 **앞쪽·다음 관광명소**를 우선한다. description만 짧아도 routeText 순서를 따른다.
- **출발·귀국(비행) 일차:** imageKeyword·imageKeyword2 모두 **일정 첫·마지막 해외 도시 영문명**만(동일 도시 가능). 국내 허브·공항 키워드 금지.
- 불확실한 슬롯은 빈 문자열.`

/** Product.schedule[]·LLM JSON에서 routeText 추출 */
export function scheduleRouteTextFromRow(row: { routeText?: unknown } | Record<string, unknown>): string | null {
  const v = (row as { routeText?: unknown }).routeText
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export const REGISTER_SCHEDULE_EXTRACT_IMAGE_KEYWORD_LINE =
  'imageKeyword(1순위 관광지·명소), imageKeyword2(2순위 관광지·명소 또는 비행일 도시명),'
