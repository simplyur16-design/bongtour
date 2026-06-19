import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  getCurationCountries,
  parseCurationEventTargetMode,
  parseTargetCountriesInput,
  resolveCurationEventTargetCountries,
  resolveCountryLabelsToKorean,
} from '@/lib/bong-marketing/curation-event-target-countries'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    monthlyCurationContent: { findMany: vi.fn() },
    seasonalDestinationCuration: { findFirst: vi.fn() },
    city: { findMany: vi.fn() },
    country: { findMany: vi.fn() },
    product: { groupBy: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'

describe('parseCurationEventTargetMode', () => {
  it('accepts valid modes', () => {
    expect(parseCurationEventTargetMode('union')).toBe('union')
    expect(parseCurationEventTargetMode('recommendation')).toBe('recommendation')
  })

  it('rejects invalid modes', () => {
    expect(parseCurationEventTargetMode('invalid')).toBeUndefined()
  })
})

describe('parseTargetCountriesInput', () => {
  it('parses string array', () => {
    expect(parseTargetCountriesInput(['일본', '베트남'])).toEqual(['일본', '베트남'])
  })
})

describe('resolveCountryLabelsToKorean', () => {
  beforeEach(() => {
    vi.mocked(prisma.country.findMany).mockResolvedValue([
      { countryKey: 'japan', koreanLabel: '일본' },
      { countryKey: 'vietnam', koreanLabel: '베트남' },
    ] as never)
  })

  it('maps slug to korean label', async () => {
    const labels = await resolveCountryLabelsToKorean(['japan', '베트남'])
    expect(labels).toContain('일본')
    expect(labels).toContain('베트남')
  })
})

describe('getCurationCountries', () => {
  beforeEach(() => {
    vi.mocked(prisma.monthlyCurationContent.findMany).mockReset()
    vi.mocked(prisma.seasonalDestinationCuration.findFirst).mockReset()
    vi.mocked(prisma.city.findMany).mockReset()
    vi.mocked(prisma.country.findMany).mockReset()
    vi.mocked(prisma.country.findMany).mockResolvedValue([
      { countryKey: 'vietnam', koreanLabel: '베트남' },
      { countryKey: 'france', koreanLabel: '프랑스' },
    ] as never)
  })

  it('unions monthly published and seasonal cycle countries', async () => {
    vi.mocked(prisma.monthlyCurationContent.findMany).mockResolvedValue([
      { countryCode: '베트남' },
      { countryCode: 'france' },
    ] as never)
    vi.mocked(prisma.seasonalDestinationCuration.findFirst).mockResolvedValue({
      cityKeys: ['danang'],
      fallbackKeys: [],
    } as never)
    vi.mocked(prisma.city.findMany).mockResolvedValue([
      {
        cityKey: 'danang',
        country: { koreanLabel: '베트남' },
      },
    ] as never)

    const countries = await getCurationCountries()
    expect(countries).toContain('베트남')
    expect(countries).toContain('프랑스')
  })
})

describe('resolveCurationEventTargetCountries', () => {
  beforeEach(() => {
    vi.mocked(prisma.product.groupBy).mockReset()
    vi.mocked(prisma.monthlyCurationContent.findMany).mockReset()
    vi.mocked(prisma.seasonalDestinationCuration.findFirst).mockReset()
    vi.mocked(prisma.city.findMany).mockReset()
    vi.mocked(prisma.country.findMany).mockReset()
    vi.mocked(prisma.country.findMany).mockResolvedValue([
      { countryKey: 'japan', koreanLabel: '일본' },
      { countryKey: 'vietnam', koreanLabel: '베트남' },
    ] as never)
  })

  it('uses recommendation countries only', async () => {
    const resolved = await resolveCurationEventTargetCountries({
      targetMode: 'recommendation',
      targetCountries: ['일본', '베트남'],
    })
    expect(resolved.targetMode).toBe('recommendation')
    expect(resolved.countries).toEqual(expect.arrayContaining(['일본', '베트남']))
    expect(prisma.product.groupBy).not.toHaveBeenCalled()
  })

  it('defaults to all_products when mode omitted', async () => {
    vi.mocked(prisma.product.groupBy).mockResolvedValue([
      { country: '일본', _count: { _all: 1 } },
    ] as never)

    const resolved = await resolveCurationEventTargetCountries()
    expect(resolved.targetMode).toBe('all_products')
    expect(resolved.countries).toContain('일본')
  })

  it('falls back to products when curation pool is empty', async () => {
    vi.mocked(prisma.monthlyCurationContent.findMany).mockResolvedValue([])
    vi.mocked(prisma.seasonalDestinationCuration.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.product.groupBy).mockResolvedValue([
      { country: '태국', _count: { _all: 1 } },
    ] as never)

    const resolved = await resolveCurationEventTargetCountries({ targetMode: 'curation' })
    expect(resolved.usedProductFallback).toBe(true)
    expect(resolved.countries).toContain('태국')
  })
})
