/**
 * 교원이지(kyowontour) 전용: `Product.schedule[].imageKeyword`·`imageKeyword2` Pexels 검색용 영문.
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: 관광 일차 2순위 — manifest
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: POI regex — schedule-poi-regex-ssot SSOT — manifest
 */

import { findAllMappedKoreanPoisInText } from '@/lib/pexels-keyword'
import {
  finalizeScheduleImageKeyword,
  isBareCityOrCountryKeyword,
  isAirlineCarrierImageKeyword,
  isNonLandmarkRouteTextSegment,
  isScheduleImageKeywordLandmarkEligible,
} from '@/lib/pexels-place-name-keyword'
import {
  inferEnglishPlaceKeywordFromDayContent,
  normScheduleImageKeywordKey,
  pickDistinctSecondScheduleImageKeyword,
  shouldReconcileScheduleImageKeyword2,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import { isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'
import {
  findAllScheduleSpotMatchesInText,
  firstMatchingScheduleCityEn,
  firstMatchingScheduleSpotEn,
} from '@/lib/schedule-poi-regex-ssot'

export type KyowontourImageKeywordContext = {
  day: number
  title: string
  description: string
  routeText?: string | null
  /** 일차 원문 블록(붙여넣기 파이프라인) */
  blob?: string
  /** 에어텔(항공+호텔) + 일정 빈약 시 도시 기반 키워드(교원이지 전용) */
  airtelFreeTravelImageKw?: 'off' | 'force-city'
  productTitle?: string
  productPrimaryDestination?: string | null
  productDestination?: string | null
}

const HANGUL = /\p{Script=Hangul}/u

/** LLM/파서 placeholder·불량 패턴 */
export function isKyowontourPlaceholderImageKeyword(s: string): boolean {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (/^day\s*\d+\s*travel$/i.test(t)) return true
  if (/^제\s*\d+\s*일차(?:\s*일정)?$/u.test(t)) return true
  if (/^real\s+place\s+name\s+in\s+english$/i.test(t)) return true
  return false
}

const DATE_LIKE =
  /\d{4}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}|\d{1,2}\s*\/\s*\d{1,2}\s*\(\s*[월화수목금토일]\s*\)|\b\d{1,2}\s*\/\s*\d{1,2}\b/

const MEAL_HOTEL_KO = /호텔|예정\s*호텔|호텔식|조식|중식|석식|점심|저녁|아침|식사\s*[:：]/u

const TRAVEL_STANDALONE_KO = /^(?:출발|도착|귀국|입국|출국|공항\s*이동|이동)$/u

const GENERIC_EN = /^(?:travel|tour|city\s*tour|day\s*\d+\s*travel)$/i

const KYOWONTOUR_DOMESTIC_HUB_RE =
  /^(?:인천|서울|한국|김포|부산|대구|청주|제주|인천국제공항|김포국제공항|인천공항|김포공항|ICN|GMP|PUS|CJU)$/iu

function isKyowontourDomesticHubToken(seg: string): boolean {
  const t = seg.replace(/\s+/g, ' ').trim()
  if (!t) return true
  return KYOWONTOUR_DOMESTIC_HUB_RE.test(t)
}

function kyowontourRouteTextSegments(routeText: string | null | undefined): string[] {
  return splitRouteTextPlaceSegments(routeText)
    .map((s) => s.replace(/\[[^\]]*]/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 2 || /[\uAC00-\uD7AF]/u.test(s))
}

/** REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: 항공사·허브·home 등 — manifest */
function isKyowontourRejectedImageKeywordCandidate(kw: string | null | undefined): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (isBlockedScheduleImageKeyword(t)) return true
  if (isAirlineCarrierImageKeyword(t)) return true
  if (isKyowontourPlaceholderImageKeyword(t)) return true
  if (!isScheduleImageKeywordLandmarkEligible(t)) return true
  return false
}

function kyowontourLandmarkFromHaystack(ctx: KyowontourImageKeywordContext): string | null {
  const h = hay(ctx)
  const spot = firstMatchingScheduleSpotEn( h)
  if (spot) return spot
  const city = firstMatchingScheduleCityEn( h)
  if (city && !isBlockedScheduleImageKeyword(city)) return city
  return null
}

function kyowontourUsableRouteSegments(routeText: string | null | undefined): string[] {
  return kyowontourRouteTextSegments(routeText).filter((s) => {
    if (isKyowontourDomesticHubToken(s)) return false
    if (firstMatchingScheduleSpotEn( s)) return true
    return !isNonLandmarkRouteTextSegment(s)
  })
}

function landmarkFromKyowontourRouteText(routeText: string | null | undefined): string | null {
  const segs = kyowontourUsableRouteSegments(routeText)
  if (!segs.length) return null
  let lastSpot: string | null = null
  let lastCity: string | null = null
  for (const seg of segs) {
    const spot = firstMatchingScheduleSpotEn( seg)
    if (spot) lastSpot = spot
    const city = firstMatchingScheduleCityEn( seg)
    if (city && !isBlockedScheduleImageKeyword(city)) lastCity = city
  }
  return lastSpot ?? lastCity
}

function firstLandmarkFromKyowontourRouteText(routeText: string | null | undefined): string | null {
  const segs = kyowontourUsableRouteSegments(routeText)
  for (const seg of segs) {
    const spot = firstMatchingScheduleSpotEn( seg)
    if (spot) return spot
    const city = firstMatchingScheduleCityEn( seg)
    if (city && !isBlockedScheduleImageKeyword(city)) return city
  }
  return null
}

const IATA_IMAGE: Readonly<Record<string, string>> = {
  ICN: 'Seoul Incheon airport departure hall',
  GMP: 'Seoul Gimpo airport',
  PVG: 'Shanghai Pudong airport to city',
  SHA: 'Shanghai Hongqiao airport',
  NRT: 'Narita airport Tokyo approach',
  HND: 'Haneda airport Tokyo skyline',
  KIX: 'Kansai airport Osaka bay',
  NGO: 'Chubu airport Nagoya',
  FUK: 'Fukuoka airport city view',
  CTS: 'New Chitose airport Hokkaido',
  CDG: 'Paris Charles de Gaulle to skyline',
  FCO: 'Rome Fiumicino airport approach',
  LHR: 'London Heathrow approach',
  JFK: 'New York JFK airport approach',
  LGA: 'New York LaGuardia skyline',
  EWR: 'New York Newark skyline',
  YNJ: 'Yanji arrival city winter',
}

function hay(ctx: KyowontourImageKeywordContext): string {
  return `${ctx.title}\n${ctx.description}\n${ctx.routeText ?? ''}\n${ctx.blob ?? ''}`.replace(/\s+/g, ' ')
}

function stripDatesAndNoise(s: string): string {
  return s
    .replace(/\b\d{4}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}\b/g, ' ')
    .replace(/\d{1,2}\s*\/\s*\d{1,2}\s*\(\s*[월화수목금토일]\s*\)/g, ' ')
    .replace(/\s*·\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}

function clampWords(s: string, maxWords: number): string {
  const w = s.split(/\s+/).filter(Boolean)
  if (w.length <= maxWords) return w.join(' ').trim()
  return w.slice(0, maxWords).join(' ').trim()
}

function hasHangul(s: string): boolean {
  return HANGUL.test(s)
}

function hasBadSubstrings(s: string): boolean {
  if (DATE_LIKE.test(s)) return true
  if (MEAL_HOTEL_KO.test(s)) return true
  if (GENERIC_EN.test(s.trim())) return true
  if (TRAVEL_STANDALONE_KO.test(s.trim())) return true
  if (/\b(?:hotel\s*only|breakfast|lunch|dinner|meals?\s*at)\b/i.test(s)) return true
  return false
}

/** 이미 영문 이미지 검색어로 쓸 만하면 true (한글 금지). `{장소} / {배경} / {시점}` 형태는 단어 상한을 넉넉히 허용(R-3.6). */
function isAcceptableEnglishKeyword(s: string): boolean {
  const t = stripDatesAndNoise(s)
  if (t.length < 4 || t.length > 120) return false
  if (hasHangul(t)) return false
  if (isKyowontourPlaceholderImageKeyword(t)) return false
  if (hasBadSubstrings(t)) return false
  if (!/[a-z]{4,}/i.test(t)) return false
  const wc = countWords(t.replace(/\s*\/\s*/g, ' '))
  if (wc > (t.includes('/') ? 18 : 10)) return false
  return true
}

function arrivalCityFromHay(h: string): string | null {
  const m = h.match(/([^\s()（）]{2,12}?)\s*[\(（]\s*([A-Z]{3})\s*[\)）]\s*도착/u)
  if (m?.[2]) {
    const iata = m[2]
    return IATA_IMAGE[iata] ?? null
  }
  return null
}

function iataHintsFromHay(h: string): string | null {
  const pairs = [...h.matchAll(/\(\s*([A-Z]{3})\s*\)\s*(출발|도착)/gu)]
  if (pairs.length >= 2) {
    const last = pairs[pairs.length - 1]
    const code = last?.[1]
    if (code && IATA_IMAGE[code]) return IATA_IMAGE[code]
  }
  if (pairs.length === 1) {
    const code = pairs[0]?.[1]
    if (code && IATA_IMAGE[code]) return IATA_IMAGE[code]
  }
  return null
}

function firstMatchingEn(rules: ReadonlyArray<{ re: RegExp; en: string }>, h: string): string | null {
  for (const { re, en } of rules) {
    if (re.test(h)) return en
  }
  return null
}

/** Pexels 검색용 권장 `{장소} / {대표 배경} / {대표 시점}` — description·blob 우선 (교원이지 R-3.6) */
const KYOWONTOUR_DESC_TRIPLE: ReadonlyArray<{ re: RegExp; en: string }> = [
  { re: /(APEC\s*공원|아펙|사랑의\s*부두|Love\s*Lock)/iu, en: 'Da Nang APEC Park / Han River waterfront / wide angle' },
  {
    re: /(호이안|회안|Hoi\s*An).{0,48}(올드|고택|Ancient|등불|올드타운)/iu,
    en: 'Hoi An Ancient Town / lantern-lit street / eye-level',
  },
  { re: /(골든\s*브릿지|Golden\s*Bridge|바나\s*힐|바나산)/iu, en: 'Golden Bridge Ba Na Hills / giant stone hands / wide angle' },
  {
    re: /(영흥사|린\s*웅|Linh\s*Ung|다낭\s*대성당)/iu,
    en: 'Linh Ung Pagoda Da Nang / Lady Buddha statue sea view / front view',
  },
  {
    re: /(미케|My\s*Khe|마블\s*마운틴|Marble\s*Mountain|논\s*누옥)/iu,
    en: 'Marble Mountains Da Nang / stone peaks pagodas / wide angle',
  },
]

const IMAGE_KEYWORD_MAX_WORDS = 20

const PEXELS_GENERIC_CITY_EN =
  /^(da\s*nang|hoi\s*an|hanoi|ha\s*noi|saigon|ho\s*chi\s*minh|tokyo|osaka|kyoto|seoul|busan|bangkok|paris|london|new\s*york)\s*$/i

/** 단순 도시명 등 Pexels 검색에 너무 넓은 키워드 */
export function isKyowontourPexelsTooGeneric(s: string): boolean {
  const t = stripDatesAndNoise(String(s ?? '').trim())
  if (!t) return true
  if (isBlockedScheduleImageKeyword(t)) return true
  if (isBareCityOrCountryKeyword(t)) return true
  if (t.includes('/')) return false
  if (PEXELS_GENERIC_CITY_EN.test(t)) return true
  if (countWords(t) <= 2 && t.length <= 22) return true
  return false
}

function normalizeSlashSpacing(s: string): string {
  return s.replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim()
}

const KYOWONTOUR_AIRTEL_SCHEDULE_STOPWORDS = new Set([
  '공항',
  '호텔',
  '이동',
  '출발',
  '도착',
  '자유일정',
  '체크인',
  '귀국',
  '입국',
  '일차',
  '미팅',
  '호텔숙박',
  '석식',
  '조식',
  '중식',
  '식사',
  '자유',
  '예정',
  '체크인',
  '픽업',
  '탑승',
  '수속',
])

function kyowontourAirtelScheduleRowHasPlaceSignal(row: { title: string; description: string }): boolean {
  const t = `${row.title ?? ''}\n${row.description ?? ''}`
  const compact = t.replace(/\s/g, '')
  if (compact.length < 10) return false
  const hangulWords = t.match(/[가-힣]{3,}/g) ?? []
  for (const w of hangulWords) {
    if (w.length >= 3 && !KYOWONTOUR_AIRTEL_SCHEDULE_STOPWORDS.has(w) && !/^제?\d+일차?$/.test(w)) return true
  }
  if (/[A-Za-z]{6,}/.test(t) && !/^day\s*\d+/i.test(t.trim())) return true
  return false
}

/** 에어텔 일정이 관광지 서술 없이 빈약한지(교원이지 전용) */
export function isKyowontourScheduleWeakForAirtelImageKw(
  rows: ReadonlyArray<{ title: string; description: string }>
): boolean {
  if (!rows.length) return true
  const usable = rows.filter((r) => (String(r.title) + String(r.description)).trim().length > 0)
  if (!usable.length) return true
  return usable.every((r) => !kyowontourAirtelScheduleRowHasPlaceSignal(r))
}

function kyowontourAirtelFreeTravelHaystackLocal(ctx: KyowontourImageKeywordContext): string {
  const parts = [
    ctx.productTitle,
    ctx.productPrimaryDestination,
    ctx.productDestination,
    ctx.title,
    ctx.description,
    ctx.blob,
  ].filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  return parts.join('\n').replace(/\s+/g, ' ').trim().slice(0, 24_000)
}

function kyowontourAirtelFreeTravelRegionalFallbackLocal(h: string): string {
  if (/(북유럽|노르웨이|스웨덴|핀란드|덴마크|스칸디나비아|Norway|Sweden|Finland|Denmark|Scandinavia)/i.test(h))
    return 'Scandinavia Nordic waterfront city harbor view'
  if (/(발틱|에스토니아|라트비아|리투아니아|타린|리가|빌뉴스)/i.test(h))
    return 'Baltic historic old town cobblestone street'
  if (/(유럽|프랑스|독일|이탈리아|스페인|포르투갈|오스트리아|스위스|그리스|크로아티아|슬로베니아)/i.test(h))
    return 'European historic city center architecture plaza'
  if (/(영국|아일랜드|스코틀랜드|에든버러)/i.test(h)) return 'British Isles historic city street architecture'
  if (/(중동|터키|요르단|이집트|모로코|UAE|아랍)/i.test(h)) return 'Middle East historic mosque old city skyline'
  if (/(아프리카|케냐|남아프리카|모잠비크)/i.test(h)) return 'Africa savanna lodge sunrise landscape'
  if (/(호주|뉴질랜드|Oceania)/i.test(h)) return 'Oceania coastal city waterfront skyline'
  if (/(미국|캐나다|하와이|알래스카|멕시코|Mexico)/i.test(h)) return 'North America urban skyline downtown day'
  if (/(일본|도쿄|오사카|교토|沖縄)/i.test(h)) return 'Japan city street skyline night district'
  if (/(중국|홍콩|마카오|대만|타이베이)/i.test(h)) return 'East Asia metropolitan skyline riverfront'
  if (/(태국|베트남|캄보디아|라오스|미얀마|필리핀|인도네시아|말레이시아|싱가포르|동남아)/i.test(h))
    return 'Southeast Asia tropical city riverfront temples'
  if (/(인도|네팔|스리랑카)/i.test(h)) return 'South Asia historic monument cityscape'
  if (/(한국|서울|제주|부산)/i.test(h)) return 'Korea modern city skyline Han river'
  return 'International city travel destination view'
}

/** 교원이지 전용: 에어텔+빈약 일정용 도시/권역 키워드(타 공급사 미사용) */
function kyowontourResolveAirtelFreeTravelImageKeywordLocal(ctx: KyowontourImageKeywordContext): string {
  const h = kyowontourAirtelFreeTravelHaystackLocal(ctx)
  if (!h) return 'International city travel destination view'

  const cityRules: ReadonlyArray<{ re: RegExp; en: string }> = [
    { re: /코펜하겐|Copenhagen|København/i, en: 'Copenhagen Nyhavn waterfront' },
    { re: /파리|Paris/i, en: 'Paris Eiffel Tower city view' },
    { re: /로마|Roma?\b|Rome/i, en: 'Rome Colosseum historic city' },
    { re: /오사카|大阪|Osaka/i, en: 'Osaka Dotonbori city night' },
    { re: /방콕|Bangkok/i, en: 'Bangkok riverside city skyline' },
    { re: /다낭|Da\s*Nang/i, en: 'Da Nang Han River / Dragon Bridge waterfront / wide angle' },
    { re: /바르셀로나|Barcelona/i, en: 'Barcelona Sagrada Familia city view' },
    { re: /스톡홀름|Stockholm/i, en: 'Stockholm Gamla Stan waterfront' },
    { re: /오슬로|Oslo/i, en: 'Oslo fjord harbor city view' },
    { re: /헬싱키|Helsinki/i, en: 'Helsinki waterfront market square' },
    { re: /베르겐|Bergen/i, en: 'Bergen Norway harbor colorful houses' },
    { re: /상해|上海|Shanghai/i, en: 'Shanghai Bund skyline Huangpu river' },
    { re: /도쿄|東京|Tokyo/i, en: 'Tokyo Shibuya crossing night city' },
    { re: /런던|London/i, en: 'London Thames skyline Westminster' },
    { re: /암스테르담|Amsterdam/i, en: 'Amsterdam canal houses bridges' },
    { re: /프라하|Prague|Praha/i, en: 'Prague old town square historic towers' },
    { re: /비엔나|Vienna|Wien/i, en: 'Vienna historic palace district city view' },
    { re: /마드리드|Madrid/i, en: 'Madrid Gran Via city sunset' },
    { re: /리스본|Lisbon/i, en: 'Lisbon Alfama hillside tram city view' },
    { re: /뮌헨|Munich/i, en: 'Munich Marienplatz historic square' },
    { re: /베를린|Berlin/i, en: 'Berlin Brandenburg Gate city view' },
    { re: /취리히|Zurich/i, en: 'Zurich lake Alps city waterfront' },
    { re: /제네바|Geneva/i, en: 'Geneva lake Jet dEau waterfront' },
    { re: /부다페스트|Budapest/i, en: 'Budapest Danube Parliament night' },
    { re: /두브로브니크|Dubrovnik/i, en: 'Dubrovnik old town walls Adriatic sea' },
    { re: /레이캬비크|Reykjavik/i, en: 'Reykjavik colorful harbor houses' },
    { re: /뉴욕|Manhattan|New\s*York/i, en: 'New York Manhattan skyline Hudson' },
    { re: /호놀룰루|Honolulu|하와이|Hawaii/i, en: 'Honolulu Waikiki beach palm sunset' },
    { re: /시드니|Sydney/i, en: 'Sydney Opera House harbour bridge view' },
    { re: /멜번|Melbourne/i, en: 'Melbourne laneway cafes city day' },
    { re: /아테네|Athens/i, en: 'Athens Acropolis historic skyline' },
    { re: /이스탄불|Istanbul/i, en: 'Istanbul Bosporus mosque skyline sunset' },
    { re: /두바이|Dubai/i, en: 'Dubai Marina skyline skyscrapers night' },
    { re: /싱가포르|Singapore/i, en: 'Singapore Marina Bay night skyline' },
    { re: /쿠알라룸푸르|Kuala Lumpur/i, en: 'Kuala Lumpur Petronas Twin Towers' },
    { re: /세부|Cebu/i, en: 'Cebu tropical turquoise beach' },
    { re: /치앙마이|Chiang Mai/i, en: 'Chiang Mai old city temple street' },
    { re: /하노이|Hanoi/i, en: 'Hanoi Old Quarter colonial street day' },
    { re: /호치민|Ho Chi Minh|사이공/i, en: 'Ho Chi Minh city skyline Saigon river' },
    { re: /교토|京都|Kyoto/i, en: 'Kyoto bamboo forest temple path' },
    { re: /후쿠오카|福岡|Fukuoka/i, en: 'Fukuoka city ramen street night' },
    { re: /삿포로|札幌|Sapporo/i, en: 'Sapporo snow festival winter city' },
    { re: /나고야|名古屋/i, en: 'Nagoya castle cherry park view' },
    { re: /요코하마|横浜/i, en: 'Yokohama bay Minato Mirai night' },
    { re: /괌|Guam/i, en: 'Guam Tumon beach lagoon' },
    { re: /발리|Bali/i, en: 'Bali rice terraces jungle sunrise' },
    { re: /연길|延吉|Yanji/i, en: 'Yanji Korean quarter winter street' },
    { re: /북경|베이징|北京/i, en: 'Beijing Forbidden City view' },
    { re: /광저우|广州/i, en: 'Guangzhou skyline night' },
  ]
  for (const { re, en } of cityRules) {
    if (re.test(h)) return en
  }
  return kyowontourAirtelFreeTravelRegionalFallbackLocal(h)
}

/** 붙여넣기/LLM 후처리 공통: 본문·제목에서 영문 검색어 유도 */
export function deriveKyowontourImageKeyword(ctx: KyowontourImageKeywordContext): string {
  const h = hay(ctx)
  const descTriple = firstMatchingEn(KYOWONTOUR_DESC_TRIPLE, h)
  if (descTriple) return descTriple

  const spot = firstMatchingScheduleSpotEn( h)
  if (spot) return spot

  const arrival = arrivalCityFromHay(h)
  if (arrival) return arrival

  const iata = iataHintsFromHay(h)
  if (iata) return iata

  const cityHit = firstMatchingScheduleCityEn( h)
  if (cityHit && !isBlockedScheduleImageKeyword(cityHit)) return cityHit

  if (ctx.airtelFreeTravelImageKw === 'force-city') {
    return kyowontourAirtelFreeTravelRegionalFallbackLocal(h)
  }
  return ''
}

function finishKyowontourImageKeyword(s: string): string {
  const t = clampWords(normalizeSlashSpacing(s), IMAGE_KEYWORD_MAX_WORDS).slice(0, 180)
  if (isBlockedScheduleImageKeyword(t)) return ''
  return finalizeScheduleImageKeyword(t) || ''
}

function exitKyowontourLandmark(chosen: string, ctx: KyowontourImageKeywordContext): string {
  let out = finishKyowontourImageKeyword(chosen)
  if (isBareCityOrCountryKeyword(out)) {
    out = finishKyowontourImageKeyword(deriveKyowontourImageKeyword(ctx))
  }
  return out
}

export function polishKyowontourImageKeyword(raw: string, ctx: KyowontourImageKeywordContext): string {
  const cleaned = stripDatesAndNoise(String(raw ?? '').trim())
  if (ctx.airtelFreeTravelImageKw === 'force-city') {
    const kw = kyowontourResolveAirtelFreeTravelImageKeywordLocal(ctx)
    if (kw.trim()) return exitKyowontourLandmark(kw, ctx)
  }
  if (cleaned && isAcceptableEnglishKeyword(cleaned)) {
    let chosen = cleaned
    if (
      isKyowontourRejectedImageKeywordCandidate(cleaned) ||
      isKyowontourPexelsTooGeneric(cleaned)
    ) {
      const d = deriveKyowontourImageKeyword(ctx)
      if (d.trim()) chosen = d
      else chosen = ''
    }
    if (!chosen.trim()) {
      const fromRoute = firstLandmarkFromKyowontourRouteText(ctx.routeText)
      if (fromRoute) return exitKyowontourLandmark(fromRoute, ctx)
      return ''
    }
    return exitKyowontourLandmark(chosen, ctx)
  }
  if (cleaned && !hasHangul(cleaned) && !isKyowontourPlaceholderImageKeyword(cleaned) && !hasBadSubstrings(cleaned)) {
    const t2 = clampWords(cleaned.replace(/[,，]+/g, ' '), IMAGE_KEYWORD_MAX_WORDS)
    if (t2.length >= 4 && /[a-z]{3,}/i.test(t2)) {
      if (isKyowontourPexelsTooGeneric(t2)) {
        const d = deriveKyowontourImageKeyword(ctx)
        if (d.trim()) return exitKyowontourLandmark(d, ctx)
      }
      return exitKyowontourLandmark(t2, ctx)
    }
  }
  return exitKyowontourLandmark(deriveKyowontourImageKeyword(ctx), ctx)
}

export type KyowontourScheduleImageKeywordOpts = {
  productDestination?: string | null
  productTitle?: string
}

type KyowontourScheduleDayKind = 'tourism' | 'movement' | 'return_home'

function normKyowontourKwKey(s: string): string {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function classifyKyowontourScheduleDayKind(
  day: number,
  maxDay: number,
  row: { title?: string; description?: string; routeText?: string | null },
): KyowontourScheduleDayKind {
  const ctx: KyowontourImageKeywordContext = {
    day,
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    routeText: row.routeText ?? null,
  }
  const h = hay(ctx)
  const foreignSegs = kyowontourRouteTextSegments(row.routeText).filter((s) => !isKyowontourDomesticHubToken(s))
  const spotSegCount = foreignSegs.filter((s) => firstMatchingScheduleSpotEn( s)).length

  if (day === maxDay && /(?:도착|해산|귀국|출국)/u.test(h)) {
    const allDomestic =
      kyowontourRouteTextSegments(row.routeText).length > 0 &&
      kyowontourRouteTextSegments(row.routeText).every((s) => isKyowontourDomesticHubToken(s))
    if (allDomestic || foreignSegs.length === 0) return 'return_home'
  }
  if (
    day === maxDay &&
    foreignSegs.length <= 1 &&
    spotSegCount === 0 &&
    /(?:인천|김포|ICN|GMP|귀국|입국)/u.test(h)
  ) {
    return 'return_home'
  }
  if (day === 1 && /(?:출발|도착|공항|입국)/u.test(h) && spotSegCount <= 1) return 'movement'
  if (day === 1 && foreignSegs.length <= 1) return 'movement'
  if (
    day !== maxDay &&
    /(?:출발|귀국|귀국길|공항(?:으로)?\s*이동|출국\s*준비)/u.test(h) &&
    spotSegCount === 0 &&
    foreignSegs.length <= 2
  ) {
    return 'movement'
  }
  return 'tourism'
}

function lastForeignLandmarkFromPriorKyowontourRows<
  T extends { day: number; title?: string; description?: string; routeText?: string | null; imageKeyword?: string | null },
>(
  priorRows: ReadonlyArray<T>,
  current: T,
  maxDay: number,
): string | null {
  const currentDay = Number(current.day) || 0
  const sorted = [...priorRows].sort((a, b) => Number(b.day) - Number(a.day))
  for (const row of sorted) {
    const day = Number(row.day) || 0
    if (day <= 0 || day >= currentDay) continue
    const kind = classifyKyowontourScheduleDayKind(day, maxDay, row)
    if (kind === 'return_home') continue
    const pk = String(row.imageKeyword ?? '').trim()
    if (pk && !isKyowontourRejectedImageKeywordCandidate(pk)) return pk
    const fromRoute = firstLandmarkFromKyowontourRouteText(row.routeText)
    if (fromRoute && !isBlockedScheduleImageKeyword(fromRoute)) return fromRoute
    const fromRouteLast = landmarkFromKyowontourRouteText(row.routeText)
    if (fromRouteLast && !isBlockedScheduleImageKeyword(fromRouteLast)) return fromRouteLast
  }
  return null
}

function resolveKyowontourPrimaryKeyword(
  row: {
    day: number
    title?: string
    description?: string
    routeText?: string | null
    imageKeyword?: string | null
  },
  dayKind: KyowontourScheduleDayKind,
  ctx: KyowontourImageKeywordContext,
  priorRows: ReadonlyArray<{ day: number; routeText?: string | null; imageKeyword?: string | null }>,
  maxDay: number,
): string {
  if (dayKind === 'return_home') {
    return ''
  }

  if (dayKind === 'movement') {
    const fromRoute = landmarkFromKyowontourRouteText(row.routeText) ?? firstLandmarkFromKyowontourRouteText(row.routeText)
    if (fromRoute) return exitKyowontourLandmark(fromRoute, ctx)
    const fromHay = kyowontourLandmarkFromHaystack(ctx)
    if (fromHay) return exitKyowontourLandmark(fromHay, ctx)
    const inferred = inferEnglishPlaceKeywordFromDayContent(row, ctx.productDestination)
    if (inferred && !isKyowontourRejectedImageKeywordCandidate(inferred)) {
      return exitKyowontourLandmark(inferred, ctx)
    }
    const derived = deriveKyowontourImageKeyword(ctx)
    if (derived.trim()) return exitKyowontourLandmark(derived, ctx)
    return ''
  }

  const fromRouteFirst = firstLandmarkFromKyowontourRouteText(row.routeText)
  if (fromRouteFirst) {
    const polished = polishKyowontourImageKeyword(String(row.imageKeyword ?? '').trim(), ctx)
    if (
      !polished ||
      isBlockedScheduleImageKeyword(polished) ||
      isKyowontourPexelsTooGeneric(polished)
    ) {
      return exitKyowontourLandmark(fromRouteFirst, ctx)
    }
  }

  const fromLlm = polishKyowontourImageKeyword(String(row.imageKeyword ?? '').trim(), ctx)
  if (fromLlm) return fromLlm

  if (fromRouteFirst) return exitKyowontourLandmark(fromRouteFirst, ctx)

  const inferred = inferEnglishPlaceKeywordFromDayContent(row, ctx.productDestination)
  if (inferred && !isKyowontourRejectedImageKeywordCandidate(inferred)) {
    return exitKyowontourLandmark(inferred, ctx)
  }
  return ''
}

function resolveKyowontourSecondaryKeyword(
  row: {
    title?: string
    description?: string
    routeText?: string | null
    imageKeyword2?: string | null
  },
  primary: string,
  dayKind: KyowontourScheduleDayKind,
  ctx: KyowontourImageKeywordContext,
): string | null {
  if (!primary) return null
  if (dayKind === 'movement' || dayKind === 'return_home') return null

  const pk = normKyowontourKwKey(primary)
  const raw2 = String(row.imageKeyword2 ?? '').trim()
  if (raw2) {
    const fromLlm = polishKyowontourImageKeyword(raw2, ctx)
    if (fromLlm && normKyowontourKwKey(fromLlm) !== pk && !isBlockedScheduleImageKeyword(fromLlm)) return fromLlm
  }

  const routeSegLandmarks: string[] = []
  for (const seg of kyowontourUsableRouteSegments(row.routeText)) {
    const spot = firstMatchingScheduleSpotEn( seg)
    if (spot) routeSegLandmarks.push(spot)
    const city = firstMatchingScheduleCityEn( seg)
    if (city && !isBlockedScheduleImageKeyword(city)) routeSegLandmarks.push(city)
  }
  const fromRoute = pickDistinctSecondScheduleImageKeyword(primary, routeSegLandmarks)
  if (fromRoute && !isBlockedScheduleImageKeyword(fromRoute)) return fromRoute

  const haystack = [row.routeText, row.title, row.description].filter(Boolean).join('\n')
  const secondEn = pickDistinctSecondScheduleImageKeyword(primary, findAllMappedKoreanPoisInText(haystack))
  if (secondEn && !isBlockedScheduleImageKeyword(secondEn)) {
    return exitKyowontourLandmark(secondEn, ctx)
  }
  return null
}

function collectKyowontourRouteLandmarkCandidates(routeText: string | null | undefined): string[] {
  const out: string[] = []
  const push = (raw: string | null) => {
    const t = String(raw ?? '').trim()
    if (!t || isBlockedScheduleImageKeyword(t)) return
    if (out.some((x) => normKyowontourKwKey(x) === normKyowontourKwKey(t))) return
    out.push(t)
  }
  for (const seg of kyowontourUsableRouteSegments(routeText)) {
    push(firstMatchingScheduleSpotEn( seg))
    push(firstMatchingScheduleCityEn( seg))
  }
  push(firstLandmarkFromKyowontourRouteText(routeText))
  push(landmarkFromKyowontourRouteText(routeText))
  return out
}

export function applyKyowontourScheduleImageKeywordsToRows<
  T extends {
    day: number
    title?: string
    description?: string
    routeText?: string | null
    imageKeyword?: string | null
    imageKeyword2?: string | null
  },
>(rows: T[], opts?: KyowontourScheduleImageKeywordOpts): T[] {
  const maxDay = rows.length ? Math.max(...rows.map((r) => Number(r.day) || 0), 1) : 1
  const used = new Set<string>()
  const mapped = rows.map((row, idx) => {
    const ctx: KyowontourImageKeywordContext = {
      day: row.day,
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      routeText: row.routeText ?? null,
      productTitle: opts?.productTitle,
      productDestination: opts?.productDestination ?? null,
      productPrimaryDestination: opts?.productDestination ?? null,
    }
    const dayKind = classifyKyowontourScheduleDayKind(row.day, maxDay, row)
    let kw = resolveKyowontourPrimaryKeyword(row, dayKind, ctx, rows.slice(0, idx), maxDay)
    const kwKey = normKyowontourKwKey(kw)
    if (kw && used.has(kwKey) && dayKind === 'tourism') {
      const routeCands = collectKyowontourRouteLandmarkCandidates(row.routeText)
      const alt =
        pickDistinctSecondScheduleImageKeyword(kw, routeCands) ??
        pickDistinctSecondScheduleImageKeyword(
          kw,
          findAllMappedKoreanPoisInText([row.routeText, row.title, row.description].filter(Boolean).join('\n')),
        )
      const altUnused =
        alt && !used.has(normKyowontourKwKey(alt))
          ? alt
          : routeCands.find((c) => !used.has(normKyowontourKwKey(c)))
      if (altUnused) kw = exitKyowontourLandmark(altUnused, ctx)
      else kw = ''
    }
    if (kw) used.add(normKyowontourKwKey(kw))
    const kw2 = resolveKyowontourSecondaryKeyword(row, kw, dayKind, ctx)
    return { ...row, imageKeyword: kw, imageKeyword2: kw2 }
  })

  return mapped.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    const primary = String(row.imageKeyword ?? '').trim()
    if (!shouldReconcileScheduleImageKeyword2(primary, row.imageKeyword2)) return row
    const ctx: KyowontourImageKeywordContext = {
      day: row.day,
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      routeText: row.routeText ?? null,
      productTitle: opts?.productTitle,
      productDestination: opts?.productDestination ?? null,
      productPrimaryDestination: opts?.productDestination ?? null,
    }
    const dayKind = classifyKyowontourScheduleDayKind(row.day, maxDay, row)
    const kw2 = resolveKyowontourSecondaryKeyword(row, primary, dayKind, ctx)
    return { ...row, imageKeyword2: kw2 }
  })
}
