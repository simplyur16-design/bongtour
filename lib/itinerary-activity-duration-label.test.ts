import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatItineraryActivityDurationLabel } from '@/lib/itinerary-activity-duration-label'

describe("활동 소요시간 표시 — 빈 값·0·null 이면 숨김('0분' 방지)", () => {
  it.each([[null], [undefined], [0], [''], ['  '], [-5], [Number.NaN], ['abc']])('%s → 표시 안 함', (v) => {
    expect(formatItineraryActivityDurationLabel(v as never)).toBeNull()
  })
  it('값이 있으면 N분', () => {
    expect(formatItineraryActivityDurationLabel(30)).toBe('30분')
    expect(formatItineraryActivityDurationLabel('90')).toBe('90분')
  })
  it('ItineraryView(PC·390 모바일 공용)는 durationMinutes 를 그대로 "분"에 붙이지 않음', () => {
    const src = readFileSync(path.resolve(__dirname, '../components/itinerary/ItineraryView.tsx'), 'utf-8')
    expect(src).not.toMatch(/\{act\.durationMinutes\}분/)
    expect(src).toContain('formatItineraryActivityDurationLabel(act.durationMinutes)')
    // 요금 표시는 그대로
    expect(src).toContain('{act.estimatedCostKrw > 0 && <span className="font-semibold fit-tx-price">₩{act.estimatedCostKrw.toLocaleString()}</span>}')
  })
})
