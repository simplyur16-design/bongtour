/**
 * REGRESSION-FREEZE[register-ingest-local-departure-reserve]: 하나·모두 지방출발 최소 1건 — manifest
 * REGRESSION-FREEZE[register-ingest-theme-category-slots]: 테마여행 분류 시드 — manifest
 */
import { describe, expect, it } from 'vitest'
import {
  buildRegisterPrePhotoLocalDepartureIngestSlots,
  buildRegisterPrePhotoThemeIngestSlots,
  prependHomepageCategoryIngestSlots,
  sportsThemeKeyFromIngestSlot,
  supplierRequiresLocalDepartureIngestReserve,
} from '@/lib/register-pre-photo-ingest-geo-slots'

describe('homepage category ingest slots', () => {
  it('reserves local-departure search seeds for hanatour and modetour only', () => {
    expect(supplierRequiresLocalDepartureIngestReserve('hanatour')).toBe(true)
    expect(supplierRequiresLocalDepartureIngestReserve('modetour')).toBe(true)
    expect(supplierRequiresLocalDepartureIngestReserve('ybtour')).toBe(false)
    expect(buildRegisterPrePhotoLocalDepartureIngestSlots('hanatour').map((s) => s.searchWord)).toEqual([
      '부산출발',
      '대구출발',
      '청주출발',
    ])
    expect(buildRegisterPrePhotoLocalDepartureIngestSlots('ybtour')).toEqual([])
  })

  it('builds theme search seeds matching homepage sports themes', () => {
    const slots = buildRegisterPrePhotoThemeIngestSlots('modetour')
    expect(slots.map((s) => s.searchWord)).toEqual(['골프', '러닝', '트레킹', '다이빙'])
    expect(sportsThemeKeyFromIngestSlot(slots[0]!)).toBe('golf')
  })

  it('prepends local then theme before geo slots', () => {
    const geo = [
      {
        supplier: 'hanatour',
        lane: 'package' as const,
        countryKey: 'japan',
        cityKey: 'osaka',
        originUrl: 'https://www.hanatour.com/',
        destination: '오사카',
        searchWord: '오사카',
        pending: 0,
      },
    ]
    const ordered = prependHomepageCategoryIngestSlots('hanatour', geo)
    expect(ordered[0]?.searchWord).toBe('부산출발')
    expect(ordered.some((s) => s.searchWord === '골프')).toBe(true)
    expect(ordered.at(-1)?.searchWord).toBe('오사카')
  })
})
