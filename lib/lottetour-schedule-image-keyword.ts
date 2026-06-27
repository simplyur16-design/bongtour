/**
 * 롯데관광(lottetour): 일차 imageKeyword / imageKeyword2 — Pexels 검색용 영문.
 * REGRESSION-FREEZE[lottetour-schedule-image-keyword-ko-route]: routeText a–g 순서 + 일차 슬롯 — manifest
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: dedupe 후 imageKeyword2 reconcile — prebuild tests/lottetour-schedule-image-keyword-turkey.test.ts
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: POI regex — schedule-poi-regex-ssot SSOT — manifest
 * title/description/일정 분리 로직은 건드리지 않는다.
 */

import { finalizeScheduleImageKeyword, isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'
import {
  inferEnglishPlaceKeywordFromDayContent,
  pickDistinctSecondScheduleImageKeyword,
  shouldReconcileScheduleImageKeyword2,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import { isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'
import {
  fillScheduleMiddleImageKeyword2Gap,
  isScheduleAirportLikeImageKeyword,
  isScheduleInFlightOvernightRow,
  pickUnusedScheduleImageKeywordFromAdjacentDays,
  resolveScheduleKeywordSlotKind,
  shouldFillScheduleMiddleKeyword2Gap,
  type ScheduleAdjacentDayAlloc,
} from '@/lib/schedule-image-keyword-adjacent-poi'
import {
  findAllScheduleSpotMatchesInText,
  firstMatchingScheduleCityEn,
  firstMatchingScheduleSpotEn,
} from '@/lib/schedule-poi-regex-ssot'

export type LottetourImageKeywordContext = {
  day: number
  title: string
  description: string
  /** 일차 원문 블록(붙여넣기 파이프라인) */
  blob?: string
  /** 이동 경로 — `인천 - 이스탄불 - …` (Pexels 키워드 SSOT 우선) */
  routeText?: string | null
  /** 에어텔(항공+호텔) + 일정 빈약 시 도시 기반 키워드(롯데관광 전용) */
  airtelFreeTravelImageKw?: 'off' | 'force-city'
  productTitle?: string
  productPrimaryDestination?: string | null
  productDestination?: string | null
}

const HANGUL = /\p{Script=Hangul}/u

/** LLM/파서 placeholder·불량 패턴 */
export function isLottetourPlaceholderImageKeyword(s: string): boolean {
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

const LOTTETOUR_DOMESTIC_HUB_RE =
  /^(?:인천|서울|한국|김포|부산|대구|청주|제주|인천국제공항|김포국제공항|인천공항|김포공항|ICN|GMP|PUS|CJU)$/iu

function isLottetourDomesticHubToken(seg: string): boolean {
  const t = seg.replace(/\s+/g, ' ').trim()
  if (!t) return true
  return LOTTETOUR_DOMESTIC_HUB_RE.test(t)
}

function stripLottetourRouteSegmentNoise(seg: string): string {
  return seg
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isLottetourRouteSegmentUsable(seg: string): boolean {
  const t = stripLottetourRouteSegmentNoise(seg)
  if (!t) return false
  if (t.length >= 2) return true
  return /[\uAC00-\uD7AF]/u.test(t)
}

function lottetourRouteTextSegments(routeText: string | null | undefined): string[] {
  return splitRouteTextPlaceSegments(routeText)
    .map(stripLottetourRouteSegmentNoise)
    .filter(isLottetourRouteSegmentUsable)
}

/** routeText 해외 구간 — 이동 순서상 마지막 랜드마크(또는 도시) 우선 */
function landmarkFromRouteText(routeText: string | null | undefined): string | null {
  const segs = lottetourRouteTextSegments(routeText).filter((s) => !isLottetourDomesticHubToken(s))
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

/** routeText 해외 구간 — 이동 순서상 첫 랜드마크(관광 일차 1순위) */
function firstLandmarkFromRouteText(routeText: string | null | undefined): string | null {
  const segs = lottetourRouteTextSegments(routeText).filter((s) => !isLottetourDomesticHubToken(s))
  for (const seg of segs) {
    const spot = firstMatchingScheduleSpotEn( seg)
    if (spot) return spot
    const city = firstMatchingScheduleCityEn( seg)
    if (city && !isBlockedScheduleImageKeyword(city)) return city
  }
  return null
}

const IATA_IMAGE: Readonly<Record<string, string>> = {
  ICN: 'Incheon International Airport departure terminal',
  IST: 'Istanbul airport city Bosporus approach',
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

function hay(ctx: LottetourImageKeywordContext): string {
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

/** 이미 영문 이미지 검색어로 쓸 만하면 true (한글 금지). `{장소} / {배경} / {시점}` 형태는 단어 상한을 넉넉히 허용. */
function isAcceptableEnglishKeyword(s: string): boolean {
  const t = stripDatesAndNoise(s)
  if (t.length < 4 || t.length > 120) return false
  if (hasHangul(t)) return false
  if (isLottetourPlaceholderImageKeyword(t)) return false
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

/** Pexels 검색용 권장 `{장소} / {대표 배경} / {대표 시점}` — description·blob 우선 */
const LOTTETOUR_DESC_TRIPLE: ReadonlyArray<{ re: RegExp; en: string }> = [
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
export function isLottetourPexelsTooGeneric(s: string): boolean {
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

const LOTTETOUR_AIRTEL_SCHEDULE_STOPWORDS = new Set([
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

function lottetourAirtelScheduleRowHasPlaceSignal(row: { title: string; description: string }): boolean {
  const t = `${row.title ?? ''}\n${row.description ?? ''}`
  const compact = t.replace(/\s/g, '')
  if (compact.length < 10) return false
  const hangulWords = t.match(/[가-힣]{3,}/g) ?? []
  for (const w of hangulWords) {
    if (w.length >= 3 && !LOTTETOUR_AIRTEL_SCHEDULE_STOPWORDS.has(w) && !/^제?\d+일차?$/.test(w)) return true
  }
  if (/[A-Za-z]{6,}/.test(t) && !/^day\s*\d+/i.test(t.trim())) return true
  return false
}

/** 에어텔 일정이 관광지 서술 없이 빈약한지(롯데관광 전용) */
export function isLottetourScheduleWeakForAirtelImageKw(
  rows: ReadonlyArray<{ title: string; description: string }>
): boolean {
  if (!rows.length) return true
  const usable = rows.filter((r) => (String(r.title) + String(r.description)).trim().length > 0)
  if (!usable.length) return true
  return usable.every((r) => !lottetourAirtelScheduleRowHasPlaceSignal(r))
}

const TURKEY_PRODUCT_SIGNAL_RE = /튀르키예|터키|Turkey|이스탄불|Istanbul|카파도키아|파묵칼레/i

const TURKEY_MISMATCH_KEYWORD_RE =
  /\b(?:Seoul|Colosseum|International(?:\s+City)?(?:\s+Travel)?(?:\s+Destination)?)\b/i

function lottetourProductHaystack(ctx: LottetourImageKeywordContext): string {
  return [ctx.productTitle, ctx.productDestination, ctx.productPrimaryDestination, ctx.title, ctx.routeText]
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .join('\n')
}

function isLottetourCrossRegionKeywordMismatch(keyword: string, ctx: LottetourImageKeywordContext): boolean {
  if (!TURKEY_PRODUCT_SIGNAL_RE.test(lottetourProductHaystack(ctx))) return false
  return TURKEY_MISMATCH_KEYWORD_RE.test(String(keyword ?? '').trim())
}

function lottetourAirtelFreeTravelHaystackLocal(ctx: LottetourImageKeywordContext): string {
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

function lottetourAirtelFreeTravelRegionalFallbackLocal(h: string): string {
  if (/(북유럽|노르웨이|스웨덴|핀란드|덴마크|스칸디나비아|Norway|Sweden|Finland|Denmark|Scandinavia)/i.test(h))
    return 'Scandinavia Nordic waterfront city harbor view'
  if (/(발틱|에스토니아|라트비아|리투아니아|타린|리가|빌뉴스)/i.test(h))
    return 'Baltic historic old town cobblestone street'
  if (/(유럽|프랑스|독일|이탈리아|스페인|포르투갈|오스트리아|스위스|그리스|크로아티아|슬로베니아)/i.test(h))
    return 'European historic city center architecture plaza'
  if (/(영국|아일랜드|스코틀랜드|에든버러)/i.test(h)) return 'British Isles historic city street architecture'
  if (/(중동|터키|튀르키예|Turkey|요르단|이집트|모로코|UAE|아랍)/i.test(h))
    return 'Istanbul Bosporus mosque skyline sunset'
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

/** 롯데관광 전용: 에어텔+빈약 일정용 도시/권역 키워드(타 공급사 미사용) */
function lottetourResolveAirtelFreeTravelImageKeywordLocal(ctx: LottetourImageKeywordContext): string {
  const h = lottetourAirtelFreeTravelHaystackLocal(ctx)
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
    { re: /북경|베이징|北京/i, en: 'Beijing' },
    { re: /광저우|广州/i, en: 'Guangzhou skyline night' },
  ]
  for (const { re, en } of cityRules) {
    if (re.test(h)) return en
  }
  return lottetourAirtelFreeTravelRegionalFallbackLocal(h)
}

/** 붙여넣기/LLM 후처리 공통: 본문·제목에서 영문 검색어 유도 */
export function deriveLottetourImageKeyword(ctx: LottetourImageKeywordContext): string {
  const fromRoute = landmarkFromRouteText(ctx.routeText)
  if (fromRoute) return fromRoute

  const h = hay(ctx)
  const descTriple = firstMatchingEn(LOTTETOUR_DESC_TRIPLE, h)
  if (descTriple) return descTriple

  const spot = firstMatchingScheduleSpotEn( h)
  if (spot) return spot

  const arrival = arrivalCityFromHay(h)
  if (arrival) return arrival

  const cityHit = firstMatchingScheduleCityEn( h)
  if (cityHit && !isBlockedScheduleImageKeyword(cityHit)) return cityHit

  if (ctx.airtelFreeTravelImageKw === 'force-city') {
    return lottetourAirtelFreeTravelRegionalFallbackLocal(h)
  }
  return ''
}

function finishLottetourImageKeyword(s: string): string {
  const t = clampWords(normalizeSlashSpacing(s), IMAGE_KEYWORD_MAX_WORDS).slice(0, 180)
  if (isBlockedScheduleImageKeyword(t)) return ''
  return finalizeScheduleImageKeyword(t) || ''
}

function exitLottetourLandmark(chosen: string, ctx: LottetourImageKeywordContext): string {
  let out = finishLottetourImageKeyword(chosen)
  if (isBareCityOrCountryKeyword(out)) {
    out = finishLottetourImageKeyword(deriveLottetourImageKeyword(ctx))
  }
  return out
}

export function polishLottetourImageKeyword(raw: string, ctx: LottetourImageKeywordContext): string {
  const cleaned = stripDatesAndNoise(String(raw ?? '').trim())
  if (ctx.airtelFreeTravelImageKw === 'force-city') {
    const kw = lottetourResolveAirtelFreeTravelImageKeywordLocal(ctx)
    if (kw.trim()) return exitLottetourLandmark(kw, ctx)
  }
  if (cleaned && isAcceptableEnglishKeyword(cleaned)) {
    let chosen = cleaned
    if (
      isBlockedScheduleImageKeyword(cleaned) ||
      isLottetourPexelsTooGeneric(cleaned) ||
      isLottetourCrossRegionKeywordMismatch(cleaned, ctx)
    ) {
      const d = deriveLottetourImageKeyword(ctx)
      if (d.trim()) chosen = d
      else chosen = ''
    }
    if (!chosen.trim()) {
      const fromRoute = firstLandmarkFromRouteText(ctx.routeText)
      if (fromRoute) return exitLottetourLandmark(fromRoute, ctx)
      const inferred = inferEnglishPlaceKeywordFromDayContent(
        { title: ctx.title, description: ctx.description, routeText: ctx.routeText },
        ctx.productDestination,
      )
      if (inferred) return exitLottetourLandmark(inferred, ctx)
      return ''
    }
    return exitLottetourLandmark(chosen, ctx)
  }
  if (cleaned && !hasHangul(cleaned) && !isLottetourPlaceholderImageKeyword(cleaned) && !hasBadSubstrings(cleaned)) {
    const t2 = clampWords(cleaned.replace(/[,，]+/g, ' '), IMAGE_KEYWORD_MAX_WORDS)
    if (t2.length >= 4 && /[a-z]{3,}/i.test(t2)) {
      if (isLottetourPexelsTooGeneric(t2) || isLottetourCrossRegionKeywordMismatch(t2, ctx)) {
        const d = deriveLottetourImageKeyword(ctx)
        if (d.trim()) return exitLottetourLandmark(d, ctx)
      }
      return exitLottetourLandmark(t2, ctx)
    }
  }
  return exitLottetourLandmark(deriveLottetourImageKeyword(ctx), ctx)
}

export type LottetourScheduleImageKeywordOpts = {
  productDestination?: string | null
  productTitle?: string
}

type LottetourScheduleDayKind = 'tourism' | 'movement' | 'return_home'

function normLottetourKwKey(s: string): string {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function lottetourKeywordKeysOverlap(a: string, b: string): boolean {
  const ka = normLottetourKwKey(a)
  const kb = normLottetourKwKey(b)
  if (!ka || !kb) return false
  if (ka === kb) return true
  if (ka.length >= 4 && kb.includes(ka)) return true
  if (kb.length >= 4 && ka.includes(kb)) return true
  return false
}

function pickLottetourAdjacentUnusedKeyword<
  T extends { day: number; title?: string; description?: string; routeText?: string | null },
>(
  anchorDay: number,
  maxDay: number,
  sorted: readonly T[],
  used: ReadonlySet<string>,
  byDay: ReadonlyMap<number, ScheduleAdjacentDayAlloc>,
  scan: 'forward' | 'backward' | 'both',
  excludePrimary?: string,
  allowTripWideReuse = false,
  ignoreAdjacentDaySlots = false,
): string {
  return pickUnusedScheduleImageKeywordFromAdjacentDays({
    anchorDay,
    maxDay,
    sorted,
    getDay: (r) => Number(r.day),
    used,
    normKey: normLottetourKwKey,
    collectLandmarkCandidates: (r) => collectLottetourLandmarkKeywordsFromRoute(r.routeText),
    byDayAlloc: byDay,
    scan,
    excludePrimary,
    allowTripWideReuse,
    ignoreAdjacentDaySlots,
    rejectKeyword: (kw) =>
      isBlockedScheduleImageKeyword(kw) ||
      isScheduleAirportLikeImageKeyword(kw) ||
      isLottetourPexelsTooGeneric(kw),
  })
}

function tryAcceptLottetourSecondaryLlmKeyword(
  raw: string | null | undefined,
  ctx: LottetourImageKeywordContext
): string | null {
  const cleaned = stripDatesAndNoise(String(raw ?? '').trim())
  if (!cleaned || !isAcceptableEnglishKeyword(cleaned)) return null
  if (isLottetourCrossRegionKeywordMismatch(cleaned, ctx)) return null
  const kw = finishLottetourImageKeyword(cleaned)
  return kw || null
}

/** routeText·세그먼트에서 관광지 고유명 영문 — 이동 순서 유지, 중복 제거(도시 스카이라인 제외) */
function collectLottetourLandmarkKeywordsFromRoute(routeText: string | null | undefined): string[] {
  const landmarks: string[] = []
  const pushSafe = (en: string) => {
    let kw = ''
    try {
      kw = finishLottetourImageKeyword(en) || en
    } catch {
      return
    }
    if (!kw) return
    if (landmarks.some((x) => normLottetourKwKey(x) === normLottetourKwKey(kw))) return
    landmarks.push(kw)
  }

  const rt = String(routeText ?? '').trim()
  if (!rt) return landmarks

  for (const { en } of findAllScheduleSpotMatchesInText(rt)) pushSafe(en)
  return landmarks
}

function classifyLottetourScheduleDayKind(
  day: number,
  maxDay: number,
  row: { title?: string; description?: string; routeText?: string | null }
): LottetourScheduleDayKind {
  const ctx: LottetourImageKeywordContext = {
    day,
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    routeText: row.routeText ?? null,
  }
  const h = hay(ctx)
  const foreignSegs = lottetourRouteTextSegments(row.routeText).filter((s) => !isLottetourDomesticHubToken(s))
  const spotSegCount = foreignSegs.filter((s) => firstMatchingScheduleSpotEn( s)).length

  if (day === maxDay && /(?:도착|해산|귀국|출국)/u.test(h)) {
    const allDomestic =
      lottetourRouteTextSegments(row.routeText).length > 0 &&
      lottetourRouteTextSegments(row.routeText).every((s) => isLottetourDomesticHubToken(s))
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
  return 'tourism'
}

function resolveLottetourPrimaryKeyword(
  row: {
    day: number
    title?: string
    description?: string
    routeText?: string | null
    imageKeyword?: string | null
  },
  dayKind: LottetourScheduleDayKind,
  ctx: LottetourImageKeywordContext,
  priorRows: ReadonlyArray<{ day: number; routeText?: string | null; imageKeyword?: string | null }>,
  maxDay: number,
): string {
  if (dayKind === 'movement' || dayKind === 'return_home') {
    const fromRoute = landmarkFromRouteText(row.routeText)
    if (fromRoute) return exitLottetourLandmark(fromRoute, ctx)
    if (dayKind === 'return_home') {
      const fromPrior = lastForeignLandmarkFromPriorLottetourRows(priorRows, row, maxDay)
      if (fromPrior) return exitLottetourLandmark(fromPrior, ctx)
    }
    return ''
  }

  const fromRoutePrimary =
    landmarkFromRouteText(row.routeText) ?? firstLandmarkFromRouteText(row.routeText)
  if (fromRoutePrimary) {
    const polished = polishLottetourImageKeyword(String(row.imageKeyword ?? '').trim(), ctx)
    if (polished && normLottetourKwKey(polished) === normLottetourKwKey(fromRoutePrimary)) {
      return polished
    }
    if (
      !polished ||
      isBlockedScheduleImageKeyword(polished) ||
      isLottetourPexelsTooGeneric(polished)
    ) {
      return exitLottetourLandmark(fromRoutePrimary, ctx)
    }
  }

  const fromLlm = polishLottetourImageKeyword(String(row.imageKeyword ?? '').trim(), ctx)
  if (fromLlm) return fromLlm

  if (fromRoutePrimary) return exitLottetourLandmark(fromRoutePrimary, ctx)

  const fromRoute = landmarkFromRouteText(row.routeText)
  if (fromRoute) return exitLottetourLandmark(fromRoute, ctx)

  const inferred = inferEnglishPlaceKeywordFromDayContent(row, ctx.productDestination)
  if (inferred) return exitLottetourLandmark(inferred, ctx)
  return ''
}

function lastForeignLandmarkFromPriorLottetourRows<
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
    const kind = classifyLottetourScheduleDayKind(day, maxDay, row)
    if (kind === 'return_home') continue
    const fromRoute = landmarkFromRouteText(row.routeText)
    if (fromRoute && !isBlockedScheduleImageKeyword(fromRoute)) return fromRoute
    const pk = String(row.imageKeyword ?? '').trim()
    if (pk && !isBlockedScheduleImageKeyword(pk) && !isLottetourPexelsTooGeneric(pk)) return pk
  }
  return null
}

function reconcileLottetourDistinctPrimaryAcrossDays<
  T extends { day: number; title?: string; description?: string; routeText?: string | null; imageKeyword?: string | null; imageKeyword2?: string | null },
>(rows: T[], maxDay: number, opts?: LottetourScheduleImageKeywordOpts): T[] {
  const used = new Set<string>()
  return rows.map((row, idx) => {
    const prior = rows.slice(0, idx)
    let primary = String(row.imageKeyword ?? '').trim()
    const dayKind = classifyLottetourScheduleDayKind(row.day, maxDay, row)
    const slotKind = resolveScheduleKeywordSlotKind(row.day, maxDay, rows.length)
    const ctx: LottetourImageKeywordContext = {
      day: row.day,
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      routeText: row.routeText ?? null,
      productTitle: opts?.productTitle,
      productDestination: opts?.productDestination ?? null,
      productPrimaryDestination: opts?.productDestination ?? null,
    }
    if (slotKind === 'return') {
      const prev = rows[idx - 1]
      if (prev) {
        const usedOnPrev = new Set(
          [prev.imageKeyword, prev.imageKeyword2]
            .map((x) => normLottetourKwKey(String(x ?? '')))
            .filter(Boolean),
        )
        for (const kw of collectLottetourLandmarkKeywordsFromRoute(prev.routeText)) {
          const nk = normLottetourKwKey(kw)
          if (!usedOnPrev.has(nk) && !used.has(nk)) {
            primary = exitLottetourLandmark(kw, ctx)
            break
          }
        }
      }
      if (!primary) {
        const fromRoute =
          landmarkFromRouteText(row.routeText) ?? firstLandmarkFromRouteText(row.routeText)
        if (fromRoute) primary = exitLottetourLandmark(fromRoute, ctx)
      }
    }
    const pk = normLottetourKwKey(primary)
    if (primary && used.has(pk) && slotKind !== 'return') {
      const altCandidates = collectLottetourLandmarkKeywordsFromRoute(row.routeText).filter(
        (kw) => !used.has(normLottetourKwKey(kw)),
      )
      if (altCandidates[0]) {
        primary = exitLottetourLandmark(altCandidates[0]!, ctx)
      } else if (dayKind === 'tourism') {
        primary = resolveLottetourPrimaryKeyword(row, dayKind, ctx, prior, maxDay)
        if (primary && used.has(normLottetourKwKey(primary))) primary = ''
      } else {
        primary = ''
      }
    }
    if (!primary) {
      for (const kw of collectLottetourLandmarkKeywordsFromRoute(row.routeText)) {
        const nk = normLottetourKwKey(kw)
        if (!used.has(nk)) {
          primary = exitLottetourLandmark(kw, ctx)
          break
        }
      }
    }
    if (primary) used.add(normLottetourKwKey(primary))

    let kw2 =
      dayKind === 'tourism' ? resolveLottetourSecondaryKeyword(row, primary, dayKind, ctx) : null
    if (kw2 && used.has(normLottetourKwKey(kw2))) {
      kw2 = null
      for (const kw of collectLottetourLandmarkKeywordsFromRoute(row.routeText)) {
        const nk = normLottetourKwKey(kw)
        if (nk !== normLottetourKwKey(primary) && !used.has(nk)) {
          kw2 = exitLottetourLandmark(kw, ctx)
          break
        }
      }
    }
    if (kw2 && used.has(normLottetourKwKey(kw2))) kw2 = null
    if (kw2) used.add(normLottetourKwKey(kw2))

    return { ...row, imageKeyword: primary, imageKeyword2: kw2 }
  })
}

function resolveLottetourSecondaryKeyword(
  row: {
    title?: string
    description?: string
    routeText?: string | null
    imageKeyword2?: string | null
  },
  primary: string,
  dayKind: LottetourScheduleDayKind,
  ctx: LottetourImageKeywordContext
): string | null {
  if (!primary) return null
  if (dayKind === 'movement' || dayKind === 'return_home') return null

  const pk = normLottetourKwKey(primary)
  const fromLlm = tryAcceptLottetourSecondaryLlmKeyword(row.imageKeyword2, ctx)
  if (fromLlm && normLottetourKwKey(fromLlm) !== pk) return fromLlm

  for (const kw of collectLottetourLandmarkKeywordsFromRoute(row.routeText)) {
    if (normLottetourKwKey(kw) !== pk) return kw
  }

  const routeSegLandmarks: string[] = []
  for (const seg of lottetourRouteTextSegments(row.routeText)) {
    const spot = firstMatchingScheduleSpotEn( seg)
    if (spot) routeSegLandmarks.push(spot)
    const city = firstMatchingScheduleCityEn( seg)
    if (city && !isBlockedScheduleImageKeyword(city)) routeSegLandmarks.push(city)
  }
  const fromRouteOrdered = pickDistinctSecondScheduleImageKeyword(primary, routeSegLandmarks)
  if (fromRouteOrdered && !isBlockedScheduleImageKeyword(fromRouteOrdered)) return fromRouteOrdered

  return null
}

export function applyLottetourScheduleImageKeywordsToRows<
  T extends {
    day: number
    title?: string
    description?: string
    routeText?: string | null
    imageKeyword?: string | null
    imageKeyword2?: string | null
  },
>(rows: T[], opts?: LottetourScheduleImageKeywordOpts): T[] {
  const maxDay = rows.length ? Math.max(...rows.map((r) => Number(r.day) || 0), 1) : 1
  const mapped = rows.map((row, idx) => {
    const ctx: LottetourImageKeywordContext = {
      day: row.day,
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      routeText: row.routeText ?? null,
      productTitle: opts?.productTitle,
      productDestination: opts?.productDestination ?? null,
      productPrimaryDestination: opts?.productDestination ?? null,
    }
    const dayKind = classifyLottetourScheduleDayKind(row.day, maxDay, row)
    const kw = resolveLottetourPrimaryKeyword(row, dayKind, ctx, rows.slice(0, idx), maxDay)
    const kw2 = resolveLottetourSecondaryKeyword(row, kw, dayKind, ctx)
    return {
      ...row,
      imageKeyword: kw,
      imageKeyword2: kw2,
    }
  })

  const deduped = reconcileLottetourDistinctPrimaryAcrossDays(mapped, maxDay, opts)

  const sorted = deduped.filter((r) => Number(r.day) > 0)
  const used = new Set<string>()
  for (const row of deduped) {
    const kw = String(row.imageKeyword ?? '').trim()
    if (kw) used.add(normLottetourKwKey(kw))
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    if (kw2) used.add(normLottetourKwKey(kw2))
  }

  return deduped.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row

    const slotKind = resolveScheduleKeywordSlotKind(day, maxDay, sorted.length)
    let primary = String(row.imageKeyword ?? '').trim()
    let secondary = String(row.imageKeyword2 ?? '').trim()

    if (
      slotKind === 'middle' &&
      primary &&
      !secondary &&
      shouldFillScheduleMiddleKeyword2Gap(
        row,
        collectLottetourLandmarkKeywordsFromRoute(row.routeText),
        primary,
        lottetourKeywordKeysOverlap,
        {
          movementOnly:
            isScheduleInFlightOvernightRow(row) ||
            classifyLottetourScheduleDayKind(day, maxDay, row) === 'movement',
        },
      )
    ) {
      const routeOrdered = collectLottetourLandmarkKeywordsFromRoute(row.routeText)
      const byDay = new Map<number, ScheduleAdjacentDayAlloc>()
      for (const r of deduped) {
        const d = Number(r.day)
        if (d <= 0) continue
        byDay.set(d, {
          primary: String(r.imageKeyword ?? '').trim(),
          secondary: r.imageKeyword2 ?? null,
        })
      }
      secondary = fillScheduleMiddleImageKeyword2Gap({
        primary,
        routeOrdered,
        extraOrdered: routeOrdered,
        overlaps: lottetourKeywordKeysOverlap,
        rejectKeyword: (kw) =>
          isBlockedScheduleImageKeyword(kw) ||
          isScheduleAirportLikeImageKeyword(kw) ||
          isLottetourPexelsTooGeneric(kw),
        pickAdjacent: (allowTripWideReuse, ignoreAdjacentDaySlots) =>
          pickLottetourAdjacentUnusedKeyword(
            day,
            maxDay,
            sorted,
            used,
            byDay,
            'both',
            primary,
            allowTripWideReuse,
            ignoreAdjacentDaySlots,
          ),
      })
      if (secondary) used.add(normLottetourKwKey(secondary))
    }

    if (secondary && lottetourKeywordKeysOverlap(secondary, primary)) {
      secondary = ''
    }

    if (slotKind === 'departure' || slotKind === 'return') {
      secondary = ''
    }

    if (!shouldReconcileScheduleImageKeyword2(primary, secondary || null)) {
      return {
        ...row,
        imageKeyword: primary,
        imageKeyword2: slotKind === 'middle' ? secondary || null : null,
      }
    }

    const ctx: LottetourImageKeywordContext = {
      day: row.day,
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      routeText: row.routeText ?? null,
      productTitle: opts?.productTitle,
      productDestination: opts?.productDestination ?? null,
      productPrimaryDestination: opts?.productDestination ?? null,
    }
    const dayKind = classifyLottetourScheduleDayKind(row.day, maxDay, row)
    const kw2 = resolveLottetourSecondaryKeyword(row, primary, dayKind, ctx)
    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: slotKind === 'middle' ? kw2 || secondary || null : null,
    }
  })
}
