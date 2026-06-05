/**
 * Pexels 검색 키워드 생성 — 관광지(명소) 우선, 규칙 기반 + 최소 보정.
 * 한국어 상품 메타를 Pexels에서 의미 있는 영어 검색어로 변환.
 */

import { normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'

/** 도시·지역명 → Pexels 검색용 영어 (소규모 매핑) */
const DESTINATION_MAP: Record<string, string> = {
  다낭: 'Da Nang',
  호이안: 'Hoi An',
  바나힐: 'Ba Na Hills',
  바나힐스: 'Ba Na Hills',
  방콕: 'Bangkok',
  파타야: 'Pattaya',
  치앙마이: 'Chiang Mai',
  푸켓: 'Phuket',
  싱가포르: 'Singapore',
  발리: 'Bali',
  세부: 'Cebu',
  보라카이: 'Boracay',
  마닐라: 'Manila',
  나트랑: 'Nha Trang',
  호치민: 'Ho Chi Minh',
  하노이: 'Hanoi',
  푸꾸옥: 'Phu Quoc',
  델리: 'Delhi',
  도쿄: 'Tokyo',
  교토: 'Kyoto',
  오사카: 'Osaka',
  후쿠오카: 'Fukuoka',
  나고야: 'Nagoya',
  다카야마: 'Takayama',
  마츠야마: 'Matsuyama',
  유후인: 'Yufuin',
  벳푸: 'Beppu',
  히로시마: 'Hiroshima',
  가고시마: 'Kagoshima',
  삿포로: 'Sapporo',
  니가타: 'Niigata',
  칸자와: 'Kanazawa',
  나라: 'Nara',
  고베: 'Kobe',
  요코하마: 'Yokohama',
  하코다테: 'Hakodate',
  오타루: 'Otaru',
  센다이: 'Sendai',
  아그라: 'Agra',
  자이푸르: 'Jaipur',
  뭄바이: 'Mumbai',
  바라나시: 'Varanasi',
  오키나와: 'Okinawa',
  제주: 'Jeju',
  제주도: 'Jeju',
  홍콩: 'Hong Kong',
  마카오: 'Macau',
  상하이: 'Shanghai',
  베이징: 'Beijing',
  하와이: 'Hawaii',
  괌: 'Guam',
  사이판: 'Saipan',
  시드니: 'Sydney',
  로마: 'Rome',
  파리: 'Paris',
  스페인: 'Spain',
  산티아고: 'Santiago de Compostela',
  순례길: 'Camino de Santiago',
  마드리드: 'Madrid',
  루고: 'Lugo',
  사리아: 'Sarria',
  포르토마린: 'Portomarin',
  팔레스데레이: 'Palas de Rei',
  레온: 'Leon',
  바르셀로나: 'Barcelona',
  세비야: 'Seville',
  그라나다: 'Granada',
  런던: 'London',
  암스테르담: 'Amsterdam',
  두바이: 'Dubai',
  이스탄불: 'Istanbul',
  이집트: 'Egypt',
  카이로: 'Cairo',
  룩소르: 'Luxor',
  아스완: 'Aswan',
  후르가다: 'Hurghada',
  기자: 'Giza',
  아부심벨: 'Abu Simbel',
  에드푸: 'Edfu',
  콤옴보: 'Kom Ombo',
  비엔나: 'Vienna',
  부다페스트: 'Budapest',
  프라하: 'Prague',
  브라티슬라바: 'Bratislava',
  잘츠부르크: 'Salzburg',
  크라쿠프: 'Krakow',
  류블랴나: 'Ljubljana',
  자그레브: 'Zagreb',
}

/** 대표 지역(primaryRegion) → 영어 */
const REGION_MAP: Record<string, string> = {
  동남아: 'Southeast Asia',
  동남아시아: 'Southeast Asia',
  유럽: 'Europe',
  일본: 'Japan',
  중국: 'China',
  괌사이판: 'Guam Saipan',
  하와이: 'Hawaii',
  오세아니아: 'Oceania',
  미주: 'Americas',
  중동: 'Middle East',
  아시아: 'Asia',
}

/**
 * 일정/POI에 자주 나오는 한글 명소·구간 → Pexels용 영어(2~4단어 우선).
 * 긴 키를 먼저 매칭하도록 호출부에서 길이 내림차순 순회.
 */
const POI_KO_TO_EN: Record<string, string> = {
  유니버설스튜디오싱가포르: 'Universal Studios Singapore',
  유니버설스튜디오재팬: 'Universal Studios Japan',
  유니버설스튜디오: 'Universal Studios Japan',
  유니버설: 'Universal Studios Japan',
  센토사: 'Sentosa',
  센토사섬: 'Sentosa',
  머를라이언: 'Merlion Park',
  머라이언: 'Merlion Park',
  가든스바이더베이: 'Gardens by the Bay',
  마리나베이샌즈: 'Marina Bay Sands',
  마리나베이: 'Marina Bay Sands',
  헨더슨웨이브: 'Henderson Waves Bridge',
  클라우드포레스트: 'Gardens by the Bay',
  오차드로드: 'Orchard Road',
  차이나타운: 'Chinatown Singapore',
  리버보트: 'Singapore River',
  리버보트크루즈: 'Singapore River',
  후르가다: 'Hurghada',
  홍해: 'Red Sea Egypt',
  그랜드이집션뮤지엄: 'Grand Egyptian Museum',
  '그랜드 이집션 뮤지엄': 'Grand Egyptian Museum',
  피라미드: 'Giza Pyramids',
  스핑크스: 'Great Sphinx of Giza',
  아부심벨: 'Abu Simbel',
  아스완하이댐: 'Aswan High Dam',
  미완성오벨리스크: 'Unfinished Obelisk',
  왕가의계곡: 'Valley of the Kings',
  카르낙신전: 'Karnak Temple',
  에드푸신전: 'Temple of Edfu',
  콤옴보신전: 'Kom Ombo Temple',
  칸엘칼릴리: 'Khan El-khalili',
  '칸 엘 칼릴리': 'Khan El-khalili',
  오사카성: 'Osaka Castle',
  나고야성: 'Nagoya Castle',
  타지마할: 'Taj Mahal',
  아그라성: 'Agra Fort',
  '아그라 성': 'Agra Fort',
  야리가다케: 'Mount Yari',
  신호다카온천: 'Shinhotaka Onsen',
  신호다카: 'Shinhotaka Onsen',
  히라유온천: 'Hirayu Onsen',
  카미코치: 'Kamikochi',
  도고온천: 'Dogo Onsen',
  마츠야마성: 'Matsuyama Castle',
  다자이후텐만구: 'Dazaifu Tenmangu',
  다자이후: 'Dazaifu Tenmangu',
  유후인온천: 'Yufuin Onsen',
  벳푸온천: 'Beppu Onsen',
  긴잔지: 'Kinkaku-ji',
  금각사: 'Kinkaku-ji',
  청수사: 'Kiyomizu-dera',
  기요미즈데라: 'Kiyomizu-dera',
  후시미이나리: 'Fushimi Inari',
  이타도신사: 'Itsukushima Shrine',
  미야지마: 'Itsukushima Shrine',
  도톤보리: 'Dotonbori',
  도톤: 'Dotonbori',
  시라카와고: 'Shirakawa-go',
  금손다리: 'Golden Bridge Da Nang',
  골든브릿지: 'Golden Bridge Da Nang',
  바나힐: 'Ba Na Hills',
  바나힐스: 'Ba Na Hills',
  호이안올드타운: 'Hoi An Ancient Town',
  호이안고성: 'Hoi An Ancient Town',
  포나가르탑: 'Po Nagar Cham Towers',
  포나가르: 'Po Nagar Cham Towers',
  롱선사: 'Long Son Pagoda',
  롱선: 'Long Son Pagoda',
  빈원더스: 'VinWonders Nha Trang',
  빈원더: 'VinWonders Nha Trang',
  담시장: 'Dam Market Nha Trang',
  나트랑: 'Nha Trang',
  나짱: 'Nha Trang',
  미케비치: 'My Khe Beach Da Nang',
  내원교: 'Dragon Bridge Da Nang',
  청담: 'Cheongdam',
  하코네신사: 'Hakone Shrine',
  하코네: 'Hakone',
  아시호수유람선: 'Lake Ashi Cruise',
  아시호수: 'Lake Ashi',
  오와쿠다니: 'Owakudani Valley',
  시부야스크램블교차로: 'Shibuya Crossing',
  시부야: 'Shibuya',
  도쿄타워: 'Tokyo Tower',
  센소지: 'Sensoji Temple',
  아사쿠사: 'Asakusa',
  오다이바: 'Odaiba',
  디즈니랜드: 'Tokyo Disneyland',
  도쿄디즈니랜드: 'Tokyo Disneyland',
  울루와뚜: 'Uluwatu Temple',
  빠당빠당비치: 'Padang Padang Beach',
  빠당빠당: 'Padang Padang Beach',
  가루다문화공원: 'Garuda Wisnu Kencana',
  짐바란: 'Jimbaran Beach',
  우붓재래시장: 'Ubud Market',
  우붓왕궁: 'Ubud Palace',
  사라스와띠사원: 'Saraswati Temple Ubud',
  뜨갈랄랑: 'Tegalalang Rice Terrace',
  뜨그눙안폭포: 'Tegenungan Waterfall',
  성바울성당: 'Ruins of St Paul Macau',
  세나도광장: 'Senado Square Macau',
  베네시안리조트: 'The Venetian Macao',
  하버시티: 'Harbour City Hong Kong',
  '하버 시티': 'Harbour City Hong Kong',
  하버플라자: 'Harbour City Hong Kong',
  할리우드로드: 'Hollywood Road Hong Kong',
  소호거리: 'SoHo Hong Kong',
  '소호 거리': 'SoHo Hong Kong',
  웡타이신: 'Wong Tai Sin Temple',
  '웡타이신 사원': 'Wong Tai Sin Temple',
  낭만의거리: 'Avenue of Stars Hong Kong',
  '낭만의 거리': 'Avenue of Stars Hong Kong',
  미드레벨에스컬레이터: 'Mid-Levels Escalator',
  타이쿤: 'Tai Kwun',
  빅토리아피크: 'Victoria Peak',
  피크트램: 'Peak Tram',
  침사추이: 'Tsim Sha Tsui',
  연인의거리: 'Avenue of Stars Hong Kong',
  헤리티지1881: '1881 Heritage Hong Kong',
  유원: 'Yu Garden',
  예원: 'Yu Garden',
  외탄: 'The Bund',
  와탄: 'The Bund',
  난징로: 'Nanjing Road',
  신천지: 'Xintiandi',
  동방명주: 'Oriental Pearl Tower',
  주가각: 'Zhujiajiao',
  우캉루: 'Wukang Road',
  송성: 'Songcheng Park',
  송가무: 'Songcheng Park',
  항주: 'West Lake',
  서호: 'West Lake',
  청황: 'City God Temple of Shanghai',
  청황묘: 'City God Temple of Shanghai',
  자금성: 'Forbidden City',
  사랑의절벽: 'Two Lovers Point',
  '사랑의 절벽': 'Two Lovers Point',
  스페인광장: 'Plaza de Espana Guam',
  '스페인 광장': 'Plaza de Espana Guam',
  아가나: 'Hagatna Cathedral',
  투몬: 'Tumon Bay',
  투몬베이: 'Tumon Bay',
  피시아이: 'Fish Eye Marine Park Guam',
  '피시 아이': 'Fish Eye Marine Park Guam',
  본다이비치: 'Bondi Beach',
  '본다이 비치': 'Bondi Beach',
  본다이: 'Bondi Beach',
  블루마운틴: 'Blue Mountains',
  '블루 마운틴': 'Blue Mountains',
  포트스티븐스: 'Port Stephens',
  포트스티븐: 'Port Stephens',
  '포트 스티븐': 'Port Stephens',
  '포트 스티븐스': 'Port Stephens',
  오페라하우스: 'Sydney Opera House',
  '오페라 하우스': 'Sydney Opera House',
  하버브리지: 'Sydney Harbour Bridge',
  '하버 브리지': 'Sydney Harbour Bridge',
  브라티슬라바성: 'Bratislava Castle',
  '브라티슬라바 성': 'Bratislava Castle',
  쇤브룬궁전: 'Schonbrunn Palace',
  '쇤브룬 궁전': 'Schonbrunn Palace',
  헝가리국회의사당: 'Hungarian Parliament',
  부다페스트국회의사당: 'Hungarian Parliament',
  카를교: 'Charles Bridge',
  '카를 교': 'Charles Bridge',
  프라하성: 'Prague Castle',
  '프라하 성': 'Prague Castle',
  스타피쉬비치: 'Starfish Beach',
  '스타피쉬 비치': 'Starfish Beach',
  사오비치: 'Sao Beach',
  '사오 비치': 'Sao Beach',
  호국사: 'Ho Quoc Pagoda',
}

/** 테마 태그(themeTags) 한국어/혼용 → Pexels 검색용 영어 (후순위 fallback) */
const THEME_TAG_MAP: Record<string, string> = {
  해변: 'beach',
  오션뷰: 'ocean view',
  바다: 'beach',
  허니문: 'honeymoon',
  신혼: 'honeymoon',
  가족: 'family travel',
  가족여행: 'family travel',
  테마파크: 'theme park',
  놀이공원: 'theme park',
  야경: 'night view',
  럭셔리: 'luxury travel',
  리조트: 'resort',
  스파: 'spa resort',
  골프: 'golf',
  크루즈: 'cruise',
  자연: 'nature landscape',
  전통: 'traditional culture',
  힐링: 'nature relaxation',
  맛집: 'food travel',
  쇼핑: 'shopping',
  시티: 'city',
  도시: 'city',
  문화: 'culture',
  역사: 'historic',
  오지: 'nature',
}

const MAX_TERMS = 3
const MAX_LENGTH = 50
const MAX_ATTRACTION_WORDS = 4

const POI_KO_KEYS_SORTED = Object.keys(POI_KO_TO_EN).sort((a, b) => b.length - a.length)

/**
 * 스크래퍼·공급사 페이지에 섞인 JSON/API 덤프가 title·destination 등에 들어오면
 * Pexels/Gemini 검색어가 `"gnbMenuEventTypeWebCode":null` 같은 문자열로 오염된다 — 미디어용으로 제외.
 */
export function isLikelyJsonOrWebApiDump(s: string | null | undefined): boolean {
  if (!s?.trim()) return false
  const t = s.trim()
  // 객체형 페이지/API 덤프 (상품명·목적지 필드에 붙는 경우)
  if (t.startsWith('{') && /"[^"]+"\s*:/.test(t)) return true
  if (t.includes('gnbMenuEventTypeWebCode') || t.includes('"gnbMenu')) return true
  if (t.includes('openapi.naver.com') || t.includes('nid.naver.com')) return true
  // `[` 로 시작하는 건 정상 schedule 배열일 수 있음 — 배열이 아닌 긴 덤프만
  const keyLike = t.match(/"[\w]+"\s*:/g)
  if (!t.startsWith('[') && keyLike && keyLike.length >= 4 && t.length > 80) return true
  return false
}

function mediaSafe(s: string | null | undefined): string | null {
  if (s == null || s === '') return s ?? null
  return isLikelyJsonOrWebApiDump(s) ? null : s
}

/** 일정 이미지·중복 제거용: 동일 명소 판별 */
export function normalizeSemanticPoiKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
}

export function mapKoreanPoiSegment(segment: string): string {
  const t = segment.trim()
  if (!t) return ''
  for (const ko of POI_KO_KEYS_SORTED) {
    if (t.includes(ko)) return POI_KO_TO_EN[ko] ?? ''
  }
  return ''
}

/** routeText·일정 본문에서 매핑 가능한 한글 POI를 긴 키 우선·중복 없이 모두 수집 */
export function findAllMappedKoreanPoisInText(text: string): string[] {
  return findMappedKoreanPoisInTextByMentionOrder(text).map((x) => x.en)
}

/** 본문 등장 순서대로 매핑된 한글 POI → 영문 (일정 1순위 명소 선택용) */
export function findMappedKoreanPoisInTextByMentionOrder(text: string): Array<{ en: string; idx: number }> {
  const t = String(text ?? '').trim()
  if (!t) return []
  const out: Array<{ en: string; idx: number }> = []
  const seen = new Set<string>()
  for (const ko of POI_KO_KEYS_SORTED) {
    if (!t.includes(ko)) continue
    const en = (POI_KO_TO_EN[ko] ?? '').trim()
    if (!en) continue
    const key = en.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ en, idx: t.indexOf(ko) })
  }
  out.sort((a, b) => a.idx - b.idx)
  return out
}

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

/** `DESTINATION_MAP` 단일 단어 도시·국가명만 — 복합 지명(타지마할·Palas de Rei 등)은 false */
export function isKnownDestinationCityEnglishKeyword(kw: string): boolean {
  const words = kw.trim().split(/\s+/).filter(Boolean)
  if (words.length !== 1) return false
  const k = normalizeSemanticPoiKey(kw)
  if (!k) return false
  for (const en of Object.values(DESTINATION_MAP)) {
    if (en.trim().split(/\s+/).filter(Boolean).length !== 1) continue
    if (normalizeSemanticPoiKey(en) === k) return true
  }
  return false
}

export function mapDestination(destination: string | null): string {
  if (!destination) return ''
  if (isLikelyJsonOrWebApiDump(destination)) return ''
  const t = normalize(destination)
  if (!t) return ''
  for (const [ko, en] of Object.entries(DESTINATION_MAP)) {
    if (t.includes(ko)) return en
  }
  return t
}

function mapRegion(region: string | null): string {
  if (!region) return ''
  if (isLikelyJsonOrWebApiDump(region)) return ''
  const t = normalize(region)
  if (!t) return ''
  for (const [ko, en] of Object.entries(REGION_MAP)) {
    if (t.includes(ko)) return en
  }
  return t
}

/** themeTags 쉼표 구분에서 첫 번째 유효 태그를 영어로 매핑 */
function mapFirstThemeTag(themeTags: string | null): string {
  if (!themeTags) return ''
  if (isLikelyJsonOrWebApiDump(themeTags)) return ''
  const tags = themeTags
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const tag of tags) {
    const lower = tag.toLowerCase()
    for (const [ko, en] of Object.entries(THEME_TAG_MAP)) {
      if (tag.includes(ko) || lower === ko.toLowerCase()) return en
    }
    if (/^[a-zA-Z\s]+$/.test(tag) && tag.length <= 20) return tag
  }
  return ''
}

/** 2~4단어, 짧은 실전 검색어 */
export function sanitizeAttractionPhrase(s: string | null | undefined): string {
  if (!s) return ''
  let t = normalize(s)
  if (!t) return ''
  const words = t.split(/\s+/).filter(Boolean).slice(0, MAX_ATTRACTION_WORDS)
  t = words.join(' ')
  if (t.length > MAX_LENGTH) t = t.slice(0, MAX_LENGTH).trim()
  return t
}

/**
 * 일정/POI 한 줄에서 Pexels용 **영문 관광지명**을 우선 추출.
 * 1) `POI_KO_TO_EN` 매핑 2) 괄호 안 라틴 구문 3) 짧은 라틴만으로 된 토큰
 */
export function extractEnglishPoiFromLabel(label: string | null | undefined): string {
  if (!label?.trim()) return ''
  const t = label.trim()
  const mapped = mapKoreanPoiSegment(t)
  if (mapped) {
    const q = sanitizeAttractionPhrase(mapped)
    if (q) return q
  }
  const paren = t.match(/\(\s*([A-Za-z][A-Za-z0-9\s,.'-]{2,48})\s*\)/)
  if (paren?.[1]) {
    const q = sanitizeAttractionPhrase(paren[1])
    if (q && isLatinAttractionName(q)) return q
  }
  if (isLatinAttractionName(t)) return sanitizeAttractionPhrase(t)
  return ''
}

/** 라틴 문자 위주인 명소명(편명·검색에 적합) */
function isLatinAttractionName(s: string): boolean {
  if (!s || s.length < 2) return false
  const letters = s.replace(/[^a-zA-Z]/g, '').length
  return letters >= Math.min(4, s.length * 0.5)
}

/** poiNamesRaw: 매핑된 한글 명소 → 영어, 없으면 첫 라틴 구간 */
function firstPoiFromRaw(poiNamesRaw: string | null | undefined): string {
  if (isLikelyJsonOrWebApiDump(poiNamesRaw)) return ''
  const hit = firstPoiSearchTermExcluding(poiNamesRaw, new Set())
  return hit ?? ''
}

/**
 * 이전 일차에서 이미 쓴 명소(semantic key)는 제외하고 첫 검색어 후보 반환.
 */
export function firstPoiSearchTermExcluding(
  poiNamesRaw: string | null | undefined,
  excludeKeys: Set<string>
): string | null {
  if (!poiNamesRaw?.trim()) return null
  const parts = poiNamesRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
  for (const p of parts) {
    const mapped = mapKoreanPoiSegment(p)
    if (mapped) {
      const q = sanitizeAttractionPhrase(mapped)
      if (q) {
        if (excludeKeys.has(normalizeSemanticPoiKey(q))) continue
        return q
      }
    }
    const q = sanitizeAttractionPhrase(p)
    if (!q) continue
    if (!isLatinAttractionName(q)) continue
    if (excludeKeys.has(normalizeSemanticPoiKey(q))) continue
    return q
  }
  return null
}

/**
 * 상품명 등에서 라틴 명소·지명 구만 추출 (짧은 영문 슬러그 우선).
 * 목적지+테마보다 앞에 두어 "여행 분위기" 키워드보다 실제 장소 이미지에 가깝게 한다.
 */
export function extractLatinPhraseFromTitle(title: string | null): string {
  if (!title?.trim()) return ''
  if (isLikelyJsonOrWebApiDump(title)) return ''
  const chunks = title
    .split(/[|·/\\[\]()\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const tryPhrase = (chunk: string): string => {
    const m = chunk.match(
      /\b([A-Za-z][A-Za-z0-9]*(?:\s+[A-Za-z][A-Za-z0-9]*){1,3})\b/
    )
    if (!m?.[1]) return ''
    const q = sanitizeAttractionPhrase(m[1])
    return q && isLatinAttractionName(q) ? q : ''
  }
  for (const chunk of chunks) {
    const hit = tryPhrase(chunk)
    if (hit) return hit
  }
  const whole = tryPhrase(title)
  return whole
}

/**
 * Product.schedule JSON에서 imageKeyword(영문 장소) 우선, 없으면 짧은 title.
 */
export function extractAttractionFromScheduleJson(scheduleJson: string | null | undefined): string {
  if (!scheduleJson || typeof scheduleJson !== 'string') return ''
  if (isLikelyJsonOrWebApiDump(scheduleJson)) return ''
  try {
    const arr = JSON.parse(scheduleJson) as unknown
    if (!Array.isArray(arr)) return ''
    for (const item of arr) {
      const o = item as Record<string, unknown>
      const kw =
        typeof o.imageKeyword === 'string'
          ? o.imageKeyword.trim()
          : typeof (o as { image_keyword?: string }).image_keyword === 'string'
            ? String((o as { image_keyword?: string }).image_keyword).trim()
            : ''
      if (kw && !isLikelyJsonOrWebApiDump(kw)) {
        const segment = kw.split(' / ')[0]?.trim() ?? kw
        const place = normalizeToPlaceName(segment)
        if (place) return place
        const q = sanitizeAttractionPhrase(segment)
        if (q) return normalizeToPlaceName(q) || q
      }
    }
    for (const item of arr) {
      const o = item as Record<string, unknown>
      const title = typeof o.title === 'string' ? o.title.trim() : ''
      if (title && title.length <= 45 && !isLikelyJsonOrWebApiDump(title)) {
        const q = sanitizeAttractionPhrase(title)
        if (q && isLatinAttractionName(q)) return q
      }
    }
  } catch {
    return ''
  }
  return ''
}

/**
 * 상품/일정 기반 Pexels 검색 키워드 생성 (관광지 우선).
 * 우선순위: 1) attractionName 2) poiNamesRaw(한글 명소 매핑 → 영어, 또는 라틴 구) 3) schedule.imageKeyword·일정 제목
 * 4) 상품명에서 추출한 짧은 라틴 명소 구 5) 도시 + landmark / attraction / travel landmark
 * 6) 목적지 + 테마·지역 7) 상품명 단어 8) travel
 * displayCategory는 검색어에 넣지 않음.
 */
export type TravelSubjectEnMediaOptions = {
  destination: string | null
  primaryRegion: string | null
  themeTags: string | null
  title: string | null
  /** 관리자/추출에서 넘긴 명소 1순위 (영문 권장) */
  attractionName?: string | null
  /** ItineraryDay.poiNamesRaw 등 — 쉼표 구분 */
  poiNamesRaw?: string | null
  /** Product.schedule JSON 문자열 */
  scheduleJson?: string | null
}

/**
 * Pexels 검색어·Gemini 장면 묘사의 공통 **영문 주제** SSOT (짧은 키워드 조각).
 * `buildPexelsKeyword` / `buildGeminiImagePrompt`는 각각 검색·이미지 지시문으로만 감싼다.
 */
export function resolveTravelSubjectEnForMedia(options: TravelSubjectEnMediaOptions): string {
  const { destination, primaryRegion, themeTags, title, attractionName, poiNamesRaw, scheduleJson } = options
  const destIn = mediaSafe(destination) ?? null
  const titleIn = mediaSafe(title) ?? null
  const attrIn = mediaSafe(attractionName) ?? null
  const themeIn = mediaSafe(themeTags) ?? null
  const regionIn = mediaSafe(primaryRegion) ?? null

  const destEn = mapDestination(destIn)
  const themeEn = mapFirstThemeTag(themeIn)
  const regionEn = mapRegion(regionIn)

  const explicit = normalizeToPlaceName(attrIn ?? '')
  if (explicit) return explicit

  const fromPoi = firstPoiFromRaw(poiNamesRaw)
  if (fromPoi) {
    const n = normalizeToPlaceName(fromPoi)
    if (n) return n
  }

  const fromSchedule = extractAttractionFromScheduleJson(scheduleJson ?? null)
  if (fromSchedule) return fromSchedule

  const fromTitleLatin = extractLatinPhraseFromTitle(titleIn)
  if (fromTitleLatin) {
    const n = normalizeToPlaceName(fromTitleLatin)
    if (n) return n
  }

  if (destEn) {
    const cityOnly = normalizeToPlaceName(destEn)
    if (cityOnly) return cityOnly
  }

  const parts: string[] = []
  if (destEn) parts.push(destEn)
  if (themeEn) parts.push(themeEn)
  else if (regionEn && !destEn) parts.push(regionEn)
  else if (regionEn && destEn && parts.length < 2) parts.push(regionEn)

  let query = parts.slice(0, MAX_TERMS).join(' ')
  if (query.length > MAX_LENGTH) query = query.slice(0, MAX_LENGTH).trim()
  if (query) {
    const n = normalizeToPlaceName(query)
    return n || query
  }

  const titleWords = (titleIn ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
  query = titleWords.join(' ')
  if (query.length > MAX_LENGTH) query = query.slice(0, MAX_LENGTH).trim()
  const n = normalizeToPlaceName(query)
  return n || query || destEn || ''
}

export function buildPexelsKeyword(options: TravelSubjectEnMediaOptions): string {
  return resolveTravelSubjectEnForMedia(options)
}
