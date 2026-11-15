import { describe, expect, it } from 'vitest'
import {
  buildExistingRegionIndex,
  canonicalPlace,
  classifyHanjintourListing,
  hanjintourDetailCollectAllowed,
  placesInText,
  splitPlaceLabel,
} from './hanjintour-region-filter'

const existing = buildExistingRegionIndex(
  [
    { originSource: 'hanatour', city_tags: ['다낭'], country_tags: ['베트남'], title: '다낭/호이안 5일' },
    { originSource: 'modetour', primaryDestination: '칭다오', country_tags: ['중국'], title: '청도 4일' },
    { originSource: 'ybtour', destinationRaw: '북해도', title: '홋카이도 삿포로 4일' },
    { originSource: 'verygoodtour', country_tags: ['뉴질랜드'], title: '뉴질랜드 남북섬 10일' },
    { originSource: 'kyowontour', city_keys: ['tbs'], title: '코카서스 3국 9일' },
    { originSource: 'windsor', title: '아르메니아 예레반 8일' },
  ],
  [{ cityKey: 'tbs', koreanLabel: '트빌리시' }],
)

describe('place normalization', () => {
  it('maps spelling variants to one place', () => {
    expect(canonicalPlace('청도')?.canonical).toBe('칭다오')
    expect(canonicalPlace('북해도')?.canonical).toBe('홋카이도')
    expect(canonicalPlace('튀르키예')?.canonical).toBe('터키')
    expect(canonicalPlace('라스베가스')?.canonical).toBe('라스베이거스')
  })
  it('splits slash and bracket labels', () => {
    expect(splitPlaceLabel('홋카이도(북해도)')).toEqual(['홋카이도', '북해도'])
    expect(splitPlaceLabel('청도/연태/대련')).toEqual(['청도', '연태', '대련'])
  })
  it('longest name wins in titles (인도네시아 is not 인도)', () => {
    expect(placesInText('인도네시아 발리 5일').map((p) => p.canonical)).toEqual(['인도네시아', '발리'])
  })
})

describe('classifyHanjintourListing', () => {
  it('selects when a core city in the title is missing from the 7 suppliers', () => {
    const r = classifyHanjintourListing(
      { gdsNo: 'A', title: '청도/연태/대련 5일', categoryPaths: [['중국/홍콩/대만/몽골', '중국', '청도/연태/대련']] },
      existing,
    )
    expect(r.decision).toBe('선정')
    expect(r.newPlaces).toEqual(['옌타이', '다롄'])
    expect(r.existingPlaces.map((p) => p.place)).toContain('칭다오')
    expect(hanjintourDetailCollectAllowed(r)).toBe(true)
  })

  it('a menu group label is not a visited city (청도 only tour stays excluded)', () => {
    const r = classifyHanjintourListing(
      { gdsNo: 'A2', title: '청도 4일 #맥주박물관', categoryPaths: [['중국/홍콩/대만/몽골', '중국', '청도/연태/대련']] },
      existing,
    )
    expect(r.decision).toBe('제외')
    expect(r.newPlaces).toEqual([])
  })

  it('group label only, with unknown members → 판단보류', () => {
    const r = classifyHanjintourListing(
      { gdsNo: 'A3', title: '특가 4일', categoryPaths: [['중국/홍콩/대만/몽골', '중국', '청도/연태/대련']] },
      existing,
    )
    expect(r.decision).toBe('판단보류')
    expect(r.basis).toContain('옌타이')
  })

  it('excludes when every core city already exists (no detail call)', () => {
    const r = classifyHanjintourListing(
      { gdsNo: 'B', title: '북해도 삿포로 4일', categoryPaths: [['일본', '홋카이도(북해도)', '삿포로']] },
      existing,
    )
    expect(r.decision).toBe('제외')
    expect(r.basis).toContain('삿포로(ybtour)')
    expect(hanjintourDetailCollectAllowed(r)).toBe(false)
  })

  it('country-only: new country selected, existing country excluded at country level', () => {
    expect(
      classifyHanjintourListing({ gdsNo: 'C', title: '피지 6일', categoryPaths: [['괌/남태평양', '피지']] }, existing).decision,
    ).toBe('선정')
    const nz = classifyHanjintourListing({ gdsNo: 'D', title: '남북섬 일주 10일', categoryPaths: [['괌/남태평양', '뉴질랜드']] }, existing)
    expect(nz.decision).toBe('제외')
    expect(nz.basis).toContain('국가 단위')
    expect(hanjintourDetailCollectAllowed(nz)).toBe(false)
  })

  it('domestic hotel packages are held, never selected', () => {
    const r = classifyHanjintourListing({ gdsNo: 'H', title: '그랜드 호텔 1박', categoryPaths: [['호캉스', '제주']] }, existing)
    expect(r.decision).toBe('판단보류')
    expect(r.basis).toContain('국내')
  })

  it('non-place leaf (전일관광) falls back to the parent place', () => {
    const r = classifyHanjintourListing(
      { gdsNo: 'E', title: '[특가] 전일관광 6일', categoryPaths: [['하와이/미국/캐나다/중남미', '하와이', '전일관광']] },
      buildExistingRegionIndex([]),
    )
    expect(r.decision).toBe('선정')
    expect(r.newPlaces).toEqual(['하와이'])
  })

  it('suppliers outside the 7 do not count as existing', () => {
    const r = classifyHanjintourListing(
      { gdsNo: 'F', title: '조지아/아르메니아 9일 #트빌리시 #예레반', categoryPaths: [['유럽/아프리카/중동', '코카서스/중앙아시아', '아르메니아']] },
      existing,
    )
    expect(r.decision).toBe('선정')
    expect(r.newPlaces).toEqual(['예레반'])
  })

  it('nothing recognizable → 판단보류', () => {
    const r = classifyHanjintourListing({ gdsNo: 'G', title: '2027 챔피언십 관람', categoryPaths: [[' 골프', '골프대회 참관', '2027 챔피언십']] }, existing)
    expect(r.decision).toBe('판단보류')
  })
})
