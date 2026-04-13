/**
 * 모두투어 전용: `Product.schedule[].imageKeyword`만 Pexels/이미지 검색용 영문 noun phrase로 정리.
 * title/description/일정 분리 로직은 건드리지 않는다.
 */

export type ModetourImageKeywordContext = {
  day: number
  title: string
  description: string
  /** 일차 원문 블록(붙여넣기 파이프라인) */
  blob?: string
  /** 에어텔(항공+호텔) + 일정 빈약 시 도시 기반 키워드(모두투어 전용) */
  airtelFreeTravelImageKw?: 'off' | 'force-city'
  productTitle?: string
  productPrimaryDestination?: string | null
  productDestination?: string | null
}

const HANGUL = /\p{Script=Hangul}/u

/** LLM/파서 placeholder·불량 패턴 */
export function isModetourPlaceholderImageKeyword(s: string): boolean {
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

/** 최소 한글→영문 관광지 (모두투어 일정 본문에서 자주 쓰이는 표기만) */
const SPOT_RULES: ReadonlyArray<{ re: RegExp; en: string }> = [
  { re: /외탄|外灘|外滩/u, en: 'Shanghai Bund skyline' },
  { re: /주가각|朱家角/u, en: 'Zhujiajiao water town canal bridge' },
  { re: /우캉\s*루|武康路/u, en: 'Wukang Road Shanghai' },
  { re: /남경\s*로|南京路/u, en: 'Nanjing Road Shanghai' },
  { re: /에펠\s*탑|에펠탑|Eiffel/i, en: 'Eiffel Tower Paris' },
  { re: /개선문/u, en: 'Arc de Triomphe Paris' },
  { re: /몽생미셸|Mont\s*Saint\s*Michel/i, en: 'Mont Saint Michel abbey' },
  { re: /시부야|渋谷/u, en: 'Shibuya crossing Tokyo night' },
  { re: /하라주쿠|原宿/u, en: 'Harajuku Takeshita street Tokyo' },
  { re: /금각사|金閣寺/u, en: 'Kinkakuji golden pavilion Kyoto' },
  { re: /은각사|銀閣寺/u, en: 'Ginkakuji temple Kyoto' },
  { re: /후시미\s*이나리|伏見稲荷/u, en: 'Fushimi Inari torii gates Kyoto' },
  { re: /도톤보리|道頓堀/u, en: 'Dotonbori Osaka night' },
  { re: /(?:유|우)니버설|USJ/u, en: 'Universal Studios Japan Osaka' },
  { re: /도쿄\s*디즈니|디즈니(?:랜드|씨)/u, en: 'Tokyo Disneyland castle' },
  { re: /타이페이\s*101|台北\s*101|타이편\s*101/u, en: 'Taipei 101 tower night' },
  { re: /지우펀|九份/u, en: 'Jiufen old street Taiwan night' },
  { re: /백두산/u, en: 'Changbai Mountain scenic view' },
  { re: /이도백하/u, en: 'Erdaobaihe river town Changbai' },
  { re: /금강\s*대?\s*협곡/u, en: 'Mount Geumgang gorge scenic' },
]

const CITY_RULES: ReadonlyArray<{ re: RegExp; en: string }> = [
  { re: /상해|사해|上海/u, en: 'Shanghai skyline night' },
  { re: /북경|베이징|北京/u, en: 'Beijing Forbidden City view' },
  { re: /광저우|광주|广州/u, en: 'Guangzhou skyline night' },
  { re: /심천|深圳/u, en: 'Shenzhen skyline night' },
  { re: /도쿄|東京/u, en: 'Tokyo street night' },
  { re: /오사카|大阪/u, en: 'Osaka Dotonbori night' },
  { re: /교토|京都/u, en: 'Kyoto temple street' },
  { re: /후쿠오카|福岡/u, en: 'Fukuoka city night' },
  { re: /삿포로|札幌/u, en: 'Sapporo snow city street' },
  { re: /나고야|名古屋/u, en: 'Nagoya castle view' },
  { re: /요코하마|横浜/u, en: 'Yokohama bay night' },
  { re: /파리/u, en: 'Paris city skyline' },
  { re: /로마/u, en: 'Rome Colosseum view' },
  { re: /바르셀로나/u, en: 'Barcelona Sagrada Familia exterior' },
  { re: /런던/u, en: 'London Thames skyline' },
  { re: /뉴욕/u, en: 'New York Manhattan skyline' },
  { re: /연길/u, en: 'Yanji Korean quarter winter street' },
  { re: /제주/u, en: 'Jeju coast view' },
  { re: /서울|인천/u, en: 'Seoul city skyline night' },
  { re: /부산/u, en: 'Busan Gamcheon village' },
  { re: /방콕/u, en: 'Bangkok Wat Arun temple' },
  { re: /치앙마이/u, en: 'Chiang Mai old city temple' },
  { re: /파타야/u, en: 'Pattaya beach sunset' },
  { re: /다낭/u, en: 'Da Nang Marble Mountains view' },
  { re: /하노이/u, en: 'Hanoi Old Quarter street' },
  { re: /호치민/u, en: 'Ho Chi Minh city skyline' },
  { re: /세부/u, en: 'Cebu tropical beach' },
  { re: /보라카이/u, en: 'Boracay white beach' },
  { re: /발리/u, en: 'Bali rice terrace view' },
  { re: /시드니|悉尼/u, en: 'Sydney Opera House harbour' },
  { re: /멜버른|멜번/u, en: 'Melbourne laneway street' },
  { re: /홍콩|香港/u, en: 'Hong Kong Victoria Harbour night' },
  { re: /마카오|澳門/u, en: 'Macau Senado square' },
  { re: /타이페이|台北/u, en: 'Taipei night market street' },
  { re: /하와이|호놀룰루|Honolulu/i, en: 'Honolulu Waikiki beach' },
  { re: /괌|Guam/i, en: 'Guam Tumon beach' },
  { re: /사이판|Saipan/i, en: 'Saipan Managaha lagoon' },
]

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

function hay(ctx: ModetourImageKeywordContext): string {
  return `${ctx.title}\n${ctx.description}\n${ctx.blob ?? ''}`.replace(/\s+/g, ' ')
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

/** 이미 영문 이미지 검색어로 쓸 만하면 true (한글 금지) */
function isAcceptableEnglishKeyword(s: string): boolean {
  const t = stripDatesAndNoise(s)
  if (t.length < 4 || t.length > 120) return false
  if (hasHangul(t)) return false
  if (isModetourPlaceholderImageKeyword(t)) return false
  if (hasBadSubstrings(t)) return false
  if (!/[a-z]{4,}/i.test(t)) return false
  if (countWords(t) > 10) return false
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

const MODETOUR_AIRTEL_SCHEDULE_STOPWORDS = new Set([
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

function modetourAirtelScheduleRowHasPlaceSignal(row: { title: string; description: string }): boolean {
  const t = `${row.title ?? ''}\n${row.description ?? ''}`
  const compact = t.replace(/\s/g, '')
  if (compact.length < 10) return false
  const hangulWords = t.match(/[가-힣]{3,}/g) ?? []
  for (const w of hangulWords) {
    if (w.length >= 3 && !MODETOUR_AIRTEL_SCHEDULE_STOPWORDS.has(w) && !/^제?\d+일차?$/.test(w)) return true
  }
  if (/[A-Za-z]{6,}/.test(t) && !/^day\s*\d+/i.test(t.trim())) return true
  return false
}

/** 에어텔 일정이 관광지 서술 없이 빈약한지(모두투어 전용) */
export function isModetourScheduleWeakForAirtelImageKw(
  rows: ReadonlyArray<{ title: string; description: string }>
): boolean {
  if (!rows.length) return true
  const usable = rows.filter((r) => (String(r.title) + String(r.description)).trim().length > 0)
  if (!usable.length) return true
  return usable.every((r) => !modetourAirtelScheduleRowHasPlaceSignal(r))
}

function modetourAirtelFreeTravelHaystackLocal(ctx: ModetourImageKeywordContext): string {
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

function modetourAirtelFreeTravelRegionalFallbackLocal(h: string): string {
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

/** 모두투어 전용: 에어텔+빈약 일정용 도시/권역 키워드(타 공급사 미사용) */
function modetourResolveAirtelFreeTravelImageKeywordLocal(ctx: ModetourImageKeywordContext): string {
  const h = modetourAirtelFreeTravelHaystackLocal(ctx)
  if (!h) return 'International city travel destination view'

  const cityRules: ReadonlyArray<{ re: RegExp; en: string }> = [
    { re: /코펜하겐|Copenhagen|København/i, en: 'Copenhagen Nyhavn waterfront' },
    { re: /파리|Paris/i, en: 'Paris Eiffel Tower city view' },
    { re: /로마|Roma?\b|Rome/i, en: 'Rome Colosseum historic city' },
    { re: /오사카|大阪|Osaka/i, en: 'Osaka Dotonbori city night' },
    { re: /방콕|Bangkok/i, en: 'Bangkok riverside city skyline' },
    { re: /다낭|Da\s*Nang/i, en: 'Da Nang beach city skyline' },
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
  return modetourAirtelFreeTravelRegionalFallbackLocal(h)
}

/** 붙여넣기/LLM 후처리 공통: 본문·제목에서 영문 검색어 유도 */
export function deriveModetourImageKeyword(ctx: ModetourImageKeywordContext): string {
  const h = hay(ctx)
  const spot = firstMatchingEn(SPOT_RULES, h)
  if (spot) return spot

  const arrival = arrivalCityFromHay(h)
  if (arrival) return arrival

  const iata = iataHintsFromHay(h)
  if (iata) return iata

  const cityHit = firstMatchingEn(CITY_RULES, h)
  if (cityHit) return cityHit

  if (/(?:공항|출발|도착|항공|귀국|입국|출국)/u.test(h)) {
    return 'International flight airport window'
  }

  return modetourAirtelFreeTravelRegionalFallbackLocal(h)
}

export function polishModetourImageKeyword(raw: string, ctx: ModetourImageKeywordContext): string {
  const cleaned = stripDatesAndNoise(String(raw ?? '').trim())
  if (ctx.airtelFreeTravelImageKw === 'force-city') {
    const kw = modetourResolveAirtelFreeTravelImageKeywordLocal(ctx)
    if (kw.trim()) return clampWords(kw, 8)
  }
  if (cleaned && isAcceptableEnglishKeyword(cleaned)) return clampWords(cleaned, 8)
  if (cleaned && !hasHangul(cleaned) && !isModetourPlaceholderImageKeyword(cleaned) && !hasBadSubstrings(cleaned)) {
    const t2 = clampWords(cleaned.replace(/[,，]+/g, ' '), 8)
    if (t2.length >= 4 && /[a-z]{3,}/i.test(t2)) return t2
  }
  return clampWords(deriveModetourImageKeyword(ctx), 8)
}
