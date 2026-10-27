import { describe, expect, it } from 'vitest'
import { toPublicDepartureStatusLabel } from './departure-status-public-label'
import { productPriceRowToDepartureView } from './departure-price-view-model'

describe('toPublicDepartureStatusLabel', () => {
  it('maps supplier wording to public badges', () => {
    expect(toPublicDepartureStatusLabel('100% 출발')).toBe('출발확정')
    expect(toPublicDepartureStatusLabel('100%출발')).toBe('출발확정')
    expect(toPublicDepartureStatusLabel(' 출발예정 ')).toBe('예약가능')
    expect(toPublicDepartureStatusLabel('출발 예정')).toBe('예약가능')
  })
  it('leaves other labels and date wording intact', () => {
    for (const s of ['출발확정', '예약가능', '예약진행', '대기예약', '마감', '예약마감', '마감임박']) {
      expect(toPublicDepartureStatusLabel(s)).toBe(s)
    }
    expect(toPublicDepartureStatusLabel('출발예정일 3/12')).toBe('출발예정일 3/12')
    expect(toPublicDepartureStatusLabel(null)).toBeUndefined()
    expect(toPublicDepartureStatusLabel('')).toBe('')
  })
})

describe('productPriceRowToDepartureView uses public label', () => {
  const base = { date: '2099-03-12', adult: 990000, priceAdult: 990000 } as Record<string, unknown>
  it.each([
    ['100% 출발', '출발확정'],
    ['출발예정', '예약가능'],
  ])('%s → %s without leaking the raw word into note', (raw, want) => {
    const vm = productPriceRowToDepartureView({ ...base, status: raw } as never, 'ybtour')
    if (vm.isAvailable) {
      expect(vm.statusLabel).toBe(want)
      expect(vm.note).toBeNull()
    } else {
      expect(vm.statusLabel).not.toContain(raw)
    }
  })
})
