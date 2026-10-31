/**
 * 자동 사진 채움 후보 걸러내기 — 순수 함수(쓰기·네트워크 없음).
 * 문과장 1차 검수(10/31, 48장 중 교체 14). 사장님 10/31 09:58: 탈락 사유는 '목적지와 안 맞음' 하나뿐
 * (얼굴·간판은 사유 아님). 목적지와 안 맞음 = ① 다른 도시 사진 ② 장소 단어가 전혀 없는 약한 일치
 * ③ 장소가 아니라 무관한 사물(손목시계·비행기)·일정에 없는 동물·실내(복도·서점)가 주인공.
 * 후보의 설명(alt)·페이지 주소·풀 이름표로 판정해 걸리면 그 후보를 버린다.
 * 출처 미상(작가·원본 주소 없음)은 탈락이 아니라 메타 표시만(photoSourceMetadataFlag).
 * 한계: 이미지 픽셀을 보지 않으므로 설명이 없는 사진은 못 잡는다 → 50개씩 검수 유지.
 * REGRESSION-FREEZE[register-photo-subject-filter]: 목적지 불일치 후보만 탈락(얼굴·간판은 사유 아님) — manifest
 */

export type PhotoSubjectContext = {
  /** 검색어(장소) */
  query?: string | null
  /** 상품 목적지(한글/영문 아무거나) */
  destination?: string | null
  destinationEn?: string | null
  /** 상품 제목 + 일정 동선 등 — 일정에 있는 동물·사물은 허용 */
  productText?: string | null
}

export type PhotoSubjectBlockReason =
  | 'unrelated_object'
  | 'animal_not_in_itinerary'
  | 'interior_not_place'
  | 'city_mismatch'
  | 'no_place_relevance'

const OBJECT_RE =
  /\b(watch|wristwatch|clock|airplane|aeroplane|plane|aircraft|jet|airliner|airport|runway|car|cars|phone|smartphone|laptop|keyboard|camera|passport|luggage|suitcase|ticket)\b/
const ANIMAL_RE =
  /\b(elephant|elephants|tiger|tigers|lion|monkey|monkeys|dog|dogs|cat|cats|bird|birds|horse|horses|camel|camels|panda|pandas|deer|cow|cows|snake|fish|dolphin|whale|bear|bears)\b/
const INTERIOR_RE =
  /\b(hallway|corridor|interior|indoor|room|bedroom|lobby|office|bookstore|bookshop|library|bookshelf|bookshelves|shelf|shelves|mall|escalator|staircase|stairs|kitchen|bathroom)\b/

/** 대표적인 여행지 도시(영문) — 후보 설명에 상품과 다른 도시가 보이면 탈락 */
export const KNOWN_DESTINATION_CITIES_EN = [
  'venice', 'paris', 'london', 'rome', 'osaka', 'dotonbori', 'kyoto', 'tokyo', 'sapporo', 'fukuoka', 'okinawa',
  'hanoi', 'da nang', 'danang', 'ho chi minh', 'saigon', 'nha trang', 'bangkok', 'pattaya', 'phuket', 'chiang mai',
  'singapore', 'bali', 'cebu', 'boracay', 'manila', 'taipei', 'hong kong', 'macau', 'shanghai', 'beijing',
  'guilin', 'zhangjiajie', 'lijiang', 'seoul', 'busan', 'jeju', 'astana', 'almaty', 'tashkent', 'ulaanbaatar',
  'dubai', 'istanbul', 'cairo', 'prague', 'vienna', 'budapest', 'barcelona', 'madrid', 'lisbon', 'zurich',
  'new york', 'los angeles', 'las vegas', 'honolulu', 'guam', 'saipan', 'sydney', 'melbourne', 'auckland',
] as const

const ANIMAL_KO: Record<string, string> = {
  elephant: '코끼리', tiger: '호랑이', lion: '사자', monkey: '원숭이', dog: '강아지', cat: '고양이', bird: '새 공원',
  horse: '승마', camel: '낙타', panda: '판다', deer: '사슴', cow: '소 목장', snake: '뱀', fish: '물고기',
  dolphin: '돌고래', whale: '고래', bear: '곰',
}

/** 일정에 그 동물 체험이 실제로 있나 — 'Tiger Leaping Gorge'(호도협) 같은 지명 속 단어는 제외 */
export function itineraryMentionsAnimal(productText: string, animal: string): boolean {
  const base = animal.toLowerCase().replace(/s$/, '')
  const p = productText.toLowerCase().replace(/tiger leaping( gorge)?/g, ' ').replace(/호도협/g, ' ')
  if (new RegExp(`\\b${base}s?\\b`).test(p)) return true
  const ko = ANIMAL_KO[base]
  return Boolean(ko && p.includes(ko))
}

/** 명소·구역 → 소속 도시 (도톤보리는 오사카 상품이면 정상) */
const CITY_PARENT_EN: Record<string, string> = { dotonbori: 'osaka', saigon: 'ho chi minh', danang: 'da nang' }
/** 상품 제목·일정은 한글이 많아 한글 도시명도 비교 */
const CITY_KO: Record<string, string[]> = {
  venice: ['베네치아', '베니스'], paris: ['파리'], london: ['런던'], rome: ['로마'], osaka: ['오사카'], dotonbori: ['도톤보리'],
  kyoto: ['교토'], tokyo: ['도쿄'], sapporo: ['삿포로'], fukuoka: ['후쿠오카'], okinawa: ['오키나와'], hanoi: ['하노이'],
  'da nang': ['다낭'], danang: ['다낭'], 'ho chi minh': ['호치민'], saigon: ['사이공', '호치민'], 'nha trang': ['나트랑', '냐짱'],
  bangkok: ['방콕'], pattaya: ['파타야'], phuket: ['푸켓'], 'chiang mai': ['치앙마이'], singapore: ['싱가포르', '싱가폴'],
  bali: ['발리'], cebu: ['세부'], boracay: ['보라카이'], manila: ['마닐라'], taipei: ['타이베이', '타이페이'], 'hong kong': ['홍콩'],
  macau: ['마카오'], shanghai: ['상하이'], beijing: ['베이징', '북경'], guilin: ['계림', '구이린'], zhangjiajie: ['장가계'],
  lijiang: ['여강', '리장'], seoul: ['서울'], busan: ['부산'], jeju: ['제주'], astana: ['아스타나'], almaty: ['알마티'],
  tashkent: ['타슈켄트'], ulaanbaatar: ['울란바토르'], dubai: ['두바이'], istanbul: ['이스탄불'], cairo: ['카이로'],
  prague: ['프라하'], vienna: ['비엔나'], budapest: ['부다페스트'], barcelona: ['바르셀로나'], madrid: ['마드리드'],
  lisbon: ['리스본'], zurich: ['취리히'], 'new york': ['뉴욕'], 'los angeles': ['로스앤젤레스'], 'las vegas': ['라스베이거스'],
  honolulu: ['호놀룰루'], guam: ['괌'], saipan: ['사이판'], sydney: ['시드니'], melbourne: ['멜버른'], auckland: ['오클랜드'],
}

function low(s: string | null | undefined): string {
  return String(s ?? '').toLowerCase()
}

/** 후보 설명 텍스트: alt + Pexels 페이지 slug + 풀 이름표(파일 이름) */
export function photoCandidateText(parts: ReadonlyArray<string | null | undefined>): string {
  return parts
    .map((p) => {
      let s = String(p ?? '')
      try {
        s = decodeURIComponent(s)
      } catch {
        /* 그대로 */
      }
      try {
        if (/^https?:\/\//i.test(s)) s = new URL(s).pathname
      } catch {
        /* 그대로 */
      }
      return s.replace(/[-_/.]+/g, ' ')
    })
    .join(' ')
    .toLowerCase()
}

function placeTokens(ctx: PhotoSubjectContext): string[] {
  return [ctx.query, ctx.destination, ctx.destinationEn]
    .flatMap((k) => low(k).split(/[\s,·/|()]+/))
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !/^(the|and|day|tour|city|old|town|night|view|park|street|market|temple|beach)$/.test(t))
}

/**
 * 후보를 버려야 하면 사유, 써도 되면 null.
 * requirePlaceMatch: 설명이 있는데 검색 장소·목적지 단어가 하나도 없으면 약한 일치로 보고 탈락.
 */
export function photoSubjectBlockReason(
  candidateText: string,
  ctx: PhotoSubjectContext,
  opts: { requirePlaceMatch?: boolean } = {},
): PhotoSubjectBlockReason | null {
  const t = ` ${low(candidateText).replace(/\s+/g, ' ')} `
  const product = ` ${low([ctx.productText, ctx.query, ctx.destination, ctx.destinationEn].join(' '))} `
  const hit = (re: RegExp) => re.exec(t)?.[1] ?? null
  const obj = hit(OBJECT_RE)
  if (obj) return 'unrelated_object'
  const animal = hit(ANIMAL_RE)
  if (animal && !itineraryMentionsAnimal(product, animal)) return 'animal_not_in_itinerary'
  if (hit(INTERIOR_RE)) return 'interior_not_place'
  for (const city of KNOWN_DESTINATION_CITIES_EN) {
    if (!t.includes(` ${city} `)) continue
    const names = [city, city.replace(/\s+/g, ''), CITY_PARENT_EN[city], ...(CITY_KO[city] ?? []), ...(CITY_KO[CITY_PARENT_EN[city] ?? ''] ?? [])]
      .filter((x): x is string => Boolean(x))
    if (!names.some((n) => product.includes(n))) return 'city_mismatch'
  }
  if (opts.requirePlaceMatch) {
    const meaningful = t.replace(/\b(pexels|photo|photos|free|stock|image|webp|jpg|jpeg|png|\d+)\b/g, ' ').trim()
    if (meaningful.length > 0) {
      const toks = placeTokens(ctx)
      if (toks.length > 0 && !toks.some((k) => t.includes(k))) return 'no_place_relevance'
    }
  }
  return null
}

/** 출처 미상 표시(탈락 아님): 작가·원본 주소가 둘 다 없으면 'source_unknown' */
export function photoSourceMetadataFlag(p: {
  photographer?: string | null
  sourceUrl?: string | null
  sourcePhotoId?: string | null
}): 'source_unknown' | null {
  const has = (v: string | null | undefined) => String(v ?? '').trim() !== ''
  return has(p.photographer) || has(p.sourceUrl) || has(p.sourcePhotoId) ? null : 'source_unknown'
}
