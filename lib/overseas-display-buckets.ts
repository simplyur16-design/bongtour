import {
  buildOverseasProductMatchHaystack,
  type MatchProductToOverseasNodeResult,
  type OverseasProductMatchInput,
} from '@/lib/match-overseas-product'

/** 여행상품 해외 허브 UI 권역 키 (상품 1건당 정확히 1개) */
export type OverseasDisplayBucketId =
  | 'europe_me_af'
  | 'sea_taiwan'
  | 'japan'
  | 'china_hk_mo'
  | 'americas'
  | 'oceania'
  | 'other'

/** 화면 표기 순서 — 메가메뉴 병합 권역과 동일 */
export const DISPLAY_CATEGORIES = [
  '유럽/중동/아프리카',
  '동남아/대만/서남아',
  '일본',
  '중국/홍콩/마카오/몽골',
  '미주/캐나다/하와이',
  '괌/사이판/호주/뉴질랜드',
  '그외',
] as const

export const OVERSEAS_DISPLAY_BUCKET_ORDER: OverseasDisplayBucketId[] = [
  'europe_me_af',
  'sea_taiwan',
  'japan',
  'china_hk_mo',
  'americas',
  'oceania',
  'other',
]

export const OVERSEAS_DISPLAY_BUCKET_LABEL: Record<OverseasDisplayBucketId, string> = {
  europe_me_af: '유럽/중동/아프리카',
  sea_taiwan: '동남아/대만/서남아',
  japan: '일본',
  china_hk_mo: '중국/홍콩/마카오/몽골',
  americas: '미주/캐나다/하와이',
  oceania: '괌/사이판/호주/뉴질랜드',
  other: '그외',
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
      if (!ck) return 'china_hk_mo'
      if (ck === 'hk-mo-sz') return 'china_hk_mo'
      if (ck === 'china-major' || ck === 'inner-mongolia' || ck === 'china-trekking' || ck === 'mongolia')
        return 'china_hk_mo'
      if (ck === 'central-asia') return 'china_hk_mo'
      return 'other'
    }
    case 'sea-taiwan-south-asia':
      if (match.countryKey === 'india-nepal-sri-bhutan') return 'sea_taiwan'
      return 'sea_taiwan'
    case 'europe-me-africa':
      return 'europe_me_af'
    case 'americas':
      return 'americas'
    case 'guam-au-nz':
      return 'oceania'
    default:
      return 'other'
  }
}

/** 호주·뉴질랜드 — 잘못된 `americas` 매칭 보정 */
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
 */
export function resolveOverseasDisplayBucketForBrowse(
  product: OverseasProductMatchInput,
  match: MatchProductToOverseasNodeResult | null,
): OverseasDisplayBucketId {
  const base = mapMatchToOverseasDisplayBucket(match)
  if (base !== 'americas') return base

  const h = buildOverseasProductMatchHaystack(product)

  if (RE_GUAM_SAIPAN_TRAVEL.test(h) && match?.countryKey !== 'hawaii') {
    return 'oceania'
  }

  if (RE_AU_NZ_TRAVEL.test(h)) {
    if (match?.groupKey === 'americas' && match.countryKey === 'hawaii') return base
    return 'oceania'
  }

  return base
}
