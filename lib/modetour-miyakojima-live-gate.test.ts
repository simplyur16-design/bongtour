/**
 * REGRESSION-FREEZE[modetour-miyakojima-live-gate]: modetour 101123669 — 마이파리≠Paris, 일차별 랜드마크 — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsForPreview } from '@/lib/register-schedule-image-keywords-preview'
import { routeTextSegmentToImageKeyword } from '@/lib/register-schedule-route-text-image-keyword-ssot'

const MIYAKO = [
  {
    day: 1,
    title: '1일차',
    description: '출발',
    routeText: '인천 - 오키나와 - 미야코지마 - 17엔드 - 토오리이케 - 이라부 대교 - 시기라 오공 온센',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 2,
    title: '2일차',
    description: '관광',
    routeText: '미야코지마 해중공원 - 히가시헨나 곶 - 조개박물관 - 유키시오 뮤지엄',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '3일차',
    description: '자유',
    routeText: '미야코지마',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    title: '4일차',
    description: '귀국',
    routeText: '미야코지마 - 오키나와 - 인천 - 마이파리 열대과수원 - 17엔드 - 토오리이케',
    imageKeyword: '',
    imageKeyword2: null,
  },
]

describe('modetour miyakojima 101123669 live gate', () => {
  it('마이파리 세그먼트는 Paris가 아님', () => {
    expect(routeTextSegmentToImageKeyword('마이파리 열대과수원')).toMatch(/Miyakojima Tropical Fruit Garden/i)
    expect(routeTextSegmentToImageKeyword('마이파리 열대과수원')).not.toMatch(/Paris/i)
  })

  it('일차별 imageKeyword — Paris 환각 없음, Day2 랜드마크 채움', () => {
    const out = applyRegisterScheduleImageKeywordsForPreview(MIYAKO, {
      supplierKey: 'modetour',
      productDestination: '오키나와',
    })
    const byDay = new Map(out.map((r) => [r.day, r]))
    expect(String(byDay.get(1)?.imageKeyword ?? '')).not.toMatch(/Paris/i)
    expect(String(byDay.get(2)?.imageKeyword ?? '')).toMatch(/Haejung|Higashi|Shell|Yuki/i)
    expect(String(byDay.get(4)?.imageKeyword ?? '')).not.toMatch(/Paris/i)
    expect(String(byDay.get(4)?.imageKeyword ?? '')).toMatch(/Miyakojima Tropical Fruit Garden|Yonaha|Toriike/i)
  })

  it('stale Okinawa·Paris server keywords — routeText SSOT replaces', () => {
    const stale = MIYAKO.map((row) => ({
      ...row,
      imageKeyword: row.day === 1 ? 'Okinawa' : row.day === 4 ? 'Paris' : '',
    }))
    const out = applyRegisterScheduleImageKeywordsForPreview(stale, {
      supplierKey: 'modetour',
      productDestination: '오키나와',
    })
    const byDay = new Map(out.map((r) => [r.day, r]))
    expect(String(byDay.get(1)?.imageKeyword ?? '')).not.toMatch(/^Okinawa$/i)
    expect(String(byDay.get(1)?.imageKeyword ?? '')).toMatch(/Yonaha|Irabu|Shigira|Toriike/i)
    expect(String(byDay.get(2)?.imageKeyword ?? '')).toMatch(/Haejung|Higashi|Shell|Yuki/i)
    expect(String(byDay.get(4)?.imageKeyword ?? '')).not.toMatch(/Paris/i)
  })
})
