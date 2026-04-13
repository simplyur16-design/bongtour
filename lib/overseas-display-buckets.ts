import type { MatchProductToOverseasNodeResult } from '@/lib/match-overseas-product'

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
  'south-france',
  'sicily',
  'germany',
  'ireland',
  'netherlands',
  'belgium',
  'austria',
  'spain',
  'portugal',
])

const EUROPE_NORTH_COUNTRIES = new Set<string>(['nordic-baltic'])

const EUROPE_EAST_COUNTRIES = new Set<string>(['czech', 'hungary', 'balkans'])

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
      if (ck === 'guam' || ck === 'saipan') return 'americas'
      return 'other'
    }
    default:
      return 'other'
  }
}
