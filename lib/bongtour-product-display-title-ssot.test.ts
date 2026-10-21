import { describe, expect, it } from 'vitest'
import {
  composeBongtourHeroDisplayTitle,
  composeHeroDayToken,
  durationHintFromTitle,
  resolvePublicBrowseCardTitle,
  sanitizePlaceLabel,
} from '@/lib/bongtour-product-display-title-ssot'

// REGRESSION-FREEZE[bongtour-ocean-warm-design-l0]: heroShortTitle 계약 — manifest

describe('composeHeroDayToken', () => {
  it('N박 M일 → N박 M일', () => {
    expect(composeHeroDayToken('3박 4일')).toBe('3박 4일')
    expect(composeHeroDayToken('7박8일')).toBe('7박 8일')
  })
  it('totalDays 폴백 → (n-1)박 n일', () => {
    expect(composeHeroDayToken(null, 5)).toBe('4박 5일')
  })
})

describe('composeBongtourHeroDisplayTitle', () => {
  it('브랜드 도시 + 단일국 → 도시 short + 국가 subtitle', () => {
    const r = composeBongtourHeroDisplayTitle({
      duration: '4박 5일',
      countryLabel: '베트남',
      cities: ['다낭', '호이안'],
    })
    expect(r.heroShortTitle).toBe('다낭 4박 5일')
    expect(r.heroSubtitle).toBe('베트남')
    expect(r.placeKind).toBe('city')
  })

  it('단일국·비브랜드 도시 → 국가 short + 도시 subtitle', () => {
    const r = composeBongtourHeroDisplayTitle({
      duration: '2박 3일',
      countryLabel: '일본',
      cities: ['가나자와', '다카야마'],
    })
    expect(r.heroShortTitle).toBe('일본 2박 3일')
    expect(r.heroSubtitle).toBe('가나자와 · 다카야마')
    expect(r.placeKind).toBe('country')
  })

  it('다국가 권역', () => {
    const r = composeBongtourHeroDisplayTitle({
      duration: '8박 10일',
      multiCountry: true,
      regionLabel: '동유럽',
      cities: ['프라하', '부다페스트', '빈'],
      countryLabel: null,
    })
    expect(r.heroShortTitle).toBe('동유럽 8박 10일')
    expect(r.placeKind).toBe('region')
  })

  it('테마 화이트리스트 — 나라+테마+일수', () => {
    const r = composeBongtourHeroDisplayTitle({
      duration: '6박 7일',
      countryLabel: '아이슬란드',
      haystack: '아이슬란드 오로라 버스투어',
      cities: ['레이캬비크'],
    })
    expect(r.heroShortTitle).toBe('아이슬란드 오로라 6박 7일')
    expect(r.placeKind).toBe('theme')
  })

  it('일수 없으면 short null (UI title 폴백)', () => {
    const r = composeBongtourHeroDisplayTitle({
      countryLabel: '태국',
      cities: ['방콕'],
    })
    expect(r.heroShortTitle).toBeNull()
    expect(r.dayToken).toBeNull()
  })

  it('금칙 토큰 제거', () => {
    const r = composeBongtourHeroDisplayTitle({
      duration: '3박 4일',
      countryLabel: '프리미엄 베트남',
      cities: ['다낭'],
    })
    expect(r.heroShortTitle).toBe('다낭 3박 4일')
    expect(r.heroSubtitle).not.toMatch(/프리미엄/)
  })
})

describe('sanitizePlaceLabel / durationHintFromTitle', () => {
  it('반쪽 괄호·괄호 안 도시 목록 제거', () => {
    expect(sanitizePlaceLabel('규슈 (후쿠오카')).toBe('규슈')
    expect(sanitizePlaceLabel('규슈 (후쿠오카, 벳푸, 유후인, 히타)')).toBe('규슈')
  })
  it('원제목에서 일수 힌트', () => {
    expect(durationHintFromTitle('뉴질랜드 남/북섬 9일 #온천')).toBe('9일')
    expect(durationHintFromTitle('이탈리아 일주 11일')).toBe('11일')
  })
})

// REGRESSION-FREEZE[public-card-hero-short-title]: 카드 제목 배선 — manifest
describe('resolvePublicBrowseCardTitle', () => {
  it('긴 해시태그 원문 대신 목적지+N박M일 카드 제목', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title:
          'NO유류 차액! 출발가능 이탈리아 일주 11일 [낯설어 아름답다] #대한항공 #4성급호텔 #남부3DAYS',
        duration: '9박 11일',
        primaryDestination: '로마 · 피렌체 · 베네치아',
        primaryRegion: '유럽',
      },
      'NO유류 차액! 출발가능 이탈리아 일주 11일 [낯설어 아름답다]',
    )
    expect(r.usedHeroShort).toBe(true)
    expect(r.cardTitle).toMatch(/\d+박\s*\d+일$/)
    expect(r.cardTitle.length).toBeLessThan(40)
    expect(r.cardTitle).not.toMatch(/#대한항공|NO유류/)
  })

  it('브랜드 도시 방콕 — 짧은 카드 제목', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '방콕/파타야 3박 5일 #첫여행추천 #5성호텔',
        duration: '3박 5일',
        primaryDestination: '방콕 · 파타야',
      },
      '방콕/파타야 3박 5일 #첫여행추천 #5성호텔',
    )
    expect(r.cardTitle).toBe('방콕 3박 5일')
    expect(r.usedHeroShort).toBe(true)
  })

  it('일수 없으면 Plan B 폴백', () => {
    const fb = '태국 자유여행 특가 모음'
    const r = resolvePublicBrowseCardTitle(
      {
        title: fb,
        primaryDestination: '방콕',
      },
      fb,
    )
    expect(r.usedHeroShort).toBe(false)
    expect(r.cardTitle).toBe(fb)
  })

  it('목적지 괄호 조각 → 규슈 N박 M일 (반쪽 괄호 금지)', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '규슈 4일 #온천의 진수 #완벽한 동선',
        duration: '3박 4일',
        primaryDestination: '규슈 (후쿠오카, 벳푸, 유후인, 히타)',
      },
      '규슈 4일 #온천의 진수',
    )
    expect(r.usedHeroShort).toBe(true)
    expect(r.cardTitle).toBe('규슈 3박 4일')
    expect(r.cardTitle).not.toMatch(/[（(）)]/)
  })

  it('duration 비어도 제목 일수로 short', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '뉴질랜드 남/북섬 9일 #자연그대로 #온천 #밀포드사운드',
        primaryRegion: '뉴질랜드',
      },
      '뉴질랜드 남/북섬 9일 #자연그대로 #온천 #밀포드사운드',
    )
    expect(r.usedHeroShort).toBe(true)
    expect(r.cardTitle).toMatch(/^뉴질랜드 \d+박 9일$/)
    expect(r.cardTitle).not.toMatch(/#/)
  })
})
