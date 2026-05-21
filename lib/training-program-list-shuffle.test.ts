import { describe, expect, it } from 'vitest'
import {
  getTrainingProgramShufflePeriodKey,
  shuffleTrainingProgramsByPeriod,
} from '@/lib/training-program-list-shuffle'

describe('training-program-list-shuffle', () => {
  const sample = [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
    { id: 'c', title: 'C' },
    { id: 'd', title: 'D' },
  ]

  it('is stable within the same period', () => {
    const w1a = shuffleTrainingProgramsByPeriod(sample, '2026-W20')
    const w1b = shuffleTrainingProgramsByPeriod(sample, '2026-W20')
    expect(w1a.map((p) => p.id)).toEqual(w1b.map((p) => p.id))
  })

  it('can differ across periods', () => {
    const w20 = shuffleTrainingProgramsByPeriod(sample, '2026-W20').map((p) => p.id).join(',')
    const w21 = shuffleTrainingProgramsByPeriod(sample, '2026-W21').map((p) => p.id).join(',')
    const sorted = [...sample].sort((a, b) => a.id.localeCompare(b.id)).map((p) => p.id).join(',')
    expect(w20).not.toBe(sorted)
    expect(w21).not.toBe(sorted)
  })

  it('produces ISO week keys', () => {
    expect(getTrainingProgramShufflePeriodKey(new Date('2026-05-21T12:00:00'))).toMatch(/^\d{4}-W\d{2}$/)
  })
})
