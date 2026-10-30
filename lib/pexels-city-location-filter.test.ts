import { describe, expect, it } from 'vitest'
import {
  cityLocationVerdict,
  englishCityTerms,
  filterCandidatesByCity,
  pageUrlSlugWords,
} from '@/lib/pexels-city-location-filter'

const sydney = englishCityTerms(['시드니'])

describe('pexels-city-location-filter (10/30 review-01 반려 후속)', () => {
  it('maps Korean city to English terms (tree + supplementary)', () => {
    expect(sydney).toContain('sydney')
    expect(englishCityTerms(['프라하, 비엔나'])).toEqual(expect.arrayContaining(['prague', 'vienna']))
    expect(englishCityTerms(['다낭'])).toEqual(expect.arrayContaining(['danang', 'da nang']))
    expect(englishCityTerms(['bangkok'])).toContain('bangkok')
    // 다도시 leaf 별칭(나가사키)이 구마모토 상품에 섞이지 않음
    expect(englishCityTerms(['구마모토'])).not.toContain('nagasaki')
  })
  it('reads Pexels page slug words', () => {
    expect(pageUrlSlugWords('https://www.pexels.com/photo/majestic-view-of-belvedere-palace-with-fountain-36934590/')).toBe(
      'majestic view of belvedere palace with fountain'
    )
    expect(pageUrlSlugWords('https://www.pexels.com/photo/36934590/')).toBe('')
  })
  it('wrong city (Melbourne for Sydney) is CITY_MISMATCH', () => {
    expect(cityLocationVerdict({ alt: 'Melbourne skyline at dusk', pageUrl: null }, sydney).verdict).toBe('CITY_MISMATCH')
  })
  it('no location info is NO_LOCATION', () => {
    expect(cityLocationVerdict({ alt: '', pageUrl: 'https://www.pexels.com/photo/12345/' }, sydney).verdict).toBe('NO_LOCATION')
  })
  it('generic alt without the city is CITY_MISMATCH (tower in park)', () => {
    expect(cityLocationVerdict({ alt: 'A tower in a park', pageUrl: null }, sydney).verdict).toBe('CITY_MISMATCH')
  })
  it('hotel / signage / people are EXCLUDED_SUBJECT even in the right city', () => {
    const hcm = englishCityTerms(['호치민'])
    expect(cityLocationVerdict({ alt: 'Two women walking past VinMart sign in Ho Chi Minh City' }, hcm).verdict).toBe('EXCLUDED_SUBJECT')
    expect(cityLocationVerdict({ alt: 'Best Western hotel facade in Saigon' }, hcm).verdict).toBe('EXCLUDED_SUBJECT')
    expect(cityLocationVerdict({ alt: 'Bitexco tower Ho Chi Minh City skyline' }, hcm).verdict).toBe('OK')
    expect(cityLocationVerdict({ alt: 'Infinity pool with Bangkok skyline' }, ['bangkok']).verdict).toBe('EXCLUDED_SUBJECT')
    expect(cityLocationVerdict({ alt: 'Sea turtles and divers in Saipan' }, ['saipan']).verdict).toBe('EXCLUDED_SUBJECT')
  })
  it('city match from slug or landmark term', () => {
    expect(cityLocationVerdict({ alt: 'Opera house aerial', pageUrl: 'https://www.pexels.com/photo/sydney-opera-house-aerial-1/' }, sydney).verdict).toBe('OK')
    expect(cityLocationVerdict({ alt: 'Ba Na Hills golden bridge' }, ['nha trang'], ['ba na hills']).matched).toBe('ba na hills')
  })
  it('word boundary: "romantic" does not match rome; "bangkokian" does not match bangkok', () => {
    expect(cityLocationVerdict({ alt: 'romantic sunset' }, ['rome']).verdict).toBe('CITY_MISMATCH')
    expect(cityLocationVerdict({ alt: 'mandalay hill' }, ['manila']).verdict).toBe('CITY_MISMATCH')
  })
  it('filterCandidatesByCity keeps order and only OK', () => {
    const r = filterCandidatesByCity(
      [{ alt: 'Melbourne' }, { alt: 'Sydney Harbour Bridge' }, { alt: 'Sydney hotel' }, { alt: 'Bondi Beach Sydney' }],
      sydney
    )
    expect(r.map((x) => x.alt)).toEqual(['Sydney Harbour Bridge', 'Bondi Beach Sydney'])
  })
})
