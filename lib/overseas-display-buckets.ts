import {
  buildOverseasProductMatchHaystack,
  type MatchProductToOverseasNodeResult,
  type OverseasProductMatchInput,
} from '@/lib/match-overseas-product'

/** 여행상품 해외 허브 UI 권역 키 (상품 1건당 정확히 1개) */
export type OverseasDisplayBucketId =
  | 'japan'
  | 'china'
  | 'hongkong'
  | 'sea'
  | 'europe_west'
  | 'europe_north'
  | 'europe_east'
  | 'americas'
  | 'other'

/** 화면 표기 순서 고정 (라벨과 동일 순서) */
export const DISPLAY_CATEGORIES = [
  '일본',
  '중국',
  '홍콩',
  '동남아',
  '서유럽',
  '북유럽',
  '동유럽',
  '미주',
  '그외',
] as const

export const OVERSEAS_DISPLAY_BUCKET_ORDER: OverseasDisplayBucketId[] = [
  'japan',
  'china',
  'hongkong',
  'sea',
  'europe_west',
  'europe_north',
  'europe_east',
  'americas',
  'other',
]

export const OVERSEAS_DISPLAY_BUCKET_LABEL: Record<OverseasDisplayBucketId, string> = {
  japan: '일본',
  china: '중국',
  hongkong: '홍콩',
  sea: '동남아',
  europe_west: '서유럽',
  europe_north: '북유럽',
  europe_east: '동유럽',
  americas: '미주',
  other: '그외',
}

const EUROPE_WEST_COUNTRIES = new Set<string>([
  'uk',
  'switzerland',
  'italy',
  'france',
  'netherlands',
  'spain',
  'portugal',
  'morocco',
  'greece',
  'turkey',
  'egypt',
])

const EUROPE_NORTH_COUNTRIES = new Set<string>(['nordic-baltic'])

const EUROPE_EAST_COUNTRIES = new Set<string>(['czech', 'hungary', 'balkans', 'germany', 'austria'])

/** `europe-me-africa` 그룹 중 표시 9분류에 없는 국가·테마 → 그외 */
function europeMeAfricaToBucket(match: MatchProductToOverseasNodeResult): OverseasDisplayBucketId {
  const ck = match.countryKey
  if (ck && EUROPE_WEST_COUNTRIES.has(ck)) return 'europe_west'
  if (ck && EUROPE_NORTH_COUNTRIES.has(ck)) return 'europe_north'
  if (ck && EUROPE_EAST_COUNTRIES.has(ck)) return 'europe_east'
  return 'other'
}

/**
 * `matchProductToOverseasNode` 결과를 화면 권역 1곳으로 매핑.
 * 동일 상품이 두 버킷에 들어가지 않도록 분기만 사용 (중복 push 없음).
 */
export function mapMatchToOverseasDisplayBucket(
  match: MatchProductToOverseasNodeResult | null
): OverseasDisplayBucketId {
  if (!match) return 'other'
  switch (match.groupKey) {
    case 'japan':
      return 'japan'
    case 'china-circle': {
      const ck = match.countryKey
      if (!ck) return 'china'
      if (ck === 'hk-mo-sz') return 'hongkong'
      if (ck === 'china-major' || ck === 'inner-mongolia' || ck === 'china-trekking') return 'china'
      return 'other'
    }
    case 'sea-taiwan-south-asia':
      if (match.countryKey === 'india-nepal-sri-bhutan') return 'other'
      return 'sea'
    case 'europe-me-africa':
      return europeMeAfricaToBucket(match)
    case 'americas':
      return 'americas'
    case 'guam-au-nz': {
      const ck = match.countryKey
      /** 여행상품 분류: 괌·사이판은 미주가 아님 — 동남아 버킷(남태평양·휴양권 성격) */
      if (ck === 'guam' || ck === 'saipan') return 'sea'
      return 'other'
    }
    default:
      return 'other'
  }
}

/** 호주·뉴질랜드 — 잘못된 `americas` 매칭 보정 (9버킷 유지, `other` = 오세아니아·대양주 성격) */
const RE_AU_NZ_TRAVEL = new RegExp(
  [
    '시드니',
    'sydney',
    '\\bSYD\\b',
    '멜번',
    '멜버른',
    'melbourne',
    '브리즈번',
    'brisbane',
    '골드코스트',
    'gold\\s*coast',
    '퍼스',
    'perth',
    '케언즈',
    '케인즈',
    'cairns',
    '울룰루',
    'uluru',
    '호주',
    'australia',
    '뉴질랜드',
    'new\\s*zealand',
    '오클랜드',
    'auckland',
    '로토루아',
    'rotorua',
    '크라이스트처치',
    'christchurch',
    '퀸즈타운',
    'queenstown',
  ].join('|'),
  'i',
)

const RE_GUAM_SAIPAN_TRAVEL = /괌|guam|사이판|saipan/i

/**
 * `/api/products/browse` 전용: 트리 매칭 후 **상품 문자열**로 미주 오분류를 덮어쓴다.
 * (9버킷 키·순서·라벨은 그대로 — 버킷 id만 보정)
 */
export function resolveOverseasDisplayBucketForBrowse(
  product: OverseasProductMatchInput,
  match: MatchProductToOverseasNodeResult | null,
): OverseasDisplayBucketId {
  const base = mapMatchToOverseasDisplayBucket(match)
  if (base !== 'americas') return base

  const h = buildOverseasProductMatchHaystack(product)

  if (RE_GUAM_SAIPAN_TRAVEL.test(h) && match?.countryKey !== 'hawaii') {
    return 'sea'
  }

  if (RE_AU_NZ_TRAVEL.test(h)) {
    if (match?.groupKey === 'americas' && match.countryKey === 'hawaii') return base
    return 'other'
  }

  return base
}
