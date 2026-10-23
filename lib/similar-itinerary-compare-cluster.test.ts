import { describe, expect, it } from 'vitest'
import {
  areSimilarByMegaCityTagOverlap,
  comparePlaceClustersMatch,
  comparePlaceDbSearchTerms,
  megaMenuCityTagOverlapCount,
  megaMenuGroupCityKeys,
  normalizeCompareDurationLabel,
  productInMegaGroupComparePool,
  resolveComparePlaceCluster,
  resolveComparePlaceClusterFromHay,
} from '@/lib/similar-itinerary-compare-cluster'

describe('similar-itinerary-compare-cluster', () => {
  // REGRESSION-FREEZE[similar-itinerary-compare-cluster]: 청도≠홍콩·몽골·중앙아시아 — manifest
  it('resolves 칭다오/청도 to mega leaf 청도, not 홍콩·마카오·몽골', () => {
    const qingdao = resolveComparePlaceClusterFromHay('칭다오 3박4일')
    expect(qingdao).toEqual({ key: 'qingdao', label: '청도' })
    expect(resolveComparePlaceClusterFromHay('중국 · 청도')?.label).toBe('청도')
    expect(resolveComparePlaceClusterFromHay('홍콩')?.label).toBe('홍콩')
    expect(resolveComparePlaceClusterFromHay('마카오')?.label).toBe('마카오')
    expect(resolveComparePlaceClusterFromHay('울란바타르')?.label).toBe('울란바타르')
    expect(resolveComparePlaceClusterFromHay('카자흐스탄')?.label).toBe('카자흐스탄')
    expect(
      comparePlaceClustersMatch(
        resolveComparePlaceClusterFromHay('칭다오'),
        resolveComparePlaceClusterFromHay('홍콩'),
      ),
    ).toBe(false)
    expect(
      comparePlaceClustersMatch(
        resolveComparePlaceClusterFromHay('청도'),
        resolveComparePlaceClusterFromHay('울란바타르'),
      ),
    ).toBe(false)
  })

  // REGRESSION-FREEZE[similar-itinerary-compare-cluster]: 일본≠나라만 · 대만↔타이베이 — manifest
  it('blocks bare Japan/China; Taiwan bare → 타이베이; other TW cities stay distinct', () => {
    expect(resolveComparePlaceClusterFromHay('일본')).toBeNull()
    expect(resolveComparePlaceClusterFromHay('중국')).toBeNull()
    expect(resolveComparePlaceClusterFromHay('대만')).toEqual({ key: 'taipei', label: '타이베이' })
    expect(resolveComparePlaceClusterFromHay('가오슝')?.label).toBe('가오슝')
    expect(resolveComparePlaceClusterFromHay('도쿄')?.label).toBe('도쿄')
    expect(resolveComparePlaceClusterFromHay('오사카')?.label).toBe('오사카')
    expect(
      comparePlaceClustersMatch(
        resolveComparePlaceClusterFromHay('도쿄'),
        resolveComparePlaceClusterFromHay('오사카'),
      ),
    ).toBe(false)
  })

  // REGRESSION-FREEZE[similar-itinerary-compare-cluster]: 한글 부분일치 금지 · 비leaf 그룹 헤더 단독 금지 — manifest
  it('does not map 인도네시아→인도; blocks non-leaf group headers', () => {
    expect(resolveComparePlaceClusterFromHay('인도네시아')).toBeNull()
    expect(resolveComparePlaceClusterFromHay('인도')?.label).toBe('인도')
    expect(resolveComparePlaceClusterFromHay('발리')?.label).toBe('발리')
    expect(resolveComparePlaceClusterFromHay('산동')).toBeNull()
    expect(resolveComparePlaceClusterFromHay('주고쿠-시코쿠')).toBeNull()
    expect(resolveComparePlaceClusterFromHay('스페인/포르투갈')).toBeNull()
    expect(resolveComparePlaceClusterFromHay('시마네')?.label).toBe('시마네')
    expect(resolveComparePlaceClusterFromHay('오키나와')?.label).toBe('오키나와')
  })

  it('prefers city leaf over country noise in product fields', () => {
    expect(
      resolveComparePlaceCluster({
        primaryDestination: '중국',
        destination: '청도',
        title: '칭다오 자유여행',
      })?.label,
    ).toBe('청도')
    expect(
      resolveComparePlaceCluster({
        primaryDestination: '부산 · 마츠야마',
        destination: null,
      })?.label,
    ).toBe('마츠야마')
  })

  // REGRESSION-FREEZE[similar-itinerary-compare-cluster]: 박일 정규화 — manifest
  it('normalizes duration spacing', () => {
    expect(normalizeCompareDurationLabel('3박5일')).toBe('3박 5일')
    expect(normalizeCompareDurationLabel('3박  4일')).toBe('3박 4일')
    expect(normalizeCompareDurationLabel('여행안내', '상해 자유 2박3일')).toBe('2박 3일')
  })

  // REGRESSION-FREEZE[similar-itinerary-compare-cluster]: 호주/뉴질랜드 LC — 도시 dest도 같은 leaf — manifest
  it('maps AU/NZ city destinations into 호주/뉴질랜드 leaf (not null)', () => {
    const au = resolveComparePlaceClusterFromHay('호주/뉴질랜드')
    expect(au?.label).toBe('호주/뉴질랜드')
    expect(resolveComparePlaceClusterFromHay('시드니')?.label).toBe('호주/뉴질랜드')
    expect(resolveComparePlaceClusterFromHay('멜버른')?.label).toBe('호주/뉴질랜드')
    expect(resolveComparePlaceClusterFromHay('케언즈 · 시드니')?.label).toBe('호주/뉴질랜드')
    expect(resolveComparePlaceClusterFromHay('오클랜드')?.label).toBe('호주/뉴질랜드')
    expect(resolveComparePlaceClusterFromHay('퀸스타운')?.label).toBe('호주/뉴질랜드')
    expect(
      comparePlaceClustersMatch(
        resolveComparePlaceClusterFromHay('시드니'),
        resolveComparePlaceClusterFromHay('뉴질랜드'),
      ),
    ).toBe(true)
    // 괌·사이판은 별 leaf
    expect(resolveComparePlaceClusterFromHay('괌')?.label).toBe('괌')
    expect(
      comparePlaceClustersMatch(
        resolveComparePlaceClusterFromHay('시드니'),
        resolveComparePlaceClusterFromHay('괌'),
      ),
    ).toBe(false)
  })

  // REGRESSION-FREEZE[similar-itinerary-compare-cluster]: DB는 leaf alias로 좁힘 — manifest
  it('exposes DB search terms for AU/NZ leaf (no full overseas scan)', () => {
    const au = resolveComparePlaceClusterFromHay('호주/뉴질랜드')
    const terms = comparePlaceDbSearchTerms(au)
    expect(terms).toContain('시드니')
    expect(terms).toContain('멜버른')
    expect(terms).toContain('뉴질랜드')
    expect(terms.length).toBeGreaterThan(5)
    expect(terms.length).toBeLessThanOrEqual(40)
  })

  // REGRESSION-FREEZE[mega-menu-dest-city-country-leaf]: 그룹 도시 1개라도 → 비교군 · ≥2 → similar — manifest
  it('미동부 그룹 — 도시 1개라도 겹치면 비교군, 2개 이상이면 유사', () => {
    const groupKeys = megaMenuGroupCityKeys('미동부')
    expect(groupKeys.length).toBeGreaterThanOrEqual(2)
    expect(productInMegaGroupComparePool(['nyc'], groupKeys)).toBe(true)
    expect(productInMegaGroupComparePool(['new-york'], groupKeys)).toBe(true)
    expect(productInMegaGroupComparePool(['niagara'], groupKeys)).toBe(false)
    // nyc+washington vs nyc+dc → 뉴욕·워싱턴 2개 겹침 (dc≡워싱턴)
    expect(megaMenuCityTagOverlapCount(['nyc', 'washington'], ['nyc', 'dc'])).toBe(2)
    expect(areSimilarByMegaCityTagOverlap(['nyc', 'washington'], ['nyc', 'washington', 'niagara'])).toBe(
      true,
    )
    expect(areSimilarByMegaCityTagOverlap(['nyc'], ['nyc', 'washington'])).toBe(false)
  })
})
