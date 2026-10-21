import { describe, expect, it } from 'vitest'
import {
  scrubPublicHotelDisplayLine,
  scrubPublicHotelNameList,
} from '@/lib/public-hotel-display-ssot'

// REGRESSION-FREEZE[public-hotel-display-scrub]: 공개 호텔 scrub — manifest
describe('scrubPublicHotelDisplayLine', () => {
  it('부산 예정 호텔 placeholder → null', () => {
    expect(scrubPublicHotelDisplayLine('부산 예정 호텔(동급 가능)')).toBeNull()
    expect(scrubPublicHotelDisplayLine('대구 예정 호텔')).toBeNull()
    expect(scrubPublicHotelDisplayLine('상하이 예정 호텔(동급 가능)')).toBeNull()
    expect(scrubPublicHotelDisplayLine('예정 호텔(출발 전 확정)')).toBeNull()
    expect(scrubPublicHotelDisplayLine('5성 호텔')).toBeNull()
    expect(scrubPublicHotelDisplayLine('호텔 투숙')).toBeNull()
  })

  it('슬래시 나열 + 호텔소개 → 대표 숙소명', () => {
    const r = scrubPublicHotelDisplayLine(
      'HOTEL VISTA Matsuyama / 객실사진 / Hiyori Hotel Matsuyama / 히요리 호텔 마츠야마 / 호텔소개',
    )
    expect(r).toMatch(/VISTA|Matsuyama|히요리|마츠야마/i)
    expect(r).not.toMatch(/호텔소개|객실사진|정보\s*보기/)
  })

  it('정보보기·호텔소개 alone → null', () => {
    expect(scrubPublicHotelDisplayLine('호텔소개')).toBeNull()
    expect(scrubPublicHotelDisplayLine('정보보기')).toBeNull()
  })

  it('참좋은여행 축약형(혹은 동급)은 영문 lead로 잘리지 않음', () => {
    expect(scrubPublicHotelDisplayLine('DESTINATION BY HYATT 혹은 동급(추후안내)')).toBe(
      'DESTINATION BY HYATT 혹은 동급(추후안내)',
    )
  })

  it('상세보기·호텔투숙·준성급호텔 UI 잔재 → null', () => {
    expect(scrubPublicHotelDisplayLine('상세보기 상세보기 3일차 예정호텔 상세보기')).toBeNull()
    expect(scrubPublicHotelDisplayLine('호텔 투숙 휴식')).toBeNull()
    expect(scrubPublicHotelDisplayLine('준5성급호텔 준5성급호텔')).toBeNull()
    expect(
      scrubPublicHotelDisplayLine(
        '호텔 투숙 호텔 투숙 3일차 예정호텔 호텔 투숙 4일차 예정호텔 호텔 투숙',
      ),
    ).toBeNull()
    expect(
      scrubPublicHotelDisplayLine(
        '준5성급호텔 준5성급호텔 3일차 예정호텔 준5성급호텔 4일차 예정호텔 숙박 없음(귀국)',
      ),
    ).toBeNull()
    expect(
      scrubPublicHotelDisplayLine(
        '본 여행상품의 호텔은 출발 1~2일 전 확정되며, 확정 시 별도로 안내 드립니다. 또한 호텔 사정상 예정호텔 외 동급호텔로',
      ),
    ).toBeNull()
    expect(
      scrubPublicHotelDisplayLine('현지 사정상 예정호텔 외 동급호텔로 배정 될 수 있습니다.'),
    ).toBeNull()
    expect(scrubPublicHotelDisplayLine('동급')).toBeNull()
    expect(scrubPublicHotelDisplayLine('동급 (4성급)')).toBeNull()
  })

  it('다일차 예정호텔 요약 → 첫 숙소명만', () => {
    const raw =
      '1일차 예정호텔\nClub Wyndham Chikumakan Nagano\n클럽 윈담\n호텔소개\n\n2일차 예정호텔\nANA Crowne Plaza Toyama by IHG'
    const r = scrubPublicHotelDisplayLine(raw)
    expect(r).toMatch(/Wyndham|Chikumakan|Nagano/i)
    expect(r).not.toMatch(/호텔소개|1일차|2일차/)
  })

  it('공백으로 합쳐진 다일차 요약도 scrub', () => {
    const raw =
      '1일차 예정호텔 Orient Hotel Kochi 오리엔탈 호텔 고치 호텔소개 3일차 예정호텔 Mercure Kochi Tosa'
    const r = scrubPublicHotelDisplayLine(raw)
    expect(r).toMatch(/Orient|Kochi/i)
    expect(r).not.toMatch(/호텔소개|1일차|3일차|Mercure/)
  })

  it('※ 변동 안내 문구 → null', () => {
    expect(
      scrubPublicHotelDisplayLine(
        '※ 예정호텔 리스트에 없는 소도시 특성상 동급호텔로 변동될 수 있습니다',
      ),
    ).toBeNull()
  })

  it('식사 문구가 호텔 필드면 null', () => {
    expect(scrubPublicHotelDisplayLine('조식 불포함')).toBeNull()
    expect(scrubPublicHotelDisplayLine('불포함')).toBeNull()
    expect(scrubPublicHotelDisplayLine('조식 호텔식')).toBeNull()
  })
})

describe('scrubPublicHotelNameList', () => {
  it('중복·크롬 제거 후 최대 3', () => {
    const r = scrubPublicHotelNameList([
      '부산 예정 호텔(동급 가능)',
      'HOTEL VISTA Matsuyama',
      '호텔소개',
      'HOTEL VISTA Matsuyama',
      'Hiyori Hotel Matsuyama',
    ])
    expect(r.length).toBeGreaterThanOrEqual(1)
    expect(r.length).toBeLessThanOrEqual(3)
    expect(r.join(' ')).not.toMatch(/부산|호텔소개/)
  })
})
