import { describe, expect, it, vi } from 'vitest'
import { detectMultiCountryAutoPlan } from '@/lib/normalize-product-geo-master'

function mockDb(countries: Array<{ countryKey: string; koreanLabel: string }>) {
  return {
    country: {
      findMany: vi.fn().mockResolvedValue(
        countries.map((c) => ({ ...c, isActive: true })),
      ),
    },
    city: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  }
}

describe('detectMultiCountryAutoPlan', () => {
  it('returns medium multi without N국 when tree tokens find 2+ countries', async () => {
    const db = mockDb([
      { countryKey: 'czech', koreanLabel: '체코' },
      { countryKey: 'hungary', koreanLabel: '헝가리' },
      { countryKey: 'austria', koreanLabel: '오스트리아' },
    ])
    const plan = await detectMultiCountryAutoPlan(
      db as never,
      {
        title: '프라하/비엔나/부다페스트 9일',
        primaryDestination: '부다페스트',
        destinationRaw: null,
      },
      'hungary',
    )
    expect(plan.kind).toBe('multi')
    if (plan.kind === 'multi') {
      expect(plan.confidence).toBe('medium')
      expect(plan.countryKeys).toContain('czech')
      expect(plan.countryKeys).toContain('hungary')
      expect(plan.countryKeys).toContain('austria')
    }
  })

  it('returns high when N국 matches found count', async () => {
    const db = mockDb([
      { countryKey: 'georgia', koreanLabel: '조지아' },
      { countryKey: 'azerbaijan', koreanLabel: '아제르바이잔' },
      { countryKey: 'armenia', koreanLabel: '아르메니아' },
    ])
    const plan = await detectMultiCountryAutoPlan(
      db as never,
      {
        title: '코카서스 3국 12일',
        primaryDestination: '조지아, 아제르바이잔, 아르메니아',
        destinationRaw: null,
      },
      'azerbaijan',
    )
    expect(plan.kind).toBe('multi')
    if (plan.kind === 'multi') {
      expect(plan.confidence).toBe('high')
      expect(plan.countryKeys.length).toBe(3)
    }
  })

  it('returns none for single country haystack', async () => {
    const db = mockDb([{ countryKey: 'japan', koreanLabel: '일본' }])
    const plan = await detectMultiCountryAutoPlan(
      db as never,
      {
        title: '도쿄 4일',
        primaryDestination: '도쿄',
        destinationRaw: null,
      },
      'japan',
    )
    expect(plan.kind).toBe('none')
  })
})
