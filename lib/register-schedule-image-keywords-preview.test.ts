/**
 * REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]
 */
import { describe, expect, it } from 'vitest'
import {
  applyRegisterScheduleImageKeywordsForPreview,
  mergePreviewImageKeywordsFromServerWhenDeriveEmpty,
} from '@/lib/register-schedule-image-keywords-preview'
import { backfillScheduleRouteTextFromDescriptionOrTitle } from '@/lib/register-schedule-route-text-backfill'

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

  it('keeps server keyword when routeText re-derive is empty', () => {
    const server = [
      {
        day: 3,
        title: '오사카',
        description: '오사카성·도톤보리',
        routeText: null,
        imageKeyword: 'Dotonbori',
        imageKeyword2: null,
      },
    ]
    const derived = [{ ...server[0], imageKeyword: '', imageKeyword2: null }]
    const out = mergePreviewImageKeywordsFromServerWhenDeriveEmpty(derived, server)
    expect(out[0]?.imageKeyword).toBe('Dotonbori')
  })

  it('backfills routeText from description first line', () => {
    const out = backfillScheduleRouteTextFromDescriptionOrTitle([
      {
        day: 2,
        title: '2일차',
        description: '교토 - 금각사 - 청수사\n아침은 가볍게.',
        routeText: null,
      },
    ])
    expect(out[0]?.routeText).toMatch(/교토 - 금각사/)
  })
})
