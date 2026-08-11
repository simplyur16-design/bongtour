import { describe, expect, it } from 'vitest'
import {
  patchProductScheduleJsonDay,
  preferStoredScheduleImageKeyword,
} from '@/lib/admin-pending-schedule-local-patch'

describe('admin-pending-schedule-local-patch', () => {
  it('patchProductScheduleJsonDay merges day fields without dropping others', () => {
    const prev = JSON.stringify([
      { day: 1, imageKeyword: 'Rome', imageUrl: null },
      { day: 2, imageKeyword: 'Florence', imageUrl: 'https://x/a.webp' },
    ])
    const next = patchProductScheduleJsonDay(prev, 2, {
      imageUrl: 'https://cdn/b.webp',
      imageManualSelected: true,
      imageKeyword: 'Florence Duomo',
    })
    expect(next).toBeTruthy()
    const rows = JSON.parse(next!) as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ day: 1, imageKeyword: 'Rome' })
    expect(rows[1]).toMatchObject({
      day: 2,
      imageUrl: 'https://cdn/b.webp',
      imageManualSelected: true,
      imageKeyword: 'Florence Duomo',
    })
  })

  it('preferStoredScheduleImageKeyword keeps saved over derived', () => {
    expect(preferStoredScheduleImageKeyword('rome', 'Colosseum')).toBe('rome')
    expect(preferStoredScheduleImageKeyword('', 'Colosseum')).toBe('Colosseum')
    expect(preferStoredScheduleImageKeyword(null, 'Colosseum')).toBe('Colosseum')
  })
})
