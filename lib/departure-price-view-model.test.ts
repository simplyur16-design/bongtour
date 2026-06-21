import { describe, expect, it } from 'vitest'
import { buildDepartureViewModels } from '@/lib/departure-price-view-model'
import type { ProductPriceRow } from '@/app/components/travel/TravelProductDetail'

function row(partial: Partial<ProductPriceRow> & Pick<ProductPriceRow, 'id' | 'date'>): ProductPriceRow {
  const adult = partial.adult ?? 0
  return {
    childBed: null,
    childNoBed: null,
    infant: null,
    ...partial,
    adult,
    priceAdult: partial.priceAdult ?? adult,
  }
}

describe('buildDepartureViewModels', () => {
  it('가격 없는 날은 달력 뷰에서 제외 — 판매완료·미운영 라벨 없음', () => {
    const vms = buildDepartureViewModels(
      [
        row({ id: '1', date: '2026-06-10', adult: 0, status: '마감', seatsStatusRaw: '잔여0' }),
        row({ id: '2', date: '2026-06-11', adult: 900_000, availableSeats: 0, seatsStatusRaw: '잔여0' }),
      ],
      'hanatour',
    )
    expect(vms).toHaveLength(1)
    expect(vms[0]?.departureDate).toBe('2026-06-11')
    expect(vms[0]?.soldOut).toBe(true)
    expect(vms[0]?.statusLabel).toBe('판매완료')
  })

  it('가격 있는 날 — 마감 문구만 있으면 판매완료 아님', () => {
    const vms = buildDepartureViewModels(
      [row({ id: '1', date: '2026-06-12', adult: 850_000, status: '마감' })],
      'hanatour',
    )
    expect(vms[0]?.soldOut).toBe(false)
    expect(vms[0]?.isAvailable).toBe(true)
  })

  it('baseline 대비 인하 — 30일 창 안 출발일 isUrgentDeal', () => {
    const vms = buildDepartureViewModels(
      [
        row({
          id: '1',
          date: '2026-06-25',
          adult: 900_000,
          baselineAdultPrice: 1_000_000,
          availableSeats: 5,
        }),
        row({
          id: '2',
          date: '2026-06-26',
          adult: 950_000,
          baselineAdultPrice: 950_000,
          availableSeats: 5,
        }),
      ],
      'modetour',
    )
    expect(vms.find((v) => v.departureDate === '2026-06-25')?.isUrgentDeal).toBe(true)
    expect(vms.find((v) => v.departureDate === '2026-06-26')?.isUrgentDeal).toBe(false)
  })
})
