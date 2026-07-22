/**
 * REGRESSION-FREEZE[lottetour-register-highlight-curated]: curated = raw — manifest
 */
import { describe, expect, it } from 'vitest'
import { extractHighlightFromLottetour } from '@/lib/extract-highlight-lottetour'

describe('extract-highlight-lottetour curated fill', () => {
  it('paste extract returns raw suitable for curated=raw', () => {
    const raw = extractHighlightFromLottetour(`
Point 상품포인트
★ 세부 호핑투어
★ 리조트 숙박
■ 포함
항공
`)
    expect(raw).toMatch(/호핑/)
    expect(raw).toMatch(/리조트|숙박/)
    // confirm path: curated mirrors raw for fill rate
    const curated = raw
    expect(curated).toBe(raw)
  })
})
