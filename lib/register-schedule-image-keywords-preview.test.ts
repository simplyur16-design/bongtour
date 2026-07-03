/**
 * REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsForPreview } from '@/lib/register-schedule-image-keywords-preview'

describe('register-schedule-image-keywords-preview', () => {
  it('ignores stale server imageKeyword — routeText SSOT only', () => {
    const rows = [
      { day: 1, title: '인천', description: '', routeText: null, imageKeyword: 'WRONG', imageKeyword2: 'BAD' },
      {
        day: 5,
        routeText:
          '크라이스트처치 시내관광 - 해글리 공원 - 에이번 강 - 모나 베일 - 바이아덕트 - 오클랜드 간단 시내탐방 - 마이클 조셉 세비지 기념공원',
        imageKeyword: 'Michael Joseph Savage Memorial',
        imageKeyword2: 'Christchurch',
      },
    ]
    const out = applyRegisterScheduleImageKeywordsForPreview(rows, {
      supplierKey: 'hanatour',
      productDestination: '뉴질랜드',
    })
    const d1 = out.find((r) => r.day === 1)
    const d5 = out.find((r) => r.day === 5)
    expect(String(d1?.imageKeyword ?? '')).not.toBe('WRONG')
    expect(String(d5?.imageKeyword ?? '')).toMatch(/Hagley|Avon/i)
    expect(String(d5?.imageKeyword ?? '')).not.toMatch(/Savage Memorial/i)
    expect(String(d5?.imageKeyword2 ?? '')).not.toMatch(/^Christchurch$/i)
  })
})
