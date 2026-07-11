/**
 * 등록 schedule routeText 세그먼트 — UI·행정 안내 문구 제외 (전 공급사 공통).
 * REGRESSION-FREEZE[register-schedule-route-place-noise]: manifest
 */
import { isAirlineCarrierImageKeyword } from '@/lib/pexels-place-name-keyword'
import { splitRouteTextPlaceSegments } from '@/lib/register-schedule-llm-image-keyword-fallback'
const ROUTE_PLACE_NOISE_START_RE =
  /^(?:호텔\s*조식|조식\s*후|중식|석식|자유\s*시간|체크\s*인|체크\s*아웃|공항\s*도착|공항\s*출발|출발|도착|이동|탑승|귀국|투숙|미팅|피켓|입국\s*수속|출국\s*수속)|^[★☆◈◎○]|기상\s*악화|결항|대체|불가할|유의|안내|주의|※|→|특전|시차|국가번호|관광\s*시간|쇼핑점|침향|찻집|라텍스/i

const ROUTE_ADMIN_GUIDANCE_RE =
  /(?:입국|출국|출입국)(?:\s*(?:시|에|할))?[\s\S]{0,24}(?:관련\s*)?안내|관련\s*안내|한국\s*[-·]\s*일본\s*여행|(?:한국|일본)\s*[-·]\s*(?:한국|일본)\s*여행|여행\s*일정|여행\s*(?:입국|출국|시\s*유의)|비자\s*(?:안내|필수|필요)|세관\s*신고|전자\s*입국|Visit\s*Japan|사전\s*동의|유의\s*사항|여행\s*시\s*유의|출입국\s*카드|온라인\s*입국|입국\s*심사|출국\s*심사|전자\s*여권|e\s*TA\b|ESTA/i

const ROUTE_AIRLINE_SEGMENT_RE =
  /^에어[\uAC00-\uD7AF]{1,12}(?:\s*항공)?$|^대한\s*항공$|^아시아나(?:\s*항공)?$|^제주\s*항공$|^진\s*에어$|^티\s*웨이(?:\s*항공)?$|^이스타(?:\s*항공)?$|^에어부산$|^에어\s*프(?:레미아|리미아)(?:\s*항공)?$|^air\s*premia(?:\s*air)?$/iu

const ROUTE_PLACE_LABEL_TRIM_SUFFIX_RE =
  /(?:으로?\s*이동|으로?\s*출발|으로?\s*귀국|로\s*이동|방문|관광|투어|탐방|체험|승차|하차|탑승|도착|출발|미팅|피켓|조식\s*후|중식\s*후|석식\s*후|시내\s*관광)$/u

const ROUTE_CMS_ASSET_SUFFIX_RE = /-\d{5,}$/i

const ROUTE_MARKETING_EPITHET_RE =
  /(?:땅이\s*끝나고|살고싶어|최고의|휴양지|휴양도시|동화속\s*마을|발현의\s*도시|기도의\s*도시|낭만을|건국의\s*도시|아름다운|천국의|에메랄드|대항해\s*시대|세상의\s*끝|땅끝마을|의\s*도시)/u

/** BongTour 해외 패키지 — routeText는 관광지 체인만. 국내 출발·귀국 허브 제외. */
const REGISTER_SCHEDULE_DOMESTIC_HUB_KO_RE =
  /^(?:인천|김포|부산|대구|청주|김해|서울|제주)(?:\s*국제?\s*공항|\s*공항)?(?:\s*출발|\s*도착)?$/u

const REGISTER_SCHEDULE_DOMESTIC_HUB_EN_RE =
  /^(?:Incheon|Gimpo|Busan|Daegu|Cheongju|Gimhae|Seoul|Jeju|ICN|GMP|PUS|TAE|CJJ|CJU)$/i

export function isRegisterScheduleDomesticHubRouteSegment(label: string): boolean {
  const t = String(label ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return false
  if (REGISTER_SCHEDULE_DOMESTIC_HUB_KO_RE.test(t)) return true
  if (REGISTER_SCHEDULE_DOMESTIC_HUB_EN_RE.test(t)) return true
  return false
}

/** ITNR·tmTitle 마케팅 접두/접미 제거 — 전 공급사 routeText a–g SSOT */
export function cleanRegisterScheduleRoutePlaceLabel(raw: string): string {
  return String(raw ?? '')
    .replace(/^[\s·▪▶●▷\-–—'"]+/, '')
    .replace(/[''"]+$/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, ' ')
    .replace(/▷|■|⭐|🌅|🚙|🚤|🔥/g, ' ')
    .replace(/\[[^\]]{2,64}\]/g, ' ')
    .replace(ROUTE_CMS_ASSET_SUFFIX_RE, '')
    .replace(/\s*\(NEW\)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(ROUTE_PLACE_LABEL_TRIM_SUFFIX_RE, '')
    .trim()
}

function isRegisterScheduleMarketingOnlyRouteLabel(t: string): boolean {
  if (!t || t.length > 64) return true
  if (/^(?:땅이\s*끝나고|유럽인들이|작은\s*동화|모든\s*지역)/u.test(t)) return true
  if (/이미지$/u.test(t) && !/(?:궁|성|사원|박물관|수도원|종탑|대성당)/u.test(t)) return true
  if (/입니다[.!]?$|합니다[.!]?$|좋은\s*일정/u.test(t)) return true
  if (ROUTE_MARKETING_EPITHET_RE.test(t) && !/[,，]/.test(t)) return true
  return false
}

function pickRegisterSchedulePlaceAfterComma(t: string): string | null {
  if (!/[,，]/.test(t)) return null
  const parts = t
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length < 2) return null
  const head = parts[0]!
  const tail = parts[parts.length - 1]!
  if (
    head.length >= 10 ||
    ROUTE_MARKETING_EPITHET_RE.test(head) ||
    /(?:의\s*도시|휴양|해변|마을|시대|끝)/u.test(head)
  ) {
    return tail.length >= 2 ? tail : null
  }
  return null
}

/** `도시A 로카곶` 등 한 카드에 붙은 복합 라벨 분리 (2토큰만 — `봉 헤수스 두 몬테 성당` 등 긴 명칭은 유지) */
export function splitRegisterScheduleCompoundRoutePlaceLabel(label: string): string[] {
  const t = cleanRegisterScheduleRoutePlaceLabel(label)
  if (!t) return []
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length !== 2) return [t]
  const m = t.match(
    /^(.{2,28})\s+([가-힣A-Za-z][가-힣A-Za-z\s]{0,22}(?:곶|해변|역|종탑|터미널))$/u,
  )
  if (m?.[1] && m?.[2]) {
    const a = cleanRegisterScheduleRoutePlaceLabel(m[1])
    const b = cleanRegisterScheduleRoutePlaceLabel(m[2])
    if (a && b && a !== b) return [a, b]
  }
  return [t]
}

/** API 카드·tmTitle 한 줄 → routeText 세그먼트 후보 0..n */
export function expandRegisterScheduleRoutePlaceCandidates(raw: string): string[] {
  const segments = String(raw ?? '')
    .split(/\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const parts = segments.length > 1 ? segments : [String(raw ?? '').trim()]
  const out: string[] = []
  for (const part of parts) {
    const label = extractRegisterScheduleRoutePlaceLabel(part)
    if (!label) continue
    for (const piece of splitRegisterScheduleCompoundRoutePlaceLabel(label)) {
      out.push(piece)
    }
  }
  return out
}

/** `메테오라 등 4성호텔` → `메테오라` — routeText·imageKeyword 세그먼트 SSOT */
export function stripRegisterScheduleRouteSegmentLodgingSuffix(seg: string): string {
  return String(seg ?? '')
    .replace(/\s*등\s*\d+\s*성\s*호텔.*$/u, '')
    .replace(/\s*\/\s*(?:준)?\d+\s*성\s*호텔.*$/u, '')
    .replace(/\s*(?:어기|Abbey)\s*호텔.*$/iu, '')
    .replace(/\s*호텔\s*$/u, '')
    .replace(/\s*\(\s*출발\s*전\s*확정\s*\)\s*$/u, '')
    .trim()
}

/** 마케팅 카드명·cms 라벨 → 순수 장소명 (없으면 null) */
export function extractRegisterScheduleRoutePlaceLabel(raw: string): string | null {
  const t0 = cleanRegisterScheduleRoutePlaceLabel(raw)
  if (!t0 || isRegisterScheduleRoutePlaceNoise(t0)) return null

  const hotelPoi = t0.match(/^(.{2,32})\s*(?:등\s*\d+\s*성\s*호텔|\/\s*(?:준)?\d+\s*성\s*호텔)/u)
  if (hotelPoi?.[1]) {
    return extractRegisterScheduleRoutePlaceLabel(hotelPoi[1].trim())
  }
  if (/등\s*\d+\s*성\s*호텔/u.test(t0) && !/(?:사원|궁|박물관|유적|폭포|성|타워|수도원|대성당)/u.test(t0)) {
    return null
  }

  const fairyVillage = t0.match(/동화속\s*마을\s+(.+)$/u)
  if (fairyVillage?.[1]) {
    return extractRegisterScheduleRoutePlaceLabel(fairyVillage[1])
  }

  const cityTail = t0.match(/(?:운하)?도시\s+(.{2,28})$/u)
  if (cityTail?.[1] && (t0.length >= 14 || ROUTE_MARKETING_EPITHET_RE.test(t0))) {
    return extractRegisterScheduleRoutePlaceLabel(cityTail[1])
  }

  const fromComma = pickRegisterSchedulePlaceAfterComma(t0)
  if (fromComma) {
    const cleaned = cleanRegisterScheduleRoutePlaceLabel(fromComma)
    if (cleaned && !isRegisterScheduleRoutePlaceNoise(cleaned) && !isRegisterScheduleMarketingOnlyRouteLabel(cleaned)) {
      return cleaned.slice(0, 48)
    }
  }

  if (isRegisterScheduleMarketingOnlyRouteLabel(t0)) return null
  if (t0.length > 48) return null
  return t0.slice(0, 48)
}

/** routeText 세그먼트 — 항공사·캐리어명(관광지 아님) */
export function isRegisterScheduleAirlineRouteSegment(label: string): boolean {
  const t = String(label ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return false
  if (ROUTE_AIRLINE_SEGMENT_RE.test(t)) return true
  if (isAirlineCarrierImageKeyword(t)) return true
  if (/항공(?:\s*사)?$/u.test(t) && t.length <= 28 && !/(박물관|과학|우주|항공\s*박물관)/u.test(t)) {
    if (/^에어/u.test(t) || isAirlineCarrierImageKeyword(t.replace(/\s*항공$/u, ''))) return true
  }
  return false
}

/** 붙여넣기·탭 행·routeText 세그먼트가 지명이 아닌 UI/행정/항공 문구인지 */
export function isRegisterScheduleRoutePlaceNoise(label: string): boolean {
  const t = String(label ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t || t.length > 96) return true
  if (t.length < 2 && !/^[\uAC00-\uD7AF]{1,2}$/u.test(t)) return true
  if (isRegisterScheduleAirlineRouteSegment(t)) return true
  if (ROUTE_PLACE_NOISE_START_RE.test(t)) return true
  if (ROUTE_ADMIN_GUIDANCE_RE.test(t)) return true
  if (/^몽골\s*FAQ$/iu.test(t)) return true
  if (/필수\s*코스|쇼핑\s*타임|시내를\s*떠나기\s*전/u.test(t)) return true
  if (/\bFAQ\b/i.test(t) && t.length <= 24) return true
  if (/\b안내\b/u.test(t) && /(?:입국|출국|출입국|비자|세관|여행)/u.test(t)) return true
  if (/^(?:조식|중식|석식|기내|기장|승무원)/i.test(t)) return true
  if (/^\d+일차$/u.test(t)) return true
  if (/^(?:뉴질랜드|호주|일본|중국|태국|베트남)\s*.+(?:관광|투어)$/u.test(t)) return true
  if (/하이라이트\s*_/u.test(t)) return true
  if (/^(?:인천|ICN|김포|GMP|부산|PUS|대구|TAE|청주|CJJ)(?:\s*국제)?\s*공항?$/i.test(t)) return true
  if (/^.{1,28}국제공항$/u.test(t) && !/(?:박물관|역사|항공\s*박물관)/u.test(t)) return true
  if (/^.{2,8}성$/u.test(t) && /(?:산동|강소|요녕|하북|하남|광동|절강|안후이|길림|사천|운남|신장|티베트|몽골|태국|베트남)/u.test(t)) {
    return true
  }
  if (/선택\s*관광|\$\s*\d|(?:전신)?마사지\s*\(\s*\d+\s*분\s*\)|옵션\s*투어|추천\s*선택/u.test(t)) return true
  if (
    /하루\s*동안\s*여러\s*장면|알찬\s*동선|전체적인\s*흐름과\s*분위기|여행의\s*컨셉|귀국길로\s*이어지|이동\s*중심의\s*마무리|현지\s*도착\s*후\s*첫날|보기와\s*걷기가\s*균형|보기와\s*이동이\s*균형/i.test(
      t,
    )
  ) {
    return true
  }
  if (/이미지$/u.test(t) && !/(?:궁|성|사원|박물관|수도원|종탑|대성당)/u.test(t)) return true
  if (/^(?:모든\s*지역|엄선된)/u.test(t)) return true
  if (/호텔\s*(?:체크\s*아웃|개별\s*조식)|체크\s*아웃\s*후/u.test(t)) return true
  if (/날짜\s*변경선|타사\s*비교|비즈니스\s*석|프라이빗\s*전용|여행\s*준비\s*가이드|골든패스|가이드\s*미팅|국경\s*통과/u.test(t)) return true
  if (/^호텔(?:\s*이동|\s*조식|\s*투숙)/u.test(t)) return true
  if (/^공항(?:\s*도착|\s*출발|\s*경유)?$/u.test(t) && t.length <= 12) return true
  if (/숙박\s*없음|입국\s*절차|파타야\s*대표\s*쇼|콜로세움.*쇼|콜롯세움/u.test(t)) return true
  if (/블루스타|Blue\s*Star\s*Delos|수완나(?:품|폼)|B게이트|출입구/u.test(t)) return true
  if (/자유일정\s*추천|전통\s*마사지|빅\s*씨|Big\s*C/u.test(t) && t.length <= 48) return true
  if (/^Travel\s*Tip$/i.test(t)) return true
  if (/^유락죠\s*온천/i.test(t)) return true
  if (/정규\s*\d+\s*성\s*급\s*호텔|성\s*급\s*호텔/u.test(t)) return true
  return false
}

/** 하나투어 등 API placeholder — 명소 없는 관광 filler routeText */
export function isRegisterScheduleGenericTourismFillerRouteText(routeText: string | null | undefined): boolean {
  const t = String(routeText ?? '').trim()
  if (!t) return false
  return /하루\s*동안\s*여러\s*장면|알찬\s*동선|전체적인\s*흐름과\s*분위기|여행의\s*컨셉/i.test(t)
}

/** routeText·places 배열에서 행정/UI·국내 출발 허브 세그먼트 제거 */
export function filterRegisterScheduleRoutePlaceSegments(segments: readonly string[]): string[] {
  const out: string[] = []
  for (const raw of segments) {
    for (const label of expandRegisterScheduleRoutePlaceCandidates(String(raw ?? ''))) {
      if (!label || isRegisterScheduleRoutePlaceNoise(label)) continue
      if (isRegisterScheduleDomesticHubRouteSegment(label)) continue
      out.push(label)
    }
  }
  return out
}

/** 기존 routeText 문자열 — 세그먼트 분리 후 noise 제거·재조립 */
export function sanitizeRegisterScheduleRouteText(
  routeText: string | null | undefined,
  maxPlaces = 7,
): string | null {
  const rt = String(routeText ?? '').trim()
  if (!rt) return null
  // routeText 체인은 ` - ` 구분 — 세그먼트 안 쉼표 지명(예: 대,소석림)은 유지
  const segments = /\s+-\s+/u.test(rt)
    ? rt.split(/\s+-\s+/).map((s) => s.trim()).filter(Boolean)
    : splitRouteTextPlaceSegments(rt)
  const chain = filterRegisterScheduleRoutePlaceSegments(segments).slice(0, maxPlaces)
  return chain.length > 0 ? chain.join(' - ') : null
}
