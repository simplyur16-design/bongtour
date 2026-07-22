/**
 * REGRESSION-FREEZE[ybtour-register-highlight-corepoints]: goodsInfo → highlight — manifest
 */
import { describe, expect, it } from 'vitest'
import {
  extractHighlightFromYbtour,
  formatYbtourHighlightPointsFromCorePoints,
} from '@/lib/extract-highlight-ybtour'

describe('extract-highlight-ybtour', () => {
  it('extracts 여행포인트 list', () => {
    const out = extractHighlightFromYbtour(`
여행포인트
✔ 하와이 호핑투어 포함
✔ 와이키키 호텔 숙박
■ 포함
항공권
`)
    expect(out).toMatch(/호핑투어/)
    expect(out).toMatch(/와이키키/)
    expect(out).not.toMatch(/항공권/)
  })

  it('formatYbtourHighlightPointsFromCorePoints filters insurance/visa/ops', () => {
    const out = formatYbtourHighlightPointsFromCorePoints([
      '하와이 호핑투어 포함',
      '여행자보험 가입',
      '무비자 입국',
      '예약 시 확인',
      '와이키키 호텔 숙박',
    ])
    expect(out).toMatch(/호핑투어/)
    expect(out).toMatch(/호텔/)
    expect(out).not.toMatch(/보험|비자|예약 시/)
  })
})
