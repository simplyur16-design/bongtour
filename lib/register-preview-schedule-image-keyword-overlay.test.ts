import { describe, expect, it } from 'vitest'
import { overlayScheduleImageKeywordsFromFallbackSchedule } from '@/lib/register-preview-schedule-image-keyword-overlay'

describe('overlayScheduleImageKeywordsFromFallbackSchedule', () => {
  it('fills missing imageKeyword on LLM rows from deterministic schedule', () => {
    const primary = [
      { day: 1, title: 'A', imageKeyword: '' },
      { day: 2, title: 'B', imageKeyword: 'Barcelona' },
    ]
    const fallback = [
      { day: 1, title: 'A', imageKeyword: 'Santiago' },
      { day: 2, title: 'B', imageKeyword: 'Madrid' },
    ]
    const out = overlayScheduleImageKeywordsFromFallbackSchedule(primary, fallback) as typeof primary
    expect(out[0]!.imageKeyword).toBe('Santiago')
    expect(out[1]!.imageKeyword).toBe('Barcelona')
  })
})
