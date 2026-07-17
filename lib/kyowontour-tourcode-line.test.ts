import { describe, expect, it } from 'vitest'
import {
  filterKyowontourCalendarRowsByUrlTourCodeLine,
  parseKyowontourTourCodeDateAndVariant,
} from '@/lib/kyowontour-tourcode-line'

describe('parseKyowontourTourCodeDateAndVariant', () => {
  // REGRESSION-FREEZE[kyowontour-tourcode-line]: parseTourCodeDateAndVariant — manifest
  it('parses JHP013 date and 7C vs ZE variant', () => {
    expect(parseKyowontourTourCodeDateAndVariant('JHP0132607167C01')).toEqual({
      departYmd: '2026-07-16',
      variantKey: '7C',
    })
    expect(parseKyowontourTourCodeDateAndVariant('JHP013260801ZE01')).toEqual({
      departYmd: '2026-08-01',
      variantKey: 'ZE',
    })
  })
})

describe('filterKyowontourCalendarRowsByUrlTourCodeLine', () => {
  it('keeps only matching airline variant rows', () => {
    const rows = [
      { tourCode: 'JHP013260801ZE01', departDate: '2026-08-01' },
      { tourCode: 'JHP0132607187C01', departDate: '2026-07-18' },
      { tourCode: 'JHP013261001ZE01', departDate: '2026-10-01' },
    ]
    const out = filterKyowontourCalendarRowsByUrlTourCodeLine(rows, 'JHP0132607167C01')
    expect(out).toHaveLength(1)
    expect(out[0]?.tourCode).toBe('JHP0132607187C01')
  })
})
