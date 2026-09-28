/**
 * REGRESSION-FREEZE[register-schedule-hotel-from-summary]: hotelSummaryRaw → day hotelText — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyHotelSummaryRawToScheduleDays } from '@/lib/register-schedule-hotel-from-summary'

const SUMMARY = `숙박 없음
1일차 예정호텔
테렐지 게르 (2인1실)

2일차 예정호텔
테렐지 게르 (2인1실)

3일차 예정호텔
울란바토르 시티 호텔
동급

4일차 예정호텔
울란바토르 시티 호텔
동급

5일차 예정호텔
숙박 없음
`

describe('applyHotelSummaryRawToScheduleDays', () => {
  it('fills empty hotelText from N일차 예정호텔 blocks', () => {
    const rows = [1, 2, 3, 4, 5].map((day) => ({
      day,
      title: day === 5 ? '귀국' : `${day}일차`,
      routeText: day === 5 ? '인천' : '몽골',
      hotelText: null as string | null,
    }))
    const out = applyHotelSummaryRawToScheduleDays(rows, SUMMARY)
    expect(out[0]?.hotelText).toMatch(/게르/)
    expect(out[2]?.hotelText).toMatch(/울란바토르|시티/)
    expect(out[4]?.hotelText).toMatch(/숙박\s*없음/)
  })
})
