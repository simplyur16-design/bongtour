import { describe, expect, it } from 'vitest'
import { isSupplierListingTitleUnacceptable } from '@/lib/supplier-listing-title-unacceptable'

describe('isSupplierListingTitleUnacceptable', () => {
  it('rejects departure date range with duration', () => {
    expect(isSupplierListingTitleUnacceptable('2026.06.15 ~ 2026.06.17 2박 3일')).toBe(true)
    expect(isSupplierListingTitleUnacceptable('2026.12.12~2026.12.14 2박 3일')).toBe(true)
  })

  it('accepts real listing titles', () => {
    expect(isSupplierListingTitleUnacceptable('[동유럽] 체코 9일 #노팁노옵션')).toBe(false)
    expect(isSupplierListingTitleUnacceptable('코카서스 3국 10일 KE #두바이관광')).toBe(false)
  })

  it('rejects stub placeholders 미지정/미입력', () => {
    expect(isSupplierListingTitleUnacceptable('미지정')).toBe(true)
    expect(isSupplierListingTitleUnacceptable('미입력')).toBe(true)
  })

  // REGRESSION-FREEZE[register-pre-photo-product-title-day-leak]: 일차|·호텔 줄 ≠ listing — manifest
  it('rejects schedule day-title leaked as product title', () => {
    expect(
      isSupplierListingTitleUnacceptable(
        '3일차 | 도쿄 · 가나자와 · 신주쿠 도청 전망대 · 오다이바 | 호텔: 총 1개의 예정 호텔이',
      ),
    ).toBe(true)
    expect(isSupplierListingTitleUnacceptable('1일차 | 인천 - 도쿄')).toBe(true)
    expect(isSupplierListingTitleUnacceptable('[관동] 도쿄·후지산 3박4일 #노쇼핑')).toBe(false)
  })
})
