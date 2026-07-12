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
})
