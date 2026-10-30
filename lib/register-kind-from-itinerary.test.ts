import { describe, expect, it } from 'vitest'
import { applyItineraryKindToTravelScope, inferProductKindFromOriginalItinerary, isItineraryDayFree } from '@/lib/register-kind-from-itinerary'

// 10/30 재수집 원문(하나투어 getPkgProdItnrInfo) 요약 픽스처
const pkgHn0058 = [ // 사이판 6일: D2~D5 일일 자유 일정 → 자유여행 (사장님 10/30 확정)
  { day: 1, title: '사이판', description: '[이동] 인천 → 사이판\n[안내] 호텔 체크인 후 자유일정입니다.' },
  { day: 2, title: '일일 자유 일정', description: '[자유일정] 일일 자유 일정 — 일일 자유일정으로 진행됩니다. ※ 현지 투어매니저가 동행하지 않습니다.' },
  { day: 3, title: '일일 자유 일정', description: '[자유일정] 일일 자유 일정 — 일일 자유일정으로 진행됩니다.' },
  { day: 4, title: '일일 자유 일정', description: '[자유일정] 일일 자유 일정 — 일일 자유일정으로 진행됩니다.' },
  { day: 5, title: '일일 자유 일정', description: '[자유일정] 일일 자유 일정 — 일일 자유일정으로 진행됩니다.' },
  { day: 6, title: '사이판 → 인천', description: '[이동] 사이판 → 인천' },
]
const fitHn0045 = [ // 홍콩/마카오 4일: D3만 자유, D2 마카오 관광 → 패키지
  { day: 1, title: '구룡반도 침사추이 - 스타페리 탑승 후 이동 - 홍콩섬 센트럴' },
  { day: 2, title: '마카오의 랜드마크, 세계문화유산 투어 - 화려한 마카오 야경투어' },
  { day: 3, title: '일일 자유 일정', description: '일일 자유일정으로 진행됩니다.' },
  { day: 4, title: '홍콩 → 인천' },
]
const fitHn0048 = [ // 오사카/교토/고베 3일 → 패키지
  { day: 1, title: '자연과 여유, 아라시야마를 걷다' },
  { day: 2, title: '난젠지 - 난젠지의 수로각 - 슈신칸' },
  { day: 3, title: '오사카 → 인천' },
]

describe('inferProductKindFromOriginalItinerary (원문 일자별 일정 유무만)', () => {
  it('free middle days → air_hotel_free', () => {
    expect(inferProductKindFromOriginalItinerary(pkgHn0058)).toBe('air_hotel_free')
  })
  it('concrete middle day → package even with one free day', () => {
    expect(inferProductKindFromOriginalItinerary(fitHn0045)).toBe('package')
    expect(inferProductKindFromOriginalItinerary(fitHn0048)).toBe('package')
  })
  it('full-day free with recommendation cards stays free', () => {
    expect(isItineraryDayFree({ description: '[자유일정] 일일 자유 일정\n[관광] 마나가하섬 (선택관광 추천)' })).toBe(true)
  })
  it('no itinerary → not a package', () => {
    expect(inferProductKindFromOriginalItinerary([])).toBe('air_hotel_free')
    expect(inferProductKindFromOriginalItinerary(null)).toBe('air_hotel_free')
    expect(inferProductKindFromOriginalItinerary([{ day: 1, title: '1일차' }, { day: 2, title: '' }])).toBe('air_hotel_free')
  })
  it('free-day wording with a concrete sight the same day counts as concrete', () => {
    expect(isItineraryDayFree({ title: '오전 자유시간 후 몬세라트 수도원 관광' })).toBe(false)
    expect(isItineraryDayFree({ title: '일일 자유 일정' })).toBe(true)
  })
  it('ignores admin menu selection, guide / guide fee / supplier code letters', () => {
    expect(applyItineraryKindToTravelScope('air_hotel_free', fitHn0045)).toBe('overseas')
    expect(applyItineraryKindToTravelScope('overseas', pkgHn0058)).toBe('air_hotel_free')
    const guideFeeOnly = [{ day: 1, title: '가이드/기사 경비 USD 50 현지 지불' }, { day: 2, title: '일일 자유 일정' }, { day: 3, title: '일일 자유 일정' }, { day: 4, title: '귀국' }]
    expect(applyItineraryKindToTravelScope('overseas', guideFeeOnly)).toBe('air_hotel_free')
  })
})
