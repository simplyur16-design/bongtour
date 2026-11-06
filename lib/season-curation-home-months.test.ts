import { describe, expect, it } from 'vitest'
import {
  HOME_SEASON_LINKED_PRODUCT_MONTH_OFFSETS,
  HOME_SEASON_SLIDE_MONTH_OFFSETS,
  homeSeasonMonthKeysFromBase,
  shiftSeoulYearMonth,
} from '@/lib/season-curation-content'

describe('home season month key SSOT', () => {
  it('includes current KST month and next three for slides', () => {
    expect(homeSeasonMonthKeysFromBase('2026-11', HOME_SEASON_SLIDE_MONTH_OFFSETS)).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ])
  })

  it('linked product months keep current + next two (existing future coverage)', () => {
    expect(homeSeasonMonthKeysFromBase('2026-11', HOME_SEASON_LINKED_PRODUCT_MONTH_OFFSETS)).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
    ])
  })

  it('crosses year boundary from December', () => {
    expect(homeSeasonMonthKeysFromBase('2026-12', HOME_SEASON_SLIDE_MONTH_OFFSETS)).toEqual([
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
    ])
  })

  it('shiftSeoulYearMonth handles negative and year wrap', () => {
    expect(shiftSeoulYearMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftSeoulYearMonth('2026-11', 0)).toBe('2026-11')
    expect(shiftSeoulYearMonth('2026-11', 3)).toBe('2027-02')
  })

  it('dedupes repeated offsets without dropping order of first occurrence', () => {
    expect(homeSeasonMonthKeysFromBase('2026-11', [0, 1, 0, 2])).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
    ])
  })

  it('empty offsets yields empty list (loader-safe)', () => {
    expect(homeSeasonMonthKeysFromBase('2026-11', [])).toEqual([])
  })
})
