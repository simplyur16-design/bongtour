import { describe, expect, it } from 'vitest'
import { applyNaeiltourScheduleImageKeywordsToRows } from '@/lib/naeiltour-schedule-image-keyword'
import { enforceRegisterScheduleTripUniqueImageKeywords } from '@/lib/register-schedule-trip-image-keyword-dedupe'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { firstMatchingScheduleSpotEn, firstMatchingScheduleCityEn } from '@/lib/schedule-poi-regex-ssot'

// REGRESSION-FREEZE[naeiltour-mykonos-kw-no-repeat]: 2EZZ8308 Mykonos windmills 다일 반복 금지 — manifest

const ROWS_2EZZ8308 = [
  { day: 1, title: '이스탄불 · 아테네', routeText: '이스탄불 - 아테네', description: '', imageKeyword: '', imageKeyword2: null },
  { day: 2, title: '아테네 · 산토리니', routeText: '아테네 - 산토리니', description: '', imageKeyword: '', imageKeyword2: null },
  { day: 3, title: '산토리니', routeText: '산토리니 - 아테네', description: '', imageKeyword: '', imageKeyword2: null },
  { day: 4, title: '산토리니 · 미코노스', routeText: '산토리니 - 미코노스', description: '', imageKeyword: '', imageKeyword2: null },
  { day: 5, title: '미코노스', routeText: '미코노스 - 아테네', description: '', imageKeyword: '', imageKeyword2: null },
  { day: 6, title: '미코노스 · 아테네', routeText: '미코노스 - 아테네', description: '', imageKeyword: '', imageKeyword2: null },
  { day: 7, title: '아테네', routeText: '아테네 - 미코노스', description: '', imageKeyword: '', imageKeyword2: null },
  { day: 8, title: '아테네', routeText: '아테네 - 미코노스', description: '', imageKeyword: '', imageKeyword2: null },
  { day: 9, title: '', routeText: '이스탄불', description: '', imageKeyword: '', imageKeyword2: null },
]

describe('naeiltour-mykonos-kw-no-repeat', () => {
  it('bare 미코노스 is city Mykonos, not windmills', () => {
    expect(firstMatchingScheduleSpotEn('미코노스')).toBeNull()
    expect(firstMatchingScheduleCityEn('미코노스')).toBe('Mykonos')
    expect(firstMatchingScheduleSpotEn('미코노스 풍차')).toMatch(/windmills/i)
  })

  it('2EZZ8308 schedule does not repeat Mykonos Windmills across middle days', () => {
    const applied = applyRegisterScheduleImageKeywordsBySupplier(ROWS_2EZZ8308 as any, {
      supplierKey: 'naeiltour',
      productTitle: '아테네 | 산토리니 | 미코노스',
      productDestination: '아테네 | 산토리니 | 미코노스',
    })
    const out = enforceRegisterScheduleTripUniqueImageKeywords(applied as any)
    const windmillDays = out
      .filter((r) => /windmills/i.test(String(r.imageKeyword ?? '')) || /windmills/i.test(String(r.imageKeyword2 ?? '')))
      .map((r) => Number(r.day))
    expect(windmillDays.length).toBeLessThanOrEqual(1)

    const midMykonosBare: number[] = []
    const mykonosAreaKeys = new Set<string>()
    for (const r of out) {
      const day = Number(r.day)
      for (const slot of [r.imageKeyword, r.imageKeyword2]) {
        const raw = String(slot ?? '').trim()
        if (!raw) continue
        const kw = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (/mykonos|delosisland|littlevenice|paradisebeach/.test(kw)) {
          mykonosAreaKeys.add(kw)
        }
        if (day > 1 && day < 9 && /^mykonos$/.test(kw)) midMykonosBare.push(day)
      }
    }
    // bare Mykonos middle 반복 금지 — soft-alt pool로 분산
    expect(midMykonosBare.length).toBeLessThanOrEqual(1)
    expect(mykonosAreaKeys.size).toBeGreaterThanOrEqual(2)

    const mykonosPrimary = out
      .filter((r) => Number(r.day) >= 4 && Number(r.day) <= 8)
      .map((r) => String(r.imageKeyword ?? '').trim())
      .filter(Boolean)
    expect(new Set(mykonosPrimary.map((k) => k.toLowerCase())).size).toBeGreaterThanOrEqual(2)

    // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: Mykonos day ≠ Anitkabir/Cappadocia bleed — manifest
    for (const r of out) {
      const day = Number(r.day)
      if (day < 4 || day > 8) continue
      for (const slot of [r.imageKeyword, r.imageKeyword2]) {
        const raw = String(slot ?? '')
        expect(raw).not.toMatch(/Anitkabir|Cappadocia|Pamukkale|Blue Mosque|Hagia Sophia/i)
      }
    }
  })

  it('applyNaeiltour alone does not stamp windmills on every Mykonos day', () => {
    const out = applyNaeiltourScheduleImageKeywordsToRows(ROWS_2EZZ8308 as any, {
      productDestination: '아테네 | 산토리니 | 미코노스',
    })
    const windmills = out.filter((r) => /windmills/i.test(String(r.imageKeyword ?? '')))
    expect(windmills.length).toBeLessThanOrEqual(1)
  })
})
