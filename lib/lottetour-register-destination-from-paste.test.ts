/**
 * REGRESSION-FREEZE[lottetour-register-destination]
 */
import { describe, expect, it } from 'vitest'
import {
  resolveLottetourRegisterDestination,
} from '@/lib/lottetour-register-destination-from-paste'
import { isSupplierRegisterDestinationUiLabel } from '@/lib/supplier-register-destination-forbidden'

describe('lottetour register destination', () => {
  it('rejects 여행일정 UI label from paste before duration', () => {
    const r = resolveLottetourRegisterDestination({
      pastedBody: '상품안내\n여행일정\n5박 6일\n1일차 인천',
      title: '',
    })
    expect(r.destination).not.toBe('여행일정')
    expect(isSupplierRegisterDestinationUiLabel('여행일정')).toBe(true)
  })

  it('uses title region after stripping promo brackets', () => {
    const r = resolveLottetourRegisterDestination({
      pastedBody: '',
      title: '[출발확정][매진임박] [best] 나트랑 5박6일 #노쇼핑',
    })
    expect(r.destination).toMatch(/나트랑/)
    expect(r.destination).not.toMatch(/출발|매진|best|여행일정/i)
  })

  it('parses 여행도시 block from paste', () => {
    const r = resolveLottetourRegisterDestination({
      pastedBody: `
[출발확정] 동남아 5일
여행도시
나트랑, 호치민
상품가격
`,
      title: '[출발확정] 나트랑·호치민 5박6일',
    })
    expect(r.destinationRaw).toMatch(/나트랑/)
    expect(r.destination).toMatch(/나트랑/)
  })

  it('extracts bracket region from title', () => {
    const r = resolveLottetourRegisterDestination({
      pastedBody: '',
      title: '[다낭] #바나힐 3박 5일',
    })
    expect(r.destination).toMatch(/다낭/)
  })
})
