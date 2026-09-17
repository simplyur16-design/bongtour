import { describe, expect, it } from 'vitest'
import {
  inferOceanCruiseDestinationFromTitle,
  isOceanCruiseAtSeaRoute,
  isOceanCruiseProductTitle,
  isTruncatedCardinalRegionDestination,
} from '@/lib/register-ocean-cruise-product'

describe('register-ocean-cruise-product', () => {
  it('detects ship cruise titles and skips activity cruises', () => {
    // REGRESSION-FREEZE[register-ocean-cruise-product]
    expect(
      isOceanCruiseProductTitle(
        '서부지중해 크루즈 3개국(이탈리아/남프랑스/스페인) 11일 #코스타 토스카나 호',
      ),
    ).toBe(true)
    expect(isOceanCruiseProductTitle('알래스카 크루즈 7일')).toBe(true)
    expect(isOceanCruiseProductTitle('시드니 6일 #클리어뷰 디너크루즈')).toBe(false)
    expect(isOceanCruiseProductTitle('이집트 일주 #나일크루즈')).toBe(false)
  })

  it('infers destination from paren countries and western med region', () => {
    expect(
      inferOceanCruiseDestinationFromTitle(
        '서부지중해 크루즈 3개국(이탈리아/남프랑스/스페인) 11일 #코스타 토스카나 호',
      ),
    ).toBe('이탈리아 · 남프랑스 · 스페인')
    expect(inferOceanCruiseDestinationFromTitle('알래스카 크루즈 7일')).toBe('알래스카')
  })

  it('treats 전일해상 as at-sea even with trailing garbage segments', () => {
    expect(isOceanCruiseAtSeaRoute('전일해상')).toBe(true)
    expect(isOceanCruiseAtSeaRoute('전일해상 - 발도르...')).toBe(true)
    expect(isOceanCruiseAtSeaRoute('전일해상 · 발도르...')).toBe(true)
    expect(isOceanCruiseAtSeaRoute('바르셀로나 - 발도르...')).toBe(false)
  })

  it('flags truncated 서부/동부 destinations', () => {
    expect(isTruncatedCardinalRegionDestination('서부')).toBe(true)
    expect(isTruncatedCardinalRegionDestination('미서부')).toBe(false)
    expect(isTruncatedCardinalRegionDestination('서부지중해')).toBe(false)
  })
})
