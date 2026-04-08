/**
 * 「꼭 확인하세요」— 출발 전 준비·출입국·서류 중심 키워드 필터.
 * 공개 소비(`public-must-know-display`)와 등록 파이프(하나투어·모두투어 기본정보)가 동일 기준을 공유한다.
 */

export const TRIP_READINESS_WHITELIST_RES: RegExp[] = [
  /여권/,
  /비자/,
  /무비자/,
  /입국/,
  /출국/,
  /전자입국/,
  /입국신고/,
  /온라인\s*입국/,
  /Visit\s*Japan/i,
  /출입국/,
  /외국\s*국적/,
  /국적/,
  /필수\s*서류/,
  /준비사항/,
  /세관/,
  /반입/,
  /금지\s*품목/,
  /금제품/,
  /육류/,
  /만\s*14\s*세/,
  /14\s*세\s*미만/,
  /자녀\s*동반/,
  /아동\s*동반/,
  /미성년/,
  /e\s*SIM|이심|유심/u,
  /전압/,
  /전자기기|보안\s*검사|검사\s*협조/,
  /전자\s*여행\s*허가|ESTA|ETA\b/i,
]

export const TRIP_READINESS_BLACKLIST_RES: RegExp[] = [
  /상품\s*가격|상품가격/,
  /가격\s*변동/,
  /항공\s*스케줄|스케줄\s*변경/,
  /호텔\s*변경/,
  /일정\s*변경/,
  /가이드\s*\/\s*기사|가이드비|기사\s*경비/,
  /선택\s*관광|선택관광/,
  /현지\s*옵션/,
  /쇼핑\s*센터|쇼핑\s*\d+\s*회|무\s*쇼핑|쇼핑\s*일정/,
  /1인\s*객실|싱글|단독\s*객실/,
  /항공\s*리턴|리턴\s*변경/,
  /취소\s*규정|환불\s*규정/,
  /여행자\s*보험|보험\s*가입\s*권유/,
  /보험/,
  /마일리지/,
  /캠페인|프로모션|이벤트/,
  /대표\s*이미지|이미지\s*설명/,
  /식사\s*이미지/,
  /관광지\s*설명|맛집|식사\s*코스/,
]

export function textPassesTripReadinessFilters(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length < 4) return false
  if (TRIP_READINESS_BLACKLIST_RES.some((re) => re.test(t))) return false
  return TRIP_READINESS_WHITELIST_RES.some((re) => re.test(t))
}

export function normalizeTripReadinessDedupeKey(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 120)
}
