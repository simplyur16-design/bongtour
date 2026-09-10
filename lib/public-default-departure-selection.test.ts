import { describe, expect, it } from 'vitest'
import {
  pickGloballyCheapestDepartureRowByAdultPrice,
  pickBookableRowForDateKey,
} from '@/lib/public-default-departure-selection'

// REGRESSION-FREEZE[public-default-departure-nearest]: 하한 이후 최저가 — manifest

describe('public-default-departure-selection', () => {
  const base = new Date('2026-09-10T12:00:00+09:00')

  it('ignores past dates and picks cheapest among bookable future rows', () => {
    const rows = [
      { id: 'jul', date: '2026-07-05', adult: 500_000 },
      { id: 'oct-cheap', date: '2026-10-20', adult: 799_900 },
      { id: 'oct-dear', date: '2026-10-01', adult: 1_200_000 },
      { id: 'sep-soon', date: '2026-09-11', adult: 600_000 },
    ]
    // floor = 2026-09-12 → jul + sep-soon out; cheapest remaining = oct-cheap
    const picked = pickGloballyCheapestDepartureRowByAdultPrice(rows as never, base)
    expect(picked?.id).toBe('oct-cheap')
  })

  it('same price prefers earlier departure', () => {
    const rows = [
      { id: 'b', date: '2026-11-10', adult: 900_000 },
      { id: 'a', date: '2026-10-05', adult: 900_000 },
    ]
    const picked = pickGloballyCheapestDepartureRowByAdultPrice(rows as never, base)
    expect(picked?.id).toBe('a')
  })

  it('rejects dateKey before public bookable floor', () => {
    const rows = [{ id: 'jul', date: '2026-07-05', adult: 500_000 }]
    expect(pickBookableRowForDateKey(rows as never, '2026-07-05')).toBeNull()
  })
})
