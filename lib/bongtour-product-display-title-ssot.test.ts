import { describe, expect, it } from 'vitest'
import {
  composeBongtourHeroDisplayTitle,
  composeHeroDayToken,
} from '@/lib/bongtour-product-display-title-ssot'

// REGRESSION-FREEZE[bongtour-product-display-title-ssot]: heroShortTitle 계약 — manifest

describe('composeHeroDayToken', () => {
  it('N박 M일 → M일', () => {
    expect(composeHeroDayToken('3박 4일')).toBe('4일')
    expect(composeHeroDayToken('7박8일')).toBe('8일')
  })
  it('totalDays 폴백', () => {
    expect(composeHeroDayToken(null, 5)).toBe('5일')
  })
})

describe('composeBongtourHeroDisplayTitle', () => {
  it('브랜드 도시 + 단일국 → 도시 short + 국가 subtitle', () => {
    const r = composeBongtourHeroDisplayTitle({
      duration: '4박 5일',
      countryLabel: '베트남',
      cities: ['다낭', '호이안'],
    })
    expect(r.heroShortTitle).toBe('다낭 5일')
    expect(r.heroSubtitle).toBe('베트남')
    expect(r.placeKind).toBe('city')
  })

  it('단일국·비브랜드 도시 → 국가 short + 도시 subtitle', () => {
    const r = composeBongtourHeroDisplayTitle({
      duration: '2박 3일',
      countryLabel: '일본',
      cities: ['가나자와', '다카야마'],
    })
    expect(r.heroShortTitle).toBe('일본 3일')
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
    expect(r.heroShortTitle).toBe('동유럽 10일')
    expect(r.placeKind).toBe('region')
  })

  it('테마 화이트리스트 — 나라+테마+일수', () => {
    const r = composeBongtourHeroDisplayTitle({
      duration: '6박 7일',
      countryLabel: '아이슬란드',
      haystack: '아이슬란드 오로라 버스투어',
      cities: ['레이캬비크'],
    })
    expect(r.heroShortTitle).toBe('아이슬란드 오로라 7일')
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
    expect(r.heroShortTitle).toBe('다낭 4일')
    expect(r.heroSubtitle).not.toMatch(/프리미엄/)
  })
})
