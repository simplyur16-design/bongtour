import { describe, expect, it, vi, beforeEach } from 'vitest'
import { detectMultiCountryAutoPlan } from '@/lib/normalize-product-geo-master'
import { resetMegaMenuSsotCityKeysCache } from '@/lib/mega-menu-ssot-city-keys'

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
    megaMenuGroupCardCity: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  }
}

describe('detectMultiCountryAutoPlan', () => {
  beforeEach(() => {
    resetMegaMenuSsotCityKeysCache()
  })

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

  // REGRESSION-FREEZE[santiago-compostela-not-chile]
  it('does not add chile for Santiago de Compostela pilgrimage', async () => {
    const db = mockDb([
      { countryKey: 'spain', koreanLabel: '스페인' },
      { countryKey: 'portugal', koreanLabel: '포르투갈' },
      { countryKey: 'chile', koreanLabel: '칠레' },
    ])
    const plan = await detectMultiCountryAutoPlan(
      db as never,
      {
        title: '산티아고 순례길+포르투갈 16일 #포르투갈관광',
        primaryDestination: '스페인, 포르투갈',
        destinationRaw: '스페인, 포르투갈',
      },
      'spain',
    )
    expect(plan.kind).toBe('multi')
    if (plan.kind === 'multi') {
      expect(plan.countryKeys).not.toContain('chile')
      expect(plan.countryKeys).toContain('spain')
      expect(plan.countryKeys).toContain('portugal')
    }
  })

  // REGRESSION-FREEZE[mega-menu-product-alignment]
  it('prefers title/dest countries over schedule transit US hub', async () => {
    const db = mockDb([
      { countryKey: 'argentina', koreanLabel: '아르헨티나' },
      { countryKey: 'chile', koreanLabel: '칠레' },
      { countryKey: 'peru', koreanLabel: '페루' },
      { countryKey: 'united-states', koreanLabel: '미국' },
    ])
    const plan = await detectMultiCountryAutoPlan(
      db as never,
      {
        title: '아르헨티나·칠레 12일 #파타고니아',
        primaryDestination: '아르헨티나, 칠레',
        destinationRaw: '아르헨티나, 칠레',
        scheduleHaystack:
          '인천에서 로스앤젤레스로 출발 로스앤젤레스를 거쳐 리마로 이동 부에노스아이레스',
      },
      null,
    )
    expect(plan.kind).toBe('multi')
    if (plan.kind === 'multi') {
      expect(plan.confidence).toMatch(/high|medium/)
      expect(plan.countryKeys).toEqual(expect.arrayContaining(['argentina', 'chile']))
      expect(plan.countryKeys).not.toContain('united-states')
      expect(plan.countryKeys).not.toContain('peru')
    }
  })

  // REGRESSION-FREEZE[mega-menu-product-alignment]
  it('null primary + 4개국 place hints → high multi', async () => {
    const db = mockDb([
      { countryKey: 'peru', koreanLabel: '페루' },
      { countryKey: 'bolivia', koreanLabel: '볼리비아' },
      { countryKey: 'brazil', koreanLabel: '브라질' },
      { countryKey: 'argentina', koreanLabel: '아르헨티나' },
    ])
    const plan = await detectMultiCountryAutoPlan(
      db as never,
      {
        title: '남미 12일 #4개국 #우유니 #이과수',
        primaryDestination: '남미',
        destinationRaw: '남미',
        scheduleHaystack: '리마 쿠스코 라파즈 우유니 리오데자네이로 이과수 부에노스아이레스',
      },
      null,
    )
    expect(plan.kind).toBe('multi')
    if (plan.kind === 'multi') {
      expect(plan.confidence).toBe('high')
      expect(plan.countryKeys).toEqual(
        expect.arrayContaining(['peru', 'bolivia', 'brazil', 'argentina']),
      )
      expect(plan.countryKeys).toHaveLength(4)
    }
  })

  it('returns medium multi when primary is caucasus tree cluster', async () => {
    const db = mockDb([
      { countryKey: 'georgia', koreanLabel: '조지아' },
      { countryKey: 'azerbaijan', koreanLabel: '아제르바이잔' },
      { countryKey: 'armenia', koreanLabel: '아르메니아' },
    ])
    const plan = await detectMultiCountryAutoPlan(
      db as never,
      {
        title: '코카서스 3국 12일',
        primaryDestination: '코카서스',
        destinationRaw: null,
      },
      'caucasus',
    )
    expect(plan.kind).toBe('multi')
    if (plan.kind === 'multi') {
      expect(plan.confidence).not.toBe('low')
      expect(plan.countryKeys).toEqual(
        expect.arrayContaining(['georgia', 'azerbaijan', 'armenia']),
      )
      expect(plan.countryKeys).toHaveLength(3)
    }
  })

  it('returns medium multi when primary is balkans tree cluster', async () => {
    const db = mockDb([
      { countryKey: 'austria', koreanLabel: '오스트리아' },
      { countryKey: 'czech', koreanLabel: '체코' },
      { countryKey: 'hungary', koreanLabel: '헝가리' },
      { countryKey: 'croatia', koreanLabel: '크로아티아' },
      { countryKey: 'slovenia', koreanLabel: '슬로베니아' },
    ])
    const plan = await detectMultiCountryAutoPlan(
      db as never,
      {
        title: '동유럽+발칸 5개국 9일',
        primaryDestination: '발칸',
        destinationRaw: null,
        scheduleHaystack: '비엔나 프라하 부다페스트 자그레브 류블랴나',
      },
      'balkans',
    )
    expect(plan.kind).toBe('multi')
    if (plan.kind === 'multi') {
      expect(plan.confidence).not.toBe('low')
      expect(plan.countryKeys).toEqual(
        expect.arrayContaining(['austria', 'czech', 'hungary', 'croatia', 'slovenia']),
      )
    }
  })
})
