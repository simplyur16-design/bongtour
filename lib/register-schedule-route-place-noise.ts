/**
 * 등록 schedule routeText 세그먼트 — UI·행정 안내 문구 제외 (전 공급사 공통).
 * REGRESSION-FREEZE[register-schedule-route-place-noise]: manifest
 */
const ROUTE_PLACE_NOISE_START_RE =
  /^(?:호텔\s*조식|조식\s*후|중식|석식|자유\s*시간|체크\s*인|체크\s*아웃|공항\s*도착|공항\s*출발|출발|도착|이동|탑승|귀국|투숙|미팅|피켓|입국\s*수속|출국\s*수속)|^[★☆◈◎○]|기상\s*악화|결항|대체|불가할|유의|안내|주의|※|→|특전|시차|국가번호|관광\s*시간|쇼핑점|침향|찻집|라텍스/i

const ROUTE_ADMIN_GUIDANCE_RE =
  /(?:입국|출국|출입국)(?:\s*(?:시|에|할))?[\s\S]{0,24}(?:관련\s*)?안내|관련\s*안내|한국\s*[-·]\s*일본\s*여행|(?:한국|일본)\s*[-·]\s*(?:한국|일본)\s*여행|여행\s*일정|여행\s*(?:입국|출국|시\s*유의)|비자\s*(?:안내|필수|필요)|세관\s*신고|전자\s*입국|Visit\s*Japan|사전\s*동의|유의\s*사항|여행\s*시\s*유의|출입국\s*카드|온라인\s*입국|입국\s*심사|출국\s*심사|전자\s*여권|e\s*TA\b|ESTA/i

/** 붙여넣기·탭 행·routeText 세그먼트가 지명이 아닌 UI/행정 문구인지 */
export function isRegisterScheduleRoutePlaceNoise(label: string): boolean {
  const t = String(label ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t || t.length > 96) return true
  if (t.length < 2 && !/^[\uAC00-\uD7AF]{1,2}$/u.test(t)) return true
  if (ROUTE_PLACE_NOISE_START_RE.test(t)) return true
  if (ROUTE_ADMIN_GUIDANCE_RE.test(t)) return true
  if (/\b안내\b/u.test(t) && /(?:입국|출국|출입국|비자|세관|여행)/u.test(t)) return true
  if (/^(?:조식|중식|석식|기내|기장|승무원)/i.test(t)) return true
  if (/^(?:인천|ICN|김포|GMP|부산|PUS|대구|TAE|청주|CJJ)(?:\s*국제)?\s*공항?$/i.test(t)) return true
  return false
}
