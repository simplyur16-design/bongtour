/**
 * 관리자·공개 공통 — 상품 노출 유형(listingKind)과 여행 범위(travelScope).
 * 공급사 파이프라인과 무관한 운영 메타.
 */

export const LISTING_KIND_VALUES = ['travel', 'private_trip', 'air_hotel_free', 'overseas_training'] as const
export type ListingKind = (typeof LISTING_KIND_VALUES)[number]

export const LISTING_KIND_LABELS: Record<ListingKind, string> = {
  travel: '여행상품',
  private_trip: '우리여행',
  air_hotel_free: '항공권+호텔(자유여행)',
  overseas_training: '국외연수 프로그램',
}

export const TRAVEL_SCOPE_VALUES = ['domestic', 'overseas'] as const
export type ProductTravelScope = (typeof TRAVEL_SCOPE_VALUES)[number]

export const TRAVEL_SCOPE_LABELS: Record<ProductTravelScope, string> = {
  domestic: '국내',
  overseas: '해외',
}

export function parseListingKind(raw: string | null | undefined): ListingKind | null {
  if (raw == null || raw === '') return null
  const t = raw.trim()
  return LISTING_KIND_VALUES.includes(t as ListingKind) ? (t as ListingKind) : null
}

export function parseTravelScope(raw: string | null | undefined): ProductTravelScope | null {
  if (raw == null || raw === '') return null
  const t = raw.trim()
  return TRAVEL_SCOPE_VALUES.includes(t as ProductTravelScope) ? (t as ProductTravelScope) : null
}

/** 관리자 수동 지정 — 지방 출발 메가 메뉴·browse 필터용 (`Product.localDepartureTag`). */
export const LOCAL_DEPARTURE_TAG_VALUES = ['busan', 'cheongju', 'daegu', 'jeju'] as const
export type LocalDepartureTag = (typeof LOCAL_DEPARTURE_TAG_VALUES)[number]

export const LOCAL_DEPARTURE_TAG_LABELS: Record<LocalDepartureTag, string> = {
  busan: '부산출발',
  cheongju: '청주출발',
  daegu: '대구출발',
  jeju: '제주출발',
}

const LOCAL_DEPARTURE_TAG_SET = new Set<string>(LOCAL_DEPARTURE_TAG_VALUES)

/**
 * 관리자 등록/수정 POST 본문에서만 사용. 허용값 외는 무시, 중복 제거, canonical 순서.
 */
export function parseLocalDepartureTagArrayFromAdminBody(body: Record<string, unknown>): LocalDepartureTag[] {
  const raw = body.localDepartureTag
  if (raw == null) return []
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  for (const x of raw) {
    const s = typeof x === 'string' ? x.trim() : ''
    if (LOCAL_DEPARTURE_TAG_SET.has(s)) seen.add(s)
  }
  return LOCAL_DEPARTURE_TAG_VALUES.filter((k) => seen.has(k))
}

/** 관리자 수동 지정 — 테마여행 메가 메뉴·browse 필터용 (`Product.sportsThemeTag`). 한글 라벨 가나다순. */
// REGRESSION-FREEZE[theme-travel-mingling-mega-menu]: 테마여행 탭·밍글밍 태그 — manifest
export const SPORTS_THEME_TAG_VALUES = [
  'golf',
  'diving',
  'running',
  'mingling',
  'spectator',
  'trekking',
] as const
export type SportsThemeTag = (typeof SPORTS_THEME_TAG_VALUES)[number]

export const SPORTS_THEME_TAG_LABELS: Record<SportsThemeTag, string> = {
  running: '러닝',
  trekking: '트레킹',
  diving: '다이빙',
  spectator: '직관',
  golf: '골프',
  mingling: '밍글밍',
}

const SPORTS_THEME_TAG_SET = new Set<string>(SPORTS_THEME_TAG_VALUES)

/**
 * 관리자 등록/수정 POST 본문에서만 사용. 허용값 외는 무시, 중복 제거, canonical 순서.
 */
export function parseSportsThemeTagArrayFromAdminBody(body: Record<string, unknown>): SportsThemeTag[] {
  const raw = body.sportsThemeTag
  if (raw == null) return []
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  for (const x of raw) {
    const s = typeof x === 'string' ? x.trim() : ''
    if (SPORTS_THEME_TAG_SET.has(s)) seen.add(s)
  }
  return SPORTS_THEME_TAG_VALUES.filter((k) => seen.has(k))
}
