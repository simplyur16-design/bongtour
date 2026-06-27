import { describe, expect, it } from 'vitest'
import { applyHanatourScheduleImageKeywordsToRows } from '@/lib/hanatour-schedule-image-keyword'

describe('applyHanatourScheduleImageKeywordsToRows — routeText 일차 슬롯', () => {
  const uaeOpts = { productDestination: 'UAE' }

  it('routeText a→g 순서 + 일차 슬롯 — 1일 kw1·귀국(N-1 routeText)', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        { day: 1, routeText: 'Incheon - Dubai', imageKeyword: '', imageKeyword2: null },
        {
          day: 2,
          routeText: 'Dubai - Burj Khalifa - Dubai Mall',
          imageKeyword: '',
          imageKeyword2: null,
        },
        { day: 3, routeText: 'Dubai - Incheon', imageKeyword: '', imageKeyword2: null },
      ],
      uaeOpts,
    )
    expect(out[0]!.imageKeyword).toBeTruthy()
    expect(out[0]!.imageKeyword2).toBeNull()
    expect(out[1]!.imageKeyword).toBeTruthy()
    expect(out[2]!.imageKeyword).toBeTruthy()
    expect(out[2]!.imageKeyword2).toBeNull()
  })
})
