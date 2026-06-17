import { describe, it, expect } from 'vitest'
import {
  buildPexelsKeyword,
  seasonKeywordsForMonth,
  seasonKeywordsForSeason,
} from '@/lib/bong-marketing/pexels-keyword-builder'

describe('seasonKeywordsForSeason', () => {
  it('summer', () => {
    expect(seasonKeywordsForSeason('summer')[0]).toBe('summer')
  })
  it('spring', () => {
    expect(seasonKeywordsForSeason('spring')[0]).toBe('spring')
  })
  it('all_year·null 은 빈 배열', () => {
    expect(seasonKeywordsForSeason('all_year')).toEqual([])
    expect(seasonKeywordsForSeason(null)).toEqual([])
  })
})

describe('seasonKeywordsForMonth', () => {
  it('8월은 summer 계열', () => {
    expect(seasonKeywordsForMonth(8)[0]).toBe('summer')
  })
  it('3월은 spring 계열', () => {
    expect(seasonKeywordsForMonth(3)[0]).toBe('spring')
  })
  it('범위 밖은 빈 배열', () => {
    expect(seasonKeywordsForMonth(0)).toEqual([])
    expect(seasonKeywordsForMonth(13)).toEqual([])
  })
})

describe('buildPexelsKeyword', () => {
  it('도시+명소+시즌을 조합한다', () => {
    expect(buildPexelsKeyword('울란바토르', '테를지', 'summer')).toBe('울란바토르 테를지 summer')
  })
  it('명소가 없으면 도시+시즌', () => {
    expect(buildPexelsKeyword('울란바토르', null, 'spring')).toBe('울란바토르 spring')
  })
  it('mode(분위기)를 덧붙인다', () => {
    expect(buildPexelsKeyword('파리', '에펠탑', 'autumn', 'sunset')).toBe('파리 에펠탑 autumn sunset')
  })
  it('공백·빈 값은 무시한다', () => {
    expect(buildPexelsKeyword('  ', '  ', 'summer')).toBe('summer')
  })
  it('시즌 null 이면 계절 키워드 제외', () => {
    expect(buildPexelsKeyword('도쿄', null, null)).toBe('도쿄')
  })
})
