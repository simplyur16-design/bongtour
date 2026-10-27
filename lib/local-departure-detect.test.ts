import { describe, expect, it } from 'vitest'
import {
  detectLocalDepartureFromExplicitSignals as detect,
  stripHealAddedDeparturePrefix,
} from '@/lib/local-departure-detect'
import { resolveRegisterProductDepartureAirportFields } from '@/lib/register-product-departure-airport-save'

describe('detectLocalDepartureFromExplicitSignals — explicit signals only', () => {
  it('reads X출발 from the supplier original title', () => {
    expect(detect({ originalTitle: '대구출발 장가계 4일 #풀만호텔' }).tags).toEqual(['daegu'])
    expect(detect({ originalTitle: '[청주출발] 발리 6일' }).tags).toEqual(['cheongju'])
    expect(detect({ originalTitle: '장가계 4일 [대구출발/사천항공] [노팁노옵션노쇼핑]' }).tags).toEqual(['daegu'])
    expect(detect({ originalTitle: '[잔여4석/10/13 까지 예약가능/대구출발] 태항산/석가장 6일' }).tags).toEqual(['daegu'])
    expect(detect({ originalTitle: '[얼리마켓][선착순8명 과일바구니 포함/Semi-프리미엄/청주출발]장가계직항 5일' }).tags).toEqual([
      'cheongju',
    ])
    expect(detect({ originalTitle: '이스턴 크루즈 3일 #비너스호 #부산항출발 #나가사키' }).tags).toEqual(['busan'])
    expect(detect({ originalTitle: '김해공항 출발 세부 5일' }).tags).toEqual(['busan'])
    expect(detect({ originalTitle: '싱가포르 5일 #부산오전출발 #싱가포르항공' }).tags).toEqual(['busan'])
  })
  it('airline names are not departure signals', () => {
    expect(detect({ originalTitle: '[제주항공] 다낭 5일' }).tags).toEqual([])
    expect(detect({ originalTitle: '장가계 4일 [사천항공] 진주만 투어' }).cities).toEqual([])
  })
  it('a city without 출발 is not a signal (destinations, bare mentions)', () => {
    expect(detect({ originalTitle: '양양 서핑 & 동해 3일' }).tags).toEqual([])
    expect(detect({ originalTitle: '부산 야경 포함 후쿠오카' }).tags).toEqual([])
  })
  it('Seoul hub departures are ignored', () => {
    const r = detect({ originalTitle: '[인천출발] 다낭', departureAirports: ['인천', 'ICN', '김포'] })
    expect(r.tags).toEqual([])
    expect(r.review).toEqual([])
  })
  it('ignores the heal-added leading prefix in rawTitle', () => {
    expect(stripHealAddedDeparturePrefix('[부산출발] [청주출발] 발리 6일')).toBe('[청주출발] 발리 6일')
    expect(stripHealAddedDeparturePrefix('[대구출발] 청주출발 다낭')).toBe('청주출발 다낭')
    expect(detect({ rawTitle: '[부산출발] [청주출발] 발리 6일' }).tags).toEqual(['cheongju'])
    expect(detect({ rawTitle: '[대구출발] 청주출발 다낭/호이안 5일' }).tags).toEqual(['cheongju'])
  })
  it('allows multiple cities', () => {
    expect(detect({ originalTitle: '[부산/대구출발] 나트랑 5일' }).tags).toEqual(['busan', 'daegu'])
    expect(detect({ originalTitle: '[대구출발] 다낭', departureAirports: ['부산'] }).tags).toEqual(['busan', 'daegu'])
  })
  it('reads the departure-airport field (names and IATA)', () => {
    expect(detect({ departureAirports: [null, '대구'] }).tags).toEqual(['daegu'])
    expect(detect({ departureAirports: ['부산(김해)'] }).tags).toEqual(['busan'])
    expect(detect({ departureAirports: ['CJJ'] }).tags).toEqual(['cheongju'])
    expect(detect({ departureAirports: ['제주'] }).tags).toEqual(['jeju'])
  })
  it('naeiltour [대구] bracket counts only with bareCityBracketIsDeparture', () => {
    expect(detect({ originalTitle: '[대구] 후쿠오카 3박4일 금까기' }).tags).toEqual([])
    expect(detect({ originalTitle: '[대구] 후쿠오카 3박4일 금까기', bareCityBracketIsDeparture: true }).tags).toEqual(['daegu'])
    expect(detect({ originalTitle: '[하카타] 후쿠오카', bareCityBracketIsDeparture: true }).tags).toEqual([])
  })
  it('listed city without a tag value → review city-known-no-tag, no tag', () => {
    const r = detect({ originalTitle: '[무안출발] 다낭 5일' })
    expect(r.tags).toEqual([])
    expect(r.cities).toEqual(['muan'])
    expect(r.review).toEqual([expect.objectContaining({ reason: 'city-known-no-tag', city: 'muan' })])
  })
  it('unlisted X출발 → review city-unlisted, no tag', () => {
    const r = detect({ originalTitle: '[평택항출발] 칭다오 크루즈' })
    expect(r.tags).toEqual([])
    expect(r.review).toEqual([expect.objectContaining({ reason: 'city-unlisted', city: '평택' })])
  })
  it('non-city words before 출발 are not reviewed', () => {
    expect(detect({ originalTitle: '[출발확정] [매일출발] 다낭 확정출발' }).review).toEqual([])
    expect(detect({ originalTitle: '[저녁출발] 세부 [아침출발] [무조건출발] [좌석확보 출발]' }).review).toEqual([])
  })
})

describe('resolveRegisterProductDepartureAirportFields + explicitSignals', () => {
  it('explicit signals override weak haystack inference', () => {
    const r = resolveRegisterProductDepartureAirportFields({
      manualLocalDepartureTags: [],
      inferHaystack: '[부산출발] 대구출발 장가계 4일',
      explicitSignals: { originalTitle: '대구출발 장가계 4일', rawTitle: '[부산출발] 대구출발 장가계 4일' },
    })
    expect(r.localDepartureTag).toEqual(['daegu'])
  })
  it('explicit city without a tag value clears the inferred tag (sent to review)', () => {
    const r = resolveRegisterProductDepartureAirportFields({
      manualLocalDepartureTags: [],
      inferHaystack: '부산출발',
      explicitSignals: { originalTitle: '[무안출발] 다낭' },
    })
    expect(r.localDepartureTag).toEqual([])
  })
  it('no explicit signal → existing inference unchanged', () => {
    const r = resolveRegisterProductDepartureAirportFields({
      manualLocalDepartureTags: [],
      inferHaystack: '[부산출발] 다낭',
      explicitSignals: { originalTitle: '다낭 5일' },
    })
    expect(r.localDepartureTag).toEqual(['busan'])
  })
  it('manual tags still win', () => {
    const r = resolveRegisterProductDepartureAirportFields({
      manualLocalDepartureTags: ['jeju'],
      inferHaystack: '',
      explicitSignals: { originalTitle: '대구출발 다낭' },
    })
    expect(r.localDepartureTag).toEqual(['jeju'])
  })
})
