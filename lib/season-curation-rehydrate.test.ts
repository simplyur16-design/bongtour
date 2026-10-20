import { describe, expect, it } from 'vitest'
import { rehydrateSeasonCurationCycle } from '@/lib/season-curation'
import type { SeasonalDestinationCuration } from '@prisma/client'

function stubCycle(
  overrides: Partial<SeasonalDestinationCuration> & {
    cycleStartDate: Date | string
    cycleEndDate: Date | string
  },
): SeasonalDestinationCuration {
  return {
    id: 'c1',
    cityKeys: ['tokyo'],
    fallbackKeys: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as SeasonalDestinationCuration
}

describe('rehydrateSeasonCurationCycle', () => {
  it('returns null for null', () => {
    expect(rehydrateSeasonCurationCycle(null)).toBeNull()
  })

  it('keeps Date instances', () => {
    const start = new Date('2026-10-01T00:00:00.000Z')
    const end = new Date('2026-11-01T00:00:00.000Z')
    const out = rehydrateSeasonCurationCycle(stubCycle({ cycleStartDate: start, cycleEndDate: end }))
    expect(out?.cycleStartDate).toBeInstanceOf(Date)
    expect(out?.cycleStartDate.toISOString()).toBe(start.toISOString())
  })

  it('rehydrates ISO strings from unstable_cache', () => {
    const out = rehydrateSeasonCurationCycle(
      stubCycle({
        cycleStartDate: '2026-10-01T00:00:00.000Z',
        cycleEndDate: '2026-11-01T00:00:00.000Z',
      }),
    )
    expect(out?.cycleStartDate).toBeInstanceOf(Date)
    expect(out?.cycleStartDate.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(out?.cycleEndDate.toISOString()).toBe('2026-11-01T00:00:00.000Z')
  })
})
