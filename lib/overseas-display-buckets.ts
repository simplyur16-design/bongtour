import type { MatchProductToOverseasNodeResult } from '@/lib/match-overseas-product'

/** 여행상품 페이지 권역형 UI용 6분류 (트리 groupKey·country 기준) */
export type OverseasDisplayBucketId = 'japan' | 'europe' | 'sea' | 'americas' | 'south_asia' | 'other'

/** 공개 목록 권역 순서 고정: 1일본 2유럽 3동남아 4미주 5서남아 6그외 — 월간 큐레이션은 ProductResultsList에서 유럽 section 직후(동남아 전) 1회 */
export const OVERSEAS_DISPLAY_BUCKET_ORDER: OverseasDisplayBucketId[] = [
  'japan',
  'europe',
  'sea',
  'americas',
  'south_asia',
  'other',
]

export const OVERSEAS_DISPLAY_BUCKET_LABEL: Record<OverseasDisplayBucketId, string> = {
  japan: '일본',
  sea: '동남아',
  europe: '유럽',
  americas: '미주',
  south_asia: '서남아',
  other: '그외',
}

/**
 * `matchProductToOverseasNode` 결과를 화면 6권역으로 매핑.
 * - 동남아·대만·서남아 그룹 중 인도·네팔·스리랑카·부탄 → 서남아, 나머지 → 동남아
 */
export function mapMatchToOverseasDisplayBucket(
  match: MatchProductToOverseasNodeResult | null
): OverseasDisplayBucketId {
  if (!match) return 'other'
  switch (match.groupKey) {
    case 'japan':
      return 'japan'
    case 'europe-me-africa':
      return 'europe'
    case 'americas':
      return 'americas'
    case 'sea-taiwan-south-asia':
      return match.countryKey === 'india-nepal-sri-bhutan' ? 'south_asia' : 'sea'
    default:
      return 'other'
  }
}
