import { describe, expect, it } from 'vitest'
import type { ResultItem } from '@/components/products/ProductResultsList'
import { kakaoConsultHref } from '@/lib/kakao-consult-href'
import { productDetailCardPreviewFromResultItem } from '@/lib/product-detail-card-preview-from-item'
import { getPublicBookableMinYmd } from '@/lib/public-bookable-date'
import {
  pickGloballyCheapestDepartureRowByAdultPrice,
  pickPublicUrlDepartureRow,
} from '@/lib/public-default-departure-selection'
import { addDaysUtcYmd, kstTodayYmd } from '@/lib/calendar-ymd'
import {
  alignRejectedDepartureSearch,
  parseProductDepartureYmdFromSearch,
  rejectedDepartureMayReplaceLocation,
  replaceRejectedDepartureInLocation,
} from '@/lib/use-product-departure-url-param'

const BASE = new Date('2026-11-08T03:00:00.000Z')
const ORIGIN = 'AVP4539-260712RS00'
const CONSULT_BASE = 'https://open.kakao.com/o/s13CLdai'

function row(date: string, id: string, seats: number, price = 100000) {
  return {
    date,
    id,
    priceAdult: price,
    status: seats <= 0 ? '매진' : '예약가능',
    seatsStatusRaw: seats <= 0 ? '매진' : '잔여 4석',
    availableSeats: seats,
    isBookable: seats > 0,
  }
}

function item(over: Partial<ResultItem>): ResultItem {
  return {
    id: 'p1',
    slug: 'pkg-yb-0012',
    title: '다낭',
    originSource: 'ybtour',
    productType: 'travel',
    primaryDestination: '다낭',
    duration: '3박5일',
    bgImageUrl: null,
    effectivePricePerPersonKrw: 500000,
    ...over,
  }
}

describe('ybtour url departure follows the public bookable floor', () => {
  const floor = getPublicBookableMinYmd(BASE)
  const yesterday = addDaysUtcYmd(floor, -3)
  const today = '2026-11-08'
  const beforeFloor = addDaysUtcYmd(floor, -1)
  const future = addDaysUtcYmd(floor, 2)
  const rows = [
    row(yesterday, 'past', 4, 1000),
    row(future, 'future-open', 4, 800000),
    row(future, 'future-sold', 0, 100000),
    row(addDaysUtcYmd(floor, 5), 'later-cheap', 3, 400000),
  ]

  it('rejects a past date, today, a date before the floor, a missing date, and a sold-out date', () => {
    expect(pickPublicUrlDepartureRow(rows, yesterday, BASE)).toBeNull()
    expect(pickPublicUrlDepartureRow(rows, today, BASE)).toBeNull()
    expect(today < floor).toBe(true)
    expect(pickPublicUrlDepartureRow(rows, beforeFloor, BASE)).toBeNull()
    expect(pickPublicUrlDepartureRow(rows, '2026-12-01', BASE)).toBeNull()
    const soldOnly = [row(future, 'future-sold', 0, 100000)]
    expect(pickPublicUrlDepartureRow(soldOnly, future, BASE)).toBeNull()
    expect(pickGloballyCheapestDepartureRowByAdultPrice(rows, BASE)?.id).toBe('later-cheap')
  })

  it('selects a valid future departure from the card href and keeps originCode on the consult link', () => {
    const preview = productDetailCardPreviewFromResultItem(
      item({
        hasUrgentDeal: true,
        urgentDealNextDepartureDate: future,
        urgentDealCurrentPriceKrw: 100000,
      }),
      (n) => String(n),
    )
    const linked = new URL(preview.href, 'https://bongtour.com').searchParams.get('departure')
    expect(preview.href).toBe(`/products/pkg-yb-0012?departure=${future}`)
    const selected = pickPublicUrlDepartureRow(rows, linked, BASE)
    expect(selected?.id).toBe('future-open')
    expect(selected?.date).toBe(future)
    const consult = kakaoConsultHref(CONSULT_BASE, {
      productCode: ORIGIN,
      productTitle: '다낭',
    })
    expect(consult).toBe(
      `${CONSULT_BASE}?productCode=${encodeURIComponent(ORIGIN)}&productTitle=${encodeURIComponent('다낭')}`,
    )
    expect(consult).not.toContain('future-open')
    expect(consult).not.toContain(future)
  })

  it('does not put an expired urgent date on the card href', () => {
    const expired = addDaysUtcYmd(kstTodayYmd(), -1)
    const preview = productDetailCardPreviewFromResultItem(
      item({
        hasUrgentDeal: true,
        urgentDealNextDepartureDate: expired,
        urgentDealCurrentPriceKrw: 100000,
      }),
      (n) => String(n),
    )
    expect(preview.href).toBe('/products/pkg-yb-0012')
    expect(pickPublicUrlDepartureRow(rows, expired, BASE)).toBeNull()
  })

  it('aligns a rejected departure query to the selected date without dropping other params', () => {
    expect(alignRejectedDepartureSearch('?departure=2026-11-01&utm=a', '2026-11-15')).toBe(
      '?departure=2026-11-15&utm=a',
    )
    expect(alignRejectedDepartureSearch('?utm=a&departure=2026-11-01', null)).toBe('?utm=a')
    expect(alignRejectedDepartureSearch('?departure=2026-11-01', null)).toBe('')
    expect(alignRejectedDepartureSearch('?departure=2026-11-15&utm=a', '2026-11-15')).toBeNull()
    expect(alignRejectedDepartureSearch('?utm=a', '2026-11-15')).toBeNull()
    expect(alignRejectedDepartureSearch('?departure=not-a-date&utm=a', '2026-11-15')).toBeNull()
  })
})

describe('departure url replace waits until the read rejects the request', () => {
  const gate = (over: {
    ready?: boolean
    requestedYmd?: string | null
    urlRowSelected?: boolean
    userPinned?: boolean
  }) =>
    rejectedDepartureMayReplaceLocation({
      ready: true,
      requestedYmd: '2026-11-01',
      urlRowSelected: false,
      userPinned: false,
      ...over,
    })

  it('keeps a valid future departure through the initial null read', () => {
    expect(gate({ ready: false, requestedYmd: null })).toBe(false)
    expect(gate({ ready: false, requestedYmd: '2026-12-20' })).toBe(false)
    expect(gate({ requestedYmd: '2026-12-20', urlRowSelected: true })).toBe(false)
  })

  it('does not invent a departure when the query is absent or not a date', () => {
    expect(parseProductDepartureYmdFromSearch('')).toBeNull()
    expect(parseProductDepartureYmdFromSearch('?utm=a')).toBeNull()
    expect(parseProductDepartureYmdFromSearch('?departure=not-a-date&utm=a')).toBeNull()
    expect(gate({ requestedYmd: null })).toBe(false)
    expect(gate({ requestedYmd: parseProductDepartureYmdFromSearch('?departure=not-a-date') })).toBe(false)
  })

  it('normalizes a ready rejected date without a history push', () => {
    expect(gate({ requestedYmd: '2026-11-01' })).toBe(true)
    expect(gate({ userPinned: true })).toBe(false)
    const state = { nav: 1 }
    const calls: { push: unknown[][]; replace: unknown[][] } = { push: [], replace: [] }
    const previous = (globalThis as { window?: unknown }).window
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          pathname: '/products/pkg',
          search: '?departure=2026-11-01&utm=a',
          hash: '#fare',
        },
        history: {
          state,
          pushState: (...args: unknown[]) => {
            calls.push.push(args)
          },
          replaceState: (...args: unknown[]) => {
            calls.replace.push(args)
          },
        },
      },
    })
    try {
      replaceRejectedDepartureInLocation('2026-11-15', '2026-12-20')
      expect(calls.replace).toEqual([])
      expect(calls.push).toEqual([])
      replaceRejectedDepartureInLocation('2026-11-15', '2026-11-01')
      expect(calls.push).toEqual([])
      expect(calls.replace).toEqual([[state, '', '/products/pkg?departure=2026-11-15&utm=a#fare']])
    } finally {
      if (previous === undefined) delete (globalThis as { window?: unknown }).window
      else Object.defineProperty(globalThis, 'window', { configurable: true, value: previous })
    }
  })
})
