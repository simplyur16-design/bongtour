/** REGISTER_PROMPT·schedule 선추출 프롬프트에 삽입 */
export const REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK = `# [schedule[].imageKeyword / imageKeyword2 — Pexels 검색용]
- **필수:** 모든 일차에 **영문** imageKeyword를 채운다(스페인·유럽·미주·중동·아프리카·동남아·일본 등 **어느 나라·도시든**). 그날 일정·routeText·description에서 **실제 방문 관광지·랜드마크 고유명**을 영어로 쓴다(예: Santiago de Compostela, Camino de Santiago, Sagrada Familia). **한글만 넣지 말 것.**
- **관광 일차:** 관광명소·어트랙션만. **호텔·숙소명·공항·식사·Day N travel** 금지. 도시·국가 이름만 단독으로 쓰지 말 것(랜드마크·명소 우선). imageKeyword = 1순위, imageKeyword2 = 다른 명소.
- **routeText:** 한글이어도 imageKeyword/imageKeyword2는 **반드시 영문**으로 번역해 채운다. routeText가 A - B - C이면 이동 순서대로 1·2순위 명소를 고른다.
- **출발·귀국(비행) 일차:** imageKeyword·imageKeyword2 = **해외 도시 영문명**(첫·마지막 방문 도시, 동일 가능). 인천·김포·ICN 등 국내 허브 금지.
- **다른 대륙 랜드마크 환각 금지**(예: 인도 일정에 Paris). 정말 불가능할 때만 빈 문자열.`

/** Product.schedule[]·LLM JSON에서 routeText 추출 */
export function scheduleRouteTextFromRow(row: { routeText?: unknown } | Record<string, unknown>): string | null {
  const v = (row as { routeText?: unknown }).routeText
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export const REGISTER_SCHEDULE_EXTRACT_IMAGE_KEYWORD_LINE =
  'imageKeyword(영문 1순위 관광지·명소), imageKeyword2(영문 2순위·다른 명소 또는 비행일 해외 도시명),'
