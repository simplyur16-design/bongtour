/**
 * Pexels 검색 키워드 생성 — 관광지(명소) 우선, 규칙 기반 + 최소 보정.
 * 한국어 상품 메타를 Pexels에서 의미 있는 영어 검색어로 변환.
 */

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
  도쿄: 'Tokyo',
  교토: 'Kyoto',
  오사카: 'Osaka',
  후쿠오카: 'Fukuoka',
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
  런던: 'London',
  바르셀로나: 'Barcelona',
  암스테르담: 'Amsterdam',
  두바이: 'Dubai',
  이스탄불: 'Istanbul',
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
  유니버설스튜디오재팬: 'Universal Studios Japan',
  유니버설스튜디오: 'Universal Studios Japan',
  유니버설: 'Universal Studios Japan',
  오사카성: 'Osaka Castle',
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
  할리우드로드: 'Hollywood Road Hong Kong',
  소호거리: 'SoHo Hong Kong',
  미드레벨에스컬레이터: 'Mid-Levels Escalator',
  타이쿤: 'Tai Kwun',
  빅토리아피크: 'Victoria Peak',
  피크트램: 'Peak Tram',
  침사추이: 'Tsim Sha Tsui',
  연인의거리: 'Avenue of Stars Hong Kong',
  헤리티지1881: '1881 Heritage Hong Kong',
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

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

export function mapDestination(destination: string | null): string {
  if (!destination) return ''
  const t = normalize(destination)
  if (!t) return ''
  for (const [ko, en] of Object.entries(DESTINATION_MAP)) {
    if (t.includes(ko)) return en
  }
  return t
}

function mapRegion(region: string | null): string {
  if (!region) return ''
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
      if (kw) {
        const q = sanitizeAttractionPhrase(kw)
        if (q) return q
      }
    }
    for (const item of arr) {
      const o = item as Record<string, unknown>
      const title = typeof o.title === 'string' ? o.title.trim() : ''
      if (title && title.length <= 45) {
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
  const destEn = mapDestination(destination)
  const themeEn = mapFirstThemeTag(themeTags)
  const regionEn = mapRegion(primaryRegion)

  const explicit = sanitizeAttractionPhrase(attractionName)
  if (explicit) return explicit

  const fromPoi = firstPoiFromRaw(poiNamesRaw)
  if (fromPoi) return fromPoi

  const fromSchedule = extractAttractionFromScheduleJson(scheduleJson ?? null)
  if (fromSchedule) return fromSchedule

  const fromTitleLatin = extractLatinPhraseFromTitle(title)
  if (fromTitleLatin) return fromTitleLatin

  if (destEn) {
    const landmark = sanitizeAttractionPhrase(`${destEn} landmark`)
    if (landmark.length <= MAX_LENGTH) return landmark
  }
  if (destEn) {
    const attr = sanitizeAttractionPhrase(`${destEn} attraction`)
    if (attr.length <= MAX_LENGTH) return attr
  }
  if (destEn) {
    const tl = sanitizeAttractionPhrase(`${destEn} travel landmark`)
    if (tl.length <= MAX_LENGTH) return tl
  }

  const parts: string[] = []
  if (destEn) parts.push(destEn)
  if (themeEn) parts.push(themeEn)
  else if (regionEn && !destEn) parts.push(regionEn)
  else if (regionEn && destEn && parts.length < 2) parts.push(regionEn)

  let query = parts.slice(0, MAX_TERMS).join(' ')
  if (query.length > MAX_LENGTH) query = query.slice(0, MAX_LENGTH).trim()
  if (query) return query

  const titleWords = (title ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
  query = titleWords.join(' ')
  if (query.length > MAX_LENGTH) query = query.slice(0, MAX_LENGTH).trim()
  return query || 'travel'
}

export function buildPexelsKeyword(options: TravelSubjectEnMediaOptions): string {
  return resolveTravelSubjectEnForMedia(options)
}
