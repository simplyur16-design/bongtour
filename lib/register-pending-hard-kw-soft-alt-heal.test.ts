import { describe, expect, it } from 'vitest'
import {
  pickUnusedRegisterScheduleCitySoftAltKeyword,
  collectRegisterScheduleCitySoftAltKeywords,
} from '@/lib/register-schedule-city-soft-alts'
import { isBrokenRegisterLandmarkKeyword } from '@/lib/register-pre-photo-guards'
import { enforceRegisterScheduleTripUniqueImageKeywords } from '@/lib/register-schedule-trip-image-keyword-dedupe'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'

// REGRESSION-FREEZE[register-pending-hard-kw-soft-alt-heal]: pending hard KW → unused soft-alt — manifest

describe('register-pending-hard-kw-soft-alt-heal', () => {
  it('Reykjavik pack yields unused alt after harbor houses used', () => {
    const used = new Set([normScheduleImageKeywordKey('Reykjavik Colorful Harbor Houses')])
    const next = pickUnusedRegisterScheduleCitySoftAltKeyword(used, {
      routeText: '레이캬비크 - 블루라군',
      usedKeyword: 'Reykjavik Colorful Harbor Houses',
    })
    expect(next).toBeTruthy()
    expect(normScheduleImageKeywordKey(next)).not.toBe(
      normScheduleImageKeywordKey('Reykjavik Colorful Harbor Houses'),
    )
  })

  it('Bondi Beach middle repeat is replaced by Sydney soft-alt', () => {
    const rows = [
      { day: 1, routeText: '인천 - 시드니', imageKeyword: 'Sydney', imageKeyword2: null },
      { day: 2, routeText: '시드니 - 본디비치', imageKeyword: 'Bondi Beach', imageKeyword2: null },
      { day: 3, routeText: '본디 - 시드니', imageKeyword: 'Bondi Beach', imageKeyword2: null },
      { day: 4, routeText: '시드니 - 인천', imageKeyword: 'Sydney', imageKeyword2: null },
    ]
    const out = enforceRegisterScheduleTripUniqueImageKeywords(rows as any)
    const middles = out.filter((r) => Number(r.day) === 2 || Number(r.day) === 3)
    const keys = middles.map((r) => normScheduleImageKeywordKey(String(r.imageKeyword ?? '')))
    expect(keys[0]).toBeTruthy()
    expect(keys[1]).toBeTruthy()
    expect(keys[0]).not.toBe(keys[1])
  })

  // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: usedKeyword≠day-route pack unlock — manifest
  it('Istanbul usedKeyword on Mykonos day does not unlock Anitkabir', () => {
    const used = new Set([
      normScheduleImageKeywordKey('Mykonos windmills'),
      normScheduleImageKeywordKey('Mykonos Chora white houses'),
      normScheduleImageKeywordKey('Paradise Beach Mykonos'),
      normScheduleImageKeywordKey('Delos Island Greece'),
      normScheduleImageKeywordKey('Istanbul'),
    ])
    const next = pickUnusedRegisterScheduleCitySoftAltKeyword(used, {
      routeText: '아테네 - 미코노스',
      usedKeyword: 'Istanbul',
    })
    expect(String(next ?? '')).not.toMatch(/Anitkabir|Cappadocia|Pamukkale|Hagia|Blue Mosque/i)
  })

  it('Laura Village usedKeyword on Yellowknife day does not unlock Bondi', () => {
    const used = new Set([normScheduleImageKeywordKey('Laura Village Blue Mountains')])
    const next = pickUnusedRegisterScheduleCitySoftAltKeyword(used, {
      routeText: '올드타운 - 오로라 빌리지',
      usedKeyword: 'Laura Village Blue Mountains',
    })
    expect(String(next ?? '')).not.toMatch(/Bondi|Sydney Opera|Harbour Bridge|Taronga/i)
  })

  // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: Lisbon≠Porto soft-alt bleed — manifest
  it('Lisbon day soft-alt pack does not unlock Porto Ribeira', () => {
    const lisbon = collectRegisterScheduleCitySoftAltKeywords('리스본 벨렝')
    expect(lisbon.some((a) => /Porto Ribeira|Clerigos Tower Porto|Dom Luis/i.test(a))).toBe(false)
    expect(lisbon.some((a) => /Belem|Jeronimos|Commerce|Tram|Alfama/i.test(a))).toBe(true)
    const used = new Set(lisbon.map((a) => normScheduleImageKeywordKey(a)))
    const next = pickUnusedRegisterScheduleCitySoftAltKeyword(used, {
      routeText: '벨렝 - 제로니모스 - 코메르시우 광장 - 리스본',
      usedKeyword: 'Belem Tower Lisbon',
    })
    expect(String(next ?? '')).not.toMatch(/Porto Ribeira|Clerigos|Sao Bento|Dom Luis/i)
  })

  // REGRESSION-FREEZE[register-schedule-city-soft-alt-empty-middle]: HK soft-alt must pass landmark guard — manifest
  it('Hong Kong soft-alt pack has no lodging/non-landmark strings', () => {
    const alts = collectRegisterScheduleCitySoftAltKeywords('홍콩 침사추이')
    expect(alts.length).toBeGreaterThanOrEqual(4)
    for (const a of alts) {
      expect(isBrokenRegisterLandmarkKeyword(a), a).toBe(false)
    }
    expect(alts.some((a) => /Ngong Ping|Symphony of Lights|Star Ferry/i.test(a))).toBe(false)
  })

  // REGRESSION-FREEZE[register-schedule-city-soft-alt-empty-middle]: Dubai bare day soft-alt pack — manifest
  it('Dubai bare day soft-alt pack yields unused landmarks', () => {
    const alts = collectRegisterScheduleCitySoftAltKeywords('두바이')
    expect(alts.length).toBeGreaterThanOrEqual(4)
    expect(alts.some((a) => /Marina|Frame|Miracle|Burj|Palm|Fountain|JBR|Fahidi/i.test(a))).toBe(true)
    const used = new Set([normScheduleImageKeywordKey(alts[0]!)])
    const next = pickUnusedRegisterScheduleCitySoftAltKeyword(used, {
      routeText: '두바이',
      usedKeyword: alts[0],
    })
    expect(next).toBeTruthy()
    expect(normScheduleImageKeywordKey(next)).not.toBe(normScheduleImageKeywordKey(alts[0]!))
  })

  it('Helsinki and Madrid packs exist for empty-middle fill', () => {
    expect(collectRegisterScheduleCitySoftAltKeywords('헬싱키').length).toBeGreaterThanOrEqual(3)
    expect(collectRegisterScheduleCitySoftAltKeywords('마드리드').length).toBeGreaterThanOrEqual(3)
    expect(collectRegisterScheduleCitySoftAltKeywords('싱가포르').length).toBeGreaterThanOrEqual(3)
  })

  it('Yellowknife schedule does not get Bondi after Laura Village soft-alt attempt', () => {
    const rows = [
      { day: 1, routeText: '인천 - 옐로나이프', imageKeyword: 'Yellowknife', imageKeyword2: null },
      {
        day: 2,
        routeText: '올드타운 - 오로라 빌리지',
        imageKeyword: 'Laura Village Blue Mountains',
        imageKeyword2: null,
      },
      {
        day: 3,
        routeText: '오로라 헌팅',
        imageKeyword: 'Prince of Wales Northern Heritage Centre',
        imageKeyword2: null,
      },
      { day: 4, routeText: '옐로나이프 - 인천', imageKeyword: 'Yellowknife', imageKeyword2: null },
    ]
    const out = enforceRegisterScheduleTripUniqueImageKeywords(rows as any)
    for (const r of out) {
      for (const slot of [r.imageKeyword, r.imageKeyword2]) {
        expect(String(slot ?? '')).not.toMatch(/Bondi Beach/i)
        expect(String(slot ?? '')).not.toMatch(/Laura Village/i)
      }
    }
  })

  it('오로라 빌리지 route landmarks are Aurora not Laura', async () => {
    const { collectRouteTextOrderedLandmarkKeywords } = await import(
      '@/lib/register-schedule-route-text-image-keyword-ssot'
    )
    const kws = collectRouteTextOrderedLandmarkKeywords('올드타운 - 오로라 빌리지')
    expect(kws.some((k) => /Laura Village/i.test(k))).toBe(false)
    expect(kws.some((k) => /Aurora|Northern Lights|Yellowknife/i.test(k))).toBe(true)
  })

  it('Phu Quoc Grand World pack has multiple alts', () => {
    const alts = collectRegisterScheduleCitySoftAltKeywords('푸꾸옥 그랜드월드 모벤픽')
    expect(alts.length).toBeGreaterThanOrEqual(3)
    expect(alts.some((a) => /Grand\s*World|Sao\s*Beach|Safari/i.test(a))).toBe(true)
  })
})
