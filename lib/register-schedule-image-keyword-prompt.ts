/** REGISTER_PROMPT·schedule 선추출·Gemini fill 프롬프트 SSOT — Pexels용 영문 관광지 고유명 */
// REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: canonical English proper name — manifest

/** 등록 LLM·Gemini fill 공통 — 직역 금지, 국제 통용 영문 고유명(resolve) */
export const REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK = `# [schedule[].imageKeyword / imageKeyword2 — Pexels 검색용]
- **필수:** 모든 일차에 **영문** imageKeyword를 채운다. 그날 routeText·description의 **실제 방문 관광지·랜드마크**에 대응하는 **국제 통용 영문 고유명(proper noun)**만 쓴다. **한글·설명형 문장 금지.**
- **직역·의역·번역 금지:** 한글 세그먼트를 영어로 옮기지 말고, **그 장소의 정식·관용 영문 표기**를 찾아 쓴다. (Wikipedia en 제목, Google Maps 영문, UNESCO·관광청 공식명 우선)
  - ✅ 포나가 참 사원 → Po Nagar Cham Towers
  - ❌ Ponagar Reference Temple / Vietnamese cham temple
  - ✅ 다딴라폭포 → Datanla Waterfalls
  - ❌ Datanla waterfall scenic area tour
- **관광 일차:** 관광명소·어트랙션 고유명만. **호텔·숙소·공항·식사·Day N travel·마케팅 문구** 금지. 도시·국가 이름만 단독 금지(랜드마크·명소 우선). imageKeyword = 1순위, imageKeyword2 = 다른 명소.
- **routeText:** A - B - C이면 **방문 순서대로** 1·2순위 명소의 **영문 고유명**을 resolve. routeText·POI 사전에 이미 영문이 있으면 **그 표기를 그대로** 쓰고 새로 지어 내지 말 것.
- **1일차·마지막 일차·출발·귀국(비행) 일차:** imageKeyword = **해외 목적/방문 도시의 정식 영문명**(첫·마지막 방문 도시). routeText가 인천만이면 **상품 destination·다른 일차 routeText**에서 resolve. imageKeyword2는 null. 인천·김포·ICN 등 국내 허브 금지.
- **다른 대륙 랜드마크 환각 금지**(예: 인도 일정에 Paris). 정말 불가능할 때만 빈 문자열.`

/** Gemini fill 전용 — 영문 지시(등록 LLM과 동일 계약) */
export const REGISTER_GEMINI_SCHEDULE_IMAGE_KEYWORD_RESOLVE_BLOCK = `English naming (critical):
- Do NOT translate Korean routeText literally or paraphrase into descriptive English.
- For each place segment, resolve the closest standard English proper name used internationally (Wikipedia en, Google Maps English, official tourism board).
- Output short landmark proper nouns only (typically 2–6 words). No meals, hotels, airports, or marketing phrases.
- If routeText already contains an English place name, reuse that exact spelling.`

/** Product.schedule[]·LLM JSON에서 routeText 추출 */
export function scheduleRouteTextFromRow(row: { routeText?: unknown } | Record<string, unknown>): string | null {
  const v = (row as { routeText?: unknown }).routeText
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export const REGISTER_SCHEDULE_EXTRACT_IMAGE_KEYWORD_LINE =
  'imageKeyword(영문 1순위 관광지·명소 고유명·직역 금지), imageKeyword2(영문 2순위·다른 명소 고유명 또는 비행일 해외 도시 정식 영문명),'
