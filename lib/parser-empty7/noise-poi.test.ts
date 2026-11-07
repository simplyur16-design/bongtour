/** 문과장 1106: narrow POI exception for '유의' substring — must keep every real caution label as noise. */
import { describe, it, expect } from 'vitest'
import { isRegisterScheduleRoutePlaceNoise } from '@/lib/register-schedule-route-place-noise'
import { dedupeNaeiltourScheduleRoutePlaces } from '@/lib/naeiltour-register-api-schedule'
describe('자유의 여신상 vs 유의 caution', () => {
  it.each(['자유의 여신상', '자유의여신상'])('POS: %s is a place (shared + NL dedupe keeps it)', (t) => {
    expect(isRegisterScheduleRoutePlaceNoise(t)).toBe(false)
    expect(dedupeNaeiltourScheduleRoutePlaces([t])).toEqual([t])
  })
  it.each(['유의사항', '유의 사항', '여행 시 유의', '출국 유의 사항', '고객센터 유의사항', '고객센터 안내', '자유의 여신상 관람 시 유의', '자유시간', '자유 시간', '현지 안내', '주의사항'])(
    'NEG: %s stays noise', (t) => { expect(isRegisterScheduleRoutePlaceNoise(t)).toBe(true); expect(dedupeNaeiltourScheduleRoutePlaces([t])).toEqual([]) })
})
